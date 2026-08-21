# Access control

Who may read and write which diagram, and how they prove it.

**Status:** design, not implemented.\
Nothing here has shipped.\
The sections marked OPEN are still being decided.

This exists because two workflows that sound similar need different machinery, and both are blocked on the same absent thing.\
Sharing one diagram with a person, and handing a code to an agent, differ in how the caller authenticates and agree in what the server must then decide.\
Arguing that in one place is cheaper than discovering it twice.

---

## Decided

| Axis | Decision |
|---|---|
| Granularity | per diagram; collection or project scope deferred |
| Levels | `read` and `write` |
| Where the ACL lives | `meta`, as server-recorded status, never a commit |
| Principals | a Google identity from IAP, or a connection code -- the same kind of thing |
| Level lives on | the grant, not the principal |
| Code shape | 14-16 characters, Crockford base32, from `crypto.randomBytes` |
| Code at rest | hashed; the plaintext is shown once at mint and never again |
| Code transport | `Authorization: Bearer`, never a query parameter |
| Code expiry | optional |
| Code surface | REST only for now; no websocket |
| Route | path prefix `/connect/v1`, outside IAP |
| Locks | principal-scoped and ACL-gated, enforced server-side |
| Compatibility | breaking changes are allowed; nothing is aliased for the old shape |

---

## The constraint that shapes everything

IAP is an edge gate, and its grants are all-or-nothing.\
`roles/iap.httpsResourceAccessor` admits a principal to the *backend service*, which is the whole application, and there is no expression in IAP for "this one diagram".

So the moment an outside person is admitted at all, IAP has finished its work, and today they would see everything: `store.js:231` returns every diagram from `list()` to every caller, and no `owner`, `tenant`, `acl` or `userId` exists anywhere in the schema, the store, the protocol or the REST plane.\
`rest.js:377` says so outright -- *"this is a single-tenant tool"*.

IAP answers **who are you**.\
Nothing currently answers **what may you touch**, and that is the substrate both workflows need.

A second consequence follows immediately and is easy to miss.\
A connection code presented to a path behind IAP is rejected at the edge, so the application never sees the header and cannot honour it.\
Token authentication is therefore not a feature that can be added to the existing API -- it requires a route IAP does not guard.

---

## Two authentication methods, one authorization model

A **principal** is whoever is asking.\
It is either a Google identity established by IAP, or a connection code presented as a bearer token.\
The application currently ignores IAP's identity entirely, which is a deliberate deferral rather than an oversight, and this is what ends it.

The identity comes from the signed assertion, not from the convenience header, and the distinction is not pedantic.\
IAP sends `X-Goog-Authenticated-User-Email`, but Google states plainly that *"you shouldn't rely on them as a security mechanism"* and that an application *"must validate every request by checking the `x-goog-iap-jwt-assertion` HTTP request header"*.\
Today nothing can reach this service except through IAP -- ingress is load-balancer-only and `run.invoker` is held solely by the IAP service agent -- but that is a configuration invariant rather than a cryptographic one.\
Widening ingress once, or broadening the invoker binding, silently converts a trusted header into a forgeable claim, and nothing would fail visibly at the moment it happened.

So the JWT is the source of truth, verified against Google's public keys with the audience `/projects/531843488473/global/backendServices/<service-id>`.\
The keys are public and the audience is a string, so this needs no secret and no SDK.\
The email header is then a cross-check rather than an input, which is exactly the role Google assigns it.

One format detail that would otherwise be found by a failing lookup rather than by reading: the header value carries a namespace prefix, `accounts.google.com:someone@example.com`, so it is not a bare address.\
A principal is `user:someone@example.com`, so the prefix is stripped rather than passed through.

### One boundary, and everything past it deals in principals

Both authentication methods resolve in a single function, which takes a request and returns a principal string or nothing.\
A verified IAP assertion becomes `user:<email>`; a bearer connection code becomes `code:<id>`; anything else is nobody.\
Past that function **nothing knows IAP exists**, and no handler reads a header.

