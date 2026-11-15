#!/usr/bin/env node
"use strict";

/*
 * Logic test for {{SLUG}}/{{SLUG}}-core.js.
 *
 *   node porting/check-{{SLUG}}.mjs
 *
 * TODO(port): say what is checked and how far: exhaustively wherever the
 * sizes allow, never a handful of samples where every case can be tried.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("{{SLUG}}/{{SLUG}}-core.js", "{{CORE_GLOBAL}}");

/* ------------------------------------------------------------ 1. the rules */

{
  // TODO(port): the start position, each kind of move, the moves that must be
  // refused, and every way the game ends.
  const s = C.start({});
  check("a new game is not over", C.result(s) === null);
}

/* ------------------------------------------- 2. every case, where it is small */

{
  // TODO(port): walk the whole game: every position reachable from every
  // start, every reply to the computer. Check the page's claims here (a
  // minimum number of moves, "the first player always wins", a formula).
}

/* ----------------------------- 3. the same answers as the applet's own method */

{
  // TODO(port): write the applet's method a second time, straight from the
  // bytecode and as literally as possible, and compare it with the core over
  // the whole range of options.
}

done("{{SLUG}}");
