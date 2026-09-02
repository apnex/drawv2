---
# Survey envelope — captures stakeholder intent BEFORE a design is committed.
# Scaffolded by survey-init.sh. Placeholders in <angle-brackets> are unfilled;
# validate-envelope.sh rejects any pick/required-field still left as <...>.
survey-title: B178 -- instance authority and client self-repair
work-item: B178
methodology-source: ~/.config/opencode/skills/survey (pinned copy; see surveys/b163-rules-system-survey.md for the prior use)
lifecycle-handoff:
  from: intent-open
  to: intent-captured
  authority-ref: Director, 2026-09-02 -- "we need to design this properly and durably before implementing"
  planning-input-ref: self
stakeholder-picks:
  round-1:
    Q1: a
    Q1-rationale: lease per document via storage; the same primitive at 1 or N instances
    Q2: b
    Q2-rationale: converge fast; accept loss of unflushable acknowledged edits
    Q3: a
    Q3-rationale: full client watchdog, self-repairing without being told
  round-2:
    Q4: a
    Q4-rationale: acquire if free, else refuse and redirect; no inter-instance traffic
    Q5: a
    Q5-rationale: event-driven on proof, slow poll only as an idle backstop
    Q6: abcd
    Q6-rationale: all four detectors compose; a spurious reload is cheap, a stranded client is not
# classification is OPTIONAL. Delete this key if your project has no work-item
# taxonomy. If you keep it and set SURVEY_CLASSES (env) or --classes, the value
# must be one of that pipe-separated set; otherwise any non-placeholder string passes.
classification: architecture
outcome-axis:
  # The consumer-supplied set of goals / objectives this work serves. Generic
  # replacement for any project-specific outcome framework. Free-form labels.
  primary: [AX1 concurrency correctness, AX4 scale-readiness]
  secondary: [AX3 observability, AX2 data safety, AX5 session continuity]
  round-1:
    primary: [AX1 concurrency correctness, AX2 data safety]
    secondary: [AX3 observability, AX5 session continuity]
  round-2:
    primary: [AX1 concurrency correctness, AX2 data safety]
    secondary: [AX3 observability, AX5 session continuity]
axiom-principle-anchors:
  # Free-form axiom/principle/goal anchors. These must also be explained in the
  # Round 1, Round 2, and final intent prose sections; labels alone are not enough.
  primary: [I15 fabricating success is the sin, A11 no mechanism against an unmeasured problem]
  secondary: [A3 earned exposure, A5 cognitive friction]
  round-1: [I15 fabricating success is the sin, A3 earned exposure]
  round-2: [A11 no mechanism against an unmeasured problem, A5 cognitive friction]
anti-goals-count: 6
flags-count: 6
calibration-data:
  stakeholder-time-cost-minutes: 8
  comparison-baseline: surveys/b163-rules-system-survey.md
  notes: Q2 forced a tradeoff the proposer had been avoiding, and its answer turned Q5 from a tuning knob into the safety control. Q6 returned all four options, which is composition rather than contradiction. The director reframed the problem before Round 1 by asking about scaling beyond one instance, which is what separated revision skew from document ownership.
contradictory-constraints:
  # Optional; fill ONLY when a multi-pick (e.g. Q2: ac) signals a both-at-once
  # constraint the stakeholder is asking the design to satisfy.
  # - round: 1
  #   questions: [Q2]
  #   picks: [a, c]
  #   constraint-envelope: <description of the common-satisfiable constraint>
---

# B178 -- instance authority and client self-repair — Survey envelope

**Methodology:** `~/.config/opencode/skills/survey` (2-round, 3-orthogonal-questions-per-round pick-list)
**Work item:** B178
**Classification candidate:** architecture
**Lifecycle handoff:** `intent-open -> intent-captured` only; this envelope grants no design, seed, implementation, or delivery effect.

---

## §0 Context

**Work item.** B178 -- a deploy leaves two writers on one diagram, and each keeps serving clients as if it were the only one.
Observed live on 2026-09-02: a deleted tower reappearing and an armed waypoint flickering, traced to revision `draw-00073-4l8` still serving forty-five minutes after `draw-00074-dmh` had taken all traffic.
Both instances held the same document in memory and broadcast only to their own clients; both flushed to GCS, where the if-generation precondition correctly refused the loser.
3203 flush failures and `/health` reporting `degraded`.

**Why a survey rather than a design.** The proposer had already begun implementing a narrow fix -- a revision marker in the bucket plus a retire broadcast -- when the director asked two questions that changed the shape of the problem: what happens if Cloud Run is deliberately scaled beyond one instance, and should the client self-repair on loss of correctness.
Those separate two tangled problems. **Revision skew** is clients running stale code. **Document ownership** is two instances both authoritative for one document, which happens at N instances even when every revision is identical.
A mechanism that only detected revision skew would be precisely the radical refactor the director asked to avoid.

