/*
 * run_game_logic actions and saved-position reader for Happy 8.
 *
 * Both use the game's real core (happy-8/happy-8-core.js), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 *
 * The counters' moves are permutations of the seats, so whether a shuffle can
 * be undone is a question about the group those permutations generate. The
 * group orders below are computed exactly by Schreier-Sims from the core's own
 * generators; no result is hard-coded.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

type Perm = number[];

/* Schreier-Sims orbit tower over the real generators, as in porting/check-happy-8.mjs. */
const identity = (n: number): Perm => Array.from({ length: n }, (_, i) => i);
const compose = (a: Perm, b: Perm): Perm => a.map((_, i) => a[b[i]]); // apply b, then a
const inverse = (p: Perm): Perm => { const q: number[] = []; p.forEach((v, i) => { q[v] = i; }); return q; };
const isIdentity = (p: Perm): boolean => p.every((v, i) => v === i);

function groupOrder(n: number, generators: Perm[]): number {
  let level = generators.slice();
  let order = 1;
  for (let beta = 0; beta < n; beta++) {
    const transversal = new Map<number, Perm>([[beta, identity(n)]]);
    const stack = [beta];
    while (stack.length) {
      const x = stack.pop() as number;
      for (const g of level) {
        const y = g[x];
        if (!transversal.has(y)) {
          transversal.set(y, compose(g, transversal.get(x) as Perm));
          stack.push(y);
        }
      }
    }
    if (transversal.size === 1) continue;
    order *= transversal.size;
    const next = new Map<string, Perm>();
    for (const [x, ux] of transversal) {
      for (const g of level) {
        const h = compose(compose(inverse(transversal.get(g[x]) as Perm), g), ux);
        if (!isIdentity(h)) next.set(h.join(","), h);
      }
    }
    level = [...next.values()];
    if (!level.length) break;
  }
  return order;
}

const factorial = (n: number): number => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };

/** The applet's even board sizes, 4 through 14 counters. */
const ALL_SIZES = [4, 6, 8, 10, 12, 14];

export function actions(): GameActions {
  const C = cores["happy-8"].Happy8Core;

  return {
    group_orders: {
      describe:
        "For each board size, the exact number of arrangements reachable with the left and right turns alone (<l,r>) and with the whole-set turn as well (<l,r,w>), computed by Schreier-Sims from the game's real generators. It also checks the page's parity claim and flags the six-counter counterexample, where <l,r> reaches only 120 of 720 arrangements.",
      args: '{ "sizes": [4, 6, 8, 10, 12, 14] }',
      run: (args) => {
        const raw = args.sizes;
        let sizes: number[];
        if (raw === undefined || raw === null) {
          sizes = ALL_SIZES.slice();
        } else {
          if (!Array.isArray(raw)) throw new Error('argument "sizes" must be an array of even board sizes');
          sizes = [...new Set(raw.map((v, i) => {
            const n = Number(v);
            if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N || n % 2 !== 0) {
              throw new Error(`sizes[${i}] must be an even integer between ${C.MIN_N} and ${C.MAX_N}, got ${JSON.stringify(v)}`);
            }
            return n;
          }))].sort((a, b) => a - b);
        }

        const rows = sizes.map((n) => {
          const { l, r, w } = C.generators(n);
          const lr = groupOrder(n, [l, r]);
          const lrw = groupOrder(n, [l, r, w]);
          const all = factorial(n);
          const pageN = n / 2 - 1; // the page's own "n+2 counters per circle" parameter
          const claimedLR = pageN % 2 === 1 ? all / 2 : all;
          return {
            n,
            countersOnEachCircle: C.halfCount(n),
            reachableWithLR: lr,
            reachableWithLRW: lrw,
            allArrangements: all,
            lrIs: lr === all ? "all arrangements (S_n)" : lr === all / 2 ? "the even arrangements (A_n)" : `a proper subgroup, one in ${all / lr} arrangements`,
            lrwIsAll: lrw === all,
            pageClaimHolds: lr === claimedLR && lrw === all,
            counterexample: n === 6 && lr < all,
          };
        });
        const bad = rows.filter((row) => !row.pageClaimHolds).map((row) => row.n);
        return {
          sizes,
          rows,
          note: bad.length
            ? `The page's even-n claim fails at ${bad.join(", ")} counters: at six counters <l,r> reaches only 120 of 720 arrangements, so some starts there cannot be solved without w. Adding w restores every arrangement at every size.`
            : "The page's claim holds at every size requested: <l,r> gives the even arrangements when the per-circle parameter is odd and every arrangement when it is even; adding w always gives every arrangement.",
        };
      },
    },

    apply_moves: {
      describe:
        "Applies a sequence of the six turns (l, r, w, L, R, W) to a board, starting from Home or from the given arrangement, and reports the counters, cycle notation, parity and Home status after each turn. Even parity is what the left and right turns preserve at 4, 8 and 12 counters.",
      args: '{ "n": 8, "values": [4, 8, 1, 2, 3, 5, 6, 7], "moves": ["l", "r", "w"] }',
      run: (args) => {
        const requestedN = num(args, "n");
        const n = C.size(requestedN);
        const values = args.values === undefined || args.values === null ? C.home(n) : numArray(args, "values");
        if (values.length !== n) throw new Error(`values must contain ${n} counters (one per seat), got ${values.length}`);
        if (values.slice().sort((a, b) => a - b).some((v, i) => v !== i + 1)) {
          throw new Error(`values must be a permutation of the counters 1..${n}`);
        }
        const rawMoves = args.moves;
        if (!Array.isArray(rawMoves)) throw new Error('argument "moves" must be an array of move names');
        const moves = rawMoves.map(String);

        let state = C.start({ n, values });
        const steps: unknown[] = [{
          after: "start",
          values: state.values.slice(),
          cycles: C.cycles(state),
          parity: C.parity(state.values),
          home: C.isHome(state.values, n),
        }];
        for (const m of moves) {
          if (C.MOVES.indexOf(m) < 0) {
            throw new Error(`unknown move "${m}"; choose from ${C.MOVES.join(", ")}`);
          }
          const next = C.move(state, m);
          if (!next) throw new Error(`move "${m}" is not legal from this position`);
          state = next;
          steps.push({
            after: m,
            values: state.values.slice(),
            cycles: C.cycles(state),
            parity: C.parity(state.values),
            home: state.solved,
          });
        }
        return {
          requestedN,
          n,
          moves: state.moves,
          home: state.solved,
          steps,
          note: "A cycle of length k flips parity k-1 times, so a turn is even or odd according to the length of the circle it rotates.",
        };
      },
    },
  };
}

