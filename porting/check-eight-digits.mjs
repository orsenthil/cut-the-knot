#!/usr/bin/env node
"use strict";

/*
 * Logic test for eight-digits/eight-digits-core.js.
 *
 * The puzzle: eight circles, some touching, and the digits 1 to 8 to be placed
 * so that no two consecutive digits sit in touching circles.
 *
 * Two things are checked here that the port cannot be trusted on:
 *
 *   1. the graph. The 17 edges are copied from the applet's Edges table, so
 *      they are re-derived independently from the circles' coordinates - two
 *      circles touch exactly when a chess king could step between them - and
 *      the two numbers the page's argument rests on are confirmed: the middle
 *      circles touch six others, and in the complementary graph they have
 *      exactly one neighbour each.
 *
 *   2. the solutions. The core's search is checked against a brute force over
 *      all 8! = 40320 assignments, and the four it finds are shown to be one
 *      solution seen four ways (mirrored and turned over).
 *
 * The game's own rules - placing in order, flagging a clash, stepping back -
 * are then exercised move by move, including the case the applet got wrong.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const E = loadCore("eight-digits/eight-digits-core.js", "EightDigitsCore");
const key = (p) => p.join("");

/* ------------------------------------------------- 1. the figure's graph */

{
  equal("eight circles", E.N, 8);
  equal("17 edges", E.EDGES.length, 17);

  // Independent adjacency: two circles touch when they are a king's move apart.
  const king = [];
  for (let a = 0; a < E.N; a++) {
    for (let b = a + 1; b < E.N; b++) {
      const p = E.CELLS[a];
      const q = E.CELLS[b];
      if (Math.max(Math.abs(p.col - q.col), Math.abs(p.row - q.row)) === 1) king.push(`${a}-${b}`);
    }
  }
  const listed = E.EDGES.map(([a, b]) => `${a}-${b}`);
  equal("the applet's edges are exactly the king moves of the figure",
    listed.slice().sort(), king.slice().sort());

  equal("every circle's neighbour count", E.NEIGHBOURS.map((n) => n.length), [3, 4, 6, 4, 4, 6, 4, 3]);
  check("the middle circles are 2 and 5", E.NEIGHBOURS[2].length === 6 && E.NEIGHBOURS[5].length === 6);
  check("neighbourhood is symmetric",
    E.NEIGHBOURS.every((list, a) => list.every((b) => E.isNeighbour(b, a))));
  check("no circle is its own neighbour", E.NEIGHBOURS.every((list, a) => !list.includes(a)));

  equal("11 pairs are not neighbours", E.COMPLEMENT.length, 28 - 17);
  equal("in the complementary graph the middle circles have one neighbour each",
    [E.COMPLEMENT_NEIGHBOURS[2].length, E.COMPLEMENT_NEIGHBOURS[5].length], [1, 1]);
  equal("circle 2's only non-neighbour is circle 7", E.COMPLEMENT_NEIGHBOURS[2], [7]);
  equal("circle 5's only non-neighbour is circle 0", E.COMPLEMENT_NEIGHBOURS[5], [0]);
  check("no other circle has so few non-neighbours",
    E.COMPLEMENT_NEIGHBOURS.every((list, i) => i === 2 || i === 5 || list.length >= 3));
}

/* ---------------------------------------------------- 2. the four answers */

const sols = E.solutions();

