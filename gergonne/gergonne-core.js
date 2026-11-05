"use strict";

/*
 * Gergonne's Magic Trick -- pure logic, no DOM. Ported from Alexander
 * Bogomolny's GergonneMagic applet
 * (cut-the-knot.org/Curriculum/Games/GergonneMagic.shtml). classes.zip has only
 * the .class files, so the trick came off `javap -c -p GergonneMagicOb.class`.
 *
 * The applet fixes N = 3 piles (GergonneMagicCanvas's constructor) and derives
 * everything else from it:
 *
 *   M     = N^(N-1) = 9     cards in each pile
 *   total = N^N     = 27    cards, numbered 1..27 in random order
 *
 * Reset(N) deals the shuffled numbers across the piles one at a time --
 * `Rows[col][row] = P.at(row * N + col)` -- and the player silently picks one.
 *
 * ReportSelection(sel), the whole trick, is this:
 *
 *   order = [0, 1, ..., N-1];  swap order[N/2] and order[sel];
 *   gather every pile in that order into one stack;
 *   deal it out again one card at a time:  Rows[col][row] = flat[row * N + col]
 *
 * So the pile the player points at is picked up in the MIDDLE, and the stack is
 * re-dealt round-robin. Each round that cuts the number of places the chosen
 * card could be by a factor of N, and after N rounds only one is left:
 *
 *   Loc = (M / 2, N / 2)   -- the middle card of the middle pile
 *
 * which Reset() works out at the start and never touches again. For N = 3 that
 * is card 14 of the 27, dead centre, every single time.
 *
 * One more detail that is easy to miss and matters a lot to the trick: at() does
 * NOT show a pile in its real order while the trick is running.
 *
 *   at(col, row) = State === FINAL ? Rows[col][row]
 *                                  : Rows[col][Aux[col].at(row) - 1]
 *
 * Aux[col] is a random permutation drawn once per game, so each pile is
 * displayed shuffled and the player cannot follow their card's position inside
 * it -- only which pile it is in. The true order is revealed on the last step.
 */
const GergonneCore = (() => {
  const DEFAULT_PILES = 3; // GergonneMagicCanvas: N = 3

  const rowsPerPile = (n) => n ** (n - 1); // M
  const cardCount = (n) => n ** n; // N * M

  /** Where the chosen card always ends up: Reset()'s Loc. */
  const finalCell = (n) => ({ col: Math.floor(n / 2), row: Math.floor(rowsPerPile(n) / 2) });

  /** The number of rounds: the applet's State runs FIRST..FINAL. */
  const rounds = (n) => n;

  /** A shuffled 1..k, the way Permutation.CreateRandom() builds one. */
  function shuffle(k, rand) {
    const v = Array.from({ length: k }, (_, i) => i + 1);
    for (let i = k - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = v[i];
      v[i] = v[j];
      v[j] = t;
    }
    return v;
  }

  /**
   * Reset(n). Returns {n, m, piles, display, state}: piles[col][row] holds the
   * real deal, and display[col][row] is the true row index to show at that
   * position while the trick runs.
   */
  function deal(n = DEFAULT_PILES, rand = Math.random) {
    const m = rowsPerPile(n);
    const flat = shuffle(cardCount(n), rand);
    const piles = [];
    for (let c = 0; c < n; c++) {
      const pile = [];
      for (let r = 0; r < m; r++) pile.push(flat[r * n + c]);
      piles.push(pile);
    }
    const display = [];
    for (let c = 0; c < n; c++) display.push(shuffle(m, rand).map((v) => v - 1));
    return { n, m, piles, display, state: 0 };
  }

  /** at(col, row): what the player sees in that slot. */
  function shown(game, col, row) {
    return game.state >= rounds(game.n)
      ? game.piles[col][row]
      : game.piles[col][game.display[col][row]];
  }

  const pileOf = (game, card) => game.piles.findIndex((p) => p.includes(card));
  const finished = (game) => game.state >= rounds(game.n);

  /** ReportSelection(sel): gather with that pile in the middle, deal again. */
  function reportSelection(game, sel) {
    const { n, m } = game;
    if (!Number.isInteger(sel) || sel < 0 || sel >= n) return game;

    const order = Array.from({ length: n }, (_, i) => i);
    const mid = Math.floor(n / 2);
    const keep = order[mid];
    order[mid] = sel;
    order[sel] = keep;

    const flat = [];
    for (const c of order) for (let r = 0; r < m; r++) flat.push(game.piles[c][r]);

    const piles = [];
    for (let c = 0; c < n; c++) {
      const pile = [];
      for (let r = 0; r < m; r++) pile.push(flat[r * n + c]);
      piles.push(pile);
    }
    return { ...game, piles, state: Math.min(rounds(n), game.state + 1) };
  }

  /** The card the trick has cornered, once the rounds are done. */
  function revealed(game) {
    const { col, row } = finalCell(game.n);
    return game.piles[col][row];
  }

  return {
    DEFAULT_PILES, rowsPerPile, cardCount, finalCell, rounds,
    deal, shown, pileOf, finished, reportSelection, revealed, shuffle,
  };
})();
