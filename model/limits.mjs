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

// the largest footprint a node may span, in cells. Its own constant rather than a second use of
// NAME_MAX: the two share a value today and mean nothing alike, so they must be free to diverge.
// Both peers cap it -- `app/src/commands.js` while resizing, `server/validate.js` on arrival -- and
// neither had a shared source. Found while closing B86 rather than listed in it.
export const SPAN_MAX = 64;
