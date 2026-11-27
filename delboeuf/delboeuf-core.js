"use strict";

/*
 * Delboeuf, from Alexander Bogomolny's applet Delboeuf (the live page embeds
 * it with fcolor=000000, bcolor=ffffff). The applet draws four rings: two
 * coloured rings of exactly the same radius, one enclosed by a larger black
 * ring and the other enclosing a smaller black ring. The eye reads the two
 * equal rings differently; the pixels do not.
 *
 * The numbers here follow DelboeufCanvas.Draw and DrawOval in the bytecode.
 * With canvas w x h: unit = round(w/5), s4 = round(unit*MR/200),
 * s5 = round(s4*WR/100), s6 = round(s4*DR/100), mid = trunc(h/2). DrawOval(g,
 * cx, cy, r, thickness, colour) fills a disc of radius r + thickness/2 in
 * that colour and then a disc of radius r - thickness/2 in the background,
 * i.e. a ring. The two coloured rings both use r = s4+s5 and thickness s5;
 * their black neighbours use r = s4+s5+s6 and r = s4-s6-s5. Ci tints the
 * coloured rings towards red (Ci > 0) or blue (Ci < 0), and CI darkens two
 * horizontal guide lines unless it sits at 255.
 *
 * This file is the applet's logic and nothing else: no document, no window,
 * no storage. It defines one global, DelboeufCore, so the page loads it with
 * a plain <script> and porting/check-delboeuf.mjs loads it in Node. The
 * position is plain data (five integers plus a probe point), so it can be
 * saved and handed to the tutor; no function changes its argument.
 */