{
  // Brute force over every permutation of 1..8, with no cleverness at all.
  const all = [];
  const digits = [1, 2, 3, 4, 5, 6, 7, 8];
  const walk = (left, acc) => {
    if (!left.length) {
      if (E.conflicts(acc).length === 0) all.push(acc.slice());
      return;
    }
    for (let i = 0; i < left.length; i++) {
      acc.push(left[i]);
      walk(left.slice(0, i).concat(left.slice(i + 1)), acc);
      acc.pop();
    }
  };
  walk(digits, []);

  equal("the search finds what brute force finds",
    sols.map(key).sort(), all.map(key).sort());
  equal("there are four placements", sols.length, 4);
  check("each one really is a solution", sols.every((s) => E.isSolution(s)));

  // The page: 1 and 8 split the two middle circles.
  check("every solution puts 1 and 8 in the middle circles",
    sols.every((s) => new Set([s[2], s[5]]).size === 2 && [s[2], s[5]].every((d) => d === 1 || d === 8)));
  // And then 7 (or 2) is forced into the one circle 8 (or 1) does not touch.
  check("the digit next to 8 goes in the only circle 8 does not touch",
    sols.every((s) => {
      const eight = s.indexOf(8);
      const away = E.COMPLEMENT_NEIGHBOURS[eight][0];
      return s[away] === 7;
    }));

  // One solution, seen four ways.
  const a = sols.find((s) => key(s) === "25863147");
  check("25863147 is one of them", Boolean(a));
  const orbit = new Set([
    key(a),
    key(E.applySymmetry(a, E.SYMMETRIES.mirrorLeftRight)),
    key(E.applySymmetry(a, E.SYMMETRIES.mirrorTopBottom)),
    key(E.applySymmetry(a, E.SYMMETRIES.halfTurn)),
  ]);
  equal("the four solutions are one solution mirrored and turned over",
    [...orbit].sort(), sols.map(key).sort());
  check("swapping d for 9-d also gives a solution",
    sols.every((s) => E.isSolution(E.reverseDigits(s))));
  check("every symmetry maps solutions to solutions",
    Object.values(E.SYMMETRIES).every((m) => sols.every((s) => E.isSolution(E.applySymmetry(s, m)))));

  // The Hamilton path view from the page: consecutive digits are non-neighbours.
  check("1, 2, ..., 8 walk a path through the complementary graph",
    sols.every((s) => {
      const cellOf = [];
      s.forEach((d, cell) => { cellOf[d] = cell; });
      for (let d = 1; d < 8; d++) {
        if (!E.COMPLEMENT_NEIGHBOURS[cellOf[d]].includes(cellOf[d + 1])) return false;
      }
      return true;
    }));
  check("and that path starts and ends at the middle circles",
    sols.every((s) => [s.indexOf(1), s.indexOf(8)].sort().join() === "2,5"));
}

/* ------------------------------------------------------- 3. playing a game */

{
  const g = new E.Game();
  equal("the first digit to place is 1", g.nextDigit, 1);
  check("an empty board has no clash", g.conflicts.length === 0);
  check("an empty board is not finished", !g.finished);

  const r1 = g.click(2);
  equal("clicking circle 2 places a 1 there", [r1.action, r1.digit], ["place", 1]);
  check("no clash yet", r1.clash === null);

  const r2 = g.click(0); // circle 0 touches circle 2
  equal("putting 2 next to 1 is allowed but flagged", r2.action, "place");
  equal("and the clashing pair is reported", r2.clash, [2, 0]);
  equal("the board knows about the clash", g.conflicts.length, 1);

  equal("clicking a filled circle that is not the last does nothing", g.click(2).action, "none");
  const u = g.click(0);
  equal("clicking the last-placed circle takes it back", [u.action, u.digit], ["undo", 2]);
  equal("the clash is gone", g.conflicts.length, 0);
  equal("and 2 is up again", g.nextDigit, 2);

  // The applet's bug: a clash made earlier was forgotten by the next clean move.
  g.reset();
  g.click(2);          // 1
  g.click(0);          // 2, touching the 1
  const clean = g.click(7);  // 3, far away - the applet cleared its warning here
  check("a clean move reports no clash of its own", clean.clash === null);
  equal("but the earlier clash is still on the board", g.conflicts.length, 1);
  check("so the board is not finishable while it stands", !g.finished);

  // Play a real solution through, in digit order.
  g.reset();
  const sol = sols[0];
  const cellOf = [];
  sol.forEach((d, cell) => { cellOf[d] = cell; });
  let clashes = 0;
  for (let d = 1; d <= 8; d++) {
    const res = g.click(cellOf[d]);
    if (res.action !== "place" || res.digit !== d) clashes += 100;
    if (res.clash) clashes++;
  }
  equal("a solution can be played in digit order with no clash", clashes, 0);
  check("and the board is then finished", g.finished);
  equal("the board holds the solution", g.placement, sol);
  equal("there is no ninth digit", g.nextDigit, null);
  equal("a click on an empty circle does nothing now", g.click(0).action, "none");

  const back = g.click(cellOf[8]);
  equal("but the last digit can still be taken back", [back.action, back.digit], ["undo", 8]);
  check("which unfinishes the board", !g.finished);

  g.reset();
  equal("reset empties the board", g.placement, new Array(8).fill(null));
  equal("and starts again at 1", g.nextDigit, 1);
}

done("eight-digits");
