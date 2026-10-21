// run under register.mjs: each gesture corpus scenario named on the command line, and the session operations it made, as JSON
import { SCENARIOS, record } from '../gesture-corpus.mjs';

const out = {};
for (const id of process.argv.slice(2)) {
	globalThis.__sessionLog = [];
	record(SCENARIOS.find((s) => s.id === id));
	out[id] = globalThis.__sessionLog;
}
process.stdout.write(JSON.stringify(out));
