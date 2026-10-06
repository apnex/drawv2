# The final dry run and the staging rehearsal -- promotion's P8 (PLAN, proposed)

> **Tier 3 -- a plan of record, proposed.** Written 2026-10-06 against `0c97a93`.
> Facts about today's code and estate are measured and cited; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.
> Infrastructure names -- the project, the buckets, the load balancer's resources -- stay in the private deploy runbook, not here.

## 1. Status

- **Asked for:** the director, 2026-10-04: "Lets proceed correctly as per the recommended path to eventually unify all the things" -- P7, then P8 with a staging rehearsal, then P9 at the director's go-ahead (`dev/DECISIONS.md`, "The path to the cutover, with a staging rehearsal").
- **Is:** stage P8 of `PROMOTION.md` section 6 -- the migration dry-run, proven when "the dry run reports zero unexplained differences between each diagram's drawing before and after; every shared leg is listed with its disposition" -- with the staging rehearsal it gained on 2026-10-04, and the rollback rehearsal P-8 placed here ("taken and verified before migrating, rehearsed in P8, held open across the window").
- **Builds nothing new.** P8 runs what is built against a copy of the real estate, in front of the director, and turns what it finds into fixes on `main` before P9.

---

## 2. From-state -> to-state

**From** (measured 2026-10-06):
- **The dry run passes on an old copy.** `tools/migrate-schema.mjs` boots a real Store on a copy of the estate and checks every ruled change; it passes on the backup of 2026-10-03 -- 43 diagrams, 464 links, 783 pipes, 0 links down, every export rendering.
- **The estate has moved since.** Production's bucket against that backup: two diagrams deleted, one created, and two written to since it was taken.
- **Nothing on `main` has been used by a person on real diagrams.** The lab runs seeded boards; the product page's matrix runs on seeded boards against a test server.
- **The rollback has never been run.** P-8 rules it is restoring the pre-migration backup on the old image, since images before schema 2 refuse schema 2 files.

**To** (at the end of P8):
- **A fresh copy of the estate, dry-run clean** on the commit P9 will deploy.
- **Section 7's exit criteria each shown met,** with evidence, in one place.
- **The director has used `main` on a migrated copy of the estate** -- as a user, behind the same sign-in -- and said whether it is ready.
- **The rollback has been run** on that copy, and timed.
- **P9's runbook written from what was run,** not from what was planned.

---

## 3. The fence

A fresh copy of the estate; the dry run on it; an audit of section 7; a staging service with its own copy and its own sign-in; the migration by the store's own boot on that copy; the director's use of it; the rollback on it; P9's runbook; every defect found, registered and fixed on `main`.

---

## 4. The anti-scope fence

- **Production is not touched.** It stays on `draw:2538ab8` (F3), its data is only read, to copy it, and staging holds no credential that can write it.
- **No new behaviour.** A defect found on staging is fixed to the ruled behaviour, with a PU entry if a user would notice.
- **No data leaves the deployment's own storage.** The local copy for the dry run stays in the private archive, as the last one did, never in the repository.

---

## 5. Findings that shape the plan

### 5.1 The estate moved, so the dry run must run again on a fresh copy

The last dry run's copy was taken 2026-10-03.\
Listed 2026-10-06, production's bucket holds 44 objects to the copy's 45: two diagrams are gone, one is new, and two have been written since.\
P9 migrates what is live on the day, so the dry run is repeated on a copy taken now, and once more on the morning of P9 (section 6).

### 5.2 A deployment on a bucket must have a sign-in

The server refuses to boot with a bucket and no identity source (`server/server.js:67`), and the only identity source is IAP (`server/identity.mjs:205`).\
So staging either sits behind IAP like production, or runs without a bucket, its data on a mounted volume and no sign-in at all.
**Recommended (judgement):** behind IAP, with its own bucket -- the store's GCS adapter, the boot migration writing each file back, and the sign-in and grants are the path P9 takes, and a rehearsal that skips them does not rehearse it (decision M1).

### 5.3 The migration runs in the store's boot, so staging rehearses P9 exactly

Every document enters through `admit` (`server/store.js:163`), which migrates it and writes the file back once.\
Booting `main` on a bucket holding an unmigrated copy is therefore what P9 does to production, step for step -- and booting `2538ab8` on the restored copy is the rollback.

### 5.4 An open tab outlives a deploy

