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

# the server’s runtime imports come from server/ + engine/ + model/ (sovereign peers);
# the legacy client/ was RETIRED (CL5) — the editor is served from app/ (client/ preserved on app-v1)
COPY server/ server/
COPY cli/ cli/
# the new thin UI (served at /next) + the geometry kernel ESM (served at /kernel)
COPY app/ app/
COPY kernel/ kernel/
# the relational engine ESM (served at /engine; imported by server/store.js at boot)
COPY engine/ engine/
# the model substrate ESM (served at /model; imported by server/store.js + seed.js at boot)
COPY model/ model/

# the shipped TEMPLATE set (H9.9). Read straight from the image and never written: a template is
# listed to everyone, owned by nobody, and forks into a real diagram on first write. It replaced the
# example corpus, which was COPIED into $DATA_DIR on first boot and became shared mutable state that
# every principal could edit -- wrong once the store had per-diagram access control.
# NOT the data dir: /data is a volume, and a fresh container must come up with something to start from.
COPY templates/ templates/
# CLI on PATH; node must own cli/ so `draw context` can write its context file at runtime.
# draw.mjs, not draw.sh: the shell version was retired when the CLI was rewritten Node-first (B117)
# and the link went on pointing at it for two milestones. `ln -s` does not check its target, so the
# image built clean and shipped a `draw` that failed the moment anyone ran it (B137).
RUN ln -s /app/cli/draw.mjs /usr/local/bin/draw && chown -R node:node /app/cli

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
