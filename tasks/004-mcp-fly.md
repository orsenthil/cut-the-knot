---
id: "004"
title: Run the MCP server on Node, packaged for Fly.io
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["003"]
offline: yes
files:
  - mcp/src/node.ts
  - mcp/src/http.ts
  - mcp/Dockerfile
  - mcp/fly.toml
  - mcp/package.json
  - mcp/tsconfig.json
  - .dockerignore
  - mcp/README.md
verify: cd mcp && npm test && docker build -f Dockerfile -t coolmaths-tutor ..
---

Replace the Cloudflare Worker entry with a host-independent HTTP layer and a Node entry.

## Outcome

The image builds and answers in `docker run`. Not deployed: that is task 005. The stateless transport was kept (as `core/handle.ts`) instead of adopting the SDK's Node transport, because it is what makes the server host-independent and testable in-process.
