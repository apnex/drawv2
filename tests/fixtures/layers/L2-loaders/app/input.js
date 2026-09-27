const code = "import('../sim/situation.mjs')";
export const run = () => eval(code);
export const host = () => new Function('return this')();
export const cjs = () => require('./other.js');
