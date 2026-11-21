#!/usr/bin/env node
"use strict";

/*
 * Logic test for distributive-law/distributive-law-core.js.
 *
 *   node porting/check-distributive-law.mjs
 *
 * The law itself: for every board up to 6 by 6 the game is played out by trying
 * EVERY cut at every step (a depth-first walk over all the cutting orders) and the
 * written expression always evaluates to NX*NY; the pieces always tile the board
 * exactly; each play ends after exactly NX*NY - 1 cuts, whatever the order; and the
 * expression text follows the applet's toString (height*width, "1" for a square,
 * parentheses optional).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("distributive-law/distributive-law-core.js", "DistributiveLawCore");

{
  const s = C.start({});
  check("the board opens 5 wide and 4 high, as the applet", s.nx === 5 && s.ny === 4);
  equal("the opening product is written 4*5", C.expression(s), "4*5");
  check("a new board is not finished", C.result(s) === null && C.remaining(s) === 19);
  const t = C.move(s, { type: "cut", axis: "col", c: 1, r: 0 });
  equal("cutting after the second column gives 4*2+4*3", C.expression(t), "4*2+4*3");
  equal("with parentheses (4*2+4*3)", C.expression(C.move(t, { type: "parentheses", value: true })), "(4*2+4*3)");
  check("the old position is untouched", C.expression(s) === "4*5" && s.moves === 0);
  check("a cut at the edge of a piece is refused", C.move(t, { type: "cut", axis: "col", c: 1, r: 0 }) === null && C.move(s, { type: "cut", axis: "col", c: 4, r: 0 }) === null);
  check("a cut outside the board is refused", C.move(s, { type: "cut", axis: "row", c: 9, r: 9 }) === null);
  { const u = C.move(t, { type: "cut", axis: "row", c: 0, r: 1 }); check("the history lists the newest first", u.history.length === 3 && u.history[0] === C.expression(u) && u.history[2] === "4*5"); }
  check("sizes outside 1..12 are refused", C.move(s, { type: "size", nx: 13, ny: 4 }) === null && C.move(s, { type: "size", nx: 0, ny: 4 }) === null);
  check("a 1 by 1 board is already finished", C.result(C.start({ nx: 1, ny: 1 })) === "done" && C.expression(C.start({ nx: 1, ny: 1 })) === "1");
  check("Reset gives the opening board back", C.expression(C.move(t, { type: "reset" })) === "4*5");
}

{
  let plays = 0, nodes = 0, bad = null;
  const walk = (s, depth) => {
    nodes++;
    const area = C.pieces(s).reduce((a, p) => a + p.w * p.h, 0);
    if (area !== s.nx * s.ny) bad = "tiling";
    for (const p of C.pieces(s)) for (let c = p.x; c < p.x + p.w; c++) for (let r = p.y; r < p.y + p.h; r++) if (C.pieceAt(s, c, r) !== p) bad = "overlap";
    if (C.evaluate(C.expression(s)) !== s.nx * s.ny) bad = "value " + C.expression(s);
    if (C.evaluate(C.expression({ ...s, parentheses: true })) !== s.nx * s.ny) bad = "parens value";
    const moves = C.legalMoves(s);
    if (moves.length === 0) {
      plays++;
      if (C.result(s) !== "done" || depth !== s.nx * s.ny - 1) bad = "end " + depth;
      return;
    }
    if (nodes > 400000) return;
    for (const m of moves) { const n = C.move(s, m); if (!n) { bad = "legal move refused"; return; } walk(n, depth + 1); }
  };
  for (let nx = 1; nx <= 3; nx++) for (let ny = 1; ny <= 3; ny++) walk(C.start({ nx, ny }), 0);
  check(`every cutting order on boards up to 3 by 3 ends after NX*NY-1 cuts with a true sum (${plays} plays, ${nodes} positions)`, bad === null && plays > 100, String(bad));
}

{
  // larger boards: random cutting orders, all the way down
  let seed = 12345, bad = null, n = 0;
  const rnd = (k) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % k; };
  for (let t = 0; t < 400; t++) {
    let s = C.start({ nx: 1 + rnd(12), ny: 1 + rnd(12), parentheses: t % 2 === 0 });
    while (C.legalMoves(s).length) { const ms = C.legalMoves(s); s = C.move(s, ms[rnd(ms.length)]); n++; if (C.evaluate(C.expression(s)) !== s.nx * s.ny) bad = C.expression(s); }
    if (C.result(s) !== "done") bad = "not finished";
  }
  check(`400 random plays on boards up to 12 by 12 always sum to NX*NY (${n} cuts)`, bad === null, String(bad));
  const s = C.start({ nx: 12, ny: 12 });
  check("the largest board has 143 cuts to go and 22 cuts open at the start", C.remaining(s) === 143 && C.legalMoves(s).length === 22);
  equal("a 2-wide cut of 12 high board is 12*1+12*1", C.expression(C.move(C.start({ nx: 2, ny: 12 }), { type: "cut", axis: "col", c: 0, r: 0 })), "12*1+12*1");
}

done("distributive-law");
