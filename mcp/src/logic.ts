/*
 * run_game_logic: calls the games' real cores.
 *
 * The point of this tool is that the tutor can *show* a strategy instead of
 * describing one from memory. Every answer here comes from the same file the
 * live page runs, copied verbatim into src/generated/cores/ at build time, so
 * the server cannot drift from the site.
 *
 * Each game exposes a small set of named actions with plain JSON arguments;
 * ACTIONS below is also what the tool's description advertises, so a client
 * can discover them without reading this file.
 */

// Generated at build time by scripts/build-index.mjs.
// eslint-disable-next-line import/no-unresolved
import { cores } from "./generated/cores.js";

type Json = Record<string, unknown>;
type ActionFn = (args: Json) => unknown;

interface ActionSpec {
  describe: string;
  args: string;
  run: ActionFn;
}

const num = (args: Json, key: string, fallback?: number): number => {
  const v = args[key];
  if (v === undefined || v === null) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing required argument "${key}"`);
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`argument "${key}" must be a number, got ${JSON.stringify(v)}`);
  return n;
};

const numArray = (args: Json, key: string): number[] => {
  const v = args[key];
  if (!Array.isArray(v)) throw new Error(`argument "${key}" must be an array of numbers`);
  return v.map((x, i) => {
    const n = Number(x);
    if (!Number.isFinite(n)) throw new Error(`${key}[${i}] is not a number`);
    return n;
  });
};

/* ------------------------------------------------------------------ games */

function hourglassActions(): Record<string, ActionSpec> {
  const H = cores.hourglass.HourglassCore;
  return {
    solve: {
      describe:
        "Fewest-flips recipe for boiling the egg for `target` minutes with glasses of `a` and `b` minutes. Returns null when it cannot be done.",
      args: '{ "a": 7, "b": 11, "target": 15 }',
      run: (args) => {
        const a = num(args, "a");
        const b = num(args, "b");
        const target = num(args, "target");
        const result = H.solve({ a, b }, target);
        if (!result) {
          return {
            solvable: false,
            why: `${target} is not reachable with ${a} and ${b} minute glasses; only multiples of gcd(${a}, ${b}) are.`,
          };
        }
        return {
          solvable: true,
          flips: result.flips,
          totalMinutes: result.elapsed,
          steps: result.steps.map((s: Json & { act: string }) => ({
            action: s.act,
            say: H.describe(s, { a, b }),
            minutesElapsed: (s as unknown as { after: { elapsed: number } }).after.elapsed,
            minutesCooked: (s as unknown as { after: { cooked: number } }).after.cooked,
          })),
        };
      },
    },
    next_state: {
      describe: "Applies one action (flipA, flipB, eggIn, eggOut, wait) to a state.",
      args: '{ "a": 7, "b": 11, "action": "flipA", "state": { "ta": 0, "tb": 0, "egg": 0, "cooked": 0, "flips": 0, "elapsed": 0, "dt": 0 } }',
      run: (args) => {
        const caps = { a: num(args, "a"), b: num(args, "b") };
        const state = (args.state as Json) ?? H.start();
        const next = H.apply(state, String(args.action), caps);
        return next ? { legal: true, state: next } : { legal: false };
      },
    },
  };
}

function coinsActions(): Record<string, ActionSpec> {
  const { Coin, CoinGame } = cores.coins;

  const build = (values: number[]) => new CoinGame(values.map((v: number, i: number) => new Coin(v, i)));

  return {
    computer_reply: {
      describe:
        "Plays the computer's move on a row of coins and says which coin it took and why. `taken` is the moves already played, in order, each 'first' or 'last', starting with the human.",
      args: '{ "values": [4, 2, 9, 1], "taken": ["first"] }',
      run: (args) => {
        const values = numArray(args, "values");
        const taken = (Array.isArray(args.taken) ? args.taken : []).map(String);
        const g = build(values);
        for (const side of taken) {
          if (g.isFinished()) break;
          const coin = side === "first" ? g.coins[g.first] : g.coins[g.last];
          g.humanTake(coin);
        }
        if (g.isFinished()) return { finished: true, scores: g.scores };
        const before = { first: g.first, last: g.last };
        const coin = g.computerPlay();
        return {
          took: { index: coin.index, value: coin.value, end: coin.index === before.first ? "first" : "last" },
          strategyParity: g.strategy,
          why:
            `The computer fixed its parity at the start: it wants the coins at positions where index % 2 === ${g.strategy}. ` +
            `It takes whichever end matches, and the larger end when neither or both do.`,
          scores: g.scores,
          finished: g.isFinished(),
        };
      },
    },
    parity_split: {
      describe:
        "The two alternating colour classes of a row and their totals. On an even row the player who moves first can guarantee the larger of the two.",
      args: '{ "values": [4, 2, 9, 1] }',
      run: (args) => {
        const values = numArray(args, "values");
        const even = values.filter((_, i) => i % 2 === 0);
        const odd = values.filter((_, i) => i % 2 === 1);
        const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
        return {
          evenPositions: { values: even, total: sum(even) },
          oddPositions: { values: odd, total: sum(odd) },
          guaranteedForFirstPlayer: values.length % 2 === 0 ? Math.max(sum(even), sum(odd)) : null,
          note:
            values.length % 2 === 0
              ? "Even row: taking an end coin only ever exposes a coin of the other class, so the first player can take one whole class."
              : "Odd row: the parity argument does not apply, and the first player has no such guarantee.",
        };
      },
    },
    play_out: {
      describe: "Plays a whole game: the computer moves first, the human takes the given ends in order.",
      args: '{ "values": [4, 2, 9, 1], "humanChoices": ["first", "last"] }',
      run: (args) => {
        const values = numArray(args, "values");
        const choices = (Array.isArray(args.humanChoices) ? args.humanChoices : []).map(String);
        const g = build(values);
        const log: unknown[] = [];
        g.computerPlay();
        log.push({ who: "computer", scores: { ...g.scores } });
        for (const side of choices) {
          if (g.isFinished()) break;
          const coin = side === "first" ? g.coins[g.first] : g.coins[g.last];
          g.humanTake(coin);
          log.push({ who: "human", took: coin.value, scores: { ...g.scores } });
          if (!g.isFinished()) {
            const c = g.computerPlay();
            log.push({ who: "computer", took: c.value, scores: { ...g.scores } });
          }
        }
        return { finished: g.isFinished(), scores: g.scores, log };
      },
    },
  };
}

function knightsActions(): Record<string, ActionSpec> {
  const K = cores["four-knights"].KnightsCore;
  return {
    shortest_solution: {
      describe: "The fewest knight moves that swap the two colours. Searched, not looked up.",
      args: "{}",
      run: () => ({
        moves: K.shortestSolution(),
        why: "The centre square is unreachable by a knight, so the eight outer squares form one 8-cycle. Knights cannot pass each other on a cycle, so swapping the colours means rotating all four knights four places.",
      }),
    },
    cycle: {
      describe: "The 3x3 board redrawn as the cycle that knight moves actually form.",
      args: "{}",
      run: () => {
        const ring = [];
        for (let r = 1; r <= 8; r++) {
          ring.push({ position: r, square: K.cellOf(r), neighbours: K.neighbors(r), startsAs: (K.HOME as Record<number, string>)[r] ?? null });
        }
        return { ring, centre: "unreachable by a knight, so it is not on the cycle" };
      },
    },
    legal_moves: {
      describe: "Legal destinations for the knight at a ring position, given who sits where.",
      args: '{ "occupied": { "1": "red", "3": "red", "5": "blue", "7": "blue" }, "ring": 1 }',
      run: (args) => {
        const occupied = (args.occupied as Record<string, string>) ?? K.start().occupied;
        return { moves: K.legalMoves({ occupied, moves: 0 }, num(args, "ring")) };
      },
    },
  };
}

function eyeOpenerActions(): Record<string, ActionSpec> {
  const E = cores["eye-opener"].EyeOpener;
  return {
    areas: {
      describe: "Where the extra square comes from: the honest area, and the area after the applet's hidden stretch.",
      args: '{ "n": 10 }',
      run: (args) => {
        const n = E.clampN(num(args, "n", 10));
        const lower = E.area(E.lowerPolygon(n));
        const upper = E.area(E.upperPolygon(n, 0, 0, 0));
        const t = E.target(n);
        const cheat = E.cheat(n, -1);
        const upperCheated = E.area(E.upperPolygon(n, t.dx, t.dy, cheat));
        return {
          n,
          rectangle: { width: n + 1, height: n - 1, area: (n + 1) * (n - 1) },
          square: { side: n, area: n * n },
          pieces: { lower, upperHonest: upper, honestTotal: lower + upper },
          cheat: { stretchPerColumn: cheat, upperAfterStretch: upperCheated, total: lower + upperCheated },
          why: `Each step is only (n-1)/n of a square tall, so after sliding, the top edge is 1/n short. The applet silently stretches it by 1/n across all ${n} columns, which is exactly the one square that "appears".`,
        };
      },
    },
  };
}

function mindReaderActions(): Record<string, ActionSpec> {
  const M = cores["mind-reader"].MindReader;
  return {
    predict: {
      describe: "Runs the trick on a number: subtract its digit sum and land on a multiple of 9.",
      args: '{ "number": 47 }',
      run: (args) => {
        const n = num(args, "number");
        if (n < 0 || n >= M.CELLS) throw new Error(`number must be between 0 and ${M.CELLS - 1}`);
        const a = Math.floor(n / 10);
        const b = n % 10;
        return {
          number: n,
          digitSum: a + b,
          result: M.digitSumResult(n),
          isMarkedCell: M.magicCells().includes(M.digitSumResult(n)),
          why: `10a + b - (a + b) = 9a, so ${n} gives 9 x ${a} = ${9 * a}. Every result is a multiple of 9, and the table shows the same shape on all of them.`,
        };
      },
    },
    marked_cells: {
      describe: "The cells that always carry the special shape.",
      args: "{}",
      run: () => ({ cells: M.magicCells(), count: M.magicCells().length }),
    },
  };
}

function torqueActions(): Record<string, ActionSpec> {
  const T = cores.torque.TorqueCore;
  return {
    generate: {
      describe: "A fresh balance puzzle. Every round is built backwards from a balanced arrangement, so it is always solvable.",
      args: "{}",
      run: () => T.generate(),
    },
    evaluate: {
      describe: "Scores a placement: the beam balances when the torques sum to zero.",
      args: '{ "items": [{ "id": "a", "value": 2 }, { "id": "b", "value": -1 }], "placements": { "a": 3, "b": 6 } }',
      run: (args) => {
        const items = (args.items as { id: string; value: number }[]) ?? [];
        const placements = (args.placements as Record<string, number>) ?? {};
        const result = T.evaluate(items, placements);
        return {
          ...result,
          why: "sum(value x position) must be 0; positions run -6..-1 on the left and 1..6 on the right.",
        };
      },
    },
  };
}

function fourByFourActions(): Record<string, ActionSpec> {
  const F = cores["four-by-four"].FourByFourCore;
  return {
    winning_lines: {
      describe: "All 76 lines of four in the 4x4x4 cube, as cell indices (cell = 16z + 4y + x).",
      args: "{}",
      run: () => ({ count: F.COMB.length, lines: F.COMB }),
    },
    lines_through: {
      describe: "Every winning line that passes through a given cell, which is how the cube's geometry becomes visible.",
      args: '{ "cell": 21 }',
      run: (args) => {
        const cell = num(args, "cell");
        if (cell < 0 || cell > 63) throw new Error("cell must be 0..63");
        const lines = F.COMB.filter((l: number[]) => l.includes(cell));
        return { cell, coords: F.xyz(cell), lineCount: lines.length, lines };
      },
    },
    machine_reply: {
      describe:
        "The computer's answer to a human move on an empty board, played by the applet's own pattern-matching logic (which does not look ahead).",
      args: '{ "humanCells": [21] }',
      run: (args) => {
        const cells = numArray(args, "humanCells");
        const B = F.create();
        F.newGame(B);
        const played: unknown[] = [];
        for (const cell of cells) {
          if (cell < 0 || cell > 63) throw new Error("cells must be 0..63");
          const before = B.occupied.slice();
          F.selection(B, cell);
          const reply = [];
          for (let c = 0; c < 64; c++) {
            if (before[c] !== B.occupied[c] && c !== cell && B.occupied[c] === F.MACHINE) reply.push(c);
          }
          played.push({ human: cell, machine: reply[0] ?? null, machineCoords: reply[0] != null ? F.xyz(reply[0]) : null });
        }
        return { moves: played, gameOver: B.player === F.END };
      },
    },
  };
}

/* ---------------------------------------------------------------- registry */

export const ACTIONS: Record<string, Record<string, ActionSpec>> = {
  hourglass: hourglassActions(),
  coins: coinsActions(),
  "four-knights": knightsActions(),
  "eye-opener": eyeOpenerActions(),
  "mind-reader": mindReaderActions(),
  torque: torqueActions(),
  "four-by-four": fourByFourActions(),
};

/** A short catalogue of what run_game_logic can do, for the tool description. */
export function actionCatalogue(): string {
  return Object.entries(ACTIONS)
    .map(([slug, actions]) => {
      const list = Object.entries(actions)
        .map(([name, spec]) => `    ${name} ${spec.args}\n      ${spec.describe}`)
        .join("\n");
      return `  ${slug}:\n${list}`;
    })
    .join("\n");
}

export function runGameLogic(slug: string, action: string, args: Json): unknown {
  const game = ACTIONS[slug];
  if (!game) {
    throw new Error(
      `No runnable logic for "${slug}". Games with a core: ${Object.keys(ACTIONS).join(", ")}.`,
    );
  }
  const spec = game[action];
  if (!spec) {
    throw new Error(`"${slug}" has no action "${action}". Available: ${Object.keys(game).join(", ")}.`);
  }
  return spec.run(args ?? {});
}
