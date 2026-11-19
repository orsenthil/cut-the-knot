"use strict";

/*
 * BTreeTesting — "Factoring with the Factor Tree" — from Alexander Bogomolny's
 * applet BTreeTesting (porting/brief.mjs). "BTree" here means a *binary* tree,
 * not a database B-tree: this is a tool for factoring a number one step at a
 * time, not a game with a win or loss.
 *
 * The idea the code relies on: every box holds a number and is either still
 * empty, a finished prime, or a composite that has grown two child boxes. When
 * the player supplies one factor of a box, the applet places it in that box
 * and puts the matching cofactor in the sibling box (SetValueToOther). A prime
 * ends its branch; a composite grows two more empty boxes. The puzzle is done
 * when no empty boxes remain, at which point the leaves are all prime and their
 * product is the original number — the unique prime factorization.
 *
 * Position is plain JSON: { n, count, root } where a node is
 * { value, done, left, right } (left/right null for a leaf, child nodes for a
 * composite). All functions return new positions; none mutate their input.
 * No document, no window, no storage.
 */
const BTreeTestingCore = (() => {
  // The applet's own prime tables (BTree static initializer). "Prime" in the
  // applet means membership in one of these two tables, so trial division is
  // deliberately NOT used to decide whether a branch is finished.
  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
  const EXTRA_PRIMES = [37, 41, 43, 47, 53, 59];
  const MIN_COUNT = 2;
  const MAX_COUNT = 6;
  const GOOD = "Yes, indeed,"; // BTreeTestingCanvas.Good

  /** True exactly when the applet would treat n as a finished prime leaf. */
  function isPrime(n) {
    return PRIMES.indexOf(n) !== -1 || EXTRA_PRIMES.indexOf(n) !== -1;
  }

  /** An empty box waiting for a factor (Value = 0, ValueAssigned = false). */
  function emptyBox() {
    return { value: 0, done: false, left: null, right: null };
  }

  /** A filled node: a leaf if done with no children, a split if children exist. */
  function box(value, left, right) {
    return {
      value: value,
      done: true,
      left: left || null,
      right: right || null,
    };
  }

  /** The box the player first sees: N with two empty boxes beneath it. */
  function makeRoot(n) {
    return box(n, emptyBox(), emptyBox());
  }

  /**
   * The count of prime factors: (int)(Math.random()*5)+2 in Reset. Kept as a
   * function so the test can drive it with a deterministic random source.
   */
  function randomCount(random) {
    const r = random || Math.random;
    return Math.floor(r() * 5) + 2;
  }

  /**
   * The number N, transcribed from BTree.CompositeNumberString. The applet
   * builds a throwaway factor tree from these primes, then CollectFactors
   * computes the root value as their product and throws the tree away; only
   * that product reaches the player, so we build the product directly.
   */
  function generateValue(count, random) {
    const r = random || Math.random;
    const c = clampCount(count);
    if (c === 2) {
      // The two-factor special case picks one ordinary and one extra prime.
      const a = PRIMES[Math.floor(r() * 4)];
      const b = EXTRA_PRIMES[Math.floor(r() * EXTRA_PRIMES.length)];
      return a * b;
    }
    let value = 1;
    for (let i = 0; i < c; i++) {
      let index;
      if (r() < 0.99) {
        index = Math.floor(r() * 4);
      } else {
        index = Math.floor(r() * PRIMES.length);
      }
      if (c === 3 && index < EXTRA_PRIMES.length && i === 0 && r() < 0.4) {
        value *= EXTRA_PRIMES[index];
      } else {
        value *= PRIMES[index];
      }
    }
    return value;
  }

  function clampCount(count) {
    const n = Number(count);
    if (!Number.isFinite(n)) return MIN_COUNT + Math.floor(Math.random() * (MAX_COUNT - MIN_COUNT + 1));
    return Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.trunc(n)));
  }

  /**
   * A fresh problem. options.count is "random" (the applet's own behaviour)
   * or an integer 2..6; options.random injects a random source for tests.
   * Exposing the count is a presentation addition: its range is exactly the
   * applet's internal 2..6, and "random" reproduces the original every time.
   */
  function start(options) {
    const o = options || {};
    const random = o.random || Math.random;
    const count = o.count === undefined || o.count === null || o.count === "random"
      ? randomCount(random)
      : clampCount(o.count);
    const n = generateValue(count, random);
    return { n: n, count: count, root: makeRoot(n) };
  }

  /** "Repeat problem": same number, empty tree (Repeat in the canvas). */
  function repeat(position) {
    return { n: position.n, count: position.count, root: makeRoot(position.n) };
  }

  /** Walk a path string of L/R steps from the root. Null if it does not exist. */
  function nodeAt(root, path) {
    let node = root;
    for (const step of String(path || "")) {
      if (step === "L") node = node && node.left;
      else if (step === "R") node = node && node.right;
      else return null;
      if (!node) return null;
    }
    return node;
  }

  /** Paths of every box still waiting for a factor, in tree order. */
  function emptyPaths(root) {
    const out = [];
    (function walk(node, path) {
      if (!node) return;
      if (!node.done) {
        out.push(path);
        return;
      }
      walk(node.left, path + "L");
      walk(node.right, path + "R");
    })(root, "");
    return out;
  }

  /** The canvas knows the factoring is finished when it has no text fields. */
  function isComplete(root) {
    return emptyPaths(root).length === 0;
  }

  function result(position) {
    return isComplete(position.root) ? "done" : null;
  }

  /** Leaf values of the tree — the prime factors found so far. */
  function collectPrimeFactors(root) {
    const out = [];
    (function walk(node) {
      if (!node) return;
      if (!node.done) return;
      if (!node.left && !node.right) out.push(node.value);
      else {
        walk(node.left);
        walk(node.right);
      }
    })(root);
    return out;
  }

  /** BTree.ArrangeIntegerVector: sorted, joined with " x " (empty -> "1"). */
  function arrangeIntegerVector(values) {
    if (values.length === 0) return "1";
    return values.slice().sort((a, b) => a - b).join(" x ");
  }

  /** BTree.CollectPrimeFactors(): "<primes> = N". */
  function factorization(position) {
    return arrangeIntegerVector(collectPrimeFactors(position.root)) + " = " + position.n;
  }

  /** The canvas' closing sentence, or null while boxes are still empty. */
  function completionMessage(position) {
    if (!isComplete(position.root)) return null;
    return GOOD + factorization(position) + "!";
  }

  /** BTree.SetValue: a prime is a leaf; a composite grows two empty boxes. */
  function setValue(value) {
    if (isPrime(value)) return box(value);
    return box(value, emptyBox(), emptyBox());
  }

  /**
   * One factor entry, transcribed from TextActionListener.actionPerformed.
   * `raw` is what the player typed (number or string). Invalid entries answer
   * with the applet's exact message and no change. A valid entry fills the box,
   * fills its sibling with the cofactor, and describes the change in words.
   */
  function enterFactor(position, path, raw) {
    const node = nodeAt(position.root, path);
    if (!node || node.done) {
      return { ok: false, message: "Choose an empty box first." };
    }
    // The sibling is the other child of this box's parent. In this tree every
    // empty box is a child of a filled parent, so find it by the path prefix.
    const parentPath = String(path).slice(0, -1);
    const parent = nodeAt(position.root, parentPath);
    if (!parent) return { ok: false, message: "Choose an empty box first." };
    const siblingPath = parentPath + (String(path).slice(-1) === "L" ? "R" : "L");
    const parentValue = parent.value;

    let n;
    if (typeof raw === "number") {
      n = raw;
    } else {
      const text = String(raw).trim();
      // Java Integer.parseInt rejects anything but an optional sign and digits.
      if (!/^[+-]?\d+$/.test(text)) {
        return { ok: false, message: text + " is not an integer" };
      }
      n = parseInt(text, 10);
    }
    if (!Number.isFinite(n)) {
      return { ok: false, message: raw + " is not an integer" };
    }
    if (n < 0) {
      return { ok: false, message: "Please enter a positive factor of " + parentValue };
    }
    if (n === 0) {
      return { ok: false, message: "0 can't be a factor of any number" };
    }
    if (n === 1) {
      return { ok: false, message: "1 does not count as a factor" };
    }
    if (n === parentValue) {
      return { ok: false, message: "Look for a factor less than " + parentValue };
    }
    const other = Math.floor(parentValue / n);
    if (other * n !== parentValue) {
      return { ok: false, message: n + " is not a factor of " + parentValue };
    }

    // Clone, then apply SetValue to this box and SetValueToOther to its sibling.
    const root = clone(position.root);
    setAt(root, path, setValue(n));
    setAt(root, siblingPath, setValue(other));
    const next = { n: position.n, count: position.count, root: root };

    let message;
    if (isComplete(root)) {
      message = completionMessage(next);
    } else {
      const a = isPrime(n) ? n + " is prime, so that branch is done" : n + " can be split again";
      const b = isPrime(other) ? other + " is prime" : other + " can be split again";
      message = "You split " + parentValue + " into " + n + " and " + other + ": " + a + ", and " + b + ".";
    }
    return { ok: true, position: next, factor: n, other: other, message: message };
  }

  function clone(node) {
    if (!node) return null;
    return { value: node.value, done: node.done, left: clone(node.left), right: clone(node.right) };
  }

  function setAt(root, path, value) {
    if (path === "") return value;
    const step = path[0];
    const child = setAt(step === "L" ? root.left : root.right, path.slice(1), value);
    if (step === "L") root.left = child;
    else root.right = child;
    return root;
  }

  /* ---- Independent helpers, used by the page's maths section and the test. */

  function product(values) {
    return values.reduce((a, b) => a * b, 1);
  }

  /** Trial division, independent of the applet's prime table. */
  function factorize(n) {
    const out = [];
    let m = n;
    for (let d = 2; d * d <= m; d++) {
      while (m % d === 0) {
        out.push(d);
        m /= d;
      }
    }
    if (m > 1) out.push(m);
    return out;
  }

  function digitSum(n) {
    return String(n).split("").reduce((a, c) => a + Number(c), 0);
  }

  const divisibleBy2 = (n) => n % 2 === 0;
  const divisibleBy3 = (n) => digitSum(n) % 3 === 0;
  const divisibleBy5 = (n) => n % 10 === 0 || n % 10 === 5;
  const divisibleBy10 = (n) => n % 10 === 0;

  return {
    PRIMES, EXTRA_PRIMES, MIN_COUNT, MAX_COUNT, GOOD,
    isPrime, emptyBox, makeRoot, randomCount, generateValue, clampCount,
    start, repeat, nodeAt, emptyPaths, isComplete, result,
    collectPrimeFactors, arrangeIntegerVector, factorization, completionMessage,
    setValue, enterFactor, product, factorize, digitSum,
    divisibleBy2, divisibleBy3, divisibleBy5, divisibleBy10,
  };
})();