That containment is doing three separate jobs, which is why it is a decision rather than tidiness.

It is what makes the two methods converge rather than run in parallel.\
Two paths that each derive their own principal are two paths that must be kept agreeing, and the day they disagree is the day one of them is wrong about who is asking.

It contains a vendor coupling.\
These are Google's headers, not a web standard -- `RFC 6648` deprecated the `X-` prefix convention for new headers in 2012 and Google uses it anyway -- so they are a contract that can change, and changing one place is the difference between a rename and an audit.

And it makes three silent failures testable in one place rather than three.\
Every trap on this header fails quietly rather than loudly, which is the worst property an authentication input can have:

| Trap | What happens if missed |
|---|---|
| Node lowercases every key in `req.headers` | `req.headers['X-Goog-Authenticated-User-Email']` is `undefined`, with no error -- the request reads as anonymous |
| The value is prefixed `accounts.google.com:` | the principal never matches a grant, so access is denied for a reason nothing reports |
| The email header is not trustworthy on its own | a forged header is believed, if anything ever reaches the service without passing IAP |

**Header names are written lowercase everywhere in this codebase**, because that is what Node presents and therefore the only spelling that works.\
Google's documentation writes `X-Goog-Authenticated-User-Email` in prose and `x-goog-iap-jwt-assertion` in the same table, which is a good indication that the casing carries no meaning.\
Anyone matching the documented mixed case gets `undefined` rather than an error, so the convention is recorded here to stop it being helpfully corrected later.

A **grant** is `(principal, diagram) -> read | write`.

Keeping the level on the grant rather than on the principal is the decision most likely to be revisited, so the reasoning is recorded rather than assumed.\
The grant table must exist regardless, because one person may legitimately hold `read` on one diagram and `write` on another.\
Putting a level on the code as well would create a second authorization mechanism that has to agree with the first, and one access check with a branch in it -- which is where the bug would eventually be.

The cost is that a code's powers are not evident from the code itself, and must be looked up.\
That is a display problem, answered by showing a code's grants wherever the code is shown, and it is a smaller problem than two mechanisms drifting.

A refinement was considered and deferred: the code could carry a **ceiling**, with effective permission `min(ceiling, grant)`, so that "this is a read-only code" is durable against a mis-click in the grant UI.\
It costs one field and is painful to retrofit, which is the argument for it; it is more than the first version needs, which is the argument against.

---

## Where the ACL lives, and why it is not a commit

In `meta`, written the way `bindSlides` writes -- `store.js:321` assigns to `model.state.meta.slides` and calls `markDirty(id)`, deliberately bypassing `commit()`.\
`server.test.js:284` pins the category: *"the Slides binding is STATUS the server records -- not a change, and not the client's to send"*.

The reason this matters for an ACL is sharper than symmetry.\
`store.js:359` flushes `serialize(model.toJSON(), entry.log)`, the document **and** the log, on every write.\
An ACL change routed through `commit()` would therefore be undoable -- and undo silently restoring access for someone just revoked is a security failure, not a usability quirk.\
Bypassing `commit()` avoids it by construction rather than by a rule someone has to remember.

An ACL is not a secret, which is what makes `meta` an acceptable home: knowing *who* has access is not the same as *having* access.\
A connection code is the opposite, and this is the trap the same mechanism sets.\
Anything written into the model is retained in the log permanently, survives deletion of the entity that carried it, and is carried into `/d/<id>.svg`.\
So a code must never enter the document at any point, not even briefly.

---

## Read-only already exists

The client has a complete read-only mode.\
`input.js:370` declares `this.readOnly = false; // Server-Locked: inspect + select only, no mutations`, with `setReadOnly()` at `:437`, and six tests pin what it suppresses -- mutation keys, arming, the label editor, the text tool -- and what it preserves, which is selection, datum and the readout.

