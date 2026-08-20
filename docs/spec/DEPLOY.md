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
| Project | `labops`, number `531843488473` |
| Region | `australia-southeast1`, matching the two services already there |
| Hostname | `draw.apnex.io`, succeeding the 2021 generation |
| Data bucket | `gs://diagrams.apnex.io`, `australia-southeast1` |

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

## The target project, and a name that is not unique

The project id is `labops`.\
There is a SECOND project whose id is `labops-389703` and whose display NAME is also "labops", and it is not the target.\
Both answer to "labops" in conversation, which is exactly the ambiguity that deploys something into the wrong place, so the id is written down rather than the name.

---

## Succeeding draw.apnex.io

`draw.apnex.io` is the address of the 2021 generation, `github.com/apnex/draw`, and drawv2 takes it over.

It is served today by a direct CNAME to `c.storage.googleapis.com`, which is bucket website hosting.\
That pattern has no TLS: the host answers `200` over HTTP and nothing at all over HTTPS.\
So the address has never had a certificate, and succeeding it fixes that rather than preserving it.

Because it was never behind the load balancer, it appears in no url-map, and the migration is an addition to existing infrastructure rather than new infrastructure.

The estate already establishes the shape three times over -- one managed certificate per hostname, all attached to one HTTPS proxy, host rules on one url-map:
```text
fwd-apnex-io (35.201.120.148:443) -> vs-apnex-io -> map-apnex-io
   certs: ssl-apnex-io, ssl-raw-apnex-io, ssl-ois-apnex-io
   hosts: apnex.io, raw.apnex.io, ois.apnex.io
```

| Step | Change |
|---|---|
| 1 | Serverless NEG pointing at the Cloud Run service |
| 2 | Backend service wrapping that NEG, with IAP enabled on it |
| 3 | `ssl-draw-apnex-io` managed certificate, attached to `vs-apnex-io` |
| 4 | Host rule for `draw.apnex.io` on `map-apnex-io` |
| 5 | DNS: replace the CNAME with an A record at `35.201.120.148` |
| 6 | Plaintext callers upgrade for free -- `fwd-apnex-io-http` already redirects |

DNS is the cutover and the rollback: point the CNAME back and the old generation returns.

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

## IAP is per backend service, not per path

IAP attaches to a backend service and protects everything routed to it.\
There is no path-level exclusion, so anything that must stay public cannot simply be a route on the application.

This matters immediately, because publishing an External consent screen requires a reachable privacy policy.\
Google's verification fetches `https://draw.apnex.io/privacy`, and if that path is behind IAP the fetch is answered with a sign-in redirect and the check fails.\
The requirement and the protection are in direct conflict, and the load balancer is where it is resolved:
```text
draw.apnex.io/privacy  -> backend bucket, public, no IAP
draw.apnex.io/*        -> backend service -> serverless NEG -> Cloud Run, IAP on
```

Serving the privacy page from a bucket rather than the application is the point, not an implementation detail.\
An application route is behind IAP by construction, and a bucket-served page also survives the service being down and needs no code.

Two related cases are open rather than decided.

`/oauth2callback` (`server/app.js:145`) is the Slides OAuth redirect.\
The user reaching it has already signed in through IAP, so it will probably pass -- and "probably" is doing enough work in that sentence to deserve a test rather than an assumption.

`/d/<id>.svg` is unauthenticated by nature today: a self-contained image at a URL.\
Behind IAP it becomes private, which is arguably correct and also means no README, document or deck can embed a live diagram.\
If embedding matters it is the same url-map question, and it is cheaper to decide before the cutover than after.

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

### Build and deploy pipeline

Cloud Build is enabled and Artifact Registry already holds an `apnex` Docker repository, so the pieces exist and the Dockerfile builds today.

Two questions are open, and neither is about YAML.

What triggers a build.\
A push to `main` needs the GitHub connection configured; a manual `gcloud builds submit` needs nothing and is honest for a single-user tool.

Whether the build re-runs the gate.\
GitHub Actions already runs the suite and the scanners on every push, so re-running them in Cloud Build duplicates the cost -- but not re-running means the image is built from code the pipeline itself never verified.

This is also what answers **B53**, the open row recording that nothing in the gate builds the image, which is how **B52** shipped a broken `npm ci`.\
It only answers it if a failed build actually blocks something.

### Bucket naming

`gs://diagrams.apnex.io`, following the estate convention of domain-shaped bucket names.

The convention buys guaranteed global uniqueness, and it costs one dependency: GCS requires domain verification for any bucket name containing a dot.\
Five existing dotted buckets prove that verification is live for `apnex.io` today, and the name is unclaimed globally.\
It has no effect on the adapter, which passes the bucket name as a path segment where dots are unremarkable.

A bucket's location is immutable, so `australia-southeast1` means creating it there rather than moving it later.

---

## Findings this plan surfaced

### B6 has fired

Its recorded revival trigger is *any multi-instance or GCS-backed deployment*, and this is one.\
The adapter is what answers it: durability becomes the object store's rather than an absent `fsync`.

### Deleting the v1 bucket

`gs://draw.apnex.io` held the 2021 deployment and has been purged -- nineteen objects and the bucket itself, 76162 bytes, every object stamped `2022-01-02T22:49:31Z` from a single upload.

The hostname now answers `404`, and the successor bucket is `gs://diagrams.apnex.io` rather than a recreation of this name.

Purging the bucket did NOT free the hostname, and the two were never coupled.\
`draw.apnex.io` is a CNAME to `c.storage.googleapis.com`, so deleting the bucket only changes what that name resolves TO; the name moves when DNS moves, which is a separate act with its own cost recorded below.

The claim that the code is safe on GitHub was CHECKED rather than accepted.\
Nineteen objects, sixteen byte-identical to `apnex/draw@HEAD`, and three -- `core/engineer.js`, `core/loader.js`, `main.js` -- differing from it.\
Those three match commit `5dc62139` (2022-01-03), two days before the final push, so the bucket is a slightly stale deploy rather than divergent work and every byte in it exists in git history.

Had they matched no commit, the deletion would have destroyed the only copy.\
That is the reason the check happened rather than the reason it was skipped.

### The Slides refresh token has nowhere to live

`server/slides/auth.js:22` writes it to `<secretsDir>/google-token.json` at runtime, and the Cloud Run filesystem is ephemeral, so every deploy loses it and the next push demands re-authorization.\
The credentials file is fine because it can be mounted read-only from Secret Manager; it is the written token that has no home.\
Simplest resolution is to keep it in the same bucket the adapter already talks to.

Both need backlog rows before implementation begins.
