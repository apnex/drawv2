# draw - instance authority and client self-repair

The sovereign spec for who may answer for a document, and for what a client does when it can no longer trust what it is running.

> **Status: DESIGN-OF-RECORD, awaiting review. Nothing here is implemented.**\
> Concretizes `surveys/b178-instance-authority-survey.md`, which captured the director's intent on 2026-09-02.\
> Serves **B178** and **H13.7**, both of which were filed against a narrower framing and are restated by this document.
>
> Section 1 is FACT -- measured in production on 2026-09-02.\
> Section 7 answers the six flags the survey carried forward.\
> Section 8 lists what still needs a ruling.

---

## 0. Two problems, deliberately separated

The defect that prompted this looked like one thing and is two.

**Revision skew** is a client running code the service has replaced.\
**Document ownership** is two instances both authoritative for one document.

They arrive together at a deploy, which is why they were tangled.\
They are not the same problem: ownership breaks at N instances even when every instance runs an identical revision, and no amount of revision checking would notice.

The separation is the director's, and it came from asking what happens if Cloud Run is deliberately scaled past one instance.\
A mechanism built only for revision skew would have to be replaced the first time the service scales, which is the outcome he asked to avoid.

---

## 1. What was measured

Production, 2026-09-02.\
Revision `draw-00073-4l8` was still serving forty-five minutes after `draw-00074-dmh` had taken one hundred percent of traffic.

Both instances held `diagram-c51225` in memory.\
Each broadcast changes only to its own connected clients, so an edit on one never reached the other.\
Both flushed to GCS, where the `ifGenerationMatch` precondition refused the loser: **3203 flush failures**, `/health` reporting `degraded`.

The user-visible symptoms were a deleted tower reappearing and an armed waypoint flickering.\
Neither reproduces in a single tab, and a CDP probe driving the real UI through place, delete and re-arm found the tower stays deleted and the class holds steady.

**Why the instance would not retire.**\
Cloud Run terminates an instance once its in-flight requests drain.\
A websocket never drains.\
So the socket prevents the shutdown that would close the socket, and `SIGTERM` -- which the process already handles and which would have flushed cleanly -- never arrives.

---

## 2. The invariant

**At any instant, exactly one instance is authoritative for a given document.**

This was always true by assumption and never enforced.\
The precondition in `server/files.mjs` detects a violation at the moment of writing and correctly refuses to overwrite, but nothing acts on what it detects: `server/store.js` counts the failure, logs it, reschedules, and retries forever while continuing to answer clients.

An instance that has lost authority and keeps answering is asserting an authority it does not hold.\
That is **I15** -- fabricating success is the sin -- and it is why hardening the detection was the wrong fix even though it was the cheapest.

---

## 3. Authority is a lease

Authority is held, not assumed.\
An instance acquires a **lease** on a document before serving it, and holds the lease for as long as it serves it.

**Mediated through storage**, because storage is the one substrate every instance already shares.\
No instance-to-instance addressing, no Admin API, no routing-layer affinity: each of those is a dependency added to hold one fact, and two of them live somewhere the application cannot test.

**Identical at one instance or twenty.**\
With a single instance the lease is always free and always acquired, so nothing observable changes today.\
That is the property that makes deliberate scaling an extension rather than a rewrite, and it is the whole reason the lease is preferable to a service-wide revision marker.

### 3.1 What a non-holder does

A client may reach an instance that does not hold the lease for the document it asks for.\
That instance **acquires the lease if it is free or expired, and otherwise refuses**.

A refusal must be **actionable**.\
A client bounced by a non-holder and routed straight back to the same non-holder would loop, and a loop is worse than the divergence being prevented.

### 3.2 Expiry must not trust wall time

A lease needs an expiry, or an instance that dies without releasing would strand its documents forever.\
It must be impossible for two instances to believe they hold the same lease at once.

**Comparing timestamps across instances is exactly the failure class removed this morning.**\
B177 was a clock offset that absorbed the age of a tab, and the two peers disagreed by tens of seconds while both believed they were right.\
A lease that trusts wall time inherits that, and inherits it in the one place where being wrong corrupts shared state rather than mis-drawing a packet.

Expiry is therefore expressed against **storage generations and the storage service's own clock**, never against a timestamp one instance wrote and another compared to its own.

---

## 4. Losing authority

An instance that discovers it is not the holder **retires**: it stops answering for that document and tells its clients.

**It does not exit.**\
Exiting drops the sockets, and a reconnect from a page whose JavaScript came from the superseded revision puts the same stale client onto a new socket.\
The connection would be refreshed and the application would not.\
Retirement is a message to the page, and the page replaces both.

**It does not defend its unflushed edits.**\
Those were computed against a document the winning copy never saw, which makes them a fork rather than the user's work, and preserving a fork prolongs the divergence retirement exists to end.\
This is a knowing trade of **AX2 data safety** for convergence, ruled at survey Q2.

The trade is bounded by how fast the loss is detected, which is what makes section 5 a safety mechanism rather than a tuning choice.

