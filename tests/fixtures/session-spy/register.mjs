/*
H26.2's verification (F6) -- A WINDOW ONTO DRAW'S GESTURE SESSION, FOR A TEST ALONE, IN A PROCESS OF ITS OWN.

Input's session is private (G7), and draw never reads the one thing that tells a chain becoming the live gesture from a chain that
cancels it and starts another: the live gesture's `row`, the id of the row that opened it. So a test run with `--import` of this file
resolves `@apnex/input-binding`, as kernel/input-rules.mjs imports it, to wrapper.mjs -- the very component, its session's operations
each logging the outcome it answers -- and reads that log. Nothing in draw changes, and no other process sees the wrapper.
*/
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
