---
id: "005"
title: Create the Fly app and deploy
status: todo
owner: human
claimedAt: 
deps: ["004"]
offline: no
files:
  - .github/workflows/mcp.yml
  - mcp/fly.toml
  - mcp/README.md
verify: curl -fsS https://coolmaths-tutor.fly.dev/ | grep -q /mcp
---

Owner setup: `fly apps create coolmaths-tutor`, add the `FLY_API_TOKEN` repository secret, push. Then repoint the claude.ai connector at the new URL and delete the old Cloudflare Worker. Until this is done, pushes to `web` no longer update the old Worker.
