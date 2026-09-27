import path from 'node:path';
import { WebSocketServer } from 'ws';
import { validate } from '../planner/validate.js';
import { LIMIT } from '../planner/txn.mjs';
const counts = {};
for (const k of ['nodes', 'waypoints', 'links', 'zones', 'groups']) counts[k] = LIMIT;
export function accept(id) { return validate(id) && counts && path.sep && WebSocketServer; }
