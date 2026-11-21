/*
 * run_game_logic actions and saved-position reader for Ambassadors at a Round Table.
 *
 * 2n ambassadors, each with at most n-1 enemies, can be seated with no two enemies
 * side by side; the page's proof is an algorithm that turns an arc over to remove at
 * least one hostile neighbouring pair each time. Every answer comes from the game's
 * real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["enemy-ambassadors"].EnemyAmbassadorsCore;

/** A position from "enemies" as [[a,b],...] (ambassadors numbered from 0) and an optional seating. */
function build(args: Json) {
  const C = core();
  const n = Math.trunc(num(args, "n", 8));
  if (n < 5 || n > 30) throw new Error("n (the number of ambassadors) runs from 5 to 30");
  const raw = Array.isArray(args.enemies) ? (args.enemies as unknown[]) : [];
  const enemies = raw.map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [NaN, NaN]));
  if (enemies.some((p) => !(p[0] >= 0 && p[1] >= 0 && p[0] < n && p[1] < n && p[0] !== p[1]))) throw new Error("each enemy pair is two different ambassadors numbered 0 to n-1");
  const seat = Array.isArray(args.seat) ? (args.seat as unknown[]).map(Number) : undefined;
  if (seat && (seat.length !== n || new Set(seat).size !== n || seat.some((a) => !(a >= 0 && a < n)))) throw new Error("seat must list each ambassador 0..n-1 once, in table order");
  return C.start({ n, enemies, seat });
}

export function actions(): GameActions {
  return {
    solve: {
      describe:
        "Run the page's algorithm on a table: seat the ambassadors in order (or as seat says), and keep turning an arc over to remove an enemy neighbour pair until none is left. Gives each turn (the pair A,B, the lucky pair B',A', the arc) and whether the page's condition (2n ambassadors, at most n-1 enemies each) holds. enemies is a list of pairs numbered from 0.",
      args: '{ "n": 8, "enemies": [[0,1],[1,2],[2,3],[4,5],[0,4],[1,5]] }',
      run: (args) => {
        const C = core();
        let s = build(args);
        const condition = C.meetsCondition(s);
        const turns: unknown[] = [];
        let guard = 0;
        while (C.mishaps(s).length > 0 && guard++ <= s.n) {
          const before = C.mishaps(s).length;
          const l = C.lucky(s);
          if (!l) { turns.push({ stuck: "no lucky pair B', A' exists" }); break; }
          s = C.move(s, { type: "hint" });
          turns.push({ pair: [l.a + 1, l.b + 1], luckyPair: [l.b2 + 1, l.a2 + 1], turnedArc: [l.from, l.to], enemyNeighboursBefore: before, after: C.mishaps(s).length });
        }
        return {
          ambassadors: s.n,
          conditionHolds: condition,
          maxEnemies: Math.max(0, ...C.degrees(s)),
          limit: s.n % 2 === 0 ? s.n / 2 - 1 : null,
          turns,
          seating: s.seat.map((a: number) => a + 1),
          solved: C.mishaps(s).length === 0,
          note: condition ? "The page's condition holds, so the procedure always succeeds, and each turn removes at least one enemy neighbour pair." : "The page's condition does not hold here (it needs an even number of ambassadors with at most n-1 enemies each), so a good seating may not exist or the procedure may stall.",
        };
      },
    },
    count: {
      describe: "How many neighbouring pairs are enemies, for a given table (enemies as pairs, seat as the ambassadors in table order).",
      args: '{ "n": 6, "enemies": [[0,1],[2,3]], "seat": [0,1,2,3,4,5] }',
      run: (args) => {
        const C = core();
        const s = build(args);
        const bad = C.mishaps(s);
        return { enemyNeighbourPairs: bad.length, places: bad.map((p: number) => [s.seat[p] + 1, s.seat[(p + 1) % s.n] + 1]), solved: bad.length === 0 };
      },
    },
  };
}

/** What the core says about the table as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const enemies = Array.isArray(state.enemies) ? (state.enemies as number[][]) : [];
  const seat = Array.isArray(state.seat) ? (state.seat as number[]) : undefined;
  const s = C.start({ n: num(state, "n", 10), enemies, seat });
  const bad = C.mishaps(s);
  const l = C.lucky(s);
  return {
    ambassadors: s.n,
    enemyPairs: s.enemies.length,
    enemyNeighbourPairs: bad.length,
    solved: bad.length === 0,
    selectedPlace: typeof state.selected === "number" && state.selected >= 0 ? state.selected : null,
    conditionHolds: C.meetsCondition(s),
    mostEnemies: Math.max(0, ...C.degrees(s)),
    hintAvailable: l !== null,
    moves: num(state, "moves", 0),
  };
}
