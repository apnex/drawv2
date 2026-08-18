/*
Auth — Google OAuth 2.0 (installed-app flow) with plain fetch; no SDK.
Credentials: a standard OAuth client JSON (Desktop or Web type) placed at
<secretsDir>/google-credentials.json or pointed at by GOOGLE_OAUTH_CREDENTIALS.
The refresh token persists at <secretsDir>/google-token.json (mode 600).
Secrets live OUTSIDE the diagram data dir so the data volume carries no credentials;
secretsDir defaults to dataDir for back-compat when a caller passes only one arg.
*/

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/presentations';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export class GoogleAuth {
	constructor(dataDir, secretsDir = dataDir) {
		this.dataDir = dataDir;
		this.secretsDir = secretsDir;
		this.tokenFile = process.env.GOOGLE_OAUTH_TOKEN || path.join(secretsDir, 'google-token.json');
		this.token = null;
	}

	credentialsFile() {
		return process.env.GOOGLE_OAUTH_CREDENTIALS || path.join(this.secretsDir, 'google-credentials.json');
	}

	credentials() {
		try {
			const raw = JSON.parse(fs.readFileSync(this.credentialsFile(), 'utf8'));
			const c = raw.installed || raw.web || raw;
			if (c.client_id && c.client_secret) return c;
		} catch { /* missing or malformed */ }
		return null;
	}

	configured() {
		return !!this.credentials();
	}

	authorized() {
		return !!this.loadToken()?.refresh_token;
	}

	loadToken() {
		if (this.token) return this.token;
		try {
			this.token = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
		} catch { /* not yet authorized */ }
		return this.token;
	}

	saveToken(token) {
		this.token = { ...this.loadToken(), ...token };
		// the token is a RUNTIME artifact written on first authorization, so its dir may not
		// exist yet on a fresh checkout (secrets/ is gitignored) — create it owner-only
		fs.mkdirSync(path.dirname(this.tokenFile), { recursive: true, mode: 0o700 });
		// the refresh token is a credential: owner-only on disk
		fs.writeFileSync(this.tokenFile, JSON.stringify(this.token, null, '\t') + '\n', { mode: 0o600 });
		try { fs.chmodSync(this.tokenFile, 0o600); } catch { /* best effort */ }
	}

	clearToken() {
		this.token = null;
		fs.rmSync(this.tokenFile, { force: true });
	}

	authUrl(redirectUri) {
		const c = this.credentials();
		// CSRF nonce: the callback must echo a state we issued. Multiple slots
		// with a TTL: a second push must not invalidate the first consent tab.
		const state = crypto.randomBytes(16).toString('hex');
		this.pendingStates ??= new Map();
		const now = Date.now();
		for (const [key, issued] of this.pendingStates) {
			if (now - issued > 600000) this.pendingStates.delete(key);
		}
		while (this.pendingStates.size >= 10) {
			this.pendingStates.delete(this.pendingStates.keys().next().value);
		}
		this.pendingStates.set(state, now);
		const params = new URLSearchParams({
			client_id: c.client_id,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: SCOPE,
			access_type: 'offline',
			prompt: 'consent',
			state
		});
		return `${AUTH_URL}?${params}`;
	}

	checkState(state) {
		const issued = this.pendingStates?.get(state);
		if (!issued || Date.now() - issued > 600000) return false;
		this.pendingStates.delete(state); // single use
		return true;
	}

	async exchangeCode(code, redirectUri) {
		const c = this.credentials();
		const res = await fetch(TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id: c.client_id,
				client_secret: c.client_secret,
				redirect_uri: redirectUri,
				grant_type: 'authorization_code'
			})
		});
		const token = await res.json();
		if (!res.ok) throw new Error(`token exchange failed: ${token.error_description || token.error || res.status}`);
		token.expiry = Date.now() + (token.expires_in || 3600) * 1000;
		this.saveToken(token);
		return token;
	}

	async accessToken() {
		const token = this.loadToken();
		if (!token || !token.refresh_token) throw new Error('not authorized');
		if (token.access_token && token.expiry && Date.now() < token.expiry - 60000) {
			return token.access_token;
		}
		const c = this.credentials();
		const res = await fetch(TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				refresh_token: token.refresh_token,
				client_id: c.client_id,
				client_secret: c.client_secret,
				grant_type: 'refresh_token'
			})
		});
		const fresh = await res.json();
		if (!res.ok) {
			if (fresh.error === 'invalid_grant') {
				// refresh token revoked/expired: clear it so the next push re-authorizes
				this.clearToken();
				throw new Error('not authorized');
			}
			throw new Error(`token refresh failed: ${fresh.error_description || fresh.error || res.status}`);
		}
		fresh.expiry = Date.now() + (fresh.expires_in || 3600) * 1000;
		this.saveToken(fresh);
		return fresh.access_token;
	}
}
