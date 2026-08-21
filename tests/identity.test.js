/*
H9.2 -- the authentication boundary.

Signed with a locally generated P-256 key rather than a captured IAP token, so the negative cases
can actually be constructed. A test that only proves a good token is accepted proves very little:
the whole value of this module is what it REFUSES, and every rejection here is a way in if it were
missing.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { iapIdentity } from '../server/identity.mjs';

const AUD = '/projects/531843488473/global/backendServices/3078630696779732675';
const ISS = 'https://cloud.google.com/iap';
const KID = 'test-kid';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256', use: 'sig' };
const keys = async (kid) => (kid === KID ? JWK : null);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function sign(claims, { alg = 'ES256', kid = KID, key = privateKey, tamper = false } = {}) {
	const body = `${b64({ alg, kid, typ: 'JWT' })}.${b64(claims)}`;
	const sig = crypto.sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' });
	if (tamper) sig[0] ^= 0xff;
	return `${body}.${sig.toString('base64url')}`;
}

const NOW = 1_800_000_000_000;
const now = () => NOW;
const t = Math.floor(NOW / 1000);
const good = { iss: ISS, aud: AUD, email: 'someone@example.com', exp: t + 600, iat: t - 10 };
const id = (opts = {}) => iapIdentity({ audience: AUD, keys, now, ...opts });

test('H9.2: a valid assertion yields a namespaced principal', async () => {
	const principal = await id()({ 'x-goog-iap-jwt-assertion': sign(good) });
	assert.equal(principal, 'user:someone@example.com',
		'the email becomes a principal, prefixed so it can never be confused with a code');
});

test('H9.2: no assertion is no principal, not an error', async () => {
	const p = id();
	assert.equal(await p({}), null, 'an unauthenticated request is ordinary, not an outage');
	assert.equal(await p({ 'x-goog-iap-jwt-assertion': '' }), null);
	assert.equal(await p({ 'x-goog-iap-jwt-assertion': 'not.a.jwt' }), null);
	assert.equal(await p({ 'x-goog-iap-jwt-assertion': 'onlyonepart' }), null);
});

test('H9.2: a tampered signature is refused', async () => {
	assert.equal(await id()({ 'x-goog-iap-jwt-assertion': sign(good, { tamper: true }) }), null);
});

test('H9.2: a token signed by a DIFFERENT key is refused', async () => {
	const other = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
	assert.equal(await id()({ 'x-goog-iap-jwt-assertion': sign(good, { key: other }) }), null,
		'anyone can mint a keypair — only Google\u2019s may sign this');
});

/*
The algorithm must be pinned, not read off the token.

"alg: none" and "hand me an HMAC where an ECDSA key was expected" are the two canonical JWT
forgeries, and both work by letting the attacker choose how their token gets checked.
*/
test('H9.2: the algorithm is pinned — alg:none and a swapped alg are refused', async () => {
	const header = b64({ alg: 'none', kid: KID, typ: 'JWT' });
	assert.equal(await id()({ 'x-goog-iap-jwt-assertion': `${header}.${b64(good)}.` }), null,
		'alg:none must never be honoured');
	assert.equal(await id()({ 'x-goog-iap-jwt-assertion': sign(good, { alg: 'HS256' }) }), null,
		'the token does not get to choose how it is verified');
});

test('H9.2: an unknown key id is refused', async () => {
	assert.equal(await id()({ 'x-goog-iap-jwt-assertion': sign(good, { kid: 'not-a-real-kid' }) }), null);
});

/*
The audience is what stops a VALID Google token for some other service being replayed here.

Without it, an assertion minted for any other IAP-protected backend in any project verifies
perfectly well against the same public keys.
*/
test('H9.2: a token for another audience is refused', async () => {
	const elsewhere = { ...good, aud: '/projects/999/global/backendServices/1' };
	assert.equal(await id()({ 'x-goog-iap-jwt-assertion': sign(elsewhere) }), null,
		'a genuine token for another service must not open this one');
});

