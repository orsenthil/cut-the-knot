/*
 * run_game_logic actions and saved-position reader for Plus or Minus (pm).
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

function build(args: Json) {
  const P = cores.pm.PmCore;
  const n = num(args, "n", 5);
  const signsArg = args.signs;
  const signs = Array.isArray(signsArg)
    ? signsArg.map((s) => (s === "-" || s === 2 ? P.MINUS : s === "+" || s === 1 ? P.PLUS : 0))
    : undefined;
  return P.restore({
    n,
    signs: signs ?? Array(n - 1).fill(0),
    turn: "you",
    over: false,
    winner: null,
    total: null,
    wins: 0,
    losses: 0,
    random: false,
    pendingSign: P.PLUS,
  });
}

export function actions(): GameActions {
  const P = cores.pm.PmCore;
  return {
    who_wins: {
      describe:
        "For sequence length N, whether the triangular number N(N+1)/2 is odd (you always win) or even (the computer always wins). Signs never change the parity.",
      args: '{ "n": 5 }',
      run: (args) => {
        const n = num(args, "n", 5);
        const tri = P.triangular(n);
        const odd = P.isOdd(tri);
        return {
          n,
          triangular: tri,
          triangularParity: odd ? "odd" : "even",
          youAlwaysWin: odd,
          computerAlwaysWins: !odd,
          note: odd
            ? "N ≡ 1 or 2 (mod 4): every signing is odd, so you win."
            : "N ≡ 0 or 3 (mod 4): every signing is even, so the computer wins.",
        };
      },
    },
    evaluate: {
      describe:
        "Evaluate 1 ± 2 ± … ± N for the given signs (+ or − / 1 or 2). Confirms the total’s parity matches the triangular number.",
      args: '{ "n": 5, "signs": ["+", "-", "+", "-"] }',
      run: (args) => {
        const game = build(args);
        if (game.signs.some((s: number) => s === 0)) {
          return { error: "every gap needs a + or −" };
        }
        const t = P.total(game);
        const tri = P.triangular(game.n);
        return {
          n: game.n,
          total: t,
          totalParity: P.isOdd(t) ? "odd" : "even",
          triangular: tri,
          matchesTriangularParity: P.isOdd(t) === P.isOdd(tri),
          youWin: P.isOdd(t),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const P = cores.pm.PmCore;
  const game = P.restore(state);
  const tri = P.triangular(game.n);
  const base = {
    n: game.n,
    signs: game.signs.map((s: number) => (s === P.PLUS ? "+" : s === P.MINUS ? "-" : null)),
    emptyGaps: P.emptyCount(game),
    triangular: tri,
    triangularParity: P.isOdd(tri) ? "odd" : "even",
    youShouldWinThisLength: P.isOdd(tri),
  };
  if (game.over) {
    return {
      finished: true,
      winner: game.winner,
      total: game.total,
      ...base,
    };
  }
  return {
    finished: false,
    turn: game.turn,
    ...base,
    note: P.isOdd(tri)
      ? "This length is odd as a triangular number: you win no matter which signs are chosen."
      : "This length is even as a triangular number: the computer wins no matter which signs are chosen.",
  };
}
