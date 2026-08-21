/*
The authentication boundary -- ACCESS.md.

One function turns a request into a principal, and nothing past it knows IAP exists or reads a
header. That containment is deliberate: two authentication methods deriving their own principals
are two things that must be kept agreeing, and Google's headers are a vendor contract rather than a
standard, so confining them makes a future change a rename instead of an audit.

Identity comes from the SIGNED assertion, never from the convenience header. Google is explicit
that `x-goog-authenticated-user-email` is "available for compatibility" and that you "shouldn't
rely on them as a security mechanism". Today nothing can reach this service except through IAP,
but that is a configuration invariant -- widening ingress once turns a trusted header into a
forgeable claim, with nothing failing visibly at the moment it happens.

Header names are lowercase throughout because that is what Node presents in `req.headers`. Matching
Google's documented mixed case yields `undefined` with no error, which reads as an anonymous
request rather than as a bug.
*/

import crypto from 'node:crypto';

const JWKS_URL = 'https://www.gstatic.com/iap/verify/public_key-jwk';
const ISSUER = 'https://cloud.google.com/iap';
// IAP signs with ES256 only. Pinning it is what stops an `alg` swap being offered to us.
const ALG = 'ES256';
const SKEW_S = 60;

const b64urlJson = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

/*
The JWKS, fetched once and re-fetched only when a key id is unknown.

Keys rotate, so a hard cache would eventually reject every request; re-fetching on a cache miss
follows rotation without polling. The negative case is bounded by `refetchMs` so an unknown `kid` --
which is also what a forged token looks like -- cannot be turned into a fetch per request.
*/
export function jwkSource({ fetch: f = globalThis.fetch, now = Date.now, refetchMs = 60_000 } = {}) {
	let keys = null;
	let lastFetch = 0;
	return async (kid) => {
		if (!keys || (!keys.has(kid) && now() - lastFetch > refetchMs)) {
			const res = await f(JWKS_URL);
			if (!res.ok) throw new Error(`could not fetch IAP signing keys: ${res.status}`);
			const body = await res.json();
			keys = new Map((body.keys || []).map((k) => [k.kid, k]));
			lastFetch = now();
		}
		return keys.get(kid) || null;
	};
}

/*
Verify the assertion and return the principal it proves, or null.

Returns null rather than throwing for anything that merely fails to authenticate, because "no
principal" is the ordinary case for an unauthenticated request and a throw would make the caller
treat absence as an outage.
*/
export function iapIdentity({ audience, keys = jwkSource(), now = Date.now, onMismatch = null } = {}) {
	if (!audience) throw new Error('an audience is required to verify an IAP assertion');

	return async function principalOf(headers = {}) {
		const token = headers['x-goog-iap-jwt-assertion'];
		if (!token || typeof token !== 'string') return null;

		const parts = token.split('.');
		if (parts.length !== 3) return null;

		let head, claims;
		try {
			head = b64urlJson(parts[0]);
			claims = b64urlJson(parts[1]);
		} catch { return null; }

		// pinned, not read: accepting the token's own choice of algorithm is how `alg: none` and
		// the RS256-key-as-HMAC-secret confusions work
		if (head.alg !== ALG || !head.kid) return null;

		const jwk = await keys(head.kid);
		if (!jwk) return null;

		let ok = false;
		try {
			const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
			// JWS packs ES256 as raw r||s, NOT as the DER envelope Node defaults to. Without
			// ieee-p1363 every signature fails verification and the cause is invisible.
			ok = crypto.verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`),
				{ key, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2], 'base64url'));
		} catch { return null; }
		if (!ok) return null;

		if (claims.iss !== ISSUER) return null;
		if (claims.aud !== audience) return null;

		const t = Math.floor(now() / 1000);
		if (!Number.isFinite(claims.exp) || claims.exp + SKEW_S < t) return null;
		if (Number.isFinite(claims.iat) && claims.iat - SKEW_S > t) return null;

		const email = typeof claims.email === 'string' ? claims.email : '';
		if (!email) return null;

		/*
		The convenience header as Google intends it: a cross-check, never an input.

		It carries a namespace prefix, `accounts.google.com:someone@example.com`, so it is compared
		stripped. A disagreement cannot change the answer -- the signature already decided -- but it
		means something upstream is not what we think it is, and that deserves to be audible.
		*/
		const raw = headers['x-goog-authenticated-user-email'];
		if (raw && onMismatch) {
			const claimed = String(raw).replace(/^accounts\.google\.com:/, '');
			if (claimed && claimed !== email) onMismatch({ signed: email, header: claimed });
		}

		return `user:${email}`;
	};
}