A tab opened before the cutover keeps its socket on the old revision, and is told when the revision answering HTTP differs (`app/src/sync.js:690`, B178).\
What that tab does after a schema 2 server takes over -- its outbox, its next snapshot -- has never been seen (`PROMOTION.md` section 8, "Stale tabs").\
Staging is where to watch it: a tab opened on `2538ab8`, left open while `main` deploys.

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | proven by |
|---|---|---|
| **Y-a** | **The fresh dry run:** a read-only copy of production's bucket into the private archive; `tools/migrate-schema.mjs` on it at `main` | PASS: every diagram migrated, every difference a ruled one, every shared leg listed with its disposition, every link up along its stops, every export rendering; the counts set beside the 2026-10-03 run |
| **Y-b** | **The exit-criteria audit:** `PROMOTION.md` section 7, each criterion with its evidence -- a test, a scan or a cited line -- recorded in this file | seven criteria, each met or registered as a gap and fixed |
| **Y-c** | **Staging stood up, at production's image:** its own bucket holding the copy unmigrated, its own service account with access to that bucket only, behind IAP for the director (M1); deployed first at `2538ab8` | every diagram opens on staging as on production, read-only checked; production's other hostnames answer as before the change |
| **Y-d** | **The rehearsal of P9:** a tab opened on staging at `2538ab8` and left open; `main` deployed to staging; the store's boot migrates the copy; then the director uses it | every diagram opens and draws, none down; the open tab told to reload, writing nothing the new server refuses silently; the director walked through what users will notice, read from the production-upgrade register; each finding a B row, fixed on `main` and redeployed |
| **Y-e** | **The rollback, rehearsed and timed (P-8):** the unmigrated copy restored to staging's bucket, `2538ab8` deployed on it; then P9's runbook written from what Y-c to Y-e ran | every diagram opens as at Y-c; the time from "abort" to serving recorded as P9's rollback window |

**P8 closes** when the director says the rehearsal is good (W24), with Y-a run once more on the morning of P9 against what is live then.
**Size, by judgement:** Y-a, Y-b and Y-e are hours; Y-c is mostly infrastructure; Y-d is the director's time, and whatever it finds.

---

## 7. Behaviour that changes, stated before it is built

**For people and agents on production:** nothing until P9.\
**For the director:** a second address to sign in at, holding a copy of their diagrams as `main` will show them; what they do there is not kept.\
**For the estate:** read once more, to copy it.

---

## 8. Coverage, verification, costs

**Proves:** P8's exit criterion; section 7's criterion 6 on today's estate; P-8's rehearsal; the stale-tab risk observed rather than reasoned about.\
**Defers:** the cutover itself, its window and its backstop (P9, W25).

**Verification targets:** the dry run's report; the audit's evidence; on staging, every diagram opened through CDP and screenshotted before and after (A5), the open tab's console and outbox, and the rollback's timing.

**Named costs and non-claims (judgement):**
- **One shared resource changes:** a host rule on the load balancer that also serves production's and other hostnames. It is measured as the original cutover was -- each hostname's answer taken before and after -- and removed after P9 if M2 so rules.
- **A second copy of users' diagrams exists** while staging stands, readable only by those IAP admits to it.
- **It is not chaos-tested** (A9): one migration and one rollback, each run once, on real data.

---

## 9. Decisions for the director -- one at a time

- **M1 -- where staging lives.** Recommended: behind IAP on the existing load balancer, at a staging hostname under the same domain, with its own bucket and a service account that can reach that bucket only, and IAP admitting the director alone -- the path P9 takes, sign-in and storage included. The alternative: a private service reached through a local proxy, with no sign-in and its data on a mounted volume -- no shared resource touched, but it skips the storage adapter and the sign-in P9 depends on.
- **M2 -- what becomes of staging after P9.** Recommended: torn down once P9 is verified -- the copy deleted, the service, its account and its host rule removed -- so users' diagrams live in one place; standing it up again is this plan's Y-c. The alternative: kept as a standing staging for future releases, refreshed from production before each use.

---

## 10. Axiom alignment audit (M7)

| axiom | weight | how the plan holds it |
|---|---|---|
| A8 Gated Recursive Integrity | load-bearing | P9 waits on gates P8 runs: the dry run, the audit, the rehearsal, the rollback, and the director's word |
| A13 Director Intent Amplification | load-bearing | the director judges `main` by using it on their own diagrams, not by reading reports of it (W24) |
| A1 Sovereign State Transparency | supporting | the audit sets each exit criterion and its evidence in one place |
| A7 Resilient Agentic Operations | supporting | the rollback is run and timed before the window that may need it |
| A9 Chaos-Validated Deployment | tension, named | the migration and the rollback are each run once on real data, not under injected failure; accepted as proportionate for a single-instance service whose rollback is a restore |
| A2-A6, A10-A12, A14 | not materially implicated | |

**Verdict: pass-with-guardrails** -- production's data is only read; staging can write nothing but its own bucket; M1 and M2 ruled before Y-c.