test('H9.2: a wrong issuer is refused', async () => {
	assert.equal(await id()({ 'x-goog-iap-jwt-assertion': sign({ ...good, iss: 'https://evil.example' }) }), null);
});

test('H9.2: expiry is enforced, with a small tolerance for clock skew', async () => {
	const p = id();
	assert.equal(await p({ 'x-goog-iap-jwt-assertion': sign({ ...good, exp: t - 3600 }) }), null,
		'long expired');
	assert.equal(await p({ 'x-goog-iap-jwt-assertion': sign({ ...good, exp: t - 5 }) }), 'user:someone@example.com',
		'just expired is tolerated — clocks disagree by seconds');
	assert.equal(await p({ 'x-goog-iap-jwt-assertion': sign({ ...good, iat: t + 3600 }) }), null,
		'issued far in the future is not plausible');
	assert.equal(await p({ 'x-goog-iap-jwt-assertion': sign({ ...good, exp: 'soon' }) }), null,
		'a non-numeric exp is not an expiry');
});

test('H9.2: a token with no email proves nothing about who is asking', async () => {
	const { email, ...noEmail } = good;
	assert.equal(await id()({ 'x-goog-iap-jwt-assertion': sign(noEmail) }), null);
});

/*
The convenience header is a cross-check and cannot change the answer.
*/
test('H9.2: the email header cannot override the signature, and a mismatch is reported', async () => {
	const seen = [];
	const p = id({ onMismatch: (m) => seen.push(m) });

	const principal = await p({
		'x-goog-iap-jwt-assertion': sign(good),
		'x-goog-authenticated-user-email': 'accounts.google.com:attacker@evil.example',
	});
	assert.equal(principal, 'user:someone@example.com', 'the signature decides, not the header');
	assert.deepEqual(seen, [{ signed: 'someone@example.com', header: 'attacker@evil.example' }],
		'and the disagreement is audible — something upstream is not what we think it is');

	seen.length = 0;
	await p({
		'x-goog-iap-jwt-assertion': sign(good),
		'x-goog-authenticated-user-email': 'accounts.google.com:someone@example.com',
	});
	assert.deepEqual(seen, [], 'the prefix is stripped before comparing, so agreement is silent');
});

test('H9.2: the header alone, with no assertion, is worth nothing', async () => {
	assert.equal(await id()({ 'x-goog-authenticated-user-email': 'accounts.google.com:someone@example.com' }), null,
		'this is exactly the forgery the JWT requirement exists to prevent');
});

/*
H9.8 -- the sign-in gate.

The allowlist is the one control whose job is to decide who becomes a principal at all, so it is
composed into `principalOf` rather than checked alongside it: a refused domain returns null and
every downstream caller already treats null as anonymous. Nothing here passes a header to the
gate, because the gate cannot reach one (B66).
*/
import { domainGate } from '../server/identity.mjs';

const fixed = (p) => async () => p;

test('H9.8: an allowed domain passes and a stranger becomes nobody', async () => {
	const gate = domainGate(fixed('user:a@apnex.com.au'), ['apnex.com.au']);
	assert.equal(await gate({}), 'user:a@apnex.com.au');
	const out = domainGate(fixed('user:a@example.com'), ['apnex.com.au']);
	assert.equal(await out({}), null, 'refused resolves to null, not to a principal with less power');
});

test('H9.8: the match is exact, so a lookalike domain is refused', async () => {
	// endsWith('apnex.com.au') is TRUE of notapnex.com.au, which anyone can register. This is the
	// entire reason the check is a Set lookup on the label rather than a suffix test.
	for (const bad of ['notapnex.com.au', 'apnex.com.au.evil.com', 'x-apnex.com.au']) {
		const gate = domainGate(fixed(`user:a@${bad}`), ['apnex.com.au']);
		assert.equal(await gate({}), null, `${bad} must not satisfy apnex.com.au`);
	}
	// and a subdomain is a different domain, not a member of the parent
	const sub = domainGate(fixed('user:a@mail.apnex.com.au'), ['apnex.com.au']);
	assert.equal(await sub({}), null, 'a subdomain is not the domain');
});

