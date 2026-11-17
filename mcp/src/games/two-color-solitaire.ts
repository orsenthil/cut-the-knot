/*
 * Tutor actions and position reader for Solitaire in Two Colors.
 *
 * The page saves the deck size and the circle order as deck values 1..N. The
 * core rebuilds that position, so the tutor can say which pairs can go, how
 * far the invariant has held, whether the magic trick applies, and (for a
 * small position) whether a winning line still exists.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Game = { n: number; order: number[] };

const parity = (value: number) => (value % 2 === 0 ? "even" : "odd");

/**
 * A saved position: deck size n (4..40, even) and the remaining circle order.
 * A circle is always a whole number of pairs short of a full deck.
 */
function restore(state: Json) {
  const C = cores["two-color-solitaire"].TwoColorSolitaireCore as any;
  if (!Array.isArray(state.order)) throw new Error("a position needs the circle order");
  const raw = state.order as unknown[];
  const n = C.clampN(state.n == null ? (raw.length || C.DEFAULT_N) : Number(state.n));
  if (raw.length > n || raw.length % 2 !== 0) {
    throw new Error(`the circle has ${raw.length} cards, which is not an even number no greater than ${n}`);
  }
  const order = raw.map(Number);
  const seen = new Set<number>();
  for (const value of order) {
    if (!Number.isInteger(value) || value < 1 || value > n) {
      throw new Error(`card ${JSON.stringify(value)} is not in the deck 1..${n}`);
    }
    if (seen.has(value)) throw new Error(`card ${value} appears twice`);
    seen.add(value);
  }
  return { C, game: { n, order } as Game };
}

/** The applet's deal, red and blue interleaved, when no order is given. */
function gameFromArgs(C: any, args: Json): Game {
  const raw = args.order;
  if (raw !== undefined && raw !== null) {
    if (!Array.isArray(raw)) throw new Error('"order" must be an array of card values');
    return restore({ n: args.n, order: raw } as Json).game;
  }
  const n = C.clampN(num(args, "n", C.DEFAULT_N));
  return { n, order: C.canonicalOrder(n) };
}

/**
 * A line of gaps (0-based) that wins from here, or null. When the invariant
 * is 0 and the colours alternate, every line wins - the page's magic trick -
 * so taking the first legal gap is enough. Otherwise the line is searched,
 * with a cap so a large hopeless position cannot hang the tutor.
 */
function winningLine(C: any, game: Game): { line: number[] | null; aborted: boolean } {
  if (game.order.length === 0) return { line: [], aborted: false };
  const gaps = C.removable(game);
  if (gaps.length === 0) return { line: null, aborted: false };
  const inv = C.invariant(game);
  const sum = Math.abs(inv.oddDifference) + Math.abs(inv.evenDifference);
  if (C.alternatesColors(game) && sum === 0) {
    const line: number[] = [];
    let s = game;
    while (s.order.length > 0) {
      const next = C.removable(s);
      if (next.length === 0) return { line: null, aborted: false };
      line.push(next[0].index);
      s = C.removePair(s, next[0].index);
    }
    return { line, aborted: false };
  }

  const cap = 100000;
  let seen = 0;
  let aborted = false;
  const memo = new Map<string, number[] | null>();
  const search = (s: Game): number[] | null => {
    if (s.order.length === 0) return [];
    const key = s.order.join(",");
    if (memo.has(key)) return memo.get(key) ?? null;
    if (seen++ >= cap) { aborted = true; return null; }
    const options = C.removable(s);
    if (options.length === 0) { memo.set(key, null); return null; }
    for (const p of options) {
      const rest = search(C.removePair(s, p.index));
      if (rest) {
        const line = [p.index].concat(rest);
        memo.set(key, line);
        return line;
      }
    }
    memo.set(key, null);
    return null;
  };
  return { line: search(game), aborted };
}

const gapView = (C: any, game: Game, gap: number) => {
  const pair = C.pairAt(game, gap);
  return pair && {
    gap: gap + 1, // 1-based for the tutor
    cards: [pair.a, pair.b],
    parity: parity(pair.a),
  };
};

