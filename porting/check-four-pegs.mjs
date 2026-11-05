#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-pegs/pegs-core.js.
 *
 * The puzzle: four pegs at the corners of a square on a grid. A peg may hop
 * over another peg and land the same distance beyond it. Can the four ever
 * form a bigger square? The cut-the-knot page says no, by a lattice argument.
 *
 * Nothing here takes the page's word for it. `reachable` walks every position
 * the pegs can get to inside a bounded patch of grid, using the core's own
 * `legalMoves` and `move`, and then every one of those positions is examined:
 *
 *   - any four pegs that form a square must form the one they started in,
 *     same size and same orientation;
 *   - the lattice the pegs generate never changes, which is the invariant the
 *     proof rests on;
 *   - every hop can be undone by hopping back over the same peg.
 *
 * The patch is bounded, so this is a search, not a proof -- but every position
 * it finds is genuinely reachable, so a counterexample would be real.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("four-pegs/pegs-core.js", "PegsCore");

/* ----------------------------------------------- 1. the opening, from Reset() */

{
  equal("the grid and the side range", [C.GRID, C.SIDE_MIN, C.SIDE_MAX, C.SIDE_DEFAULT], [12, 1, 4, 1]);
  for (let side = C.SIDE_MIN; side <= C.SIDE_MAX; side++) {
    const s = C.start(side);
    equal(`start(${side}) has four pegs`, s.length, 4);
    check(`start(${side}) stays on the grid`, s.every(C.onGrid));
    const sq = C.squareOf(s);
    check(`start(${side}) is a square`, !!sq);
    equal(`start(${side}) has side ${side}`, sq.side2, side * side);
    check(`start(${side}) is upright`, sq.axisAligned);
    equal(`start(${side}) generates a grid of step ${side}`, C.latticeBasis(s), { a: side, c: 0, b: side });
  }
}

/* ------------------------------------------- 2. the hop rule, from VerifyDrop() */

{
  const sq = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }];
  check("a peg may hop over a neighbour", C.canMove(sq, 0, { x: 4, y: 2 }));
  check("and over the diagonal one", C.canMove(sq, 0, { x: 4, y: 4 }));
  check("a peg may not land where nothing was hopped over", !C.canMove(sq, 0, { x: 2, y: 0 }));
  check("a peg may not stay put", !C.canMove(sq, 0, { x: 2, y: 2 }));
  check("a peg may not land on another peg", !C.canMove(sq, 0, { x: 3, y: 2 }));
  check("a peg may not land off the grid", !C.canMove([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], 1, { x: -1, y: 0 }));

  equal("legalMoves finds one landing per other peg", C.legalMoves(sq, 0).length, 3);
  const moved = C.move(sq, 0, { x: 4, y: 2 });
  equal("the hop lands the same distance beyond", moved[0], { x: 4, y: 2 });
  equal("the peg hopped over does not move", moved[1], { x: 3, y: 2 });
  equal("move does not mutate its argument", sq[0], { x: 2, y: 2 });
  equal("an illegal hop returns null", C.move(sq, 0, { x: 2, y: 0 }), null);
}

/* --------------------------------------------------- 3. the shape detector */

{
  equal("an upright square", C.squareOf([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]), {
    side2: 4, side: 2, axisAligned: true,
  });
  const tilted = C.squareOf([{ x: 1, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 1 }]);
  equal("a tilted square is still a square", tilted.side2, 2);
  check("and it knows it is tilted", !tilted.axisAligned);
  equal("a rectangle is not a square", C.squareOf([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 0, y: 1 }]), null);
  equal("a rhombus is not a square", C.squareOf([{ x: 0, y: 0 }, { x: 3, y: 1 }, { x: 6, y: 0 }, { x: 3, y: -1 }]), null);
  equal("the area of the opening square", C.area(C.start(3)), 9);
}

/* ------------------------------------------------- 4. the lattice in Hermite form */

{
  equal("the whole-number grid", C.latticeBasis([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]), { a: 1, c: 0, b: 1 });
  equal("a grid of step 2", C.latticeBasis([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }]), { a: 2, c: 0, b: 2 });
  equal("one point generates nothing", C.latticeBasis([{ x: 5, y: 5 }]), { a: 0, c: 0, b: 0 });
  // A sheared basis is the same lattice as an upright one of the same index.
  equal("a sheared pair, reduced", C.latticeBasis([{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 2 }]), { a: 2, c: 1, b: 2 });
  equal("the order of the points does not matter",
    C.latticeBasis([{ x: 0, y: 2 }, { x: 2, y: 1 }, { x: 0, y: 0 }]),
    C.latticeBasis([{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 2 }]));
  // One peg hopping adds 2q - p, which the lattice already contains.
  const before = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }];
  equal("a hop leaves the lattice alone", C.latticeBasis(C.move(before, 0, { x: 6, y: 0 })), C.latticeBasis(before));
}

/* ------------------------------------- the bounded search over every position */

const keyOf = (pegs) => pegs.map((p) => `${p.x},${p.y}`).sort().join(" ");

/**
 * Every position reachable from `startPegs` while all pegs stay inside the
 * square patch `0..span`. Pegs are interchangeable, so a position is the set
 * of points; the walk uses the core's own legalMoves and move.
 */
function reachable(startPegs, span, cap = 400000) {
  const inside = (p) => p.x >= 0 && p.x <= span && p.y >= 0 && p.y <= span;
  const seen = new Map([[keyOf(startPegs), startPegs]]);
  const queue = [startPegs];
  let head = 0;
  while (head < queue.length && seen.size < cap) {
    const pegs = queue[head++];
    for (let i = 0; i < pegs.length; i++) {
      for (const t of C.legalMoves(pegs, i)) {
        if (!inside(t)) continue;
        const next = C.move(pegs, i, t);
        const k = keyOf(next);
        if (seen.has(k)) continue;
        seen.set(k, next);
        queue.push(next);
      }
    }
  }
  return [...seen.values()];
}