**Outcome axes.** AX1 concurrency correctness (never two authorities for one document); AX2 data safety (no silent loss of acknowledged work); AX3 observability (the condition is reported, not inferred from symptoms); AX4 scale-readiness (N instances without redesigning the mechanism); AX5 session continuity (interruption absorbed by a live player).

---

## §1 Round 1 picks

| Q | Question | Pick |
|---|---|---|
| Q1 | What invariant should the mechanism enforce about who owns a document? | **a** -- lease per document via storage |
| Q2 | An instance retiring cannot flush its edits. What wins? | **b** -- converge fast, accept the loss |
| Q3 | What may a client do on its own, unprompted? | **a** -- full watchdog, self-repairing |

### §1.Q1 — Per-question interpretation

The director rejected (d) *keep the assumption, harden the detection* -- which is the option the proposer had already started building, and the one that manages a symptom rather than establishing ownership.
He also rejected (b) *single authoritative instance*, which would have made today's accidental constraint permanent and deliberate.

The reading: **authority must be explicit and storage-mediated**, expressed through the one substrate instances already share, using a primitive whose behaviour does not change with instance count.
With one instance the lease is always trivially acquired and nothing observable changes today; with twenty it is the whole mechanism.
That is what makes scaling an extension rather than a rewrite, which was the director's stated constraint.

A lease also forces a question into the open that the marker design left implicit and unanswered: what an instance does when a client asks it for a document it does not own. Carried to Round 2 as Q4.

### §1.Q2 — Per-question interpretation

The director rejected (a) *never lose acknowledged work* and (c) *handoff*, and also (d) *write-through*, which would have preserved safety at the cost of putting storage on the commit path.

The defensible reading is that a stale instance's unflushed edits were computed against a document the winning copy never saw, so they are a **fork rather than the user's work**.
Preserving a fork prolongs the divergence the mechanism exists to end.

This pick has a sharp consequence the proposer did not anticipate when writing the question: **detection latency now bounds data loss.**
How quickly an instance notices it has lost authority stops being a cost knob and becomes the control that decides how much acknowledged work can evaporate. That reframes Round 2's cadence question entirely.

### §1.Q3 — Per-question interpretation

Rejecting (c) *server-triggered only* avoids the deadlock this defect is built on: a websocket keeps its instance alive, so Cloud Run never sends the SIGTERM that would close the websocket. A mechanism that depends on the server being willing and able to speak inherits that deadlock.
Rejecting (d) *never silent* accepts a reload happening underneath a user.

The reading: **every participant is responsible for detecting its own staleness**, and the client is not merely a recipient of instructions. Combined with Q2 this is one consistent principle -- convergence beats preservation, of both state and comfort.

**Round-1 composite read.** Authority should be explicit, storage-mediated and instance-count-agnostic; convergence beats preservation; and detection is a responsibility of every participant rather than a message from one. The tension to carry forward is that Q2 and Q3 both buy speed with comfort, which makes the intervals in Round 2 the actual safety design rather than tuning.

**Round-1 axiom / principle anchoring.** The load-bearing anchor is **I15 -- fabricating success is the sin.** An instance that has lost authority and keeps answering clients is not merely stale, it is asserting an authority it does not hold, which is the precise shape I15 forbids; that is why (d) *harden the detection* was the wrong option even though it is the cheapest.
**A3 earned exposure** justifies the lease being introduced now rather than earlier: the abstraction generalises over instances that have actually been observed, not imagined ones.

---

## §2 Round 2 picks

| Q | Question | Pick | Relation to Round 1 |
|---|---|---|---|
| Q4 | What does a non-holder do when a client asks for a document it does not own? | **a** -- acquire if free, else refuse and redirect | deepens Q1 |
| Q5 | What should drive detection, given latency now bounds loss? | **a** -- event-driven, with a slow safety poll | deepens Q2 |
| Q6 | What counts as evidence to the client that it is stale? | **a b c d** -- all four | refines Q3 |

### §2.Q4 — Per-question interpretation

*Deepens the Round-1 aggregate: the lease Q1 chose forces this question into the open.*

Rejecting (c) *proxy* and (d) *routing affinity* keeps the mechanism entirely inside the application and inside the storage it already uses.
No instance-to-instance addressing, and no invariant pushed into infrastructure the app cannot see or test -- which matters because an invariant enforced somewhere untestable is an invariant nobody can prove.

The constraint this creates, and it is load-bearing: **a refusal must be actionable.** A client bounced by a non-holder and routed back to the same non-holder would loop. Whatever the refusal carries has to let the client make progress, and that is a design obligation rather than a detail. Flagged F1.

### §2.Q5 — Per-question interpretation

*Deepens the Round-1 aggregate: Q2 made detection latency the bound on data loss.*