export function actions(): GameActions {
  return {
    legal_gaps: {
      describe:
        "List the gaps in the circle where the two neighbouring cards share a parity - the pairs that can be removed. Gaps are numbered from 1. Omit order to use the applet's starting deal.",
      args: '{ "n": 8 }',
      run: (args) => {
        const C = cores["two-color-solitaire"].TwoColorSolitaireCore as any;
        const game = gameFromArgs(C, args);
        const gaps = C.removable(game).map((p: { index: number }) => gapView(C, game, p.index));
        const inv = C.invariant(game);
        return {
          deckSize: game.n,
          cardsLeft: game.order.length,
          gaps,
          gapCount: gaps.length,
          invariant: inv,
          note: game.order.length === 0
            ? "The circle is already empty."
            : gaps.length === 0
              ? `Stuck: ${game.order.length} cards are left and no neighbours share a parity.`
              : `${gaps.length} of ${game.order.length} gaps can be clicked.`,
        };
      },
    },
    check_removal: {
      describe:
        "Test removing the pair at a gap (1-based) and say what is left. A pair is legal only when both cards are odd or both are even.",
      args: '{ "n": 6, "order": [1, 4, 2, 5, 3, 6], "gap": 1 }',
      run: (args) => {
        const C = cores["two-color-solitaire"].TwoColorSolitaireCore as any;
        const game = gameFromArgs(C, args);
        const gap = Math.trunc(num(args, "gap", 1)) - 1;
        const pair = C.pairAt(game, gap);
        if (!pair) throw new Error(`gap ${gap + 1} is not on a circle of ${game.order.length} cards`);
        const next = C.removePair(game, gap);
        if (!next) {
          return {
            legal: false,
            cards: [pair.a, pair.b],
            reason: `${pair.a} is ${parity(pair.a)} while ${pair.b} is ${parity(pair.b)}; only two odds or two evens can go.`,
          };
        }
        const end = C.result(next);
        return {
          legal: true,
          cards: [pair.a, pair.b],
          orderAfter: next.order,
          cardsLeft: next.order.length,
          finished: end === "win",
          stuck: end === "lose",
          note: end === "win"
            ? "That was the last pair; the circle is empty."
            : end === "lose"
              ? `That leaves ${next.order.length} cards with no legal pair: a stuck position.`
              : `${next.order.length} cards left.`,
        };
      },
    },
    invariant: {
      describe:
        "Count the four kinds of card (odd red, odd blue, even red, even blue) and their differences. The differences never change during play; when both are 0 the magic trick holds and no line can get stuck.",
      args: '{ "n": 6 }',
      run: (args) => {
        const C = cores["two-color-solitaire"].TwoColorSolitaireCore as any;
        const game = gameFromArgs(C, args);
        const inv = C.invariant(game);
        const sum = Math.abs(inv.oddDifference) + Math.abs(inv.evenDifference);
        return {
          deckSize: game.n,
          cardsLeft: game.order.length,
          coloursAlternate: C.alternatesColors(game),
          ...inv,
          everyLineWins: sum === 0 && C.alternatesColors(game),
          note: sum === 0
            ? "The two differences are 0, so no reachable position can be stuck: every line of play wins."
            : `The differences are ${inv.oddDifference} and ${inv.evenDifference}, so some lines of play get stuck.`,
        };
      },
    },
    winning_line: {
      describe:
        "Find gaps (1-based, in order) that remove every card, or say that this position cannot be won. Large hopeless positions are searched up to a limit; winnable is then null and the answer is not a proof.",
      args: '{ "n": 6, "order": [1, 4, 2, 5, 3, 6] }',
      run: (args) => {
        const C = cores["two-color-solitaire"].TwoColorSolitaireCore as any;
        const game = gameFromArgs(C, args);
        const { line, aborted } = winningLine(C, game);
        if (!line) {
          return {
            winnable: aborted ? null : false,
            note: aborted
              ? "The search hit its limit without finding a winning line. That is not a proof that none exists."
              : `${game.order.length} cards are left but no line of legal removals clears them.`,
          };
        }
        // Replay to give each gap with the cards it removes.
        const moves: { gap: number; cards: number[] }[] = [];
        let s = game;
        for (const gap of line) {
          const pair = C.pairAt(s, gap);
          moves.push({ gap: gap + 1, cards: [pair.a, pair.b] });
          s = C.removePair(s, gap);
        }
        return {
          winnable: true,
          moves,
          moveCount: moves.length,
          note: moves.length === 0
            ? "The circle is already empty."
            : `${moves.length} removals clear the circle.`,
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const { C, game } = restore(state);
  const n = game.n;
  const left = game.order.length;
  const inv = C.invariant(game);
  const end = C.result(game);
  const gaps = C.removable(game).map((p: { index: number }) => gapView(C, game, p.index));
  const magic = n % 4 === 0;

  return {
    finished: end === "win",
    stuck: end === "lose",
    deckSize: n,
    cardsLeft: left,
    pairsRemoved: (n - left) / 2,
    cards: game.order.slice(),
    legalGaps: gaps,
    legalGapCount: gaps.length,
    coloursAlternate: C.alternatesColors(game),
    oddRed: inv.oddRed,
    oddBlue: inv.oddBlue,
    evenRed: inv.evenRed,
    evenBlue: inv.evenBlue,
    oddDifference: inv.oddDifference,
    evenDifference: inv.evenDifference,
    magicTrickApplies: magic,
    note: end === "win"
      ? `Every one of the ${n} cards has been removed.`
      : end === "lose"
        ? `Stuck with ${left} cards left: no two neighbours share a parity.`
        : magic
          ? `${left} cards left after ${(n - left) / 2} pairs. ${n} is a multiple of 4, so every line of play wins from here.`
          : `${left} cards left after ${(n - left) / 2} pairs. ${n} is not a multiple of 4, so a careless line can get stuck.`,
  };
}
