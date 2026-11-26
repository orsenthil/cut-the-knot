/*
 * run_game_logic actions and saved-position reader for Voting. The core lives in
 * voting/ and is copied into src/generated/cores/ at build time. It holds all
 * four counting methods: plurality, Borda, elimination and pairwise comparison.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

type Scores = Record<string, number>;
type Duel = { a: string; b: string; forA: number; forB: number; award: string | null };
type Round = {
  number: number;
  active: string[];
  scores: Scores;
  ranked: string[];
  weakest: string;
  winner?: string | null;
};
type State = {
  candidates: string[];
  ballots: { count: number; order: string[] }[];
  method: string;
  revealed: string[];
  comparisons: string[][];
  round: number;
  namesText: string;
};
type CoreApi = {
  METHODS: string[];
  RANGE: { candidates: [number, number]; ballots: [number, number]; voters: [number, number] };
  start: (options?: { candidates?: unknown; ballots?: unknown; counts?: unknown; method?: string }) => State;
  voters: (s: State) => number;
  plurality: (s: State) => Scores;
  borda: (s: State) => Scores;
  pairwise: (s: State) => { scores: Scores; duels: Duel[] };
  scoreLine: (s: State, name: string, method: string) => string;
  eliminationRounds: (s: State) => Round[];
  scores: (s: State, method?: string) => Scores | null;
  winners: (s: State, method?: string) => string[];
  tie: (s: State, method?: string) => boolean;
  ranked: (scores: Scores, insertOrder: string[]) => string[];
  hashtableOrder: (names: string[]) => string[];
  result: (s: State) => string | null;
};

const core = (): CoreApi => cores["voting"].VotingCore as unknown as CoreApi;

const namesFrom = (v: unknown): string[] =>
  (Array.isArray(v) ? v : String(v ?? "").split(/[\s,]+/)).map((x) => String(x).trim()).filter(Boolean);

/** Ballots may be "ABC" (letters) or "Alice,Bob,Carol" (names with separators). */
function ballotOrder(raw: unknown, candidates: string[]): string[] {
  let parts = namesFrom(raw);
  if (parts.length === 1 && candidates.length > 1 && candidates.every((c) => c.length === 1) &&
      parts[0].length === candidates.length && typeof raw === "string" && !/[\s,]/.test(raw)) {
    parts = raw.split("");
  }
  return parts;
}

/** A preference schedule from "A,B,C" and ballots like "ABC", with voter counts. */
function readElection(args: Json): State {
  const C = core();
  const candidates = namesFrom(args.candidates);
  const [minC, maxC] = C.RANGE.candidates;
  if (candidates.length < minC || candidates.length > maxC) {
    throw new Error(`candidates must be ${minC} to ${maxC} different names, e.g. "A,B,C"`);
  }
  if (new Set(candidates).size !== candidates.length) throw new Error("candidates must be different names");

  const ballots = args.ballots;
  if (!Array.isArray(ballots)) throw new Error("ballots must be an array of rankings, e.g. [\"ABC\", \"BCA\"]");
  const [minB, maxB] = C.RANGE.ballots;
  if (ballots.length < minB || ballots.length > maxB) {
    throw new Error(`ballots must have ${minB} to ${maxB} columns`);
  }
  const orders = ballots.map((b, i) => {
    const raw = typeof b === "string" || Array.isArray(b) ? b : (b && typeof b === "object" ? (b as Json).order : null);
    const order = ballotOrder(raw, candidates);
    if (order.length !== candidates.length || new Set(order).size !== candidates.length ||
        order.some((name) => !candidates.includes(name))) {
      throw new Error(`ballots[${i}] must rank every candidate exactly once, e.g. "ABC"`);
    }
    return order;
  });

  // Counts may be given as a parallel array or inside ballot objects.
  const counts = args.counts !== undefined
    ? numArray(args, "counts")
    : ballots.map((b, i) => {
      if (b && typeof b === "object" && !Array.isArray(b) && (b as Json).count !== undefined) return num(b as Json, "count");
      throw new Error(`ballots[${i}] needs a count, or pass a counts array`);
    });
  if (counts.length !== orders.length) throw new Error("counts: one number of voters per ballot");
  const [minV, maxV] = C.RANGE.voters;
  counts.forEach((c, i) => {
    if (!Number.isInteger(c) || c < minV || c > maxV) {
      throw new Error(`counts[${i}] must be a whole number of voters from ${minV} to ${maxV}`);
    }
  });

  const method = args.method === undefined ? "plurality" : String(args.method);
  if (!C.METHODS.includes(method)) throw new Error(`method must be one of ${C.METHODS.join(", ")}`);
  return C.start({ candidates, ballots: orders.map((order, i) => ({ count: counts[i], order })), method });
}

/** Each method's scores, sorted order and winner(s) on the same schedule. */
function compare(C: CoreApi, s: State) {
  return Object.fromEntries(C.METHODS.map((method) => {
    const scores = C.scores(s, method) ?? {};
    const order = method === "pairwise" ? C.hashtableOrder(s.candidates) : s.candidates;
    return [method, {
      scores,
      ranked: C.ranked(scores, order),
      winners: C.winners(s, method),
      tied: C.tie(s, method),
    }];
  }));
}