This resolves the tension Q2 created, and elegantly.
Event-driven detection reacts to the signals that **already constitute proof** -- a write conflict, a failed lease renewal -- rather than discovering the situation on a timer. The loss window is therefore near-zero exactly when a document is being edited, which is the only time there is anything to lose. The slow poll exists only for the idle case, where by definition nothing is at risk.

Rejecting (d) *bound it at the write* is consistent with Q2's rejection of write-through: the director has twice declined to put storage latency on the commit path.

### §2.Q6 — Per-question interpretation

*Refines the Round-1 aggregate: Q3 chose a watchdog; this settles what it watches.*

All four picked. These are orthogonal detectors and compose rather than conflict, so this is a **constraint envelope, not a contradiction**: the client should be defence-in-depth self-repairing.

The reasoning that makes all four coherent is an asymmetry: **a spurious reload is cheap and a stranded client is not.** The outbox is durable, so a reload costs a moment; a stranded client silently diverges shared state and, as observed today, presents as a defect somewhere else entirely.

Two carry obligations. (b) *connection lost beyond a TTL* risks false positives on a sleeping laptop or a long tunnel, and the threshold must be grounded in measurement -- this proposer has shipped a guessed threshold that could never fail (flagged F3). (d) *unreconcilable version gap* is the hardest to define without false positives and needs a precise predicate (flagged F4).

**Round-2 composite read.** The mechanism stays wholly inside the application and its storage; it reacts to proof rather than polling for it; and the client carries four independent detectors because the cost of over-reacting is far below the cost of not noticing.

**Round-2 axiom / principle anchoring.** **A11 -- no mechanism against an unmeasured problem** is what keeps Q5 honest: event-driven detection adds machinery only where a real signal already exists, and the poll is a deliberate backstop rather than the primary design.
**A5 cognitive friction** anchors Q4's actionable-refusal constraint and the observability axis: an operator should not have to infer this condition from a reappearing tower, which is exactly how it was found.

---

## §3 Composite intent envelope

**Authority over a document is explicit, storage-mediated, and identical at any instance count.**
A lease per diagram replaces an assumption that was never enforced. With one instance nothing observable changes; with several the same primitive is the whole mechanism, which is what makes deliberate scaling an extension rather than a rewrite.

**Convergence beats preservation.** An instance that has lost authority holds a fork, not the user's work. It retires promptly rather than defending state the winning copy never saw. The cost is accepted knowingly and is bounded by how fast loss is detected.

**Detection follows proof.** A write conflict and a failed lease renewal already prove the condition; those drive retirement. A slow poll covers only the idle case, where nothing is at risk.

**Every participant detects its own staleness.** The server cannot be the sole trigger, because the deadlock that created this defect is precisely a server unable to act. The client carries four independent detectors and repairs itself by reloading, on the asymmetry that a spurious reload is cheap and a stranded client is not.

**Final axiom / principle anchoring.** The design is anchored on **I15 -- fabricating success is the sin**: every element exists to stop a process asserting an authority it does not hold, whether that is an instance still answering for a document it has lost or a page still running code the service has replaced.
**A11** shapes how much is built -- reacting to proof already present, not polling for a problem, and not building CRDT semantics against a problem nobody has measured.
**A3 earned exposure** permits the lease now: it generalises over instances that have been observed in production, and the survey exists because the director declined to let it generalise over imagined ones.
The tension the design must carry openly is **AX2**: data safety was deliberately traded for convergence, and Q5's event-driven detection is the mitigation that keeps the trade small rather than a separate feature.

---

## §4 Scope summary

**Title.** Instance authority and client self-repair.

**Classification candidate.** architecture.

**Primary outcomes.** A document has exactly one authority at any instant, enforced rather than assumed (AX1). The mechanism is unchanged in shape if the service is scaled deliberately beyond one instance (AX4).

**Secondary outcomes.** The condition is reported rather than inferred from symptoms (AX3). The window in which acknowledged work can be lost is bounded by proof-driven detection (AX2). A live session is interrupted only by a reload, and never left silently stale (AX5).

**Outcome-axis alignment.** Whole survey: primary AX1, AX4; secondary AX3, AX2, AX5. Round 1 leaned AX1/AX4 with AX5 traded away; Round 2 recovered AX2 through detection cadence and added AX3.

---

## §5 Anti-goals (out-of-scope; deferred)

