#!/usr/bin/env node
"use strict";

/*
 * Logic test for btree-testing/btree-testing-core.js.
 *
 *   node porting/check-btree-testing.mjs
 *
 * Checks, exhaustively where the sizes allow:
 *  1. the start and Repeat positions;
 *  2. the applet's own number generation, transcribed a second time straight
 *     from BTree.CompositeNumberString, over every count 2..6 and many seeds,
 *     plus every index pair of the two-factor special case;
 *  3. every rejection message from TextActionListener, exactly;
 *  4. every proper divisor of every generated number is an accepted factor,
 *     and each accepted split preserves the product;
 *  5. full factorization of every generated number, with the exact closing
 *     sentence and the same prime multiset as independent trial division;
 *  6. the page's claims: factorization unique up to order, factor tree not
 *     unique, any factor will do, "prime" is the applet's table, the four
 *     divisibility rules, and the GCD/LCM statement;
 *  7. immutability of positions.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("btree-testing/btree-testing-core.js", "BTreeTestingCore");

const sampleNumbers = [];
for (let count = C.MIN_COUNT; count <= C.MAX_COUNT; count++) {
  for (let seed = 1; seed <= 60; seed++) {
    const r = rng(seed * 1000 + count);
    sampleNumbers.push({ count, n: C.generateValue(count, r) });
  }
}

/* --------------------------------------------------------- 1. the position */

{
  const s = C.start({ count: 4, random: rng(7) });
  equal("start keeps the plain-JSON shape", Object.keys(s).sort(), ["count", "n", "root"]);
  check("start's root is the generated number", s.n === s.root.value);
  check("start stores the chosen count", s.count === 4);
  check("start has two boxes beneath the root", !!s.root.left && !!s.root.right);
  check("both starting boxes are empty", !s.root.left.done && !s.root.right.done);
  check("a new problem is not finished", C.result(s) === null && C.completionMessage(s) === null);
  equal("one empty path per starting box", C.emptyPaths(s.root), ["L", "R"]);

  const r = C.repeat(s);
  check("Repeat keeps the same number", r.n === s.n);
  check("Repeat clears the tree", r.root.value === s.n && !r.root.left.done && !r.root.right.done);
  check("Repeat is not finished", C.isComplete(r.root) === false);
  const touched = C.enterFactor(r, "L", 2);
  check("a move on the repeated tree does not change the original", !touched.ok || s.root.left.value === 0);
}

/* ----------- 2. the number generator, against a second bytecode transcription */

// BTree.CompositeNumberString's factor phase, transcribed literally.
function appletPrimes(count, r) {
  if (count === 2) {
    return [C.PRIMES[Math.floor(r() * 4)], C.EXTRA_PRIMES[Math.floor(r() * C.EXTRA_PRIMES.length)]];
  }
  const v = [];
  for (let i = 0; i < count; i++) {
    let idx;
    if (r() < 0.99) idx = Math.floor(r() * 4);
    else idx = Math.floor(r() * C.PRIMES.length);
    if (count === 3 && idx < C.EXTRA_PRIMES.length && i === 0 && r() < 0.4) {
      v.push(C.EXTRA_PRIMES[idx]);
    } else {
      v.push(C.PRIMES[idx]);
    }
  }
  return v;
}

// ComposeNumberString removes one random element at a time (RandomFactor).
// The multiset it leaves on the leaves is the same one appletPrimes built.
function appletComposeLeaves(primes, r) {
  const v = primes.slice();
  let sb = "";
  const take = () => v.splice(Math.floor(r() * v.length), 1)[0];
  while (v.length > 0) {
    let op = Math.floor(r() * 3);
    if (v.length <= 1) op = r() < 0.5 ? 1 : 2;
    if (sb.length === 0) op = 0;
    if (op === 0) {
      // With an existing tree this is "{old}{" + "{a}" + "{b}" + "}",
      // i.e. the old tree and a fresh pair become the two children.
      const a = take();
      const b = take();
      let out = "";
      if (sb.length > 0) out += "{" + sb + "}" + "{";
      out += "{" + a + "}" + "{" + b + "}";
      if (sb.length > 0) out += "}";
      sb = out;
    } else if (op === 1) {
      const a = take();
      sb = "{" + sb + "}" + "{" + a + "}";
    } else {
      const a = take();
      sb = "{" + a + "}" + "{" + sb + "}";
    }
  }
  return sb;
}