That gives three representations rather than two, and the middle one is the useful one:

| Representation | What the viewer gets |
|---|---|
| `/d/<id>.svg` | a static snapshot, with no live updates, selection or inspection |
| editor, Server-Locked | live, selectable, measurable, inspectable, and unable to mutate |
| editor, unlocked | read-write |

So `read` costs an access check rather than a feature.

A URL suffix is a representation and not a permission, and the distinction is load-bearing.\
If `.svg` decided access, read-only would be bypassed by deleting four characters from the address bar.\
The ACL decides; the suffix only selects what is served to a principal already permitted.

Server-Locked is client-side suppression, which for an untrusted principal is decoration.\
A hand-written request bypasses it entirely, so `read` must be refused **server-side** on every mutating path, with Server-Locked as the interface honestly reflecting a decision the server has already made.

---

## Connection codes

### Shape

Short, human-transcribable, and shaped like an invite code: 14-16 characters of Crockford base32, displayed as `XXXX-XXXX-XXXX-XXXX` with the hyphens purely cosmetic.\
That alphabet is chosen rather than inherited -- it omits `I`, `L`, `O` and `U`, so there is no confusion between `1`, `l` and `I` or between `0` and `O`, it cannot accidentally spell anything unfortunate, and it decodes case-insensitively with `O` read as `0`.

### Why short codes are safe here, and what would make them unsafe

At five bits per character, 14 characters is 70 bits and 16 is 80.

| Length | Entropy | Online guessing at 10k/s | Offline, if the hash store leaks |
|---|---|---|---|
| 14 | 70 bits | ~3.7 billion years | ~370 years |
| 16 | 80 bits | ~10^12 years | ~370,000 years |

Online guessing is therefore never the threat, which has a consequence worth stating so it is not re-argued: any request throttling added later is denial-of-service protection and must not be described as credential protection.

The binding constraint is offline cracking if the hash store leaks, and both lengths survive it comfortably with a fast hash.\
A slow key-derivation function would buy nothing, because slow hashing exists to defend *low-entropy* secrets and there is nothing here to guess.\
Note that this reasoning is specific to these lengths: at meaningfully shorter codes it inverts, and the KDF starts doing real work.

Two things become load-bearing at this size that would not be at 256 bits.

Generation must use `crypto.randomBytes`, never `Math.random()`.\
A weak generator makes the length irrelevant, and that -- rather than the arithmetic -- is what kills short codes in practice.

The code must not carry a prefix that eats its own budget.\
A `draw_<id>_<secret>` structure inside a 16-character total leaves roughly 45 bits, which is crackable offline in hours.\
Any prefix must be additional to the entropy rather than carved out of it.

### Lookup and storage

A public identifier for direct lookup was considered and rejected as solving a problem this deployment does not have.\
At a few dozen codes the server hashes the presented value and looks it up, which is constant time and needs no prefix.

Codes live outside the document, and outside the diagram files.\
`store.js:25` restricts the store to `/^diagram-[0-9a-f]{6}\.json$/`, so a second object can sit beside them in the bucket without the store trying to parse it as a diagram.\
This is the one genuinely new piece of structure in this design: the store has never persisted a second *kind* of thing, and that is a larger change than adding a field.

### Audit is already present

`txn.mjs:240` writes `{ seq, from, at, by, actor }` into every log record, and the REST path already populates `actor` -- a production write during the H8.4 smoke test recorded `actor: "rest-d82fcefd"`.\
A connection code becomes the actor, and history answers "who did this" with no new machinery.

---

## The lock becomes principal-scoped

`locks.js:8` states the current design outright: *"it is a pure state machine over opaque tokens"*, with `this.map` holding `diagramId -> { token, expiresAt }` and no notion of who the holder is.

