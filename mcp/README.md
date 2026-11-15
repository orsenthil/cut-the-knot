# coolmaths tutor — an MCP server

A remote [MCP](https://modelcontextprotocol.io) server that serves this site as
grounded tutoring material: the games' own rules text, their own "Look for the
math" explanations, their source, and their **real runnable logic**.

It does not do the teaching. The client's model teaches; this supplies material
so that answers come from the site's actual code and explanations rather than
the model's memory of Bogomolny.

## Connect

```sh
claude mcp add --transport http coolmaths https://coolmaths-tutor.fly.dev/mcp
```

On claude.ai or Claude Desktop: **Settings → Connectors → add a custom
connector** with the same URL. `/mcp` is read-only, public and needs no
sign-in.

`https://coolmaths-tutor.fly.dev/mcp/me` is the same server plus the
[personal tools](#personal-tools-mcpme) for one signed-in player. Add it as
a connector the same way; the client is sent to the coolmaths sign-in page,
where the player signs in with Google or GitHub and allows the connection
(see [Sign-in](#sign-in-for-mcpme)).

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
| `list_games(tag?, kind?, limit?, offset?)` | The catalogue a page at a time (25 by default), optionally filtered by concept or kind. |
| `get_game(slug, includeSource?)` | One game as markdown. |
| `search(query, limit?)` | Keyword search over titles, blurbs, rules, maths and tags. |
| `explain_concept(concept)` | Every game using a concept, the relevant maths, the Wikipedia link. |
| `list_actions(slug?)` | Which games have runnable logic, or one game's actions with example arguments. |
| `run_game_logic(slug, action, args)` | Calls the game's real core. |
| `porting_status(kind?, status?, limit?)` | How the campaign stands. |
| `next_to_port(count?, kind?)` | What to port next, games first. |
| `get_original(name)` | Manifest entry, cut-the-knot page, and the port's source. |

**Prompts**: `tutor(slug)` (Socratic: play, then hints, then the invariant),
`quiz_me(tag)`, `explain_like_im(slug, level)`, `review_port(slug)`.

### run_game_logic

The interesting one. It calls the same files the live pages run, so the tutor
can *show* a strategy instead of describing it. `list_actions` says which
games have it (seven today) and what each action takes; the descriptions of
the tools themselves stay the same size however many games there are.

```
run_game_logic("hourglass", "solve", {"a": 7, "b": 11, "target": 15})
  -> 3 flips, 22 minutes, with the eight steps spelled out
run_game_logic("coins", "parity_split", {"values": [4, 2, 9, 1]})
  -> even positions total 13, odd total 3, first player can guarantee 13
```

`euler2d` has a core but no actions: it is a continuous simulation, and a
single step of it means nothing over a request/response call.

### Personal tools (`/mcp/me`)

| Tool | What |
|---|---|
| `whoami()` | Who the connection is signed in as. |
| `my_progress()` | Games played, and per concept how many were tried and whether it is practised. |
| `recommend_next(count?)` | Untried games in prerequisite order, each with a reason. Runs `assets/recommend.js`, the file the profile page runs. |
| `my_position()` | The game the player has open and the position on their screen, plus what the game's core says about it. |

**Prompt**: `coach_me` (starts from `my_position`; hints before answers).

All four are read-only, see only the signed-in player, and refuse when that
player has turned the tutor's access off. The data shapes are in
[docs/contracts.md](../docs/contracts.md).

## Layout

```
mcp/
  Dockerfile, fly.toml     the container and its Fly.io config
  scripts/build-index.mjs  the site -> src/generated/ (runs in every build)
  src/node.ts              Node entry: reads the environment, builds the app, listens
  src/app.ts               Express app: the SDK's OAuth endpoints, then src/http.ts
  src/http.ts              routes, on standard Request/Response
  src/core/handle.ts       the MCP server as a function: JSON-RPC in, replies out
  src/core/content.ts      the generated site content, typed, and shared helpers
  src/core/store.ts        UserStore: the only way to a player's record
  src/stores/memory.ts     UserStore on plain data (tests, local work)
  src/stores/firestore.ts  UserStore and the OAuth store on Cloud Firestore
  src/auth/                Authenticator, the OAuth provider and its store, the development token
  src/server/              build.ts composes resources, public tools, personal tools, prompts
  src/games/<slug>.ts      one game's run_game_logic actions and position reader
  src/generated/           build output (gitignored)
  fixtures/users.json      three players for tests and local work
  test/                    golden answers and HTTP tests
```

Things worth knowing about the design.

**It is layered so the host does not matter.** `core/handle.ts` turns a parsed
JSON-RPC payload into replies and knows nothing about HTTP. `http.ts` adds the
routes using the standard `Request` and `Response`, which Node, Workers, Deno
and Bun all have. `app.ts` and `node.ts` are the Node part: an Express app,
needed only because the SDK's OAuth endpoints are Express middleware.

**It is stateless.** One POST carries one JSON-RPC message (or a batch) and
the reply comes back in the body. Each request builds a fresh server, so
nothing is kept between requests, any number of machines can serve the same
URL, and Fly can stop the machine when idle. The server has no notifications
to push, so it offers no SSE stream; `GET /mcp` returns 405 by design.

**The cores are copied, not evaluated.** `build-index.mjs` copies each core's
source verbatim into `src/generated/cores/` with an `export` appended, and
does the same for `assets/recommend.js`. The file in the site stays the single
source of truth; this build never edits one.

**Adding a game adds a file and edits none.** Put the core in `CORE_GLOBALS`
in `build-index.mjs` and write `src/games/<slug>.ts` exporting `actions()`
(and `position(state)` if the page saves its position with `Track.state`).
The registry is generated.

**Storage and sign-in are interfaces.** Tools read players only through
`UserStore`, and `/mcp/me` knows only `Authenticator`; memory and Firestore
implement the first, the development token and OAuth the second.

## Sign-in for `/mcp/me`

The server is an OAuth 2.1 authorization server for MCP clients. The
protocol endpoints (`/authorize`, `/token`, `/register`, `/revoke` and the
discovery documents) are the MCP SDK's; `src/auth/oauth-provider.ts` supplies
who the player is and what is remembered.

1. The client sends the browser to `/authorize`. The server saves the
   request and redirects to the site's `signin/` page with its id.
2. The page shows who is asking, signs the player in with Firebase, and on
   Allow posts the request id and the player's Firebase ID token to
   `/oauth/complete`. That endpoint answers only the site's own origin.
3. The server verifies the ID token with `firebase-admin` and sends the
   browser back to the client with a one-time code.
4. The client swaps the code (with PKCE) for an access token, good for an
   hour, and a refresh token, good for thirty days and replaced on each use.

Codes and tokens are random and stored only as SHA-256 hashes, under
`oauth/` in Firestore, which the security rules close to every browser. A
token gives read-only access to one player's record, and the tools refuse
while that player has "Let the coolmaths tutor see my record" switched off
on their profile.

The server needs one secret, the Firebase service account key:

```sh
fly secrets set FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" -a coolmaths-tutor
```

Without it the server runs with the public endpoint only and `/mcp/me`
answers 503. The other settings (`PUBLIC_URL`, `SIGN_IN_URL`,
`SIGN_IN_ORIGINS`) are in `fly.toml`.

## Develop

```sh
npm install
npm run dev          # build-index, then the server on :8080, restarting on change
npm test             # typecheck, golden answers, HTTP and OAuth tests
npm run test:firestore   # the Firestore stores, in the emulator (needs Java)
```

The whole sign-in, with a browser, the site's sign-in page and this server
against the emulators: `cd ../firebase && npm run test:tutor`.

To try the personal tools locally, as the fixture player `ada`:

```sh
COOLMATHS_DEV_TOKEN=any-16-characters-or-more COOLMATHS_DEV_USER=ada npm run dev
```

Then point the inspector at it:

```sh
npx @modelcontextprotocol/inspector --cli http://127.0.0.1:8080/mcp --transport http --method tools/list
```

```sh
npx @modelcontextprotocol/inspector --cli http://127.0.0.1:8080/mcp --transport http --method tools/call --tool-name run_game_logic --tool-arg slug=hourglass --tool-arg action=solve --tool-arg 'args={"a":7,"b":11,"target":15}'
```

The answer should match the Node one-liner in CLAUDE.md: 3 flips.

`test/golden/` holds saved answers that must not change by accident. After a
deliberate change, `npm run golden -- --update` and review the diff. Before a
refactor, `npm run golden -- --all --update --dir /tmp/before` saves every
answer, including the ones that follow the site's content, to compare after.

## Deploy

`.github/workflows/mcp.yml` tests, builds the image and deploys to Fly.io on
every push to `web` that touches `mcp/`, the games, the catalogue or the
manifest, so a merged port updates the tutor automatically. One-time setup:

```sh
fly apps create coolmaths-tutor
fly tokens create deploy -a coolmaths-tutor    # -> repository secret FLY_API_TOKEN
```

To deploy by hand, from the repository root (the image build reads the site):

```sh
fly deploy --config mcp/fly.toml --dockerfile mcp/Dockerfile
```

The machine stops when idle and starts on the next request, so the first call
after a quiet spell takes a second or two longer.