function detail(C: CoreApi, s: State, method: string) {
  const winners = C.winners(s, method);
  const tied = C.tie(s, method);
  if (method === "plurality") {
    const scores = C.plurality(s);
    return {
      method, scores, ranked: C.ranked(scores, s.candidates),
      lines: s.candidates.map((name) => C.scoreLine(s, name, method)), winners, tied,
      note: "Only first places count: a candidate gets the voters of every ballot headed by their name.",
    };
  }
  if (method === "borda") {
    const scores = C.borda(s);
    return {
      method, scores, ranked: C.ranked(scores, s.candidates),
      lines: s.candidates.map((name) => C.scoreLine(s, name, method)), winners, tied,
      note: `With ${s.candidates.length} candidates a first place is worth ${s.candidates.length} points and the last place 1; each line shows the points added per ballot column.`,
    };
  }
  if (method === "elimination") {
    return {
      method,
      rounds: C.eliminationRounds(s).map((r) => ({
        number: r.number, active: r.active, scores: r.scores, ranked: r.ranked,
        weakest: r.weakest, winner: r.winner === undefined ? null : r.winner,
      })),
      winners, tied,
      note: "Each round the highest still-running name on a ballot wins that whole column; the weakest name is struck out. At two names the survivor wins, or nobody wins if they tie.",
    };
  }
  const { scores, duels } = C.pairwise(s);
  return {
    method, scores, duels,
    ranked: C.ranked(scores, C.hashtableOrder(s.candidates)), winners, tied,
    note: "Every pair is compared once: a head-to-head win is 1 point, a tie gives each candidate .5 point.",
  };
}

export function actions(): GameActions {
  return {
    compare_methods: {
      describe:
        "Count a preference schedule by all four methods at once. Pass the candidates (comma separated or an array) and ballots as rankings from favourite down, with one voter count per ballot (or counts inside ballot objects). Returns each method's scores, descending order and winner(s), and flags ties.",
      args: '{ "candidates": "A,B,C", "ballots": ["ABC", "BCA", "CAB"], "counts": [5, 4, 2] }',
      run: (args) => {
        const C = core();
        const s = readElection(args);
        return {
          candidates: s.candidates,
          ballots: s.ballots.map((b) => `${b.count} x ${b.order.join("")}`),
          voters: C.voters(s),
          results: compare(C, s),
          note: "Plurality counts first places; Borda gives n points down to 1; elimination drops the weakest name round by round (its scores here are from round 1); pairwise hands out points for head-to-head wins. More than one winner means a tie — a three-way pairwise tie can be a cycle where each name beats one other.",
        };
      },
    },
    method_detail: {
      describe:
        "Show the full counting arithmetic for one method: the per-ballot lines for plurality or Borda, every elimination round with the name dropped, or every head-to-head duel for pairwise comparison. The method must be plurality, borda, elimination or pairwise.",
      args: '{ "candidates": "A,B,C", "ballots": ["ABC", "BCA", "CAB"], "counts": [5, 4, 2], "method": "elimination" }',
      run: (args) => {
        const C = core();
        const s = readElection(args);
        return {
          candidates: s.candidates,
          ballots: s.ballots.map((b) => `${b.count} x ${b.order.join("")}`),
          voters: C.voters(s),
          ...detail(C, s, s.method),
        };
      },
    },
  };
}

/** A position saved by the page's Track.state(state), read back with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Voting state version ${stateVersion}`);
  const C = core();
  const names = namesFrom(state.candidates !== undefined ? state.candidates : state.namesText);
  const s = C.start({
    candidates: names.length ? names : undefined,
    ballots: Array.isArray(state.ballots) ? state.ballots : undefined,
    method: typeof state.method === "string" ? state.method : undefined,
  });
  const revealed = Array.isArray(state.revealed)
    ? (state.revealed as unknown[]).map(String).filter((name) => s.candidates.includes(name))
    : [];
  const comparisons = Array.isArray(state.comparisons)
    ? (state.comparisons as unknown[]).filter((p) => Array.isArray(p) && p.length === 2 &&
        p.every((name) => s.candidates.includes(String(name)))).map((p) => (p as unknown[]).map(String))
    : [];
  const now: State = { ...s, revealed, comparisons, round: num(state, "round", 0) };
  const method = now.method;
  const scores = C.scores(now, method) ?? {};
  const rounds = method === "elimination" ? C.eliminationRounds(now) : [];

  return {
    stateVersion,
    candidates: now.candidates,
    namesText: typeof state.namesText === "string" ? state.namesText : now.namesText,
    ballots: now.ballots,
    schedule: now.ballots.map((b) => `${b.count} x ${b.order.join("")}`),
    voters: C.voters(now),
    method,
    revealed: now.revealed,
    comparisons: now.comparisons,
    round: now.round,
    finished: C.result(now) === "done",
    current: {
      method,
      scores,
      ranked: C.ranked(scores, method === "pairwise" ? C.hashtableOrder(now.candidates) : now.candidates),
      winners: C.winners(now, method),
      tied: C.tie(now, method),
      ...(method === "elimination" ? {
        totalRounds: rounds.length,
        roundShown: Math.max(1, Math.min(now.round, rounds.length)),
      } : {}),
    },
    note: "The scores come from the whole table even where only some names have been revealed on the page; 'finished' says whether the player has revealed every score, stepped through all eliminations, or compared every pair.",
  };
}
