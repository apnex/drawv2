# Cloud deployment

The plan for running `draw` on Google Cloud.

**Status:** largely shipped.\
The application runs on Cloud Run behind IAP at `draw.apnex.io`, on GCS, with a wildcard certificate.\
Sections headed *as executed* record what was actually done rather than what was planned, and the sections marked OPEN are still being decided.\
Access control is designed but not built, and lives in `docs/spec/ACCESS.md`.

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

### Certificates: one wildcard, provisioned before it is needed

The obvious move was a fourth classic certificate, `ssl-draw-apnex-io`, alongside the three.\
That was rejected, and the reason generalises past this hostname.

A classic Google-managed certificate validates only once the domain already resolves to the load balancer, so it cannot be readied in advance -- and worse, failed attempts back off exponentially, so a certificate created before the DNS flip is SLOWER to activate afterwards than one created at the moment of cutover (B58).\
Pointing the name at both the old and new targets to cover the gap is not available either: multi-perspective validation requires the records resolve only to the load balancer address.\
The window was therefore unavoidable on that path, and it lands after the old generation is already gone.

Certificate Manager removes the window rather than shortening it, because DNS authorization validates over a `_acme-challenge` CNAME instead of over live traffic.\
Wildcards are the second reason and the larger one: classic managed certificates cannot issue them at all, so `*.apnex.io` collapses three per-hostname certificates into one and pre-covers every subdomain this estate ever adds.\
`draw.apnex.io` then needs no certificate work, and neither does the hostname after it.

Both are already done -- the certificate was provisioned while `draw.apnex.io` still resolved elsewhere, which is the property being bought:
```text
auth-apnex-io            DNS authorization -> _acme-challenge.apnex.io CNAME
cert-apnex-io-wildcard   apnex.io, *.apnex.io   ACTIVE, both domains AUTHORIZED
```

The apex is listed separately on purpose: a wildcard covers one subdomain level and does NOT match the bare domain.

### The cutover

| Step | Change |
|---|---|
| 1 | Serverless NEG pointing at the Cloud Run service |
| 2 | Backend service wrapping that NEG, with IAP enabled on it |
| 3 | Host rule for `draw.apnex.io` on `map-apnex-io` |
| 4 | Certificate map carrying `cert-apnex-io-wildcard`, with one entry PER HOSTNAME |
| 5 | Attach the map to `vs-apnex-io` -- see the warning below |
| 6 | DNS: replace the CNAME with an A record at `35.201.120.148` |
| 7 | Plaintext callers upgrade for free -- `fwd-apnex-io-http` already redirects |

Step 5 is the only irreversible-feeling one, and it is an atomic swap rather than a blend.\
A proxy carrying a certificate map IGNORES every classic certificate attached to it, so the map must already cover `apnex.io`, `raw.apnex.io` and `ois.apnex.io` before it is attached or those three hostnames break the instant it lands.\
The wildcard covers all of them, which is why one certificate is safer here than four, not merely tidier.\
A primary map entry alone is NOT sufficient, and that cost an hour to learn.\
It is the obvious design -- one wildcard certificate, one primary entry, every hostname matched -- and it is correct for TLS and wrong for IAP: an IAP-protected backend behind a primary entry answers `401` with error code 52, `Hostname/SSL certificate mismatch`, which names the certificate and not the real cause.\
Google states it only in the error-code table: *"IAP does not support primary certificate map entries.\
Use separate entries to map each certificate to the correct hostname."*\
So the map carries an explicit entry per hostname, all pointing at the same wildcard, with the primary retained purely as the fallback for clients that send no SNI.

Rollback differs per step, and this is worth stating plainly because it changed.\
Detaching the certificate map restores the classic certificates, so step 5 reverses cleanly.\
DNS no longer reverses, however: the v1 bucket has been deleted, so pointing the CNAME back yields `404` rather than the old generation.\
The 2021 deployment is recoverable only from `github.com/apnex/draw`, and nothing about the cutover depends on it.

### What is deployed

