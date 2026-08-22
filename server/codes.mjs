#!/usr/bin/env node
/*
Connection codes -- H9.5. The CREDENTIAL half of the identity split (H9.4b).

A code is not a principal. It authenticates as an `agent:<name>`, may be rotated or revoked without
touching that identity, and several may exist at once so a rotation needs no downtime. Everything
an agent owns survives the code it happened to arrive with.

Sovereign on purpose: generation, formatting and hashing know nothing about the store, so the
alphabet and the entropy can be tested directly rather than through a persistence layer.
*/
import crypto from 'node:crypto';

/*
Crockford base32, chosen rather than inherited. It omits I, L, O and U: no confusion between 1, l
and I, none between 0 and O, and it cannot accidentally spell anything unfortunate. Decoding is
case-insensitive and folds the shapes a human is likely to mistype.
*/
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LENGTH = 16;                                    // 5 bits per character -- 80 bits

/*
No rejection sampling, and that is a property of the numbers rather than an oversight: 32 divides
256 exactly, so masking a uniform byte to its low five bits is itself uniform. A modulo against an
alphabet whose size did not divide 256 would skew toward its first characters.
*/
export function mintCode() {
	const bytes = crypto.randomBytes(LENGTH);
	let out = '';
	for (const b of bytes) out += ALPHABET[b & 31];
	return out;
}

// cosmetic only -- the hyphens are for transcription and are stripped before anything is compared
export function formatCode(code) {
	return String(code).match(/.{1,4}/g)?.join('-') ?? '';
}

/*
Fold what a human is likely to type back to what was minted. Crockford reads O as 0, and I and L as
1, which is the whole point of excluding them from the alphabet. Hyphens and spaces go, because the
grouping is display and a caller should be able to paste either form.
*/
// Internal to `hashCode`, and not exported: nothing outside needs to fold a code, and the property
// that matters -- a plausibly mistyped code still authenticates -- is observable through the hash.
function normaliseCode(input) {
	return String(input || '').toUpperCase().replace(/[\s-]/g, '')
		.replace(/O/g, '0').replace(/[IL]/g, '1');
}

/*
A fast hash, deliberately. Slow key derivation exists to defend LOW-ENTROPY secrets -- it buys time
against guessing a password a human chose. There is nothing to guess here: 80 bits from a CSPRNG
is not reachable offline, so the cost of bcrypt or argon2 would be paid on every request to defend
against an attack that does not apply. ACCESS.md reasons this out at length and the conclusion is
length-specific: it inverts for shorter codes, so shortening one without revisiting this is a
mistake the comment exists to prevent.
*/
export function hashCode(code) {
	return crypto.createHash('sha256').update(normaliseCode(code)).digest('hex');
}

/*
A shape check belongs with the verifier that needs one, and the verifier is H9.6. It was written
here first, had no caller, and scan-dead refused it -- correctly. Adding it back is a line, and
adding it with its consumer is how the surface stays honest.
*/
