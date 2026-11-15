# Contracts

The interfaces between the parts of coolmaths that are built separately: the
game pages, the progress tracker, the database, and the MCP tutor. Code on
either side of a contract can change freely; the contract changes only on
purpose, here first.

Tasks in [`tasks/`](../tasks/README.md) refer to sections of this file.

## 1. The parts

```
game page ──Track──▶ assets/progress.js ──backend──▶ localStorage   (guests)
                                                 └──▶ Firestore      (signed in)

profile page, home ──▶ Track.progress() + assets/recommend.js

MCP server ──UserStore──▶ Firestore (fixtures in tests)
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

## 7. Firestore

```
users/{uid}                     displayName, providers[], createdAt, lastSeenAt,
                                settings { mcpAccess: bool, public: bool }
users/{uid}/progress/{slug}     a progress record (section 3)
users/{uid}/sessions/{autoId}   a session record, plus expireAt (a date 180
                                days on, for a TTL policy to remove it)
users/{uid}/live/current        the live record, with `state` as JSON text
                                (Firestore cannot hold a list inside a list,
                                and text lets the rules cap its size)

# later tasks; closed to everyone until they get rules
handles/{handle}                { uid }            uniqueness index
publicProfiles/{uid}            opt-in, handle only, public read
oauth/{kind}/items/{id}         MCP OAuth clients, sign-ins in progress, codes
                                and tokens (by hash): server only
matches/{matchId}[/moves/{n}]   later: multiplayer, written by the server only
```

The rules are `firebase/firestore.rules`, tested in the emulator by
`cd firebase && npm test`: `users/{uid}/**` is the owner's alone; while a
progress record exists its counters only grow; a session is written once;
`live.state` is at most 8,000 characters; everything else is closed.

Sign-in is `assets/auth.js` (Google or GitHub, by popup), offered on the
profile page. **A guest has no account and never loads the Firebase SDK**;
their record stays in localStorage. On sign-in, `Track` switches to the
Firestore backend (`assets/backends/firebase.js`) and `moveRecord` adds the
browser's record to the account and empties the browser's copy. The same
move runs on every later page load, so anything written before the account
loaded, or while offline (`withFallback`), catches up. `site.js` loads
`auth.js` on the profile page, and on every page while the
`coolmaths-account` flag is set in localStorage.

`cd firebase && npm run test:ui` drives all of this in a browser against the
Auth and Firestore emulators.

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

Implementations: `MemoryStore` and `FirestoreUserStore`; `DevAuthenticator`
and `CoolmathsOAuthProvider`. How a client signs in is in `mcp/README.md`
("Sign-in for /mcp/me"); the site's half is the `signin/` page, which sends
the player's Firebase ID token to `TUTOR_SERVER` (`assets/firebase-config.js`)
and nowhere else.

The personal tools are read-only and must refuse when
`profile.settings.mcpAccess === false`. Anything that would let one player
affect another (matches, public numbers) is written by the server, never
trusted from a browser.
