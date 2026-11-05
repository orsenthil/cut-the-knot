# coolmaths tutor — an MCP server

A remote [MCP](https://modelcontextprotocol.io) server that serves this site as
grounded tutoring material: the games' own rules text, their own "Look for the
math" explanations, their source, and their **real runnable logic**.

It does not do the teaching. The client's model teaches; this supplies material
so that answers come from the site's actual code and explanations rather than
the model's memory of Bogomolny.

## Connect

```sh
claude mcp add --transport http coolmaths https://coolmaths-tutor.<account>.workers.dev/mcp
```

On claude.ai or Claude Desktop: **Settings → Connectors → add a custom
connector** with the same URL. The server is read-only, public and needs no
auth.

## What it exposes

**Resources**

| URI | What |
|---|---|
| `coolmaths://catalogue` | Every game with its blurb and tags. |
| `coolmaths://game/{slug}` | Rules, the full maths section, named concepts, source. |
| `coolmaths://tag/{tag}` | Every game that uses a concept. |
| `coolmaths://manifest` | The porting manifest: ~1,280 applets with kind and status. |

**Tools**

| Tool | What |
|---|---|
| `list_games(tag?)` | The catalogue, optionally filtered by concept. |
| `get_game(slug, includeSource?)` | One game as markdown. |
| `search(query, limit?)` | Keyword search over titles, blurbs, rules, maths and tags. |
| `explain_concept(concept)` | Every game using a concept, the relevant maths, the Wikipedia link. |
| `run_game_logic(slug, action, args)` | Calls the game's real core. |
| `porting_status(kind?, status?, limit?)` | How the campaign stands. |
| `next_to_port(count?, kind?)` | What to port next, games first. |
| `get_original(name)` | Manifest entry, cut-the-knot page, and the port's source. |

**Prompts**: `tutor(slug)` (Socratic: play, then hints, then the invariant),
`quiz_me(tag)`, `explain_like_im(slug, level)`, `review_port(slug)`.

### run_game_logic

The interesting one. It calls the same files the live pages run, so the tutor
can *show* a strategy instead of describing it:

| Game | Actions |
|---|---|
| `hourglass` | `solve`, `next_state` |
| `coins` | `computer_reply`, `parity_split`, `play_out` |
| `four-knights` | `shortest_solution`, `cycle`, `legal_moves` |
| `eye-opener` | `areas` |
| `mind-reader` | `predict`, `marked_cells` |
| `torque` | `generate`, `evaluate` |
| `four-by-four` | `winning_lines`, `lines_through`, `machine_reply` |

```
run_game_logic("hourglass", "solve", {"a": 7, "b": 11, "target": 15})
  -> 3 flips, 22 minutes, with the eight steps spelled out
run_game_logic("coins", "parity_split", {"values": [4, 2, 9, 1]})
  -> even positions total 13, odd total 3, first player can guarantee 13
```

`euler2d` has a core but no actions: it is a continuous simulation, and a
single step of it means nothing over a request/response call.

## Layout

```
mcp/
  wrangler.toml            Cloudflare Worker config
  scripts/build-index.mjs  the site -> src/generated/ (runs in CI before deploy)
  src/index.ts             Worker entry: the /mcp endpoint
  src/server.ts            resources, tools and prompts
  src/logic.ts             run_game_logic, and the per-game action table
  src/transport.ts         a stateless Streamable HTTP transport for Workers
  src/generated/           build output (gitignored)
```

Two things are worth knowing about the design.

**It is stateless.** The SDK's `StreamableHTTPServerTransport` is written
against `node:http`, which a Worker does not have, so `src/transport.ts` speaks
the same protocol over the Fetch API: one POST carries one JSON-RPC message and
the reply comes back in the body. Nothing is kept between requests, so there is
no session to track and no Durable Object to pay for. The server has no
notifications to push, so it offers no SSE stream; `GET /mcp` returns 405 by
design.

**The cores are copied, not evaluated.** Workers forbid `eval` and
`new Function`, so the trick CLAUDE.md uses in Node is unavailable.
`build-index.mjs` copies each core's source verbatim into
`src/generated/cores/` with an `export` appended. The core in the game folder
stays the single source of truth — this build never edits one.

## Develop

```sh
npm install
npm run dev          # build-index + wrangler dev on :8787
```

Then point the inspector at it:

```sh
npx @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/list
```

```sh
npx @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/call --tool-name run_game_logic --tool-arg slug=hourglass --tool-arg action=solve --tool-arg 'args={"a":7,"b":11,"target":15}'
```

The answer should match the Node one-liner in CLAUDE.md: 3 flips.

```sh
npm run typecheck
npx wrangler deploy --dry-run    # check the bundle still fits
```

## Deploy

`.github/workflows/mcp.yml` deploys on every push to `web` that touches `mcp/`,
the games, or the manifest — so a merged port updates the tutor automatically.
It needs two repository secrets:

- `CLOUDFLARE_API_TOKEN` — an "Edit Cloudflare Workers" token
- `CLOUDFLARE_ACCOUNT_ID`

To deploy by hand:

```sh
cd mcp && npm ci && npm run deploy
```
