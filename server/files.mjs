/*
Files -- the Store's persistence surface, and the whole of it.

`D19` injected `writeDoc` so a test could fail or observe a flush. That covered the write and
nothing else: boot listed and read through `fs` directly, and delete called `rmSync` three times
(B55). Three of the four operations bypassed the seam, so a non-filesystem backend could not be
supplied by injection at all -- which is what a GCS deployment needs.

Four verbs, and they take NAMES rather than paths. That is the load-bearing detail: an object store
has keys, not directories, so a seam that passed `path.join(dir, file)` around would push filesystem
shape into a place that has none. The implementation owns where a name lives.

  list()             -> Promise<string[]>   every document name currently stored
  read(name)         -> Promise<string>     utf8 text, rejects if absent
  write(name, text)  -> Promise<void>       atomic: a reader sees the old text or the new, never a splice
  remove(name)       -> Promise<void>       idempotent, absent is success

Every verb is ASYNC, including the filesystem one that has no need to be (B59). The seam shipped
synchronous, which quietly excluded the backend it was built for: there is no synchronous HTTP, so
`read(name) -> string` is unsatisfiable over GCS. A seam whose contract only the incumbent can meet
is not a seam. The filesystem implementation stays `*Sync` underneath because that is genuinely the
cheapest correct thing on a local disk -- what changed is the CONTRACT, not its cost here.

What this deliberately does NOT cover is `examples/`. That corpus is read-only content baked into
the image, and it is read straight from disk in every deployment -- only the mutable store moves.
*/

import fs from 'node:fs';
import path from 'node:path';

/*
The filesystem implementation, and the default.

Atomicity is write-then-rename, because `rename(2)` is atomic within a filesystem: a reader either
sees the old inode or the new one. That is exactly the property an object store provides for free on
a single PUT, and exactly the property a `gcsfuse` mount does NOT provide, since it emulates rename
as copy-then-delete -- which is why the cloud backend is an adapter rather than a mount (DEPLOY.md).
*/
export function fsFiles(dir) {
	fs.mkdirSync(dir, { recursive: true });
	const at = (name) => path.join(dir, name);
	return {
		async list() {
			return fs.readdirSync(dir);
		},
		async read(name) {
			return fs.readFileSync(at(name), 'utf8');
		},
		async write(name, text) {
			const file = at(name);
			const tmp = `${file}.tmp`;
			fs.writeFileSync(tmp, text);
			fs.renameSync(tmp, file);
		},
		async remove(name) {
			// `force` makes absence success rather than an error, which is what idempotent means
			// here: delete is called on a best-effort basis and must not throw on a second attempt.
			fs.rmSync(at(name), { force: true });
			// the write-then-rename above can leave this behind if the process died between the two
			fs.rmSync(`${at(name)}.tmp`, { force: true });
		},
	};
}