/**
 * Echo the fields the page saved with Track.state (n, values, moves, solved)
 * and re-read that board with the real core: its Home status, parity, cycle
 * notation, the seats of the six controls, what every turn would lead to, and
 * whether the left/right turns alone can reach this arrangement.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Happy 8 state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Happy 8 position must be an object");
  }
  const C = cores["happy-8"].Happy8Core;
  const n = C.size(num(state, "n"));
  const values = numArray(state, "values");
  if (values.length !== n) throw new Error(`saved values must contain ${n} counters, got ${values.length}`);
  const moves = num(state, "moves", 0);
  const solved = state.solved === true;
  const here = { n, values, moves, solved };

  const parity = C.parity(values);
  const whatEachTurnLeadsTo: Record<string, unknown> = {};
  for (const m of C.MOVES) {
    const next = C.move(here, m);
    if (!next) continue; // the six named moves are always legal, but keep it safe
    whatEachTurnLeadsTo[m] = {
      values: next.values,
      cycles: C.cycles(next),
      parity: C.parity(next.values),
      home: next.solved,
    };
  }

  const { l, r } = C.generators(n);
  const lr = groupOrder(n, [l, r]);
  const all = factorial(n);
  const reachableByLR = lr === all ? true : lr === all / 2 ? parity === 0 : null;
  const reachabilityNote = reachableByLR === true
    ? "The left and right turns generate every arrangement here, so any shuffle can be undone without w."
    : reachableByLR === null
      ? "At six counters the left and right turns generate only 120 of the 720 arrangements: even parity is not enough, and some starts need w (the page's even-n claim fails here)."
      : "The left and right turns generate only the even arrangements here, so an odd arrangement such as this one cannot be solved without w.";

  return {
    ...state,
    stateVersion,
    saved: { n, values, moves, solved },
    countersOnEachCircle: C.halfCount(n),
    home: C.isHome(values, n),
    parity,
    parityWord: parity === 0 ? "even" : "odd",
    cycles: C.cycles(here),
    controlSeats: C.controlSeats(n),
    whatEachTurnLeadsTo,
    leftRightGroupOrder: lr,
    allArrangements: all,
    reachableByLeftRightAlone: reachableByLR,
    note: reachabilityNote,
  };
}
