// FROZEN REFERENCE — the pre-CS1 single-op planner, lifted verbatim from server/store.js at
// commit f31ff79 and kept only as the differential oracle for server/txn.mjs#plan. It is not
// wired into anything. GR5: the old implementation is deleted only in the commit that lands its
// own green differential, so the oracle must outlive the code it replaced.
import { groupAfterRemoval } from '../../engine/index.mjs';
import { validateMutation } from '../../server/validate.js';

export // S1b: the mutation PLANNER — pure (reads the model, applies NOTHING). Runs the validateMutation gate,
// then computes the ordered op-list for the mutation + its server-side cascade (idempotent with the
// client's explicit cascade deltas). {ok:false,error} rejects BEFORE any write, so apply()-via-commit
// keeps the reject-writes-nothing guarantee without a rollback (atomicity by purity). load-consuming —
// this is what makes apply() a genuine 2nd consumer of prism.commit's load->mutate->validate->save.
function planMutation(model, mutation) {
	const err = validateMutation(model, mutation);
	if (err) return { ok: false, error: err };
	const { action, kind, entity } = mutation;
	const ops = [];
	const trimGroupsHolding = (memberId) => model.all('group').forEach((group) => {
		if (!group.members.includes(memberId)) return;
		const { remaining, dissolve } = groupAfterRemoval(group.members, (m) => m === memberId);
		if (dissolve) ops.push({ action: 'del', kind: 'group', id: group.id });
		else ops.push({ action: 'set', kind: 'group', id: group.id, patch: { members: remaining } });
	});
	if (action === 'put') {
		if (!model.get(kind, entity.id) && model.all(kind).length >= 2000) return { ok: false, error: `${kind} collection limit reached` };
		ops.push({ action: 'put', kind, entity: { ...entity, ...(entity.members ? { members: [...entity.members] } : {}) } });
	}
	if (action === 'set') {
		if (!model.get(kind, entity.id)) return { ok: false, error: `set on missing entity: ${entity.id}` };
		ops.push({ action: 'set', kind, id: entity.id, patch: { ...entity } });
	}
	if (action === 'del') {
		if (kind === 'node') {
			model.linksOf(entity.id).forEach((link) => ops.push({ action: 'del', kind: 'link', id: link.id }));
			trimGroupsHolding(entity.id);
		}
		if (kind === 'waypoint') {
			model.linksAt(entity.id).forEach((link) => {
				if (link.src === entity.id || link.dst === entity.id) ops.push({ action: 'del', kind: 'link', id: link.id });
				else ops.push({ action: 'set', kind: 'link', id: link.id, patch: { via: link.via.filter((w) => w !== entity.id) } });
			});
			trimGroupsHolding(entity.id);
		}
		ops.push({ action: 'del', kind, id: entity.id });
	}
	return { ok: true, ops };
}
