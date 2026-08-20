# Cloud deployment

The plan for running `draw` on Google Cloud.

**Status:** design, not implemented.\
Nothing in this document has shipped, and the sections marked OPEN are still being decided.

This exists because the deployment changes assumptions the code currently rests on, and those assumptions should be argued in one place before any of them are edited.

---

## Decided

| Axis | Decision |
|---|---|
| Compute | Cloud Run, one container, `min=1`, `max=1` |
| Request timeout | 3600s, for long-lived websockets |
| Storage | GCS, through a custom lightweight adapter |
| Adapter style | raw `fetch`, no added dependency |
| Identity | IAP, Google SSO, no application-side user model yet |
| Object versioning | off to begin with |
| Tenancy | shared workspace; one user today |

---

## Why one instance

Three pieces of state live in the process, and that is the design rather than an oversight.

| Component | State it holds | What a second instance does |
|---|---|---|
| `Store` | model in memory, writes throttled | last writer takes the whole file, log and inverses with it |
| `Hub` | the set of live websocket sessions | viewers on B never see a change made on A |
| `Locks` | the lock table | two controllers each believe they hold it |

`SCOPE.md` puts multi-user editing out of scope, so the single-writer model is deliberate.\
The deployment question is therefore narrow: run exactly one instance, durably, and expose it safely.

`min=1` is what keeps that true across idle periods.\
It costs a permanently running instance, and it buys live viewers and held locks surviving quiet spells.

---

## Storage: why an adapter rather than a mount

Cloud Run can mount a bucket directly, and that would need no code change at all.\
It is rejected for one specific reason.

The store writes `writeFileSync(tmp)` then `renameSync(tmp, file)`, and that rename is where atomicity comes from.\
The mount is `gcsfuse`, which has no atomic rename: it copies and then deletes.\
So the property the durability model rests on is exactly the property the mount cannot provide, and the README's claim that a write is "atomic against a dying process" would quietly become false.

`[A]` This is a claim about `gcsfuse` behaviour, not something measured here.\
**B6** requires it to be confirmed against a real bucket before anything relies on it, and that confirmation has not been done.

A native adapter avoids the question rather than answering it.\
A GCS object write is a single `PUT`, which is atomic by construction, so neither rename nor `fsync` remains load-bearing.

### The seam already exists

`D19` built it: `new Store(dataDir, { writeDoc })`.\
The adapter replaces one function, and local development keeps the file implementation as a peer rather than losing it.

### Why not the SDK

Measured, not assumed: `@google-cloud/storage` is 60 packages and 18MB, against a project that ships one runtime dependency and 212KB.

The operation set is four verbs -- get an object, put an object, list a prefix, delete an object.\
Documents are small JSON, so there are no resumable uploads, no streaming and no signed URLs.\
Authentication on Cloud Run is one metadata-server call, cached until expiry, and `server/slides/auth.js` already establishes that pattern against Google over raw `fetch`.

The one real argument for the SDK is retry and backoff on `429` and `503`, which is roughly fifteen lines to do properly.\
If those fifteen lines turn out badly, the `D19` seam makes swapping to the SDK a one-file change.

### Compare-and-swap

`ifGenerationMatch` on the `PUT` gives a compare-and-swap against the object generation.\
That is the same shape as the existing `expect` precondition on the wire, so the concept is already in the system.

It matters because it turns **D34** -- two revisions overlapping during a deploy, the loser silently taking the whole file -- from an accepted silent hazard into a detectable `412`.

---

## Identity

IAP in front, Google SSO, and no application-side user model in this phase.

IAP supplies `X-Goog-Authenticated-User-Email` on every request, which is the identity to build on when workspaces arrive.\
It is deliberately not being consumed yet.

The application has no user concept at all today: `server/rest.js:377` states outright that this is a single-tenant tool, and no owner, tenant or user id exists in the document model, the store, the protocol or the REST plane.\
Diagram ids are global and `list()` returns everything to everyone.

So IAP authenticates people and then hands all of them the same shared workspace.\
That is acceptable while there is one user, and it is the reason workspaces are a design task rather than a configuration setting.

---

## Deferred, deliberately

### Workspaces

Each user mapped to their own workspace by default, with an invite code granting others view access.\
Designed after the deployment is running, against something real.

### Lazy loading

`Store.init` lists the data directory and parses every diagram it finds.\
Against a bucket that is a list plus one get per diagram on cold start, and every user's data resident in one process.\
It is fine for one user, and it has to change before workspaces can isolate anything.

### Object versioning

Off to begin with.

---

## Open

### Write cadence

`markDirty` is a throttle rather than a debounce: the first dirty mark starts a 200ms timer and later marks do not reset it, so sustained editing writes every 200ms.\
Each write serialises the whole document, and the change log lives in the same file, so the object grows with history.\
Against object storage that is a network `PUT` per 200ms of continuous editing.\
Changing it touches the file format, which `docfile.mjs` owns.

### Conflict handling

Nothing today handles the object having moved underneath a write.\
With one instance it cannot happen; with `min=1` and an overlapping deploy it can.\
Open question: does a `412` refetch and replay, or refuse and surface?

### First-boot seeding

`Store.init` seeds the example corpus when the data directory is empty, which against a bucket means a list returning nothing and eleven puts on a cold bucket.\
Open question: should a fresh cloud deployment seed at all, or start genuinely empty?

### Domain, certificates, load balancer, project

Constraints not yet captured.

---

## Findings this plan surfaced

### B6 has fired

Its recorded revival trigger is *any multi-instance or GCS-backed deployment*, and this is one.\
The adapter is what answers it: durability becomes the object store's rather than an absent `fsync`.

### The Slides refresh token has nowhere to live

`server/slides/auth.js:22` writes it to `<secretsDir>/google-token.json` at runtime, and the Cloud Run filesystem is ephemeral, so every deploy loses it and the next push demands re-authorization.\
The credentials file is fine because it can be mounted read-only from Secret Manager; it is the written token that has no home.\
Simplest resolution is to keep it in the same bucket the adapter already talks to.

Both need backlog rows before implementation begins.
