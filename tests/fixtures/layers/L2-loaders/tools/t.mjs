import { builtinModules } from 'node:module';
export const quoted = "import { x } from './y.mjs';";
export const both = () => eval(quoted) ?? builtinModules;
