export function draw() { return 1; }
export async function chrome() { return import('./main.js'); }
export async function anything(name) { return import(name); }
