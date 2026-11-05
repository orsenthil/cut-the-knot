"use strict";

/*
 * The Game of Jam (John A. Michon's; Bogomolny's Jam applet) - rules and computer.
 *
 * Nine roads join eight cities. Players take turns claiming a road; the first
 * to own every road through some city wins. If every road is taken and nobody
 * has a city, it is a stalemate.
 *
 * The secret: it is tic-tac-toe. Each road is a square of the 3 by 3 board and
 * each city is one of the eight lines - the three roads through a city are the
 * three squares of a row, column or diagonal. The applet numbers its roads so
 * that road i *is* square i, and stores positions as 9-bit masks.
 *
 * Read off the bytecode (JamCanvas, after Arthur van Hoff's TicTacToe demo):
 *   - the winning masks 7, 56, 448, 73, 146, 292, 273, 84;
 *   - the road map: cities C0, C2..C7 placed by init() and C1 where roads 2,
 *     4 and 6 cross; road i joins the two cities in ROAD_ENDS[i];
 *   - bestMove(): try squares in the order centre, corners, edges; for each
 *     free one, with chance 1/10 just take it ("from time to time, benevolent
 *     mistakes"); take it if it wins; otherwise remember the first one after
 *     which the opponent has no immediate win; failing all that, the first free
 *     square;
 *   - the computer is "white" (red on the board), you are "black" (blue); with
 *     "I move first" ticked, Start has the computer open on a random road.
 */

var JamCore = (function () {
  const FULL = 511;
  const LINES = [7, 56, 448, 73, 146, 292, 273, 84];
  const ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7]; // JamCanvas.moves
  const MAGIC = [3, 8, 1, 2, 4, 6, 7, 0, 5]; // JamCanvas.magic: +1 gives the Lo Shu square
  const MISTAKE = 0.1; // (int)(random * 10) == 7

  // Where the applet puts its cities, in a unit square (init() with margin 20 on a 300 board).
  const CITIES = (() => {
    const S = 300;
    const M = 20;
    const L3 = S - 2 * M;
    const c = [];
    c[0] = [M, S / 2];
    c[2] = [M + (2 * L3) / 3, S / 2];
    c[3] = [S - M, S / 2];
    const x45 = M + L3 / 6;
    c[4] = [x45, M];
    c[5] = [x45, S - M];
    c[6] = [c[4][0] + (c[3][0] - c[4][0]) * 0.44, c[4][1] + (c[3][1] - c[4][1]) * 0.44];
    c[7] = [c[5][0] + (c[3][0] - c[5][0]) * 0.44, c[5][1] + (c[3][1] - c[5][1]) * 0.44];
    // C1: where road 2 (C4-C7) meets road 4 (C0-C3), the line y = S/2.
    const t = (S / 2 - c[4][1]) / (c[7][1] - c[4][1]);
    c[1] = [c[4][0] + t * (c[7][0] - c[4][0]), S / 2];
    return c.map(([x, y]) => [x / S, y / S]);
  })();
  const ROAD_ENDS = [[3, 5], [2, 7], [4, 7], [0, 5], [0, 3], [0, 4], [5, 6], [2, 6], [3, 4]];
  // Which city is which line (found by testing which three roads pass through each city).
  const CITY_LINE = [56, 84, 146, 273, 292, 73, 448, 7];

  const isWon = (mask) => LINES.some((l) => (mask & l) === l);
  const bit = (i) => 1 << i;

  function start() {
    return { you: 0, computer: 0, over: false, result: null };
  }

  /** status(): who has a city, or a full board. */
  function status(s) {
    if (isWon(s.computer)) return "computer";
    if (isWon(s.you)) return "you";
    if ((s.you | s.computer) === FULL) return "stalemate";
    return null;
  }

  const free = (s, i) => !((s.you | s.computer) & bit(i));

  /** bestMove(white, black): the computer's road. */
  function bestMove(s, rnd = Math.random) {
    const me = s.computer;
    const them = s.you;
    let best = -1;
    for (const m of ORDER) {
      if ((me | them) & bit(m)) continue;
      if (Math.trunc(rnd() * 10) === 7) return m;
      const pw = me | bit(m);
      if (isWon(pw)) return m;
      let safe = true;
      for (let j = 0; j < 9; j++) {
        if ((pw | them) & bit(j)) continue;
        if (isWon(them | bit(j))) { safe = false; break; }
      }
      if (safe && best === -1) best = m;
    }
    if (best !== -1) return best;
    for (const m of ORDER) if (!((me | them) & bit(m))) return m;
    return -1;
  }

  function finish(s) {
    const r = status(s);
    if (r) { s.over = true; s.result = r; }
    return r;
  }

  /** yourMove() then, if the game goes on, myMove(). Returns the computer's road or -1. */
  function playYou(s, road, rnd = Math.random) {
    if (s.over || road < 0 || road > 8 || !free(s, road)) return null;
    s.you |= bit(road);
    if (finish(s)) return -1;
    const m = bestMove(s, rnd);
    if (m >= 0) s.computer |= bit(m);
    finish(s);
    return m;
  }

  /** Start(): with "I move first", the computer opens on a random road. */
  function computerOpens(s, rnd = Math.random) {
    const m = Math.trunc(rnd() * 9);
    s.computer = bit(m);
    return m;
  }

  return {
    FULL, LINES, ORDER, MAGIC, MISTAKE, CITIES, ROAD_ENDS, CITY_LINE,
    isWon, bit, start, status, free, bestMove, playYou, computerOpens,
  };
})();
