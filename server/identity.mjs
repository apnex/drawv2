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
One line per distinct reason, not per request. A misconfigured audience refuses every request, so
logging each one buries the fact in its own repetition; logging the first announces it.

`console.warn` for severity, not availability: a refused assertion is a warning and should sort
with the other warnings, while the boot summary that states configuration is ordinary output.
An earlier version of this comment claimed stdout is discarded on Cloud Run -- that was false and
is withdrawn as B69; both streams are captured.
*/
function warnOnceRefusal() {
	const seen = new Set();
	return (reason, detail) => {
		if (seen.has(reason)) return;
		seen.add(reason);
		console.warn(`[ identity ] refusing assertions: ${reason}${detail ? ` -- ${detail}` : ''}`);
	};
}

/*
Verify the assertion and return the principal it proves, or null.

Returns null rather than throwing for anything that merely fails to authenticate, because "no
principal" is the ordinary case for an unauthenticated request and a throw would make the caller
treat absence as an outage.
*/
export function iapIdentity({ audience, keys = jwkSource(), now = Date.now, onMismatch = null,
	onRefuse = warnOnceRefusal() } = {}) {
	if (!audience) throw new Error('an audience is required to verify an IAP assertion');

	return async function principalOf(headers = {}) {
		// B68: every refusal names itself. Nine paths used to return a bare null, which made a
		// misconfigured audience and an absent header the same observable event -- a uniform
		// denial with nothing to read. The reason never carries the token or the signature; the
		// values it does carry (audience, issuer, kid) are already public configuration.
		const no = (reason, detail) => { onRefuse(reason, detail); return null; };

		const token = headers['x-goog-iap-jwt-assertion'];
		if (!token || typeof token !== 'string') return no('no-assertion-header');

		const parts = token.split('.');
		if (parts.length !== 3) return no('malformed-jws', `${parts.length} segments`);

		let head, claims;
		try {
			head = b64urlJson(parts[0]);
			claims = b64urlJson(parts[1]);
		} catch { return no('unparseable-jws'); }

		// pinned, not read: accepting the token's own choice of algorithm is how `alg: none` and
		// the RS256-key-as-HMAC-secret confusions work
		if (head.alg !== ALG) return no('unexpected-alg', `${head.alg}, expected ${ALG}`);
		if (!head.kid) return no('no-kid');

		const jwk = await keys(head.kid);
		if (!jwk) return no('unknown-kid', head.kid);

		let ok = false;
		try {
			const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
			// JWS packs ES256 as raw r||s, NOT as the DER envelope Node defaults to. Without
			// ieee-p1363 every signature fails verification and the cause is invisible.
			ok = crypto.verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`),
				{ key, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2], 'base64url'));
		} catch (err) { return no('verify-threw', err.message); }
		if (!ok) return no('bad-signature');

		if (claims.iss !== ISSUER) return no('wrong-issuer', `${claims.iss}`);
		// the single most likely misconfiguration, so it reports both sides
		if (claims.aud !== audience) return no('wrong-audience', `got ${claims.aud} want ${audience}`);

		const t = Math.floor(now() / 1000);
		if (!Number.isFinite(claims.exp) || claims.exp + SKEW_S < t) return no('expired');
		if (Number.isFinite(claims.iat) && claims.iat - SKEW_S > t) return no('issued-in-future');

		const email = typeof claims.email === 'string' ? claims.email : '';
		if (!email) return no('no-email-claim');

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

		const principal = `user:${email}`;
		// and the success case names itself once too: a token that verifies but resolves to a
		// principal other than the expected owner produces no refusal at all, so without this the
		// only symptom is a uniform denial with a valid token behind it
		onRefuse('resolved', principal);
		return principal;
	};
}

/*
The sign-in gate (H9.8). Authorization decides what a principal reaches; this decides whether
they get as far as being one, which is why it wraps `principalOf` rather than sitting beside it:
a refused domain resolves to `null` and every caller downstream already treats that as anonymous.
There is no path by which it could read an unsigned header, because it never sees one (B66) --
it inspects only the principal that verification already proved.

An empty allowlist means no domain restriction, not no access. That is deliberate and is the
documented end state: grants default-deny, so a stranger with no allowlist configured signs in
and sees an empty list. The allowlist narrows who may hold a session at all, which is defence in
depth over the grant model rather than a replacement for it -- if it were the primary control,
an empty value would have to fail closed.
*/
export function domainGate(principalOf, domains = []) {
	const allow = new Set(
		(Array.isArray(domains) ? domains : String(domains).split(','))
			.map((d) => d.trim().toLowerCase()).filter(Boolean),
	);
	if (allow.size === 0) return principalOf;
	return async function principalOfAllowedDomain(headers = {}) {
		const principal = await principalOf(headers);
		if (!principal) return null;
		// only `user:` carries a domain. A `code:` principal authenticates by a different route
		// with its own gate, and silently refusing it here would be a domain rule deciding
		// something that is not a domain question.
		if (!principal.startsWith('user:')) return principal;
		const at = principal.lastIndexOf('@');
		if (at < 0) return null;
		// exact match on the domain label, never a suffix test: `endsWith('apnex.com.au')` is
		// also true of `notapnex.com.au`, which is an attacker-registrable name
		return allow.has(principal.slice(at + 1).toLowerCase()) ? principal : null;
	};
}