const DelboeufCore = (() => {
  // The live cut-the-knot page embeds the applet at 500 x 350; the SVG board
  // uses 500 x 300 user units so every drawing number carries straight over.
  const BOARD = Object.freeze({ width: 500, height: 300 });

  // The page's <param> tags, in hex as the applet's Integer.parseInt(s, 16).
  const PAGE_COLORS = Object.freeze({ background: "ffffff", foreground: "000000" });

  // DelboeufCanvas.init() and the five java.awt.Scrollbars in DelboeufPanel.
  const DEFAULTS = Object.freeze({ MR: 50, DR: 10, WR: 10, CI: 255, Ci: 0 });
  const LIMITS = Object.freeze({
    MR: [10, 100],   // 50, page increment 5, min 10, max 100
    DR: [1, 50],     // 10, page increment 5, min 1, max 50
    WR: [10, 50],    // 10, page increment 5, min 10, max 50
    CI: [0, 260],    // 255, page increment 5, min 0, max 260
    Ci: [-100, 100], // 0, page increment 5, min -100, max 100
  });
  const OPTIONS = Object.freeze(["MR", "DR", "WR", "CI", "Ci"]);

  /** A scrollbar value: an integer inside that scrollbar's own range. */
  function clampOption(key, value) {
    const range = LIMITS[key];
    if (!range) return value;
    const n = Number(value);
    const v = Number.isFinite(n) ? Math.round(n) : DEFAULTS[key];
    return Math.min(range[1], Math.max(range[0], v));
  }

  /** The five scrollbar values the applet starts with. */
  function start() {
    return { ...DEFAULTS };
  }

  /** A new position with one scrollbar changed, as the listener copies them. */
  function option(state, key, value) {
    if (!(key in LIMITS)) return state;
    return { ...state, [key]: clampOption(key, value) };
  }

  /** new Color(Integer.parseInt(hex, 16)) as three 0..255 channels. */
  function rgb(hex) {
    const n = parseInt(String(hex), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function css(c) {
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  /** GetColor(): for Ci > 0 tint towards red, for Ci < 0 towards blue. */
  function getColor(foreground, ci) {
    if (ci === 0) return foreground.slice();
    const amount = Math.abs(ci);
    const to = ci > 0 ? [255, 0, 0] : [0, 0, 255];
    // ProrateColor: round(c1[i]*(100-amount)/100 + c2[i]*amount/100).
    return foreground.map((v, i) =>
      Math.round(v * (100 - amount) / 100 + to[i] * amount / 100));
  }

  /** The four rings and the two guide lines, in board units. */
  function geometry(state, canvasW = BOARD.width, canvasH = BOARD.height) {
    const unit = Math.round(canvasW / 5.0);
    const s4 = Math.round(unit * state.MR / 200.0);
    const s5 = Math.round(s4 * state.WR / 100.0);
    const s6 = Math.round(s4 * state.DR / 100.0);
    const mid = Math.trunc(canvasH / 2);
    const leftX = unit + Math.trunc(unit / 2);
    const rightX = canvasW - leftX;
    const ring = (cx, r) => ({ cx, cy: mid, r, thickness: s5 });
    return {
      unit, s4, s5, s6, mid, leftX, rightX,
      // Draw() paints them in this order: black neighbour, coloured ring,
      // coloured ring, black neighbour.
      ovals: [
        { id: "leftOuter", ...ring(leftX, s4 + s5 + s6), palette: "foreground" },
        { id: "leftTarget", ...ring(leftX, s4 + s5), palette: "target" },
        { id: "rightTarget", ...ring(rightX, s4 + s5), palette: "target" },
        { id: "rightInner", ...ring(rightX, s4 - s6 - s5), palette: "foreground" },
      ],
      band: {
        y1: mid - s4 - Math.trunc(s5 / 2) - 1,
        y2: mid + s4 + Math.trunc(s5 / 2),
      },
    };
  }

  /** Everything needed for one frame, from a position and a canvas size. */
  function compute(state, canvasW = BOARD.width, canvasH = BOARD.height, background = null, foreground = null) {
    const bg = background || rgb(PAGE_COLORS.background);
    const fg = foreground || rgb(PAGE_COLORS.foreground);
    const f = geometry(state, canvasW, canvasH);
    const target = getColor(fg, state.Ci);
    // CI == 255 leaves the background alone; otherwise the guide lines use
    // round(channel * CI / 255) of it.
    const band = state.CI === 255
      ? null
      : bg.map((v) => Math.round(v * state.CI / 255.0));
    return {
      ...f,
      band: band ? { ...f.band, color: css(band) } : null,
      colors: {
        background: css(bg),
        foreground: css(fg),
        target: css(target),
        band: band ? css(band) : null,
      },
      targetRGB: target,
      bandRGB: band,
    };
  }

  /** A sentence for the status line, including the probe's reading. */
  function describe(state, frame, probe) {
    const r = frame.ovals[1].r;
    const outer = frame.ovals[0].r;
    const inner = frame.ovals[3].r;
    const right = inner > 0
      ? `the right one holds a smaller circle of radius ${inner}.`
      : "the small circle inside the right one has vanished (a negative radius paints nothing).";
    const left = outer > r
      ? `The left one sits in a bigger ring of radius ${outer};`
      : `The ring around the left one has shrunk to the same radius ${outer};`;
    const message = `The two coloured circles are the same size: radius ${r} ` +
      `with a ${frame.s5}-wide edge. ` + left + ' ' + right;
    if (!probe) return message;
    const near = (o) => Math.abs(Math.hypot(probe.x - o.cx, probe.y - o.cy) - o.r);
    const closest = frame.ovals.slice().sort((a, b) => near(a) - near(b))[0];
    const names = {
      leftOuter: "the ring around the left circle",
      leftTarget: "the left coloured circle",
      rightTarget: "the right coloured circle",
      rightInner: "the small circle inside the right one",
    };
    return message + ` Probe: ${names[closest.id]}, radius ${closest.r}.`;
  }

  return {
    BOARD, PAGE_COLORS, DEFAULTS, LIMITS, OPTIONS,
    start, option, clampOption, rgb, css, getColor,
    geometry, compute, describe,
  };
})();
