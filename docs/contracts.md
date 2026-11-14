# Contracts

The interfaces between the parts of coolmaths that are built separately: the
game pages, the progress tracker, the database, and the MCP tutor. Code on
either side of a contract can change freely; the contract changes only on
purpose, here first.

Tasks in [`tasks/`](../tasks/README.md) refer to sections of this file.

## 1. The parts

```
game page ──Track──▶ assets/progress.js ──backend──▶ localStorage   (today)
                                                 └──▶ Firestore      (task 010)

profile page, home ──▶ Track.progress() + assets/recommend.js

MCP server ──UserStore──▶ fixtures (today) / Firestore (task 014)
           └─ assets/recommend.js, and each game's core, copied in at build
```

Three rules hold everywhere:

- **Games never talk to a database.** They call `Track`, or nothing at all.
- **The catalogue and the concept graph live in git** (`assets/games.js`,
  `assets/concepts.js`). The database holds only what players did.
- **A new game needs no schema change.** Records are keyed by the game's slug.

## 2. Track: what a game page may call

Defined in `assets/progress.js`; tested by `porting/check-progress.mjs` and
`porting/check-profile-ui.mjs`.

A page with `<body data-game="slug">` needs to call nothing: visits and
visible time are counted, and a play is recorded each time `#status` gains
`.win` or `.lose`. A page that wants its plays and positions recorded exactly
includes `<script src="../assets/progress.js"></script>` before its own
script and calls:

| Call | Meaning |
|---|---|
| `Track.start(slug, { options?, stateVersion? })` | A new play begins. Turns the `#status` watching off for this page. |
| `Track.state(state, status?)` | The position changed. `state` is plain JSON of at most 8,000 characters; `status` is the line on screen (default: the text of `#status`). Written at most every 2 seconds. |
| `Track.end({ outcome, moves?, best?, completed? })` | The play is over. |
| `Track.progress()`, `Track.sessions()`, `Track.live()` | Read the record (promises). |
| `Track.clear()` | Forget the record. |

`outcome` is `win`, `loss`, `draw`, `quit`, `impossible` or `done` (`done` is
for demos, which have no win). A play counts as *completed* on `win` or
`done`, or when `completed: true` is passed. `best` holds numbers; `moves`,
`seconds`, `flips` and `steps` keep the smallest seen, anything else the
largest.

The page fires `progresschange` on `window` after every write.

Reference adopter: `coins/coins.js`.

## 3. The player's record

Times are milliseconds since 1970. This is what the local backend stores
under the `coolmaths-profile-v1` key and what `UserStore` returns.

```
progress[slug]  { slug, firstAt, lastAt,
                  opens, activeSeconds, plays, completed, wins, losses,
                  best?: { name: number }, lastOptions?: { ... } }

sessions[]      { slug, startedAt, endedAt, outcome, moves?, options? }

live            { slug, sessionId, stateVersion, state, status, updatedAt }
```

Counters only grow. `live` is one record, overwritten: the game the player
has open, or had open last (`updatedAt` says how stale it is).

Concept mastery is **not** stored. It is computed from `progress` by
`Recommend.mastery`, so changing the scoring needs no migration.

## 4. A game's position (`live.state`)

The game's core owns the shape: it has a method that returns the position as
plain data and one that rebuilds the game from it, and the logic test checks
that the round trip is exact. For coins these are `CoinGame.snapshot()` and
`CoinGame.restore()` in `coins/coin-game.js`, tested in
`porting/check-coins.mjs`.

`stateVersion` starts at 1 and goes up when the shape changes in a way old
readers cannot handle.

On the server, `mcp/src/games/<slug>.ts` may export
`position(state, stateVersion)`, which rebuilds the game with the same core
and returns what the core can say about it. `my_position` includes that as
`analysis`. Games without a core still report `state` and `status`, and the
tutor reasons from the rules.

## 5. Backends (browser)

A backend keeps one player's record. All methods return promises:

```
readProgress()      -> { slug: progress record }
bump(slug, delta)   -> the updated progress record
readSessions()      -> sessions, oldest first
addSession(session)
readLive()          -> live | null
setLive(live)
clear()
```

`delta` carries amounts to add (`opens`, `activeSeconds`, `plays`,
`completed`, `wins`, `losses`), values to merge or replace (`best`,
`lastOptions`) and `at`. `Track.core.applyDelta` is the reference merge; a
backend must give the same result. Switch with `Track.useBackend(backend)`.

## 6. Recommend

`assets/recommend.js`, pure, tested by `porting/check-concepts.mjs`:

```
Recommend.next(progress, games, concepts, count)
  -> [{ game, missing: [tag], known: [tag], why }]
Recommend.mastery(progress, games, concepts)
  -> { tag: { points, total, tried, completed, practised } }
Recommend.explain(suggestion, labelOf) -> one sentence
```

A catalogue entry may carry `level` (1 to 3, default 2) and `kind`
(`"game"` or `"demo"`, default game). `assets/concepts.js` gives each tag
its `prereqs`.

## 7. Firestore (planned; tasks 007, 010, 014)

```
users/{uid}                     displayName, photoURL, providers[], isAnonymous,
                                createdAt, lastSeenAt, handle,
                                settings { mcpAccess: bool, public: bool }
users/{uid}/progress/{slug}     a progress record (section 3)
users/{uid}/sessions/{autoId}   a session record, expiring after 180 days
users/{uid}/live/current        the live record
handles/{handle}                { uid }            uniqueness index
publicProfiles/{uid}            opt-in, handle only, public read
oauth/{kind}/{id}               MCP OAuth clients, codes, tokens: server only
matches/{matchId}[/moves/{n}]   later: multiplayer, written by the server only
```

Rules in one line each: `users/{uid}/**` is the owner's alone; counters only
grow; `live.state` is size-capped; `publicProfiles` is public to read and
the owner's to write when `settings.public`; clients cannot touch `oauth/**`
or write `matches/**`.

Guests get an anonymous Firebase account, which is *linked* to Google or
GitHub on sign-in, so the record carries over. Anything already in
localStorage is replayed into the account once, then the local copy is
cleared.

## 8. UserStore and Authenticator (server)

`mcp/src/core/store.ts`:

```ts
interface UserStore {
  getProfile(uid): Promise<Profile | null>
  getProgress(uid): Promise<Record<string, ProgressRecord>>
  getLive(uid): Promise<LivePosition | null>
}
```

`mcp/src/auth/authenticator.ts`:

```ts
interface Authenticator {
  authenticate(authorizationHeader): Promise<User | null>
}
```

The personal tools are read-only and must refuse when
`profile.settings.mcpAccess === false`. Anything that would let one player
affect another (matches, public numbers) is written by the server, never
trusted from a browser.
