/*
H26.3 (dev/design/components/INPUT-CAPTURE.md acceptance step 7) -- EVERY MODULE A PROCESS LOADS, LOGGED, FOR A TEST ALONE, IN A PROCESS
OF ITS OWN. A process run with `--import` of this file appends each URL it resolves to the file RESOLVE_LOG names, so a test can say
what a server or the export loads -- that neither loads input-capture, which only the pages compose. Nothing in draw changes.
*/
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url, { data: { log: process.env.RESOLVE_LOG } });