Live as a private Cloud Run service, not yet reachable at `draw.apnex.io`:
```text
draw            australia-southeast1, min=1 max=1, --no-cpu-throttling
image           australia-southeast1-docker.pkg.dev/labops/apnex/draw
identity        sa-draw@labops.iam.gserviceaccount.com
                objectAdmin on gs://diagrams.apnex.io ONLY -- no project-wide storage role
BUCKET          diagrams.apnex.io
ingress         --no-allow-unauthenticated, so nothing is public before IAP exists
```

`--no-cpu-throttling` is a correctness setting here rather than a performance one.\
Cloud Run throttles CPU between requests by default, and the store debounces its writes on a `setTimeout`, so a throttled instance would not run the timer until the next request happened to arrive.\
The flush would then be triggered by unrelated traffic instead of by elapsed time, which is not what the debounce means.

Verified against the running service rather than assumed: it seeded eleven examples from the image, flushed every one to the bucket, took a REST write whose GCS generation visibly advanced, and after a forced restart reloaded the same eleven objects instead of reseeding.\
A reseed would have minted new ids and grown the bucket, so the fingerprint being unchanged is what distinguishes reload from re-creation.

### The cutover, as executed

Steps 1 to 3 are done and `draw.apnex.io` resolves to the load balancer with a valid certificate for the first time in its life:
```text
neg-draw        serverless NEG -> Cloud Run draw (australia-southeast1)
svc-draw        EXTERNAL backend service -> neg-draw
map-apnex-io    + host rule draw.apnex.io -> svc-draw   (4 hosts now)
cm-apnex-io     certificate map, one PRIMARY entry -> cert-apnex-io-wildcard
vs-apnex-io     certificate map attached
DNS             draw.apnex.io  CNAME -> A 35.201.120.148
```

The map attach was the step that could have broken three live hostnames, so it was measured rather than trusted.\
Baselines were taken first -- `apnex.io` 200, `raw.apnex.io` 404, `ois.apnex.io` 401 -- and all three returned exactly those codes afterwards, now served by the wildcard.\
Propagation took roughly ninety seconds, during which the proxy still presented the old per-hostname certificates, so an immediate check would have read as a failed attach rather than an incomplete one.

`draw.apnex.io` was verified against the load balancer IP with SNI BEFORE the DNS change, which is the whole benefit of having provisioned the certificate in advance: the hostname could be proven to serve a valid certificate while it still pointed somewhere else entirely.

The classic certificates are deliberately still attached to the proxy.\
They are ignored while the map is present, and detaching the map restores them, so rollback is one command rather than a re-provisioning exercise.

### Identity, as configured

IAP is enabled on `svc-draw` with a Google-managed OAuth client, and `aobersnel@apnex.com.au` holds `roles/iap.httpsResourceAccessor` on it.\
Cloud Run then had to accept unauthenticated traffic, because IAP terminates identity at the load balancer and cannot forward a Cloud Run credential.\
That is only safe because ingress was already narrowed: the `run.app` URL returns `404` from outside, so the sole route in is the load balancer, and the load balancer is behind IAP.

The order was deliberate -- IAP first, then open Cloud Run.\
Reversed, there is a window where the load balancer serves the application to anyone who asks.

### Why draw.apnex.io answered 403 before IAP

It is not broken.\
The Cloud Run service is deployed `--no-allow-unauthenticated`, so the load balancer reaches it and Cloud Run declines -- which is the correct state to flip DNS into, because the hostname becomes real without exposing anything.

Ingress was also narrowed to `internal-and-cloud-load-balancing`.\
That closes a hole which would otherwise open the moment IAP arrives: IAP requires the service to accept unauthenticated traffic, at which point the `run.app` URL would have been a way around IAP altogether.\
Doing it now means the bypass never exists rather than being closed after the fact.

### The public pages, and why there are three

`bb-draw-public` fronts `gs://draw-apnex-io-public` and takes `/about`, `/privacy` and `/terms` off the application, outside IAP.\
Everything else on `draw.apnex.io` stays behind sign-in, verified after the change: `/`, `/api/v1/diagrams` and `/src/main.js` all still answer `302`.

Scoping this to the privacy policy alone was wrong, and the correction is worth recording because the requirement is larger than it first appears.\
Google will not accept an external app for verification while any of the homepage, privacy policy or terms links are missing, and verification is the thing that makes a custom name and logo appear at all.\
The homepage carries two further conditions that collide with IAP directly: it must describe the application's functionality, and it *"can not be only a login page"*.

