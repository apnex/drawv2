/*
Relations -- the core's maintained reverse indices over the entity graph, kept in sync with a Model off its
onChange spine (B341, H21.8; O1: the core keeps the anchor capability -- identity, position, occupancy, resolving a
reference). The generic incremental-view mechanism lives in `engine/ivm.mjs` (`maintainIndex`); here we declare the three
core views, parameterized by what the composition's rows declare (`references`, `gathers`, `ANCHOR_KINDS`):
  - reference incidence  targetId -> Set<referrerId>   for any kind whose row declares `references` (and does not `gathers`)
  - gathering            memberId -> gathererId        for any kind whose row declares `gathers` (O-c)
  - cell occupancy       cellKey  -> Set<anchorId>     for the anchor kinds (`ANCHOR_KINDS`, R13, O1)

Names no plugin's kind and imports no plugin module: `network/link-queries.mjs` asks `referrersOf(id, 'link')` and
`devices/occupancy.mjs` asks `anchorsAt(p)`.
*/

import { maintainIndex } from './ivm.mjs';
import { byId } from '../model/order.mjs';   // B246: the one derivation order
import { ANCHOR_KINDS } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)

export function makeRelations(model, { cellOf } = {}) {   // cellOf injected (composition root) -- engine imports no kernel
	if (!cellOf) throw new Error('makeRelations requires an injected { cellOf } (px->cell) -- wire it at the composition root');

	const keyOf = (e) => cellOf(e.x) + ',' + cellOf(e.y);
	const cellsOf = (e) => [cellOf(e.x) + ',' + cellOf(e.y)];
	const kindOfId = (id) => id.slice(0, id.indexOf('-'));
	const refTargets = (kind) => (model.kinds.gathers[kind] ? [] : (model.kinds.row(kind)?.references ?? []));
	const isRefKind = (kind) => refTargets(kind).length > 0;

	const incident = maintainIndex({
		refsOf: (e) => {
			const targets = new Set(refTargets(kindOfId(e.id)));
			return Object.values(e).flat().filter((v) => typeof v === 'string' && targets.has(kindOfId(v)));
		},
		kind: 'set',
	});
	const member = maintainIndex({ refsOf: (e) => e[model.kinds.gathers[kindOfId(e.id)]], kind: 'single' });
	const cellAnchors = maintainIndex({ refsOf: cellsOf, kind: 'set' });

	return {
		apply(action, kind, entity) {
			if (isRefKind(kind)) {
				if (action === 'put') incident.put(entity);
				else if (action === 'set') incident.set(entity);
				else if (action === 'del') incident.del(entity.id);
			} else if (model.kinds.gathers[kind]) {
				if (action === 'put') member.put(entity);
				else if (action === 'set') member.set(entity);
				else if (action === 'del') member.del(entity.id);
			} else if (ANCHOR_KINDS.includes(kind)) {
				if (action === 'put') cellAnchors.put(entity);
				else if (action === 'set') cellAnchors.set(entity);
				else if (action === 'del') cellAnchors.del(entity.id);
			}
		},
		rebuild() {
			incident.clear(); member.clear(); cellAnchors.clear();
			for (const kind of model.kinds.list) {
				if (isRefKind(kind)) model.all(kind).forEach((e) => incident.put(e));
				else if (model.kinds.gathers[kind]) model.all(kind).forEach((e) => member.put(e));
				else if (ANCHOR_KINDS.includes(kind)) model.all(kind).forEach((e) => cellAnchors.put(e));
			}
		},

		// every entity referencing `targetId` (optionally narrowed to `kind`), in ascending id order (B246)
		referrersOf(targetId, kind = null) {
			const s = incident.get(targetId); if (!s) return [];
			const out = [];
			s.forEach((id) => {
				const k = kindOfId(id);
				if (kind && k !== kind) return;
				const e = model.get(k, id);
				if (e) out.push(e);
			});
			return out.sort(byId);
		},
		gathererOf(id) {
			const gid = member.get(id);
			return gid ? model.get(kindOfId(gid), gid) : undefined;
		},
		atCell(id) {
			const e = model.endpointOf(id);
			return e ? [cellOf(e.x), cellOf(e.y)] : undefined;
		},
		occupiedAnyAt(p) { return cellAnchors.has(keyOf(p)); },
		anchorsAt(p) { return [...(cellAnchors.get(keyOf(p)) ?? [])]; },
	};
}