- **AG-1 Mergeable / CRDT document semantics.** Rejected at Q1(c). Composes later only as a replacement for the lease, not alongside it -- if concurrent writers ever become safe by construction, the lease becomes unnecessary rather than complementary.
- **AG-2 Instance-to-instance networking or proxying.** Rejected at Q4(c). Composes later if read-scaling demands it, and would sit on top of the lease by asking the holder rather than replacing ownership.
- **AG-3 Per-document routing affinity.** Rejected at Q4(d). Composes later as an optimisation that reduces refusals; the lease would remain the correctness mechanism underneath it.
- **AG-4 Write-through acknowledgement.** Rejected at Q2(d) and again at Q5(d). Composes later only if the accepted loss window proves unacceptable in practice.
- **AG-5 Handoff of unflushed state to the new authority.** Rejected at Q2(c). Composes later as a refinement of retirement if measurement shows real work is being lost.
- **AG-6 Multi-instance read scaling.** Not addressed. The lease governs authority, not capacity, and nothing here makes additional instances useful yet -- only safe.

---

## §6 Flags / open questions for the design phase

- **F1 An actionable refusal.** Q4(a) requires that a client refused by a non-holder can make progress rather than loop back to the same instance. The refusal payload and the client's response to it are undesigned and are the sharpest correctness risk in the picked direction.
- **F2 Lease expiry against clock skew.** A lease needs a TTL, and two holders must be impossible when clocks disagree. This system fixed a clock defect today (B177) in which a peer's offset absorbed the age of its own tab; a lease that trusts wall time inherits that class of failure. The design should prefer storage generations or server-side monotonic checks over comparing timestamps across instances.
- **F3 The disconnect TTL threshold.** Q6(b) needs a number. It must come from measurement rather than judgement: this proposer shipped a guessed threshold in H13.1 that sat above both measured values and therefore could never fail.
- **F4 Defining an unreconcilable version gap.** Q6(d) is the hardest detector to state without false positives, and an over-eager definition turns a reload watchdog into a reload loop.
- **F5 Outbox interaction on reload.** A client reloading mid-session replays a durable outbox. The design must confirm that retirement-triggered reloads cannot duplicate submissions, particularly where the retiring instance already acknowledged an edit it then failed to flush.
- **F6 Local and single-instance behaviour must be explicit.** With no revision identity and no second writer, every element here must be deliberately inert rather than accidentally so, or the development environment diverges from production in the mechanism meant to guarantee correctness.

---

## §7 Sequencing / cross-work considerations

### §7.1 Branch + review strategy

Design-of-record first, reviewed before any implementation, per the director's instruction. The work then splits cleanly along the server/client seam and can land as two reviewable pieces: the lease and retirement on the server, the watchdog on the client. The client watchdog is independently valuable and independently testable, and it is the half that keeps working when the server cannot speak.

### §7.2 Composability with concurrent / pending work

A narrow fix was already part-built before this survey and has been removed from the working tree rather than carried forward: a `retireAll` broadcast on the hub, a global revision-marker module, and a `revision` field on the health report and the snapshot body. None was committed and none was deployed; the diff is preserved outside the repository as `/tmp/probe/b178-premature.patch` and `/tmp/probe/b178-revision.mjs.bak`.
The retire broadcast and the two `revision` fields survive this survey as ideas and should be reintroduced by the design with consumers attached. The global revision marker does not survive: Q1 replaced a service-wide revision claim with a per-document lease, so it must be rewritten rather than extended.
It was removed rather than left in place because the dead-symbol scanner correctly refused three exports with no production consumer -- implementing ahead of a design is exactly what that gate exists to catch.
H13.7 is on the board and B178 is filed; both predate the survey and describe the narrow framing, so both need restating against this envelope.

### §7.3 Compressed-timeline candidate?

No. The director explicitly asked for a durable design ahead of implementation, and the defect is currently masked by a workaround that costs nothing -- reloading both tabs. There is no pressure that would justify trading design quality for speed, and the failure mode being designed against is silent shared-state corruption, which is the worst class to rush.

---

## §calibration — Calibration data point

- **stakeholder-time-cost-minutes:** 8
- **comparison-baseline:** `surveys/b163-rules-system-survey.md`
- **notes:** Q2 forced a tradeoff the proposer had been avoiding by listing options rather than choosing, and the answer turned Q5 from a cost knob into the safety control -- the single most useful movement in the survey. Q6 returned all four options, which is composition rather than contradiction and needed no reconciliation. The most valuable input arrived before Round 1: the director's question about deliberate scaling separated revision skew from document ownership, and the proposer had been building for the former while the latter was the real defect. That suggests a Round-0 habit worth testing -- asking the decision-authority what the problem IS before asking what the solution should optimise for.

---

## §8 Cross-references

- **B178** -- `docs/BACKLOG.md`, the defect this envelope serves. Filed against the narrow framing and to be restated.
- **H13.7** -- `docs/BOARD.md`, the board item, likewise scoped to the narrow framing.
- **B177** -- the clock defect fixed the same day; relevant to F2, because a lease that trusts wall time inherits the failure class B177 removed.
- **surveys/b163-rules-system-survey.md** -- the prior use of this instrument, and the calibration baseline.
- **Design artifact** -- not yet written. This envelope is its load-bearing input.
