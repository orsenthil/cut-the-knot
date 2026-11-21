#!/usr/bin/env node
"use strict";

/*
 * Logic test for gcd-by-factor-tree/gcd-by-factor-tree-core.js.
 *
 *   1. Factorisation, multiplicities, multiset intersection/union and trees.
 *   2. The page's claim N*M = gcd*lcm and the min/max exponent identity on every
 *      pair 2..60, plus the multiset example from the page (20 and 350).
 *   3. A second transcription of Euclid's algorithm for the gcd, and the
 *      factor-tree shape for small numbers.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("gcd-by-factor-tree/gcd-by-factor-tree-core.js", "GcdByFactorTreeCore");

/* ------------------------------------------------------------ 1. the pieces */

{
  equal("factors of 20", C.factors(20).join(","), "2,2,5");
  equal("factors of 350", C.factors(350).join(","), "2,5,5,7");
  equal("factors of a prime", C.factors(13).join(","), "13");
  equal("factors of 1", C.factors(1).join(","), "");
  equal("multiplicity of 2 in 12", C.multiplicities(C.factors(12)).get(2), 2);
  equal("product of a multiset", C.product([2, 2, 5]), 20);
  equal("intersection of {2,2,5} and {2,5,5,7}", C.intersection([2, 2, 5], [2, 5, 5, 7]).join(","), "2,5");
  equal("union of {2,2,5} and {2,5,5,7}", C.union([2, 2, 5], [2, 5, 5, 7]).join(","), "2,2,5,5,7");

  const tree = C.factorTree(12);
  equal("root of the tree", tree.value, 12);
  equal("12 splits into 2 and 6", tree.children.map((c) => c.value).join(","), "2,6");
  equal("the 6 node splits again", tree.children[1].children.map((c) => c.value).join(","), "2,3");
  equal("prime leaves have no children", tree.children[1].children[1].children.length, 0);
}

/* ------------------------------------- 2. the page's claims, exhaustively */

{
  const ex = C.analyze(20, 350);
  equal("page example gcd factors", ex.gcdFactors.join(","), "2,5");
  equal("page example gcd", ex.gcd, 10);
  equal("page example lcm", ex.lcm, 700);
  equal("page example identity", ex.productNM, ex.productGcdLcm);

  let identities = 0;
  let multiset = 0;
  let pairs = 0;
  for (let n = 2; n <= 60; n++) {
    for (let m = 2; m <= 60; m++) {
      const r = C.analyze(n, m);
      pairs++;
      if (r.productNM === r.productGcdLcm) identities++;
      const fn = C.multiplicities(r.factorsN);
      const fm = C.multiplicities(r.factorsM);
      const ok = [...new Set([...fn.keys(), ...fm.keys()])].every((p) => {
        const a = fn.get(p) || 0;
        const b = fm.get(p) || 0;
        return (C.multiplicities(r.gcdFactors).get(p) || 0) === Math.min(a, b) &&
          (C.multiplicities(r.lcmFactors).get(p) || 0) === Math.max(a, b);
      });
      if (ok) multiset++;
    }
  }
  equal("every pair was checked", pairs, 59 * 59);
  equal("N*M = gcd*lcm for every pair", identities, pairs);
  equal("gcd uses minima and lcm uses maxima", multiset, pairs);
}

/* --------------------------- 3. Euclid's algorithm, transcribed again */

function euclid(a, b) {
  while (b !== 0) { const t = a % b; a = b; b = t; }
  return Math.abs(a);
}

{
  let agreements = 0;
  for (let n = 1; n <= 200; n++) {
    for (let m = 1; m <= 200; m++) {
      if (C.product(C.intersection(C.factors(n), C.factors(m))) === euclid(n, m)) agreements++;
    }
  }
  equal("gcd by factor tree agrees with Euclid", agreements, 200 * 200);
}

done("gcd-by-factor-tree");