Possession of the token is therefore the authority, and that is the hole.\
Corrected 2026-08-21 (H9.4, B63): this said a revoked principal's lock keeps working until its TTL expires.\
The lock does keep working; the consequence does not follow.\
Commit checks the ACL on every call, so a revoked principal's write is refused the moment the grant is dropped whether or not it holds a lock.\
What survives revocation is occupancy of the single write slot, which is a denial of service and not a disclosure.\
The remedy is reclaim, already unconditional for the owner, which is why the lock need not record who holds it and why `locks.js` stays a state machine over opaque tokens.\
Principal-scoping is what makes revocation take effect immediately.

It gates the other end too.\
`acquire(id)` takes no principal and succeeds whenever the lock is free, so a `read` principal could take a write lease today.\
The ACL check belongs on acquire, not only on commit.

The two axes stay separate, and merging them would be a mistake.\
A lock answers *someone else is driving*; an ACL answers *you may not drive*.\
They need different answers on the wire, because `423` is temporary and worth retrying while `403` is not, and an agent that confuses them either spins forever or gives up permanently.

This reverses a stated decision, so it carries a dated amendment.\
`GR10` has a test asserting that every locked decision reversed in an arc is amended rather than quietly changed.

---

## The route

The code-authenticated surface lives at `/connect/v1`, outside IAP, leaving every path the editor uses behind IAP untouched.

A hostname was the alternative and was rejected on a concrete constraint.\
A wildcard certificate covers one label, so `*.apnex.io` covers `draw.apnex.io` but **not** `api.draw.apnex.io`, which would need a new certificate carrying `*.draw.apnex.io`.\
A sibling name such as `draw-api.apnex.io` would be covered, but a path prefix needs no new DNS record, no new certificate and no second backend hostname to reason about.

The name was chosen against the alternatives rather than picked.\
`/link/` is unusable because `link` is a model entity with 61 uses across `validate.js` and `model.mjs`, and the route would be undiscoverable by search.\
`/agent/` is rejected because `agent` already denotes the *calling program* in `rest.js` and `locks.js`, so reusing it conflates the caller with the surface, and it over-narrows -- a person with `curl` uses this path too.\
`/token/` and `/key/` name the mechanism and would age badly the moment authentication changes.\
`/open/` and `/public/` are actively misleading, because the surface is authenticated and merely not by IAP, which is exactly the misconception that would get someone hurt.\
`/share/` names the *other* workflow, which does not live here.

`/connect` matches the vocabulary already in use, collides with nothing, and names the boundary rather than the consumer or the mechanism, so it survives adding a further kind of principal later.

The `v1` is kept, and the argument for it is stronger here than on `/api`.\
`/api/v1` is consumed only by the editor shipped in the same image, so both sides move together and it can be broken freely.\
`/connect/v1` is consumed by third parties who cannot be coordinated with, and versioning matters precisely where nobody can be called.

### The boundary should be structural

The failure mode of this design is a route added under `/connect` without an authorization check, because IAP is not there to catch the omission.\
That is the same shape `scan-writers` already guards for DOM access under `GR17` and for command builders under `GR16`.\
A scanner asserting that every handler under `/connect` performs the grant check would make the boundary enforced rather than remembered.

---

## Who may sign in at all

Authorization decides what a principal reaches; this decides whether they get as far as being one.

The goal is that anyone with a Google account can sign in, and that signing in grants nothing.\
Those two halves must land together.\
Opening sign-in before the grant model exists does not share a diagram -- it publishes the whole store with write access, because `list()` returns everything and `protocol.js:323` gates `delete` only on whether a server-side controller holds the lock.

IAM can express two of the three shapes wanted, and not the third.

| Intent | Mechanism |
|---|---|
| One named person, internal or external | `user:someone@example.com` on `roles/iap.httpsResourceAccessor` |
| Everyone in a domain we own | `domain:apnex.com.au` -- valid only for a Workspace or Cloud Identity domain |
| Only consumer Google accounts | no IAM expression exists |