{
  let equalValues = 0;
  let composed = 0;
  for (let count = C.MIN_COUNT; count <= C.MAX_COUNT; count++) {
    for (let seed = 1; seed <= 200; seed++) {
      const r1 = rng(seed * 7919 + count);
      const expected = C.product(appletPrimes(count, r1));
      const r2 = rng(seed * 7919 + count);
      const actual = C.generateValue(count, r2);
      check("generation matches the applet, count " + count + " seed " + seed, actual === expected,
        "expected " + expected + ", got " + actual);
      equalValues++;

      // The throwaway tree's leaves, composed with the applet's own random
      // consumption, multiply back to the same number.
      const r3 = rng(seed * 7919 + count);
      const primes = appletPrimes(count, r3);
      const text = appletComposeLeaves(primes, r3);
      const leaves = text.match(/\d+/g).map(Number);
      check("composed leaves multiply to N, count " + count + " seed " + seed,
        C.product(leaves) === actual);
      composed++;
    }
  }
  check("generation compared over all counts and seeds", equalValues === 1000);
  check("composed trees compared over all counts and seeds", composed === 1000);

  // The two-factor special case, over every pair of table indices.
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < C.EXTRA_PRIMES.length; j++) {
      const seq = [i / 4 + 0.001, j / C.EXTRA_PRIMES.length + 0.001];
      let k = 0;
      const r = () => seq[k++];
      check("two-factor case " + i + "," + j,
        C.generateValue(2, r) === C.PRIMES[i] * C.EXTRA_PRIMES[j]);
    }
  }

  // clamped range, like (int)(random*5)+2 can only give 2..6.
  check("count below range clamps to 2", C.clampCount(1) === 2);
  check("count above range clamps to 6", C.clampCount(99) === 6);
  check("fractional count truncates", C.clampCount(4.9) === 4);
}

/* ------------------------------------------------- 3. every rejection case */

{
  const s = C.start({ count: 3, random: rng(11) });
  const cases = [
    ["abc", "abc is not an integer"],
    ["1.5", "1.5 is not an integer"],
    ["-4", "Please enter a positive factor of " + s.n],
    ["0", "0 can't be a factor of any number"],
    ["1", "1 does not count as a factor"],
    [String(s.n), "Look for a factor less than " + s.n],
    [String(s.n + 1), (s.n + 1) + " is not a factor of " + s.n],
  ];
  for (const [input, message] of cases) {
    const out = C.enterFactor(s, "L", input);
    check("reject " + JSON.stringify(input), !out.ok && out.message === message,
      "got " + JSON.stringify(out.message) + ", expected " + JSON.stringify(message));
    check("rejection leaves the tree alone " + JSON.stringify(input),
      JSON.stringify(out.position || s.root) === JSON.stringify(s.root));
  }
  const badBox = C.enterFactor(s, "LL", 2);
  check("a box that is not empty is refused", !badBox.ok);
}

/* ----------------------- 4. every divisor, in every generated problem */

{
  let accepted = 0;
  let preserved = 0;
  for (const { n } of sampleNumbers) {
    const s = { n, count: 0, root: C.makeRoot(n) };
    for (let d = 2; d < n; d++) {
      if (n % d !== 0) continue;
      const out = C.enterFactor(s, "L", d);
      check("the divisor " + d + " of " + n + " is accepted", out.ok && out.factor === d);
      accepted++;
      const other = out.position ? out.position.root.right.value : -1;
      check("the cofactor of " + d + " in " + n + " is " + n / d, other === n / d,
        "got " + other);
      const leaves = out.position ? C.collectPrimeFactors(out.position.root) : [];
      // An unfinished branch also contributes an empty box (value 0), so
      // compare the split itself rather than the full factorization here.
      const split = out.position
        ? out.position.root.left.value * out.position.root.right.value
        : -1;
      check("splitting " + n + " into " + d + " preserves the product", split === n);
      preserved++;
      void leaves;
    }
  }
  check("all proper divisors were tried", accepted > 200 && preserved === accepted);
}

/* ------------------- 5. full factorization of every generated problem */

function smallestPrimeFactorOf(n) {
  const f = C.factorize(n);
  return f.length ? Math.min.apply(null, f) : n;
}

{
  let finished = 0;
  for (const { count, n } of sampleNumbers) {
    let pos = { n, count, root: C.makeRoot(n) };
    let guard = 0;
    while (!C.isComplete(pos.root)) {
      const paths = C.emptyPaths(pos.root);
      const path = paths[0];
      const parent = C.nodeAt(pos.root, path.slice(0, -1));
      const d = smallestPrimeFactorOf(parent.value);
      const out = C.enterFactor(pos, path, d);
      check("smallest prime factor " + d + " accepted in " + parent.value, out.ok);
      pos = out.position;
      if (++guard > 100) throw new Error("factorization did not finish for " + n);
    }
    const primes = C.factorize(n);
    equal("prime multiset of " + n + " matches trial division",
      C.collectPrimeFactors(pos.root).slice().sort((a, b) => a - b), primes.slice().sort((a, b) => a - b));
    check("leaf count of " + n + " is the number of generated factors",
      C.collectPrimeFactors(pos.root).length === count);
    check("the product of the leaves of " + n + " is " + n,
      C.product(C.collectPrimeFactors(pos.root)) === n);
    const expected = C.GOOD + C.arrangeIntegerVector(primes) + " = " + n + "!";
    check("closing sentence of " + n + " is exact", C.completionMessage(pos) === expected,
      "got " + JSON.stringify(C.completionMessage(pos)) + ", expected " + JSON.stringify(expected));
    check("result is done for " + n, C.result(pos) === "done");
    finished++;
  }
  check("every generated problem was finished", finished === sampleNumbers.length);
}

/* ----- 6. the page's claims: unique factorization, non-unique tree, any factor */