test('H9.8: the domain compares case-insensitively, the local part is left alone', async () => {
	const gate = domainGate(fixed('user:A.Person@APNEX.com.AU'), ['apnex.com.au']);
	assert.equal(await gate({}), 'user:A.Person@APNEX.com.AU',
		'admitted on a case-folded domain, and returned verbatim — the principal is an identity key');
});

test('H9.8: an empty allowlist restricts nothing, and never invents a principal', async () => {
	const gate = domainGate(fixed('user:anyone@gmail.com'), []);
	assert.equal(await gate({}), 'user:anyone@gmail.com', 'unset means no domain restriction');
	assert.equal(await domainGate(fixed(null), [])({}), null, 'and anonymous stays anonymous');
	assert.equal(await domainGate(fixed(null), ['apnex.com.au'])({}), null,
		'a failed verification is not rescued by an allowlist');
});

test('H9.8: a code principal carries no domain and is not judged on one', async () => {
	// refusing `code:` here would be a domain rule deciding something that is not a domain
	// question; codes authenticate by another route with its own gate (H9.5/9.6)
	const gate = domainGate(fixed('code:abc123'), ['apnex.com.au']);
	assert.equal(await gate({}), 'code:abc123');
	const weird = domainGate(fixed('user:no-at-sign'), ['apnex.com.au']);
	assert.equal(await weird({}), null, 'but a user principal with no domain at all is refused');
});

test('H9.8: multiple domains, and a comma-separated string, both work', async () => {
	const list = domainGate(fixed('user:a@gmail.com'), ['apnex.com.au', 'gmail.com']);
	assert.equal(await list({}), 'user:a@gmail.com');
	// server.js splits the env var, but accepting the raw string keeps one behaviour not two
	const str = domainGate(fixed('user:a@gmail.com'), ' apnex.com.au , gmail.com ');
	assert.equal(await str({}), 'user:a@gmail.com', 'whitespace and a bare string are tolerated');
});

/*
B68 -- a refusal that names itself.

Nine paths returned a bare null, so a misconfigured audience and an absent header were the same
observable event. These assert the reason rather than only the null, because the null was never
the part that was broken.
*/
test('B68: each refusal reports a distinct reason, and the success case reports too', async () => {
	const seen = [];
	const aud = '/projects/1/global/backendServices/2';
	const id = iapIdentity({ audience: aud, keys: async () => null, onRefuse: (r, d) => seen.push([r, d]) });

	assert.equal(await id({}), null);
	assert.equal(await id({ 'x-goog-iap-jwt-assertion': 'a.b' }), null);
	assert.equal(await id({ 'x-goog-iap-jwt-assertion': 'not.valid.b64' }), null);
	assert.deepEqual(seen.map((s) => s[0]), ['no-assertion-header', 'malformed-jws', 'unparseable-jws'],
		'three different causes, three different names');
});

test('B68: a wrong audience says so, and says both sides', async () => {
	const seen = [];
	const head = Buffer.from(JSON.stringify({ alg: 'ES256', kid: 'k' })).toString('base64url');
	const claims = Buffer.from(JSON.stringify({
		iss: 'https://cloud.google.com/iap', aud: '/projects/1/global/backendServices/WRONG',
		email: 'a@b.co', exp: Math.floor(Date.now() / 1000) + 600,
	})).toString('base64url');
	// verification is stubbed to succeed so the audience check is what the test reaches
	const id = iapIdentity({
		audience: '/projects/1/global/backendServices/RIGHT',
		keys: async () => ({ kty: 'EC' }), onRefuse: (r, d) => seen.push([r, d]),
	});
	const realVerify = crypto.verify;
	crypto.createPublicKey = () => ({});
	crypto.verify = () => true;
	try {
		assert.equal(await id({ 'x-goog-iap-jwt-assertion': `${head}.${claims}.sig` }), null);
	} finally { crypto.verify = realVerify; }
	assert.equal(seen[0][0], 'wrong-audience', 'the single most likely misconfiguration is named');
	assert.match(seen[0][1], /got .*WRONG want .*RIGHT/, 'and both sides are reported, or it is unactionable');
});
