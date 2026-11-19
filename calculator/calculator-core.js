"use strict";

/*
 * Broken Calculator, from Alexander Bogomolny's applet `Calculator`.
 *
 * The calculator is broken on purpose: every new game switches off most of its
 * buttons. What is left is the digit 0, four digits from 2 to 9, one of * and /,
 * one of + and -, and sometimes a decimal point, a sign key and the memory keys.
 * The puzzle is to reach each of the integers 1 through 15 with what is left.
 *
 * The key idea behind this file is that the whole calculator is a small state
 * machine over plain data. A number is a reduced fraction {n, d}; arithmetic is
 * exact rational arithmetic (the applet uses int numerators and denominators),
 * and the "achievement" is a 15-element array of flags. Nothing here touches
 * the DOM: the page only renders the position and sends button labels to `press`.
 *
 * The random button selection is driven by an injected [0,1) generator so the
 * same seed reproduces the same broken calculator. That lets the logic test
 * compare it with a literal second transcription of the applet's bytecode.
 */
const CalculatorCore = (() => {
  "use strict";

  const TOTAL = 15;
  const DEAD_BUTTONS = ["Back", "sqrt", "%", "1/x"]; // present but never enabled

  /* Java's (int) cast of a non-negative double truncates toward zero. */
  const jint = (x) => Math.floor(x);

  /** A tiny deterministic [0,1) generator, in the spirit of java.lang.Math.random. */
  function rng(seed) {
    // Hash the seed so that even 0, 1, 2 ... give varied first draws.
    let s = (Math.imul(seed, 0x9e3779b9) >>> 0) || 0x9e3779b9;
    return () => {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ------------------------------------------------------------ numbers */

  /* applet: gcd(a,b) = b == 0 ? a : gcd(b, a % b) */
  function gcd(a, b) {
    while (b !== 0) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  /** applet: new CalculatorNumber(int n, int d) — reduce by gcd. */
  function make(n, d) {
    const g = gcd(n, d);
    if (g !== 1 && g !== 0) {
      n = Math.trunc(n / g);
      d = Math.trunc(d / g);
    }
    return { n, d };
  }

  /*
   * applet: new CalculatorNumber(String) / (String, boolean).
   * The flag is the applet's UseFloat: with it, decimals become n / 10^k;
   * without it, Parse accepts integers and "a/b" and maps junk to 0/1.
   */
  function parseNumber(text, useFloat) {
    if (useFloat) {
      const dot = text.indexOf(".");
      if (dot < 0) return { n: parseInt(text, 10) || 0, d: 1 };
      const power = text.length - 1 - dot;
      const d = Math.trunc(Math.pow(10, power));
      const whole = text.substring(0, dot);
      const frac = text.substring(dot + 1);
      return { n: parseInt(whole + frac, 10) || 0, d };
    }
    if (text === "") return { n: 0, d: 1 };
    const slash = text.indexOf("/");
    if (slash < 0) {
      const n = parseInt(text, 10);
      return Number.isNaN(n) ? { n: 0, d: 1 } : { n, d: 1 };
    }
    const n = parseInt(text.substring(0, slash), 10);
    const d = parseInt(text.substring(slash + 1), 10);
    if (Number.isNaN(n) || Number.isNaN(d)) return { n: 0, d: 1 };
    return make(n, d);
  }

  /** applet: CalculatorNumber.toString(). */
  function formatNumber(num) {
    if (num.d === 1) return String(num.n);
    if (num.d === 0) return "Bad number";
    return String(num.n / num.d);
  }

  /** applet: NumberFormat.getInstance().parse(s).floatValue(), or 0 on failure. */
  function floatValue(text) {
    const m = /^\s*[+-]?\d*\.?\d*/.exec(text);
    const v = m ? Math.fround(parseFloat(m[0] || "0")) : 0;
    return Number.isNaN(v) ? 0 : v;
  }

  /** applet: Crop(s) — show a whole-valued result as an integer. */
  function crop(text) {
    const f = floatValue(text);
    const n = Math.trunc(f);
    return Math.fround(n) === f ? String(n) : text;
  }

  /** applet: CalculatorNumber.Op(other, op), 1=+ 2=- 3=* 4=/. */
  function applyOp(a, b, op) {
    if (op === 1) return make(a.n * b.d + b.n * a.d, a.d * b.d);
    if (op === 2) return make(a.n * b.d - b.n * a.d, a.d * b.d);
    if (op === 3) return make(a.n * b.n, a.d * b.d);
    if (op === 4) return make(a.n * b.d, a.d * b.n);
    return { n: a.n, d: a.d };
  }

  /* --------------------------------------------------------- achievement */

  /** applet: CalculatorAchievment.Insert(int) — one flag per result, 1..15. */
  function insert(found, value) {
    if (value < 1 || value > TOTAL || found[value - 1]) return false;
    found[value - 1] = true;
    return true;
  }

  /** applet: CalculatorAchievment.Insert(String) — only whole numbers count. */
  function insertText(found, text) {
    const num = parseNumber(text, false);
    return num.d === 1 ? insert(found, num.n) : false;
  }

  /** applet: CalculatorAchievment.toString() — ascending list, "!" if complete. */
  function achievementString(found) {
    const parts = [];
    let all = true;
    for (let i = 0; i < TOTAL; i++) {
      if (found[i]) parts.push(String(i + 1));
      else all = false;
    }
    return parts.join(",") + (all ? "!" : "");
  }

  function countFound(found) {
    let n = 0;
    for (const f of found) if (f) n++;
    return n;
  }

  /* ------------------------------------------------------------- setup */

  /*
   * Literal transcription of SelectTwoOperations() + SelectFourDigits(boolean)
   * + SelectOneNum(int[], int) with the generator supplied by the caller.
   */
  function selectSetup(random) {
    const mulDiv = jint(random() * 2); // 0 -> * and ., 1 -> /
    const plusMinus = jint(random() * 2); // 0 -> +, 1 -> - and +/-
    const useFloat = mulDiv === 0;

    const digits = [0, 0, 0, 0];
    if (useFloat) {
      digits[0] = 5;
      digits[1] = Math.trunc(Math.pow(2, jint(random() * 3) + 1)); // 2, 4 or 8
    }
    for (let i = useFloat ? 2 : 0; i < 4; i++) {
      let d;
      for (;;) {
        d = jint(random() * 8 + 2); // 2..9 (the applet never offers 1)
        let seen = false;
        for (let j = 0; j < i; j++) if (digits[j] === d) seen = true;
        if (!seen) break;
      }
      digits[i] = d;
    }
    return { mulDiv, plusMinus, useFloat, digits };
  }

  /** Buttons that work in a position, in keypad order. */
  function enabledButtons(state) {
    const out = ["CE", "C", "MC", "MR", "MS", "M+"]; // memory keys need the option
    if (!state.useMemory) out.splice(2, 4);
    out.push("0");
    for (const d of state.digits) out.push(String(d));
    if (state.mulDiv === 0) out.push("*", ".");
    else out.push("/");
    if (state.plusMinus === 0) out.push("+");
    else out.push("-", "+/-");
    out.push("=");
    return out;
  }

  /* ---------------------------------------------------------- the game */

  /** The position a new game starts from. `options.seed` fixes the broken set. */
  function start(options = {}) {
    const seed = options.seed == null ? Math.floor(Math.random() * 2147483647) : options.seed;
    const setup = selectSetup(rng(seed));
    return {
      seed,
      useMemory: !!options.useMemory,
      useFloat: setup.useFloat,
      mulDiv: setup.mulDiv,
      plusMinus: setup.plusMinus,
      digits: setup.digits.slice(),
      display: "",
      progress: "",
      found: Array(TOTAL).fill(false),
      temp: null,
      op: 0,
      opPressed: false,
      memory: "",
      memIndicator: "",
      moves: 0,
      lastFound: 0,
    };
  }

  /** The "Use memory" checkbox: enables/disables the four memory keys. */
  function setUseMemory(state, on) {
    const next = Object.assign({}, state, { useMemory: !!on, memIndicator: "" });
    return next;
  }

  /** Reset keeps the same broken calculator and clears the play. */
  function reset(state) {
    return Object.assign({}, state, {
      display: "",
      progress: "",
      found: Array(TOTAL).fill(false),
      temp: null,
      op: 0,
      opPressed: false,
      memory: "",
      memIndicator: "",
      moves: 0,
      lastFound: 0,
    });
  }

  /*
   * Compute(boolean). With `record` it also tests the achievement and updates
   * the progress line. Returns { state, value } where `value` is the new
   * CalculatorNumber (null when no operation was pending), as in the applet.
   */
  function compute(state, record) {
    let value = null;
    let display = state.display;
    let found = state.found;
    let progress = state.progress;
    let lastFound = 0;

    if (state.op !== 0 && state.temp) {
      value = applyOp(state.temp, parseNumber(display, state.useFloat), state.op);
      display = crop(formatNumber(value));
    }
    if (record) {
      found = found.slice();
      let text;
      if (state.useFloat) {
        const f = floatValue(display);
        const n = Math.trunc(f);
        text = Math.fround(n) === f ? String(n) : null;
      } else {
        text = display;
      }
      if (text !== null) lastFound = insertText(found, text) ? parseInt(text, 10) : 0;
      progress = achievementString(found);
    }
    return {
      state: Object.assign({}, state, { display, found, progress, lastFound }),
      value,
    };
  }

  /* Applet's memory: MS stores the display, MR recalls it, M+ adds to it. */
  function memoryPlus(memory, text, useFloat) {
    if (useFloat) {
      // MP(float): a rational + a 32-bit float takes the applet's float path.
      const a = floatValue(memory);
      const b = floatValue(text);
      return String(Math.fround(a + b));
    }
    const a = parseNumber(memory, false);
    const b = parseNumber(text, false);
    return formatNumber(make(a.n * b.d + b.n * a.d, a.d * b.d));
  }

  /** The position after one button press, or the same position if impossible. */
  function press(state, label) {
    const allowed = enabledButtons(state);
    if (allowed.indexOf(label) < 0 || DEAD_BUTTONS.indexOf(label) >= 0) return state;

    const next = Object.assign({}, state, { moves: state.moves + 1, lastFound: 0 });

    if (/^[0-9]$/.test(label) || label === ".") {
      next.display = (state.opPressed ? "" : state.display) + label;
      next.opPressed = false;
      return next;
    }
    if (label === "CE") {
      next.display = "";
      return next;
    }
    if (label === "C") {
      return Object.assign(next, {
        display: "", memory: "", memIndicator: "", temp: null, op: 0, opPressed: false,
      });
    }
    if (label === "+/-") {
      const s = state.display.length ? state.display : "";
      next.display = crop(s.charAt(0) === "-" ? s.substring(1) : "-" + s);
      return next;
    }
    if (label === "+" || label === "-" || label === "*" || label === "/") {
      const settled = compute(state, false);
      return Object.assign(next, {
        display: settled.state.display,
        temp: parseNumber(settled.state.display, state.useFloat),
        op: label === "+" ? 1 : label === "-" ? 2 : label === "*" ? 3 : 4,
        opPressed: true,
      });
    }
    if (label === "=") {
      const settled = compute(state, true);
      return Object.assign(next, {
        display: settled.state.display,
        found: settled.state.found,
        progress: settled.state.progress,
        lastFound: settled.state.lastFound,
        temp: settled.value,
        op: 0,
      });
    }
    if (label === "MC") {
      return Object.assign(next, { memory: "", memIndicator: "" });
    }
    if (label === "MS") {
      return Object.assign(next, { memory: state.display, memIndicator: "M" });
    }
    if (label === "MR") {
      return Object.assign(next, { display: crop(state.memory) });
    }
    if (label === "M+") {
      return Object.assign(next, {
        memory: memoryPlus(state.memory, state.display, state.useFloat),
        memIndicator: "M",
      });
    }
    return state;
  }

  /** "done" once every integer from 1 to 15 has been found. */
  function result(state) {
    return countFound(state.found) === TOTAL ? "done" : null;
  }

  return {
    TOTAL,
    DEAD_BUTTONS,
    rng,
    gcd,
    make,
    parseNumber,
    formatNumber,
    floatValue,
    crop,
    applyOp,
    insert,
    insertText,
    achievementString,
    countFound,
    selectSetup,
    enabledButtons,
    start,
    setUseMemory,
    reset,
    compute,
    memoryPlus,
    press,
    result,
  };
})();