---

## 5. Detection follows proof

Two signals already **prove** an instance has lost authority, and both are free.

A **write conflict** is proof: another writer holds a newer generation.\
A **failed lease renewal** is proof: someone else holds what this instance believed it held.

Both drive retirement immediately.\
The loss window is therefore near-zero exactly while a document is being edited, which is the only time there is anything to lose.

A **slow background poll** exists only for the idle case, where by definition nothing is at risk.\
It is a backstop, not the primary mechanism, and saying so is what keeps this from being mechanism against an unmeasured problem (**A11**).

Deliberately NOT chosen: verifying the lease on every commit.\
It is the strongest guarantee short of write-through, and it puts a storage round trip on the commit path -- the latency the debounced flush exists to avoid, and which the director declined twice.

---

## 6. The client repairs itself

The server cannot be the only trigger.\
The deadlock in section 1 is precisely a server that is unable to act, and a mechanism that depends on the server being willing and able inherits it.

### 6.1 The ladder

A client moves through **rungs**, and the rungs are deliberately distinct because they call for opposite responses.\
Ruled by the director on 2026-09-02.

**Rung 1 -- `offline`.**\
The socket is gone.\
This is the response to any loss of connection, and it is **reversible, informative and safe**.\
The application keeps running, edits keep accumulating in the durable outbox, and reconnection is attempted with backoff.\
`#lockstate` already renders this today and already answers exactly the right question.

**Rung 2 -- `stale`.**\
There is positive evidence this client should not be trusted.\
Evidence, ruled at survey Q6, is any of: the server said so; the revision that served this page differs from the revision now answering; or a version gap the client cannot reconcile.\
The response is a full page reload.

**Rung 3 -- `unreachable`.**\
A reload is warranted but cannot be completed.\
The client holds its ground, says so, and keeps trying.

### 6.2 A disconnection is not staleness

The rungs must not collapse into each other, and the reason is sharper than tidiness.

**A reload requires the server to be up.**\
Reloading in response to a lost connection is the one action guaranteed to fail at precisely the moment it fires: it discards a working application and replaces it with a browser error page.

So a timeout may raise `offline` and may raise **suspicion**, but a timeout alone never triggers a reload.\
Section 6.1's rung 2 needs evidence that the client is stale, and every form of that evidence requires having heard from the server -- which also establishes that the server can be heard from.

### 6.3 Preflight, and why it is the same call

A client about to reload first confirms it can.

The confirmation is a fetch of `/health`, and this is the elegant part: **that one call answers both questions at once**.\
It returns the live revision, which is the staleness test, and its success is the reachability test.\
A client that gets an answer knows both that it is stale and that reloading will complete.\
A client that gets nothing drops to rung 3 rather than reloading into a void.

An HTTP request is routed afresh and therefore reaches the **current** revision, while a websocket stays pinned to whichever revision it connected to.\
That asymmetry is the only thing in the system able to tell a stranded tab that it is stranded, and it costs one field on a report every client can already reach.

---

## 7. The survey's flags, answered

**F1 -- an actionable refusal.**\
Answered in 3.1 as a requirement, not yet as a payload.\
Still owed: what a refusal carries so a client makes progress.\
See section 8.

**F2 -- lease expiry against clock skew.**\
Answered in 3.2.\
Expiry is expressed against storage generations, never against timestamps compared across instances.

**F3 -- the disconnect TTL threshold.**\
Partly dissolved by 6.2.\
The threshold no longer gates a reload, only the `offline` rung, which is reversible and safe -- so getting it wrong is cheap rather than destructive.\
It must still come from measurement: a guessed threshold shipped in H13.1 sat above both measured values and could never have failed.

**F4 -- defining an unreconcilable version gap.**\
Not yet answered.\
It is the hardest detector to state without false positives, and an over-eager definition turns a watchdog into a reload loop.\
See section 8.

**F5 -- outbox interaction on reload.**\
Not yet answered.\
A reloading client replays a durable outbox, and retirement can follow an edit the retiring instance acknowledged but never flushed.\
The design must establish that this cannot duplicate a submission.

**F6 -- local and single-instance behaviour.**\
With no revision identity and no second writer, every element here must be **deliberately inert**, not accidentally so.\
A development environment that diverges from production in the mechanism meant to guarantee correctness is worse than no mechanism.

---

## 8. What this document cannot settle

**The refusal payload (F1).**\
A non-holder must refuse in a way that lets the client make progress rather than loop.\
Whether that is the holder's identity, a retry directive, or an instruction to reload is a decision about how much topology a client may see.

**The version-gap predicate (F4).**\
Needs a precise, false-positive-free definition, or it should be dropped from the evidence set and the other three detectors relied on.

**Outbox replay safety (F5).**\
Needs establishing before any reload is automatic.

**Sequencing.**\
The client ladder is independently valuable, independently testable, and is the half that still works when the server cannot speak.\
It is the recommended first landing.
