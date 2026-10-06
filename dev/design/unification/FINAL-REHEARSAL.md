# The final dry run and the staging rehearsal -- promotion's P8 (PLAN, proposed)

> **Tier 3 -- a plan of record, proposed.** Written 2026-10-06 against `0c97a93`.
> Facts about today's code and estate are measured and cited; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.
> Infrastructure names -- the project, the buckets, the load balancer's resources -- stay in the private deploy runbook, not here.
> AMENDED 2026-10-06: approved; M1 and M2 ruled as recommended (section 9).

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

AMENDED 2026-10-06 -- **M1 and M2 RULED as recommended** (`dev/DECISIONS.md`, "P8's plan decisions, M1 and M2"): staging behind the same sign-in, on its own bucket, admitting the director alone; torn down once P9 is verified.

AMENDED 2026-10-06 -- **Y-a done** (H18.42): the fresh dry run.
**The copy:** production's bucket read once, 2026-10-06, into the private archive, write-protected there: 44 objects, 42 of them diagrams.\
**`tools/migrate-schema.mjs` at `9a422fe`: PASS** -- every diagram boots in a real store, and nothing changed that was not ruled.
**Its counts, beside the 2026-10-03 run:** 42 diagrams (43); 1030 nodes (1005); 802 pipes laid (783); 17 rings with a closing leg (17); 0 shared legs split (0); 104 `pinned` dropped (104); 5 waypoints renumbered; 48 directions renamed; 1947 undo records dropped (P-6).\
**Read through the product's own doors,** a server booted on a second copy: 481 links, none down, each asked through REST's `path`; all 42 downloads render.\
So criterion 6 holds on today's estate, with no shared leg to dispose of.

AMENDED 2026-10-06 -- **Y-b done** (H18.43): `PROMOTION.md` section 7, each criterion with its evidence.

| # | criterion | met | evidence |
|---|---|---|---|
| 1 | production imports `network/`, and no path builds a Model or runs the planner without it | yes | every production `new Model` passes a network (`server/store.js:677`, `:821`, `:870`; `network/read-model.mjs:28`; `app/src/compose-canvas.js:64`); a Model holding a network-drawn kind with no network throws (`model/model.mjs:126`); the planner has no default link tenant or kinds (`planner/txn.mjs:241`, S-b) |
| 2 | a pipe is a stored entity through store, snapshot, sync, log, undo and redo | yes | `tests/server-network.test.js` S-b: written, read back at boot, undone with its pipes; on the product page every matrix row requires the tab's pipes to be the server's (I1), the page opening each board from the server's snapshot; UNDO-03 lays pipes, undoes and redoes through the server's log |
| 3 | two peers derive identical routes, after a reload too -- ages stored | yes | `tests/consumer-parity.test.js` "criterion 3", added here: peers learning the document in another order, and one reading it from the stored file, read every link as the tab does; with two links' stored orders swapped the other holds the pipe. Mutant: ages read from ids -- killed |
| 4 | the export, REST, `draw movers`, `draw combat` and the tab draw the same route | yes | `tests/consumer-parity.test.js` R-e: REST, the CLI, the download and movers against the tab; `tests/read-model.test.js` R-a: one read composition for every reader, `combat` among them |
| 5 | the behaviour matrix passes on the product page | yes | P7: `tests/page-matrix.test.js`, all 89 rows, in the gate and in CI, none skipped |
| 6 | every live diagram migrated, drawing unchanged but for ruled shared legs, each listed | yes | Y-a above: PASS, 0 shared legs, 0 links down |
| 7 | no pre-network behaviour remains | yes | `KEEPS_ORPHAN_AS_RULED` and `NEVER_STRANDED`: no line of code [V, exhaustive grep]; `pinned` survives only as the English word and the socket's revision pin, the field retired (`model/shape.mjs:58`); `straightPath` is no default -- a Model with no network draws nothing, and the network draws only a down link along it (`model/model.mjs:247`) |

AMENDED 2026-10-06 -- **Y-c done** (H18.44): staging stands, at production's image, behind the same sign-in (M1).
**Built as production is:** its own bucket holding Y-a's copy, unmigrated; a service account that can reach that bucket only, with no project role and nothing on production's; the service at `2538ab8`, sized and configured as production, reachable only through the load balancer; IAP admitting the director.
The names, and the teardown M2 calls for, are in the private deploy runbook.