function allCompletedTrees(n) {
  // Exhaustive search over every sequence of valid factor entries.
  const results = [];
  const seenMessages = new Set();
  (function walk(pos) {
    if (C.isComplete(pos.root)) {
      const msg = C.completionMessage(pos);
      seenMessages.add(msg);
      results.push(JSON.stringify(pos.root));
      return;
    }
    for (const path of C.emptyPaths(pos.root)) {
      const parent = C.nodeAt(pos.root, path.slice(0, -1));
      for (let d = 2; d < parent.value; d++) {
        if (parent.value % d !== 0) continue;
        const out = C.enterFactor(pos, path, d);
        if (out.ok) walk(out.position);
      }
    }
  })({ n, count: 0, root: C.makeRoot(n) });
  return { results, messages: Array.from(seenMessages) };
}

{
  // Small numbers only: the whole game tree is finite and tiny here.
  // 108 is the number whose three trees the page shows.
  for (const n of [12, 18, 24, 30, 36, 60, 108]) {
    const { results, messages } = allCompletedTrees(n);
    check("every completed tree of " + n + " prints the same factorization", messages.length === 1,
      JSON.stringify(messages));
    check("at least one complete tree exists for " + n, results.length >= 1);
    const uniqueTrees = new Set(results);
    check("the factor tree of " + n + " is not unique", uniqueTrees.size >= 2,
      "only " + uniqueTrees.size + " tree(s)");
    check("the printed factorization of " + n + " is sorted",
      messages[0] === C.GOOD + C.arrangeIntegerVector(C.factorize(n)) + " = " + n + "!");
  }

  // "Any factor will do": every divisor is accepted, prime or composite.
  for (const { n } of sampleNumbers.slice(0, 40)) {
    for (let d = 2; d < n; d++) {
      if (n % d !== 0) continue;
      check("any factor works: " + d + " of " + n,
        C.enterFactor({ n, count: 0, root: C.makeRoot(n) }, "L", d).ok);
    }
  }
}

/* -------------------------- 7. the divisibility rules on the page */

{
  let ruleChecks = 0;
  for (let n = 1; n <= 300; n++) {
    check("even rule at " + n, C.divisibleBy2(n) === (n % 2 === 0));
    check("threes rule at " + n, C.divisibleBy3(n) === (n % 3 === 0));
    check("fives rule at " + n, C.divisibleBy5(n) === (n % 5 === 0));
    check("tens rule at " + n, C.divisibleBy10(n) === (n % 10 === 0));
    ruleChecks += 4;
  }
  check("all divisibility rules checked", ruleChecks === 1200);
  check("the digit-sum rule really is the rule", C.digitSum(108) === 9);
}

/* ------------------- 8. the GCD / LCM claim, stated precisely */

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

{
  for (let i = 0; i < sampleNumbers.length; i += 5) {
    for (let j = i + 1; j < sampleNumbers.length; j += 37) {
      const a = sampleNumbers[i].n;
      const b = sampleNumbers[j].n;
      const fa = C.factorize(a);
      const fb = C.factorize(b);
      // min exponents -> GCD, max exponents -> LCM (the page's "common
      // factors / remaining ones" with multiplicity).
      const counts = (xs) => {
        const m = new Map();
        for (const x of xs) m.set(x, (m.get(x) || 0) + 1);
        return m;
      };
      const ma = counts(fa);
      const mb = counts(fb);
      let g = 1;
      let l = 1;
      for (const p of new Set([...ma.keys(), ...mb.keys()])) {
        const x = ma.get(p) || 0;
        const y = mb.get(p) || 0;
        for (let k = 0; k < Math.min(x, y); k++) g *= p;
        for (let k = 0; k < Math.max(x, y); k++) l *= p;
      }
      check("min-exponent product is the GCD of " + a + "," + b, g === gcd(a, b));
      check("max-exponent product is the LCM of " + a + "," + b, l === (a * b) / gcd(a, b));
    }
  }
}

/* --------------------------- 9. the prime table and immutability */

{
  equal("the applet's ordinary primes", C.PRIMES, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]);
  equal("the applet's extra primes", C.EXTRA_PRIMES, [37, 41, 43, 47, 53, 59]);
  for (const p of C.PRIMES.concat(C.EXTRA_PRIMES)) {
    check(p + " is prime to the applet", C.isPrime(p));
    check("SetValue makes " + p + " a leaf", C.setValue(p).left === null && C.setValue(p).right === null);
  }
  for (const c of [4, 6, 9, 25, 49, 61, 77, 121]) {
    check(c + " is not an applet prime", !C.isPrime(c));
    check("SetValue grows two boxes for " + c,
      !!C.setValue(c).left && !!C.setValue(c).right &&
      !C.setValue(c).left.done && !C.setValue(c).right.done);
  }
  const s = C.start({ count: 5, random: rng(3) });
  const before = JSON.stringify(s);
  C.enterFactor(s, "L", 2);
  C.repeat(s);
  C.collectPrimeFactors(s.root);
  C.emptyPaths(s.root);
  check("core functions never mutate the position", JSON.stringify(s) === before);
}

done("btree-testing");
