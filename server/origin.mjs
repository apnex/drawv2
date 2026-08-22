#!/usr/bin/env node
/*
Origin policy -- H9.28/B33. Is this request coming from a page we know?

Separate from identity.mjs on purpose. That module answers WHO is asking and is the authentication
boundary; this answers WHERE the request was made from, which is a different question with a
different failure mode. Authentication says the caller is Alice. It cannot say that Alice meant to
make this request, and a cross-site request carries Alice's cookie whether or not Alice intended it.

The websocket is why this exists. CORS does not gate a websocket upgrade -- there is no preflight
and no Access-Control check -- so a page on any origin can open one to us, and the browser attaches
the cookies for OUR origin automatically. IAP then sees a valid session and admits it. Whether that
is exploitable today rests on the SameSite attribute of a cookie set by a Google product, which is
neither ours to set nor something we verified, and is exactly the kind of dependency that should not
be load-bearing -- especially with in-app SSO under consideration, where the cookie WOULD be ours.

An absent Origin is allowed, and that is not a hole. Browsers always send Origin on a websocket
handshake and on cross-origin fetches; a client that omits it is not a browser, and a non-browser
caller does not carry a victim's cookies. The attack this closes is specifically browser-driven.
*/
const normal = (o) => String(o || '').trim().toLowerCase().replace(/\/+$/, '');

export function originPolicy(allowList = '') {
	const extra = new Set(String(allowList).split(',').map(normal).filter(Boolean));
	return function originAllowed(origin, host) {
		if (!origin) return true;                       // not a browser -- see above
		let url;
		try { url = new URL(origin); } catch { return false; }
		// same-origin is the ordinary case: the editor connects to the host that served it
		if (host && url.host.toLowerCase() === String(host).toLowerCase()) return true;
		return extra.has(normal(origin));
	};
}
