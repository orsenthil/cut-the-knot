"use strict";

/*
 * Judd Illusion, from Alexander Bogomolny's applet JuddIllusion. The applet
 * draws one horizontal bar with arrow heads at both ends and a short mark at
 * its middle. With a rectangle/dot mark the two halves look different lengths;
 * replacing the mark by an arrow head weakens the impression. The bar itself
 * never changes: the trick is in the seeing, not in the pixels.
 *
 * Every number below comes straight from JuddIllusionCanvas.Draw / Arrow / Bob
 * in the bytecode. With a w x h canvas:
 *   c = round(w * (100 - 2*L) / 100 / 2),  mid = trunc(h / 2)
 *   bar = fillRect(c - 20, mid - W, w - 2*c, 2*W + 1)
 *   Arrow(x, mid, h): s = sign(h), base y = mid - W*s,
 *                     tip = (x + A, base y - h), B parallel strokes
 *   Bob(x, mid): B vertical strokes from mid - W - 3 to mid + W + 3
 * The end arrows sit at c - 20 and w - c - 20; the middle mark sits at
 * trunc(w/2) - 20. For even w that is exactly halfway along the bar.
 *
 * This file is the applet's logic and nothing else: no document, no window,
 * no storage. It defines one global, JuddIllusionCore, so the page loads it
 * with a plain <script> and porting/check-judd-illusion.mjs loads it in Node.
 * The position is plain data (five integers, a flag and a probe point), so it
 * can be saved and handed to the tutor; no function changes its argument.
 */
