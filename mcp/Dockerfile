# The coolmaths tutor as a container. Build from the repository root, because
# the server's content is generated from the site itself:
#
#   docker build -f mcp/Dockerfile -t coolmaths-tutor .
#   docker run --rm -p 8080:8080 coolmaths-tutor
#
# fly.toml points here; `fly deploy` (run from the repository root) does the same.

FROM node:22-slim AS build
WORKDIR /repo

# Dependencies first, so they are cached until package-lock.json changes.
COPY mcp/package.json mcp/package-lock.json mcp/
RUN cd mcp && npm ci

# The site (what build-index reads) and the server. .dockerignore keeps the
# 100 MB of applet archives and other clutter out.
COPY . .
RUN cd mcp && npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /repo/mcp/package.json ./
COPY --from=build /repo/mcp/node_modules ./node_modules
COPY --from=build /repo/mcp/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server.mjs"]