**The shared load balancer, measured:** every other hostname answered the same before and after -- a host rule and a certificate map entry were added, nothing else changed.

**Verified:** booted at `2538ab8` on the copy, it loaded all 42 diagrams and wrote nothing back -- the bucket is byte-identical to Y-a's copy; anonymous requests are sent to sign-in, and the service's own address is closed from outside.
A probe account, admitted by IAP and holding no grants, reached the server's health route -- status ok, 42 diagrams, no flush or invariant failures -- and saw only the templates, so access is by grant on staging as on production.

**Not verified by the agent:** opening each diagram in a browser as its owner. IAP admits only the director's sign-in to their diagrams, and Google refuses to allowlist the command-line tool's client for programmatic access, so that check is the director's, at the start of Y-d, before `main` is deployed.

AMENDED 2026-10-06 -- **Y-d, the deploy:** P9's path, run on staging.\
The director signed in on `2538ab8`, checked their diagrams opened as on production, drew a link through four new waypoints on one, and left that tab open.\
`main` (`9ac031a`, its code the lab's `5457f9b`) was deployed to staging in 22 seconds, and the store's boot migrated the copy: every diagram schema 2, no waypoint collection and no `pinned` left.\
Of the 42 diagrams, 41 are identical to the same copy migrated locally by the same code; the 42nd differs only by the director's link, drawn and saved in the old format before the deploy, then migrated -- its waypoints made nodes, its three pipes laid, its undo history dropped as ruled (P-6).\
Read through the new server's doors: 42 diagrams, 482 links, 805 pipes, none down; every download renders; the director's link is up along its route.
**The open tab (section 5.4), observed:** its health check saw the new revision a second after it answered, and the tab reloaded itself onto `main` and reconnected; nothing was refused, and the server logged no error.\
Next in Y-d: the director uses `main` on staging; each finding is a B row, fixed on `main` and redeployed.

AMENDED 2026-10-06 -- **Y-e done** (H18.46): the rollback rehearsed and timed (P-8), and the upgrade run a second time.
**The rollback, 34 seconds from abort to serving:** writes frozen at the load balancer (3 s), the bucket restored from the pre-migration copy (17 s), `2538ab8` deployed (30 s), reopened (34 s).
The bucket was then byte-identical to the copy, and the old server healthy on all 42 diagrams.
**The order is load-bearing:** freeze before restoring, or a running new revision could save a schema 2 file over a restored one.\
**What a rollback loses:** everything written after the backup -- here, the link the director drew.\
**The upgrade again, 13 seconds to deploy:** all 42 diagrams on staging identical to the same copy migrated locally, version numbers included; staging is left on `main` for the director.

**P9's runbook, from what ran** (the commands, by name, are in the private deploy runbook):
1. Freeze writes at the load balancer.
2. Take the backup, frozen, so a rollback loses nothing written before the upgrade.
3. Dry-run that exact backup; on any difference, abort -- nothing has changed yet.
4. Deploy `main`; the store's boot migrates every diagram.
5. Verify: the bucket equals the backup migrated locally by the same code, health is ok, the log is clean.
6. Reopen; open tabs reload themselves onto the new version.

**Downtime, by judgement:** a few minutes, most of it the dry run and the check; the deploy itself took 13 to 22 seconds.\
**For P9, a decision to put to the director:** how long the rollback stays open after step 6, since a rollback then discards every edit users made on the new version (W25).

AMENDED 2026-10-06 -- **Y-d done, and P8 is closed** (H18.45): the director approved the rehearsal -- "Dont need to maintain rollback. Approved for next best action" (`dev/DECISIONS.md`).\
So P9's runbook stands with one change: the rollback is an abort, available until step 6 reopens to users; after that, a defect is fixed forward.

AMENDED 2026-10-07 -- **The runbook ran on production** (P9, H18.47): frozen, backed up, dry-run, deployed, verified and reopened in 3 minutes 18 seconds, as rehearsed; every diagram identical to the dry run's migration of the frozen backup.
Staging is torn down (M2, H18.48).
