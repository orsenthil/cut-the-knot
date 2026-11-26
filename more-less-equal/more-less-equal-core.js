"use strict";

/*
 * More, Less or Equal, from Alexander Bogomolny's applet Rote.
 *
 * An equation of three numbers, a ∘ b ? c, where ∘ is +, −, × or ÷ and the
 * sign in the middle is worked out: the left side is more than, less than or
 * equal to the right. The player nudges each number up or down by one and
 * watches the sign. It starts at 1 + 1 = 2: add one to either number on the
 * left and, to keep the balance, one must also be added on the right.
 *
 * The idea the code relies on: a ÷ b is never computed. Like the applet,
 * the comparison of a/b with c is made as a comparison of a with b·c, whose
 * direction flips when b is negative; and when b is 0 the quotient has no
 * value, so the sign shown is ≠ ("cannot be compared").
 *
 * This file is the game's logic and nothing else. It defines one global,
 * MoreLessEqualCore. The position is plain data.
 */
const MoreLessEqualCore = (() => {
  const OPS = ["+", "-", "x", "/"];
  const SYMBOL = { "+": "+", "-": "−", "x": "×", "/": "÷" };

  /** RoteCanvas.init: 1 + 1 = 2. */
  function start(options = {}) {
    const op = OPS.includes(options.op) ? options.op : "+";
    return { a: 1, b: 1, c: 2, op };
  }

  /**
   * SimpleEquation.Compute: ">", "<", "=" or "<>" (no value: division by 0).
   * The sign says how the left side a ∘ b compares with c.
   */
  function relation(s) {
    const { a, b, c } = s;
    if (s.op === "/") {
      if (b * c > a) return b > 0 ? "<" : b === 0 ? "<>" : ">";
      if (b * c < a) return b > 0 ? ">" : b === 0 ? "<>" : "<";
      return b === 0 ? "<>" : "=";
    }
    const left = s.op === "+" ? a + b : s.op === "-" ? a - b : a * b;
    if (left > c) return ">";
    if (left < c) return "<";
    return "=";
  }

  /** CTKNumber.Update: one of the three numbers up or down by one. No limits. */
  function nudge(s, which, delta) {
    if (!["a", "b", "c"].includes(which) || (delta !== 1 && delta !== -1)) return null;
    return { ...s, [which]: s[which] + delta };
  }

  /** RotePanel: switch the operation; the numbers stay. */
  function setOp(s, op) {
    if (!OPS.includes(op)) return null;
    return { ...s, op };
  }

  /** The equation as the applet writes it: a negative middle number in brackets. */
  function text(s) {
    const rel = relation(s);
    const b = s.b < 0 ? `(${s.b})` : String(s.b);
    const sign = rel === "<>" ? "≠" : rel;
    return `${s.a} ${SYMBOL[s.op]} ${b} ${sign} ${s.c}`;
  }

  /** The value of the left side, or null when it has none (÷ 0). Exact for ÷ as a fraction string. */
  function leftValue(s) {
    if (s.op === "+") return String(s.a + s.b);
    if (s.op === "-") return String(s.a - s.b);
    if (s.op === "x") return String(s.a * s.b);
    if (s.b === 0) return null;
    let n = s.a, d = s.b;
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(Math.abs(n), d);
    n /= g; d /= g;
    return d === 1 ? String(n) : `${n}/${d}`;
  }

  function gcd(x, y) {
    while (y) [x, y] = [y, x % y];
    return x || 1;
  }

  return { OPS, SYMBOL, start, relation, nudge, setOp, text, leftValue };
})();