`draw.apnex.io/` is exactly a login page to an anonymous reviewer, because IAP answers it with a redirect to `accounts.google.com`.\
So the homepage is `/about` rather than the site root -- nothing in the requirement demands the root, only that the declared homepage describes the app and links to the privacy policy, which it does.\
It also links to `github.com/apnex/drawv2`, which gives a reviewer the source rather than an assertion.

The pages live in `public/` in the repository and are copied to the bucket.\
Keeping them only in cloud storage would leave the text unversioned, unreviewable, and invisible to anyone reading the code.

### A quota override that is not a rate limit

The first two builds failed with `toomanyrequests` from Artifact Registry, which reads as contention and is not.\
`artifactregistry.googleapis.com/user_requests` had a **consumer override of 60/min** on this project, against a Google default of `-1` for unlimited, while every project-level limit sat untouched at 60000/min.\
A Docker push moves several layers in parallel and retries each, so 60 is exhausted immediately -- and it explains why the last successful regional build in this project was in 2021.

The override was deleted, restoring the default, after which the same build succeeded in 29 seconds.\
It is recorded because the error names rate limiting and the cause was configuration, which is the kind of mismatch that costs an afternoon.

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

`/d/<id>.svg` was unauthenticated by nature: a self-contained image at a URL.\
Corrected 2026-08-21 (B67, H10.12): it is now gated on `canRead` like every other read.\
An SVG is a rendering of the whole document, so leaving it open was not a property of images but a hole -- ACCESS.md already said a representation is not a permission, and nothing enforced it until reads were gated.\
The consequence the paragraph below anticipated is now real and deliberate: no README, document or deck can embed a live diagram, because embedding requires a credential the embedder does not have.\
If embedding matters it is a separate decision -- a per-diagram public flag, or a signed time-limited URL -- and neither should be reached by leaving the route open.

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

## Turning authorization on

Three environment variables, and the service is single-tenant until the first of them is set.

```text
IAP_AUDIENCE    /projects/531843488473/global/backendServices/3078630696779732675
OWNER           user:aobersnel@apnex.com.au
ALLOW_DOMAINS   apnex.com.au            (optional; comma-separated)
```

**Amended 2026-08-21 (H9.25).**\
`IAP_AUDIENCE` configures an identity SOURCE, and the presence of a source is the switch.\
That distinction is the whole of the amendment: authorization used to be spelled `Boolean(IAP_AUDIENCE)`, so it was on precisely when one Google product was configured, and since `canRead` and `canWrite` both return true when it is off, removing the mechanism would have removed the model with it.\
Adding a second mechanism is now one branch in `identitySource()` and no change anywhere else.

Setting a source turns on the grant filter and makes every request carry a verified identity, so it must not be set before `OWNER` is, or the twelve existing diagrams belong to nobody and list to nobody.\
The service refuses to boot with `BUCKET` set and no identity source configured, which covers the opposite mistake.

`ALLOW_ORIGINS` is optional and usually unset.\
The websocket refuses an upgrade whose `Origin` is neither absent nor the host that served the page, because a cross-site handshake carries the victim's cookie and CORS does not gate one -- there is no preflight on a websocket.\
Same-origin is recognised without configuration by matching the `Host` header, so this is only needed if a page on another origin must legitimately connect.\
Every refusal is logged with both the origin and the host, so a wrongly refused client is attributable rather than a silent reconnect loop.

`OWNER` claims diagrams that predate ownership, once, at boot.\
It is a migration rather than a policy: diagrams created after the flag is on take their owner from the session that created them, and adoption never runs against them.

`ALLOW_DOMAINS` restricts who may hold a session at all, and is checked before any grant is looked up, so it overrides a grant rather than composing with one.\
Unset means no domain restriction, which is not the same as no access -- grants still deny by default, so an unlisted account signs in successfully and sees an empty list.\
That is the documented end state rather than an oversight, and it is why an empty value does not fail closed.\
The server prints the policy it resolved at boot, so an operator reads it rather than infers it.

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
