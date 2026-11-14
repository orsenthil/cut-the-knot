/*
 * run_game_logic actions for coins.
 *
 * Each action calls the game's real core (coins/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
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

/**
 * What the core says about a position saved by the page (CoinGame.snapshot()):
 * what is left, the two alternating groups the parity argument is about, and
 * how the computer would answer each coin the player may take now.
 */
export function position(state: Json): unknown {
  const { CoinGame } = cores.coins;
  const game = CoinGame.restore(state);
  if (game.isFinished()) {
    const points = game.countPoints();
    return { finished: true, you: points.x, computer: points.y };
  }

  const n: number = game.n;
  const remaining: { index: number; value: number }[] = [];
  for (let i = game.first, guard = 0; guard < n; i = (i + 1) % n, guard++) {
    if (game.coins[i].enabled) remaining.push({ index: i, value: game.coins[i].value });
    if (i === game.last) break;
  }
  const total = (parity: number) =>
    remaining.filter((c) => c.index % 2 === parity).reduce((sum, c) => sum + c.value, 0);

  const choices = game.coins
    .filter((coin: { enabled: boolean }) => game.isTakeable(coin))
    .map((coin: { index: number; value: number }) => {
      const copy = CoinGame.restore(state);
      copy.humanTake(copy.coins[coin.index]);
      if (copy.isFinished()) return { take: coin, thenComputerTakes: null };
      const tie = copy.coins[copy.first].value === copy.coins[copy.last].value && copy.first !== copy.last;
      const reply = copy.computerPlay();
      return {
        take: { index: coin.index, value: coin.value },
        thenComputerTakes: { index: reply.index, value: reply.value },
        ...(tie ? { note: "The two ends were equal, so the computer may take either." } : {}),
      };
    });

  return {
    finished: false,
    scores: { you: game.scores.x, computer: game.scores.y },
    remaining,
    alternatingGroups: {
      evenIndexTotal: total(0),
      oddIndexTotal: total(1),
      computerWantsIndexParity: game.strategy,
      note: "Taking an end coin only ever uncovers a coin of the other group, which is the whole parity argument.",
    },
    yourChoices: choices,
  };
}
