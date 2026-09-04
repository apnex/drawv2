# draw -- hosting constraints

Why this system is shaped the way it is for hosting, independent of where any instance of it runs.

> **This document holds reasoning, not a recipe.**\
> The deployment procedure, project identifiers, bucket names, DNS and identity configuration for the maintainer's own instance were removed on 2026-09-03: how one deployment is wired is not a property of the system, and a published repository that describes it invites a reader to treat it as the way rather than a way.
>
> What remains is the reasoning other documents and source comments cite: why a single writer, and why storage is an adapter rather than a mounted filesystem.\
> Both are design constraints that hold on any host.

---

## Why one instance

Three pieces of state live in the process, and that is the design rather than an oversight.

| Component | State it holds | What a second instance does |
|---|---|---|
| `Store` | model in memory, writes throttled | last writer takes the whole file, log and inverses with it |
| `Hub` | the set of live websocket sessions | viewers on B never see a change made on A |
| `Locks` | the lock table | two controllers each believe they hold it |

The single-writer model is a property of this deployment rather than of the product: `../../VISION.md` does not exclude concurrent editing, and `AUTHORITY.md` holds why one instance owns a document at a time.\
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
Authentication on Cloud Run is one metadata-server call, cached until expiry, and the token cache already establishes that pattern against Google over raw `fetch`.

The one real argument for the SDK is retry and backoff on `429` and `503`, which is roughly fifteen lines to do properly.\
If those fifteen lines turn out badly, the `D19` seam makes swapping to the SDK a one-file change.

### Compare-and-swap

`ifGenerationMatch` on the `PUT` gives a compare-and-swap against the object generation.\
That is the same shape as the existing `expect` precondition on the wire, so the concept is already in the system.

It matters because it turns **D34** -- two revisions overlapping during a deploy, the loser silently taking the whole file -- from an accepted silent hazard into a detectable `412`.

---
