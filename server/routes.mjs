/*
What the REST surface answers, declared (B119).

Methods could not be INFERRED from `server/rest.js` honestly. Two attempts are recorded in
tools/routes.mjs: by position, which mislabelled the workspace family, and by nearest guard, which
reported `diagrams` as write-only. The router expresses its guards in several shapes and a scanner
reading control flow will keep guessing, so the surface says what it is instead.

A declaration is only worth having if it cannot drift, so two things hold it. `tests/routes.test.js`
issues every pair below against a live server and fails if one answers 404 or 405 -- a declared
route that is not there, or a method the router does not take. And `tools/routes.mjs` derives the
route NAMES independently, so a family added to the router and forgotten here is caught even if
nobody writes a test for it.

`:id` and `:name` are placeholders the prover fills. Paths are relative to the version prefix, which
is a door rather than a route (`/api/v1` or `/connect/v1`).

Two paths are deliberately ABSENT because they are not relative to that prefix, and listing them
here made the rule above false. The root `/health` is the liveness contract Cloud Run and the
Dockerfile probe, so it carries no credential and must not start needing one. `/d/<id>.svg` is the
picture, reached through its own door entry (B101).

`health` below was always the correct DECLARATION -- prefix-relative, so `/api/v1/health` -- and the
server simply never implemented it. The prover papered over the gap by special-casing this one entry
to the root, so it proved a different route from the one declared, and `draw health` asked for the
declared one and collected a 404 in every configuration for two milestones (B132). The route exists
now and the exception is gone.
*/
export const ROUTES = [
	{ path: 'health',                          methods: ['GET'],            about: 'store health, through the versioned door -- what an agent reads' },

	{ path: 'diagrams',                        methods: ['GET', 'POST'],    about: 'list, and mint a new one' },
	{ path: 'diagrams/:id',                    methods: ['GET', 'DELETE'],  about: 'the document, and removing it' },
	{ path: 'diagrams/deleted',                methods: ['GET'],            about: 'what is inside the delete window (B109)' },
	{ path: 'diagrams/deleted/:id/restore',    methods: ['POST'],           about: 'bring one back from the window' },
	{ path: 'diagrams/:id/commit',             methods: ['POST'],           about: 'a batch of ops as one transaction' },
	{ path: 'diagrams/:id/history',            methods: ['GET'],            about: 'the change log' },
	{ path: 'diagrams/:id/lock',               methods: ['GET', 'POST', 'DELETE'], about: 'the write slot' },
	{ path: 'diagrams/:id/undo',               methods: ['POST'],           about: 'reverse a change or a run' },
	{ path: 'diagrams/:id/redo',               methods: ['POST'],           about: 'reapply what undo reversed' },
	{ path: 'diagrams/:id/selection',          methods: ['PUT'],            about: 'the authoritative selection' },
	{ path: 'diagrams/:id/grants',             methods: ['POST'],           about: 'grant access to this diagram' },
	{ path: 'diagrams/:id/grants/:principal',  methods: ['DELETE'],         about: 'revoke it; answers what remains' },

	{ path: 'diagrams/:id/context/:entity',    methods: ['GET'],            about: 'what surrounds an entity' },
	{ path: 'diagrams/:id/near',               methods: ['GET'],            about: 'what is around a point' },
	{ path: 'diagrams/:id/zones/:zone/contents', methods: ['GET'],          about: 'what falls inside a zone' },
	{ path: 'diagrams/:id/links/:link/path',   methods: ['GET'],            about: 'a route resolved to coordinates' },
	{ path: 'diagrams/:id/layouts',            methods: ['GET'],            about: 'the named grids' },
	{ path: 'diagrams/:id/layouts/:name/nearest', methods: ['GET'],         about: 'the legal anchor nearest a pixel' },
	{ path: 'diagrams/:id/layouts/:name/anchors', methods: ['GET'],         about: 'every anchor, or every free one' },

	{ path: 'diagrams/:id/nodes',              methods: ['POST'],           about: 'high-level create; `draw add` and `draw place` are preferred' },
	{ path: 'diagrams/:id/nodes/:entity',      methods: ['PATCH', 'DELETE'], about: 'high-level patch and remove' },
	{ path: 'diagrams/:id/links',              methods: ['POST'],           about: 'high-level create' },
	{ path: 'diagrams/:id/links/:entity',      methods: ['PATCH', 'DELETE'], about: 'high-level patch and remove' },
	{ path: 'diagrams/:id/zones',              methods: ['POST'],           about: 'high-level create' },
	{ path: 'diagrams/:id/zones/:entity',      methods: ['PATCH', 'DELETE'], about: 'high-level patch and remove' },
	{ path: 'diagrams/:id/groups',             methods: ['POST'],           about: 'high-level create' },
	{ path: 'diagrams/:id/groups/:entity',     methods: ['PATCH', 'DELETE'], about: 'high-level patch and remove' },

	{ path: 'workspace/agents',                methods: ['GET'],            about: 'what every agent is doing' },
	{ path: 'workspace/viewers',               methods: ['GET'],            about: 'who is looking at what' },
	{ path: 'workspace/grants',                methods: ['GET', 'POST'],    about: 'grants across everything you own' },
	{ path: 'workspace/grants/:principal',     methods: ['DELETE'],         about: 'withdraw one' },
	{ path: 'workspace/codes',                 methods: ['GET', 'POST'],    about: 'connection codes' },
	{ path: 'workspace/codes/:code',           methods: ['DELETE'],         about: 'retire one' },
];

// the route FAMILIES this declares, for comparison against what the router is seen to answer
export const families = () => [...new Set(ROUTES.flatMap((r) => r.path.split('/').filter((s) => s && !s.startsWith(':'))))].sort();
