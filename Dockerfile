# draw — the whole product in one image: editor + persistence websocket +
# read-only REST + Slides push + the `draw` CLI. One container is the default
# deployment. Run API-only (no editor) with: -e CLIENT_DIR=/none
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# CLI runtime so `docker exec <container> draw show` works in-container
# (the CLI defaults to http://localhost:8080 — itself). column lives in util-linux.
RUN apk add --no-cache bash curl jq util-linux

# dependency layer — one runtime dependency (ws); no git, no SSH key, no build step
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# the server's runtime imports come from server/ + engine/ + document/ (sovereign peers);
# the legacy client/ was RETIRED (CL5) — the editor is served from app/ (client/ preserved on app-v1)
COPY server/ server/
COPY cli/ cli/
# the new thin UI (served at /next) + the geometry kernel ESM (served at /kernel)
COPY app/ app/
COPY kernel/ kernel/
# the relational engine ESM (served at /engine; imported by server/store.js at boot)
COPY engine/ engine/
# the document substrate ESM (served at /document; imported by server/store.js + seed.js at boot)
COPY document/ document/

# the shipped example corpus — copied into $DATA_DIR on FIRST boot only (see server/store.js).
# NOT the data dir: /data is a volume, and a fresh container must come up with content.
COPY examples/ examples/
# CLI on PATH; node must own cli/ so `draw context` can write .draw_context at runtime
RUN ln -s /app/cli/draw.sh /usr/local/bin/draw && chown -R node:node /app/cli

# diagrams persist here — create+own BEFORE declaring the volume (filesystem changes
# made AFTER a VOLUME are discarded), so the node user can write on ANY volume, not
# just a bind mount that happens to be uid-1000-owned
ENV DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
VOLUME /data

ENV PORT=8080
# containers must listen beyond loopback
ENV HOST=0.0.0.0
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
	CMD wget -qO- http://localhost:8080/health || exit 1

USER node
CMD ["node", "server/server.js"]