/** Move the opening square into the corner of a patch of the given span. */
function openingIn(span, side) {
  const lo = Math.round((span - side) / 2);
  return [
    { x: lo, y: lo }, { x: lo + side, y: lo },
    { x: lo + side, y: lo + side }, { x: lo, y: lo + side },
  ];
}

/* ---------------------- 5. no square but the one you started with */

for (const [span, side] of [[6, 1], [8, 2], [9, 3]]) {
  const open = openingIn(span, side);
  const states = reachable(open, span);
  const want = C.latticeBasis(open);
  let squares = 0;
  for (const pegs of states) {
    equal(`the lattice never changes (side ${side}, ${keyOf(pegs)})`, C.latticeBasis(pegs), want);
    const sq = C.squareOf(pegs);
    if (!sq) continue;
    squares++;
    equal(`every square reachable has side ${side} (${keyOf(pegs)})`, sq.side2, side * side);
    check(`and is upright (${keyOf(pegs)})`, sq.axisAligned);
  }
  check(
    `side ${side} on a ${span} by ${span} patch: searched ${states.length} positions, ${squares} of them squares`,
    states.length > 50 && squares > 1,
    `${states.length} positions, ${squares} squares`
  );
}

/* ------------------------------------------ 6. every hop can be undone */

{
  const states = reachable(openingIn(6, 1), 6);
  let hops = 0;
  for (const pegs of states.slice(0, 400)) {
    for (let i = 0; i < pegs.length; i++) {
      for (const t of C.legalMoves(pegs, i)) {
        const next = C.move(pegs, i, t);
        if (!next) continue;
        hops++;
        // The peg hopped over is the midpoint; hopping back over it returns.
        const back = C.move(next, i, pegs[i]);
        check(`a hop undoes itself (${keyOf(pegs)} peg ${i})`, back !== null && keyOf(back) === keyOf(pegs));
      }
    }
  }
  check(`reversibility checked on ${hops} hops`, hops > 1000, `only ${hops}`);
}

/* ------------------- 7. the fifth peg makes the grid finer, and that matters */

{
  // Side 2, with a helper peg one step off a corner -- a point the other four
  // can never reach. The lattice drops from step 2 to step 1 by 2, and with it
  // the argument that kept the square the same size: the four original pegs
  // can then be worked onto a bigger square. The witness is found by searching
  // and then replayed hop by hop through the core's own move().
  const span = 8;
  const side = 2;
  const four = openingIn(span, side);
  const five = [...four, { x: four[0].x + 1, y: four[0].y }];
  equal("four pegs at side 2 reach a grid of step 2", C.latticeBasis(four), { a: 2, c: 0, b: 2 });
  equal("the helper makes it step 1 by 2", C.latticeBasis(five), { a: 1, c: 0, b: 2 });

  // The first four pegs keep their identity here, so the key names the helper
  // separately; the original four are still interchangeable among themselves.
  const inside = (p) => p.x >= 0 && p.x <= span && p.y >= 0 && p.y <= span;
  const label = (pegs) =>
    `${pegs.slice(0, 4).map((p) => `${p.x},${p.y}`).sort().join(" ")}|${pegs[4].x},${pegs[4].y}`;
  const prev = new Map();
  const seen = new Set([label(five)]);
  const queue = [five];
  let head = 0;
  let witness = null;
  let upright = null;
  while (head < queue.length) {
    const pegs = queue[head++];
    const sq = C.squareOf(pegs.slice(0, 4));
    if (sq && sq.side2 > side * side) {
      if (!witness) witness = pegs;
      if (sq.axisAligned && !upright) upright = pegs;
    }
    for (let i = 0; i < pegs.length; i++) {
      for (const t of C.legalMoves(pegs, i)) {
        if (!inside(t)) continue;
        const next = C.move(pegs, i, t);
        const k = label(next);
        if (seen.has(k)) continue;
        seen.add(k);
        prev.set(k, [label(pegs), i, t]);
        queue.push(next);
      }
    }
  }
  check(`five pegs: searched ${seen.size} positions`, seen.size > 1000, `${seen.size}`);
  check("a bigger square is reachable once there is a helper peg", witness !== null);

  // Replay it: every hop has to be legal at the time it is played.
  const hops = [];
  for (let k = label(witness); prev.has(k); ) {
    const [back, i, t] = prev.get(k);
    hops.push([i, t]);
    k = back;
  }
  hops.reverse();
  let pegs = five;
  for (const [i, t] of hops) {
    const next = C.move(pegs, i, t);
    check(`hop ${i} to ${t.x},${t.y} is legal when played`, next !== null);
    if (!next) break;
    pegs = next;
  }
  const end = C.squareOf(pegs.slice(0, 4));
  check("the replay really ends on a square", !!end);
  check(`and it is bigger than the opening one (side^2 ${end && end.side2} against ${side * side})`,
    !!end && end.side2 > side * side);
  check(`the shortest such line is short enough to find by hand (${hops.length} hops)`, hops.length <= 6);
  equal("the lattice is still what the five pegs started with", C.latticeBasis(pegs), { a: 1, c: 0, b: 2 });

  // Every bigger square the search found was tilted; the page's own argument
  // covers this case, and nothing here claims more than the search shows.
  equal("no bigger square square to the grid turned up", upright, null);
}

done("four-pegs");
