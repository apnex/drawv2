/*
Limits - the caps on user-supplied values, in ONE place.

These are not geometry and not a field taxonomy. They are the bounds on what a person may type, and
both peers enforce them: the browser to stop a field growing past what it will store, the server to
refuse what arrives anyway. Two enforcers, one number, or the pair drifts and the browser starts
offering what the server rejects.

B86 found each of these stated five and two times respectively, with NO shared constant, across
`server/validate.js`, `server/store.js`, `server/protocol.js`, `app/src/sync.js` and
`app/src/labeledit.js`.

THE TWO RESPONSES DIFFER ON PURPOSE, and sharing the number is what makes that safe rather than
accidental. The client and the store TRUNCATE, because a name that is too long is a slip and
silently losing the tail is kinder than an error nobody asked for. The server's validator REJECTS,
because by the time a value reaches it the caller is a program and a quiet truncation would make it
believe something it did not write. B86 recorded that this is "not currently a bug because
truncation happens first, and is the kind of pair that becomes one" -- it becomes one the moment the
two numbers disagree, which is precisely what a shared constant prevents.

NOT HERE, deliberately:

  the principal cap of 64 the local-part length inside the `PRINCIPAL` regex. It shares a VALUE with
                          the name cap and nothing else, and folding them together would couple two
                          unrelated limits so that changing one silently moved the other.
  the zone minimum        one grid cell, so it derives from `kernel`'s `STD.pitch` at each site.
                          `model/` is a sovereign sibling of `kernel/` and imports it nowhere; the
                          shared source already exists one layer down.
*/

// the longest name a diagram, node, group or zone may carry
export const NAME_MAX = 64;

// the longest string inside a content region's `value`
export const CONTENT_VALUE_MAX = 256;

/*
B220 -- the longest caption a beat may carry. Its own constant, not NAME_MAX.

A name identifies a thing: `spine-1`, `core-router`. A caption is the narration of a beat -- a
sentence someone reads while the diagram builds itself. They are different kinds of string and 64
characters is about ten words, which is a name-sized budget for prose.

The value that exposed this was 105 characters and entirely reasonable: "Optus Target State
Architecture: Hybrid Multi-Tenant NCC Core with Centralized Security & On-Prem Transit". The commit
path stored it, the diagram worked all session, and the BOOT path refused the file -- so a document
the system produced could not be reloaded by the system, and the diagram simply went missing.

256 matches CONTENT_VALUE_MAX, which is the nearest thing to prose the schema already carries.
*/
export const CAPTION_MAX = 256;

// the largest footprint a node may span, in cells. Its own constant rather than a second use of
// NAME_MAX: the two share a value today and mean nothing alike, so they must be free to diverge.
// Both peers cap it -- `app/src/commands.js` while resizing, `server/validate.js` on arrival -- and
// neither had a shared source. Found while closing B86 rather than listed in it.
export const SPAN_MAX = 64;

/*
H12.5 -- the bounds on an authored spawner.

These ARE user-supplied values, which is why they belong here and why the derived cap on how many
movers may be alive at once does not: `MAX_MOVERS_PER_SPAWNER` in `engine/movers.mjs` is a runtime
safety bound over numbers that have already passed these, and folding the two together would give
this file a second concern.

The floor on the interval is what keeps a spawner authorable-but-not-abusive: below it the departure
rate stops being a rate a person chose and starts being a way to ask for a swarm. The ceiling on
speed is the same idea from the other side -- a mover crossing the whole canvas within one frame is
not visible motion, it is a flicker.
*/
export const SPAWN_INTERVAL_MIN = 50;        // ms between departures, floor
export const SPAWN_INTERVAL_MAX = 600_000;   // ms, ceiling -- ten minutes is already "effectively off"
/*
CELLS per second, not pixels -- B172. The grid is this system's unit of distance (B110: positions
are anchors, never pixels), so a speed in pixels silently changes meaning if the pitch ever moves,
and cannot be reasoned about without knowing it. 20 cells/s crosses the whole canvas in under two
seconds, which is the point past which motion stops reading as motion.
*/
export const SPAWN_SPEED_MAX = 20;

/*
H15.18 -- the bounds a region's text size may take.

Bounded because the size feeds layout arithmetic: `contentLayout` divides a region's box by the line
height to decide how many lines fit, so an absurd value asks the wrapper for a line count nobody
wanted. The floor is legibility rather than arithmetic -- below about 6 the glyphs stop resolving on
a normal display, and a caption nobody can read is not a caption.
*/
export const FONT_MIN = 6;
export const FONT_MAX = 48;
