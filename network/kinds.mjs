/*
THE NETWORK'S ROWS -- everything the network plugin brings to a composition's kinds, in one list (S-a, H18.11):

  PIPE_ROW        its own kind, `pipe` (network/pipe-kind.mjs; H17.22 N-b)
  TRANSIT_FIELDS  a field it contributes to the product's node: `transit` (ruled 2026-10-03, G3) -- whether what arrives at
                  the anchor passes through it, stored only where the author chose other than the type's default (TR-7).
                  The network gives it its meaning: the rules that read it, and the refusal of a value a type does not
                  offer, are its tenant's (network/transit.mjs). A composition without the network refuses the field.

A composition with the network is `productKinds(...NETWORK_ROWS)`, so adding a row here reaches every one of them.
*/
import { PIPE_ROW } from './pipe-kind.mjs';

const TRANSIT_FIELDS = {
	kind: 'node', owner: 'the network', extends: true,
	fields: { transit: (v) => typeof v === 'boolean' },
	optional: ['transit'],
};

export const NETWORK_ROWS = [PIPE_ROW, TRANSIT_FIELDS];