const JuddIllusionCore = (() => {
  // The live cut-the-knot page embeds the applet at 500 x 400 with these
  // parameters. Our SVG board is 500 x 300: the drawing area left by the
  // applet's south control panel, and tall enough for W + H = 130.
  const BOARD = Object.freeze({ width: 500, height: 300 });
  const PAGE_COLORS = Object.freeze({ background: "ffffff", foreground: "000000" });

  // JuddIllusionCanvas constructor: L=20, W=5, H=50, A=10, B=10, Bob=true.
  const DEFAULTS = Object.freeze({ L: 20, W: 5, H: 50, A: 10, B: 10, bob: true });
  // The A scrollbar is constructed at 30, but nothing copies it into the
  // canvas until a control moves: the opening picture uses A=10.
  const SCROLLBAR_START = Object.freeze({ L: 20, W: 5, H: 50, A: 30, B: 10 });

  // The five java.awt.Scrollbars in JuddIllusionPanel, in construction order
  // (the panel places L, W, H, A, B in a 5 x 1 grid).
  const LIMITS = Object.freeze({
    L: [10, 45],    // initial 20, page increment 2, min 10, max 45
    W: [0, 20],     // initial 5,  page increment 2, min 0,  max 20
    H: [10, 110],   // initial 50, page increment 2, min 10, max 110
    A: [-90, 90],   // initial 30, page increment 10, min -90, max 90
    B: [1, 40],     // initial 10, page increment 10, min 1, max 40
  });
  const OPTIONS = Object.freeze(["L", "W", "H", "A", "B"]);

  /** Math.round(double), which Java defines as floor(x + 0.5). */
  function javaRound(x) {
    return Math.floor(x + 0.5);
  }

  /** A scrollbar value: an integer inside that scrollbar's own range. */
  function clampOption(key, value) {
    const range = LIMITS[key];
    if (!range) return value;
    const n = Number(value);
    const v = Number.isFinite(n) ? Math.round(n) : DEFAULTS[key];
    return Math.min(range[1], Math.max(range[0], v));
  }

  /** The canvas's opening values, plus the UI probe used for measuring. */
  function start() {
    return { ...DEFAULTS, probe: { x: 250, y: BOARD.height - 10 } };
  }

  /** A new position with one control changed, as the applet's listeners do. */
  function option(state, key, value) {
    if (key === "bob") return { ...state, bob: Boolean(value) };
    if (!(key in LIMITS)) return state;
    return { ...state, [key]: clampOption(key, value) };
  }

  /**
   * Arrow(g, x, y, h) in the bytecode. `h` is +H or -H, so s is +1 or -1.
   * The B strokes are one unit apart in x, exactly as the Java loop draws.
   */
  function arrow(state, mid, x, h) {
    const s = Math.trunc(h / Math.abs(h));
    const base = { x: x, y: mid - state.W * s };
    const tip = { x: x + state.A, y: base.y - h };
    const lines = [];
    for (let i = 0; i < state.B; i++) {
      lines.push({ x1: base.x + i, y1: base.y, x2: tip.x + i, y2: tip.y });
    }
    return { base, tip, sign: s, lines };
  }

  /** Bob(g, x, y) in the bytecode: a short B-stroke rectangle/dot. */
  function bob(state, mid, x) {
    const top = mid - state.W - 3;
    const bottom = mid + state.W + 3;
    const lines = [];
    for (let i = 0; i < state.B; i++) {
      lines.push({ x1: x + i, y1: top, x2: x + i, y2: bottom });
    }
    return { kind: "rectangle", x, top, bottom, lines };
  }

  /** Every drawn primitive for one frame, in board units. */
  function geometry(state, canvasW = BOARD.width, canvasH = BOARD.height) {
    const mid = Math.trunc(canvasH / 2);
    // Draw(): width * (100 - 2*L) / 100.0 / 2.0, then Math.round.
    const c = javaRound(canvasW * (100 - 2 * state.L) / 100.0 / 2.0);
    const bar = {
      x: c - 20,
      y: mid - state.W,
      width: canvasW - 2 * c,
      height: 2 * state.W + 1,
    };
    const leftX = c - 20;
    const rightX = canvasW - c - 20;
    const centerX = Math.trunc(canvasW / 2) - 20;

    const arrows = {
      leftUp: arrow(state, mid, leftX, state.H),
      leftDown: arrow(state, mid, leftX, -state.H),
      rightUp: arrow(state, mid, rightX, state.H),
      rightDown: arrow(state, mid, rightX, -state.H),
    };
    const marker = state.bob
      ? bob(state, mid, centerX)
      : {
          kind: "arrowhead",
          x: centerX,
          up: arrow(state, mid, centerX, state.H),
          down: arrow(state, mid, centerX, -state.H),
          lines: [
            ...arrow(state, mid, centerX, state.H).lines,
            ...arrow(state, mid, centerX, -state.H).lines,
          ],
        };

    const lines = [
      ...arrows.leftUp.lines, ...arrows.leftDown.lines,
      ...arrows.rightUp.lines, ...arrows.rightDown.lines,
      ...marker.lines,
    ];
    const halves = {
      left: centerX - bar.x,
      right: bar.x + bar.width - centerX,
    };
    return { mid, c, bar, leftX, rightX, centerX, arrows, marker, lines, halves };
  }

  /** A plain-English reading of the frame; no win or loss exists here. */
  function describe(state, frame, probe) {
    const h = frame.halves;
    const equal = h.left === h.right;
    const lengths = equal
      ? `The mark is ${h.left} units from each end of the ${frame.bar.width}-unit bar.`
      : `The mark is ${h.left} units from the left end and ${h.right} units from the right end of the ${frame.bar.width}-unit bar.`;
    const direction = state.A > 0 ? "right" : state.A < 0 ? "left" : "straight up and down";
    const mark = state.bob ? "a short rectangle" : "an arrow head";
    let message = `${lengths} The end arrows point ${direction}; the middle mark is ${mark}.`;
    if (probe) {
      const x = Math.round(probe.x);
      const place = x < frame.leftX ? "left of the bar"
        : x > frame.rightX ? "right of the bar"
          : x < frame.centerX ? "over the left half"
            : x > frame.centerX ? "over the right half" : "on the middle mark";
      message += ` Probe at ${x}: ${place}.`;
    }
    return message;
  }

  return {
    BOARD, PAGE_COLORS, DEFAULTS, SCROLLBAR_START, LIMITS, OPTIONS,
    javaRound, clampOption, start, option, arrow, bob, geometry, describe,
  };
})();
