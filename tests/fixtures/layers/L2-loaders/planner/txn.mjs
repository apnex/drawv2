import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
export const lazy = () => req('./store.js');
export const vm = () => import('node:vm');
export const builtin = () => process.getBuiltinModule('module');
