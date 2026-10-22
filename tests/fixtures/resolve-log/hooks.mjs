// the resolve hook register.mjs installs: every URL resolved, appended to the log, the resolution itself unchanged
import fs from 'node:fs';

let log = null;
export function initialize(data) { log = data?.log ?? null; }
export async function resolve(specifier, context, next) {
	const r = await next(specifier, context);
	if (log) fs.appendFileSync(log, `${r.url}\n`);
	return r;
}
