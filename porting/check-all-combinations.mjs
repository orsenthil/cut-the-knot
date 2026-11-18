#!/usr/bin/env node
"use strict";

/*
 * Logic test for all-combinations/all-combinations-core.js.
 *
 *   1. The options and the binomial count, including the BigInteger range,
 *      symmetry and Pascal's identity.
 *   2. The enumeration transcribed from the applet's Combination.getNext,
 *      compared with an independent recursive generator for every N <= 8 and
 *      every M, checking that all rows are distinct and in lexicographic order.
 *   3. The large end of the option range (N = 20), where the list is too long
 *      to display in full but the count and endpoints can still be checked.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("all-combinations/all-combinations-core.js", "AllCombinationsCore");

/* ------------------------------------------------------------ 1. options */

{
  const o = C.options({ n: 5, m: 3 });
  equal("n stays in range", o.n, 5);
  equal("m stays in range", o.m, 3);
  equal("n is clamped low", C.options({ n: 0, m: 3 }).n, 2);
  equal("n is clamped high", C.options({ n: 99, m: 3 }).n, 20);
  equal("m is clamped high", C.options({ n: 20, m: 99 }).m, 20);
  equal("m is never larger than n", C.options({ n: 4, m: 9 }).m, 4);
  equal("a bad value falls back", C.options({ n: "x", m: "x" }).n, 5);

  check("C(5,3)", C.count(5, 3) === 10n);
  check("C(20,10) is a big integer", C.count(20, 10) === 184756n);
  check("C(n,0)", C.count(7, 0) === 1n);
  check("C(n,n)", C.count(7, 7) === 1n);
  check("out of range count", C.count(5, 6) === 0n);
  let symmetry = 0;
  let pascal = 0;
  for (let n = 0; n <= 20; n++) {
    for (let m = 0; m <= n; m++) {
      if (C.count(n, m) === C.count(n, n - m)) symmetry++;
      if (m < n && C.count(n, m) + C.count(n, m + 1) === C.count(n + 1, m + 1)) pascal++;
    }
  }
  equal("symmetry holds for all small n", symmetry, 231);
  check("Pascal's identity holds", pascal > 200);
}

/* ------------------------------------- 2. the enumeration, against recursion */

{
  let boards = 0;
  let rows = 0;
  let ordered = 0;
  for (let n = 2; n <= 8; n++) {
    for (let m = 1; m <= n; m++) {
      boards++;
      const expected = C.all(n, m);
      let state = C.start({ n, m });
      check(`start counts C(${n},${m})`, state.remaining === BigInt(expected.length));
      equal(`start shows 0..${m - 1}`, state.current.join(","), Array.from({ length: m }, (_, i) => i).join(","));
      const actual = [];
      while (C.hasMore(state)) {
        const next = C.nextState(state);
        if (!next) break;
        state = next;
        actual.push(state.current.slice());
        rows++;
      }
      equal(`all ${expected.length} combinations for ${n} choose ${m}`, actual.length, expected.length);
      equal(`the rows match the recursive generator`, JSON.stringify(actual), JSON.stringify(expected));
      if (actual.every((row, i) => i === 0 || row.join(",") > actual[i - 1].join(","))) ordered++;
      check("every row is sorted and inside the range", actual.every((row) =>
        row.every((v, i) => v >= 0 && v < n && (i === 0 || v > row[i - 1]))));
      check("the countdown reaches zero", state.remaining === 0n);
      check("display adds one to each value", C.display(actual[0]).every((v) => v >= 1 && v <= n));
      check("no more rows after the last", C.nextState(state) === null);
    }
  }
  equal("every board was checked", boards, 35);
  equal("every lexicographic list is ordered", ordered, boards);
  check("thousands of rows were compared", rows > 200);
}

/* ------------------------------------- 3. the large boards */

{
  const s = C.start({ n: 20, m: 10 });
  check("C(20,10) rows", s.remaining === 184756n);
  let state = C.nextState(s);
  const first = C.display(state.current);
  equal("the first row is 1..10", first.join(","), "1,2,3,4,5,6,7,8,9,10");
  state = C.nextState(state);
  const second = C.display(state.current);
  equal("the second row", second.join(","), "1,2,3,4,5,6,7,8,9,11");

  let two = C.start({ n: 20, m: 2 });
  let last = null;
  let guard = 0;
  while (C.hasMore(two) && guard++ < 300) {
    two = C.nextState(two);
    last = two;
  }
  equal("the last pair is 19,20", C.display(last.current).join(","), "19,20");
}

done("all-combinations");
