"use strict";

/*
 * Close To Hilbert, from Alexander Bogomolny's applet CloseToHilbert.
 *
 * The applet writes a word over four directions - 0 down, 1 right, 2 up,
 * 3 left. Level 1 is the single letter "1". Each later level replaces the word
 * by (reverse and turn) + itself + itself + (complement), so four smaller copies
 * make the next curve while its two middle copies stay identical. A walk along
 * the word is drawn as semicircles, or as two-line tents, instead of straight
 * segments. Each click halves the walking step and asks for one more level.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CloseToHilbertCore, so the page loads it with a plain
 * <script> and porting/check-close-to-hilbert.mjs loads it in Node. The position
 * is plain data, so it can be saved for the player's record and the tutor.
 */
const CloseToHilbertCore = (() => {
  const VARIANTS = ["semicircles", "tents"];
  // The applet wraps back to its first step as soon as a halved step is 1.
  const MIN_STEP = 2;

  /** java int division: truncation towards zero, for the sizes we are given. */
  const half = (n) => Math.floor(n / 2);

  /* IntToChar from the bytecode: 0..3 -> '0'..'3', with '0' as its default. */
  function char(d) {
    const v = ((d % 4) + 4) % 4;
    return "0123"[v];
  }
  /* CharToInt from the bytecode: the letter's code minus '0'. */
  function val(c) {
    return c.charCodeAt(0) - 48;
  }

  /* reverse(k, s): turn the word round and add k to every digit modulo 4. */
  function reverse(k, s) {
    let out = "";
    for (let i = s.length - 1; i >= 0; i--) out += char(val(s[i]) + k);
    return out;
  }

  /* complement(s): replace each digit d by 3 - d. */
  function complement(s) {
    let out = "";
    for (let i = 0; i < s.length; i++) out += char(3 - val(s[i]));
    return out;
  }

  /** The applet's combine(1, maxStep), written top-down. */
  function word(level) {
    if (level <= 1) return "1";
    const previous = word(level - 1);
    return reverse(3, previous) + previous + previous + complement(previous);
  }

  /**
   * The applet's init() sizing, transcribed: halve min(width, height)/2 while
   * half the step is at least 2, then use the largest power-of-two multiple of
   * that step which still fits. `options.side` lets a page choose a smaller
   * virtual canvas without changing any of the drawing's proportions.
   */
  function configure(options) {
    const o = options || {};
    const width = Math.max(16, Math.floor(o.width === undefined ? 320 : o.width));
    const height = Math.max(16, Math.floor(o.height === undefined ? 320 : o.height));
    let step = half(Math.min(width, height));
    let absMax = 1;
    while (half(step) >= 2) {
      step = half(step);
      absMax++;
    }
    let pow = 1;
    for (let i = 0; i < absMax; i++) pow *= 2;
    const side = o.side === undefined ? step * pow : Math.floor(o.side);
    return {
      width: width,
      height: height,
      side: side,
      origin: { x: half(width - side), y: half(height - side) },
      absMax: absMax,
    };
  }

  /** A fresh position. The applet always opens on level 1, semicircles. */
  function start(options) {
    const o = options || {};
    const geo = configure(o);
    const level = Math.max(1, Math.floor(o.level === undefined ? 1 : o.level));
    return {
      width: geo.width,
      height: geo.height,
      side: geo.side,
      origin: geo.origin,
      absMax: geo.absMax,
      level: level,
      step: geo.side / Math.pow(2, level - 1),
      variant: VARIANTS.indexOf(o.variant) >= 0 ? o.variant : VARIANTS[0],
    };
  }

  /** One click of the applet: deeper word, half the step, or back to the top. */
  function advance(state) {
    if (state.step / 2 >= MIN_STEP) {
      return start({ width: state.width, height: state.height, side: state.side,
        level: state.level + 1, variant: state.variant });
    }
    return start({ width: state.width, height: state.height, side: state.side,
      variant: state.variant });
  }

  /**
   * One piece per letter, straight from drawCloseToHilbert: the letter moves
   * the turtle by one step, while the arc (or the tent's apex) is placed at the
   * piece's *starting* point. All numbers are viewBox units, not screen pixels.
   */
  function pieces(state) {
    const letters = word(state.level);
    const s = state.step;
    // The Java drawArc/drawLine offsets use an int division. For an odd step
    // that truncates by half a unit; the quirk is kept here.
    const h = half(s);
    let x = state.origin.x;
    let y = state.origin.y;
    const out = [];
    for (const ch of letters) {
      const from = { x: x, y: y };
      let to, center, a0, a1, apex;
      switch (ch) {
        case "0": // down: right-hand semicircle, tent apex to the right
          to = { x: x, y: y + s };
          center = { x: x - h + s / 2, y: y + s / 2 };
          a0 = -Math.PI / 2; a1 = Math.PI / 2;
          apex = { x: x + h, y: y + h };
          break;
        case "1": // right: upper semicircle, tent apex above
          to = { x: x + s, y: y };
          center = { x: x + s / 2, y: y - h + s / 2 };
          a0 = Math.PI; a1 = 2 * Math.PI;
          apex = { x: x + h, y: y - h };
          break;
        case "2": // up: left-hand semicircle, tent apex to the left
          to = { x: x, y: y - s };
          center = { x: x - h + s / 2, y: y - s / 2 };
          a0 = Math.PI / 2; a1 = 3 * Math.PI / 2;
          apex = { x: x - h, y: y - h };
          break;
        default: // 3, left: lower semicircle, tent apex below
          to = { x: x - s, y: y };
          center = { x: x - s / 2, y: y - h + s / 2 };
          a0 = 0; a1 = Math.PI;
          apex = { x: x - h, y: y + h };
          break;
      }
      out.push({ ch: ch, from: from, to: to, center: center, radius: s / 2,
        a0: a0, a1: a1, apex: apex });
      x = to.x;
      y = to.y;
    }
    return out;
  }

  /** A sentence for the status line: no win or loss, only progress. */
  function describe(state) {
    const segments = Math.pow(4, Math.max(0, state.level - 1));
    return `Step ${state.level}: ${segments} ${state.variant === "tents" ? "tents" : "semicircles"}; each step is ${Number(state.step.toFixed(3))} units wide.`;
  }

  return { VARIANTS: VARIANTS, MIN_STEP: MIN_STEP, char: char, val: val,
    configure: configure, start: start, advance: advance, word: word,
    pieces: pieces, describe: describe };
})();
