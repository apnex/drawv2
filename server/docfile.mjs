/*
Docfile — the on-disk representation of a diagram, read and write, in ONE place.

A diagram file holds two things that must be published together: the document (config + status)
and its change log (the undo ring + the version watermark). They are ONE file, not two, for a
reason that outlives this milestone: flush() already rewrites the whole document on every debounce
tick, so an in-file log adds bytes to a write that already happens — whereas a sidecar adds a
second object that must stay consistent with the first across a rename that is not atomic on every
backend we may run on. One writeDoc publishes the config and the log describing it as one unit, so
there is no ordering rule because there is nothing to order.

The log is STORE-owned, not Model-owned. It must not appear in Model.toJSON(), because that value
is what GET /api/v1/diagrams/:id returns and what a snapshot
carries — none of which should ship up to 32 KiB of inverses. So the composition happens here,
at the store boundary, rather than inside the Model.

This is also the seam a future storage backend replaces: give it a different serialize/parse pair
and the store does not change.
*/

// The document is the human-readable half and stays pretty-printed and diffable; the log is
// machine data and is written compactly, one record per line, so a diff over a diagram file shows
// what the user changed rather than a reflowed blob.
export function serialize(doc, log) {
	const body = JSON.stringify(doc, null, '\t');
	if (!log) return body + '\n';
	const records = (log.records || []).map((r) => '\t\t\t' + JSON.stringify(r)).join(',\n');
	const block = [
		'\t"log": {',
		`\t\t"version": ${log.version},`,
		`\t\t"cursor": ${log.cursor},`,
		`\t\t"evicted": ${log.evicted},`,
		`\t\t"evictedHuman": ${log.evictedHuman || 0},`,
		'\t\t"records": [',
		records,
		'\t\t]',
		'\t}',
	].filter((l) => l !== '').join('\n');

	/*
	Append the block before the document's closing brace, by SLICING — never by
	`String.replace(regex, string)`.

	B13: the replacement argument to `String.prototype.replace` is a pattern, not a literal, so
	`$&`, $-backtick, `$'`, `$1` and `$$` inside `block` expand. `block` carries every log record,
	a record carries entity names, and a name is any string (validate.js FIELDS.node.name). A node
	named `a$&b` therefore injected the matched `"\n}"` into a JSON string literal and produced a
	file that no longer parsed — written successfully, `dirty` cleared, silent until the next boot,
	where D17/GR8 turned it into a refusal to start. The old form also anchored on /\n\}$/ and
	dropped the whole log when the body did not match.

	Slicing has neither failure mode: no pattern is interpreted, and the position is computed
	rather than matched.
	*/
	if (!body.endsWith('}')) throw new Error(`docfile.serialize: document body is not a JSON object, got ${JSON.stringify(body.slice(0, 40))}`);
	const head = body.slice(0, -1).trimEnd();          // everything up to, excluding, the closing brace
	const sep = head.endsWith('{') ? '\n' : ',\n';     // only the EMPTY document has no member to comma after
	return head + sep + block + '\n}\n';
}

// Splits a file back into { doc, log }. The log is returned as raw JSON for Log.from to
// interpret — this function does no validation beyond JSON.parse, so a malformed log is a
// tolerate-and-drop decision made by the caller, not a parse failure that loses the diagram.
export function parse(text) {
	const all = JSON.parse(text);
	const log = all.log ?? null;
	delete all.log;
	return { doc: all, log };
}