`domain:gmail.com` is not available, because `domain:` names a customer domain rather than Google's consumer namespace.\
The only IAM member covering arbitrary Google accounts is `allAuthenticatedUsers`, which carries no restriction whatsoever.

So a domain allowlist belongs in the application, checked against the verified principal before any grant lookup.\
Corrected 2026-08-21 (H9.8, B66): this named `X-Goog-Authenticated-User-Email`, which contradicts the assertion rule three sections above and would have read the one value an attacker can set.\
The allowlist is composed into `principalOf` rather than checked beside it, so it inspects only what signature verification already proved and has no access to a header at all.\
Running before the grant lookup is what gives it force: a principal on a domain not on the list is refused even when an explicit grant names it.\
It is per-application rather than org-wide, it can name `gmail.com`, and it composes with grants instead of competing with them.\
The org policy `iam.allowedPolicyMemberDomains` is the alternative and is the wrong tool: it constrains every IAM policy in the project, not this application, and still cannot name a consumer domain.

Added 2026-08-21 (H9.12, B67): reads are gated by `canRead`, the mirror of `canWrite`, on the websocket `hello` and `open`, on the REST document and its log, and on `/d/<id>.svg`.\
Until then only writes, listing, and lock acquisition were checked, and the document itself went to anyone who named an id.\
The gap survived review because `snapshotBody` filters the diagram list three lines below where it returns the document, so an unauthorized payload sat beside an authorized one and read as though it had been checked.\
It surfaced in production as a diagram rendering in the editor while the dropdown that should have listed it was empty.\
`snapshotBody` now refuses rather than trusting its callers, because five callers each had to remember and one did not.

The intended end state is `allAuthenticatedUsers` at the IAP layer with the allowlist and default-deny in the application, so a stranger signs in successfully and sees an empty list.\
An unset allowlist therefore means no domain restriction rather than no access, because the grant model is the primary control and already denies by default.\
`ALLOW_DOMAINS` names the exception, and the server states the policy it resolved at boot rather than leaving an operator to infer it.

---

## Examples become templates, and writing forks

Today the example corpus is copied into the data dir on first boot and becomes real, shared, mutable diagrams.\
Under per-user access that is wrong twice over: the corpus is shared state everyone can edit, and there is no per-user starting point.

Examples become **templates** instead.\
They are read from the image, never written to the store, and listed to every principal.\
The first mutation against a template forks it -- a new diagram, a new id, owned by the caller, seeded from the template's content.

### The amendment this requires

`examples.test.js:73` asserts that deleting an example does not bring it back, recording the reason as *"seeding is FIRST BOOT only -- a re-seeding store would resurrect deleted work forever"*.

The invariant behind that sentence survives intact, and stating it precisely is what makes the reversal safe: **deleted user work never returns**.\
A template is not user work.\
A template reappearing after its fork is deleted is not a resurrection, because the template was never the caller's to delete -- what must remain impossible is the deleted *fork* returning.

So the reversal is narrower than it appears.\
`GR10` requires a dated amendment for a reversed decision, and it belongs in `SCOPE.md` beside the seeding rule rather than here.

### Undecided

Whether a fork shadows its template in the listing, or appears beside it.\
Shadowing reads better -- the diagram is simply yours now -- but it makes the listing a merge of two sources rather than a query over one.

What becomes of the eleven diagrams currently in `gs://diagrams.apnex.io`.\
They are the seeded examples from before this change, so under templates they are orphans with no owner: they are either adopted by the operator or deleted, and the choice should be explicit rather than incidental.

---

## Open

Expiry is optional, and whether a default expiry is offered at mint is undecided.

The persistence format for grants and codes is undecided, beyond living outside the diagram files.

Whether the code carries a ceiling in addition to the grant is deferred rather than rejected.

Whether `/d/<id>.svg` remains reachable without any principal at all is unresolved, and is inherited from `DEPLOY.md` rather than introduced here.

The workflow set is assumed to be the two described.\
If others exist, the grant model is the part most likely to need widening.
