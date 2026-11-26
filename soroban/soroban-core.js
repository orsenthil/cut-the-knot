"use strict";

/*
 * Soroban in Various Number Systems, from Alexander Bogomolny's applet
 * Soroban.
 *
 * The Japanese soroban: every wire has one bead above the bar (heaven),
 * worth five, and four below (earth), worth one each; a bead counts when it
 * touches the bar. Five is half of ten, so the same device works for any
 * even base r: one heaven bead worth r/2 and r/2 - 1 earth beads, giving
 * every digit 0..r-1 on a wire.
 *
 * Transcribed from SorobanDevice$Wire. A wire's beads are numbered from the
 * one farthest from the bar (0) to the one next to it (r/2 - 2), then the
 * heaven bead. Clicking an earth bead that is away from the bar pushes it
 * and every earth bead between it and the bar up to the bar; clicking one at
 * the bar pulls it and every bead beyond it away. Clicking the heaven bead
 * toggles it, except that when all the earth beads are up, pushing it down
 * also drops them: four ones become one five (the digit goes from r/2 - 1 to
 * r/2). Under each wire the applet writes its digit, leading zeros left out.
 * Radix 2..20 (even, 10 to start), 1..10 wires (7 to start); the leftmost
 * wire is the highest place.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SorobanCore. The position is plain data.
 */
const SorobanCore = (() => {
  const RADICES = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  const WIRES = { min: 1, max: 10, def: 7 };
  const DIGITS = "0123456789ABCDEFGHIJ";

  function start(options = {}) {
    const radix = RADICES.includes(Number(options.radix)) ? Number(options.radix) : 10;
    const w = Math.round(Number(options.wires ?? WIRES.def));
    const wires = Number.isFinite(w) ? Math.max(WIRES.min, Math.min(WIRES.max, w)) : WIRES.def;
    const earth = radix / 2 - 1;
    return { radix, wires: Array.from({ length: wires }, () => ({ earth: new Array(earth).fill(false), heaven: false })) };
  }

  /** Wire.Value: the earth beads at the bar plus r/2 for the heaven bead. */
  function value(s, i) {
    const w = s.wires[i];
    let v = 0;
    const first = w.earth.indexOf(true);
    if (first >= 0) v = w.earth.length - first;
    if (w.heaven) v += s.radix / 2;
    return v;
  }

  /** Wire.CheckBone on bead `bead` of wire `i`: 0.. earth (far to near), "heaven" for the top one. */
  function click(s, i, bead) {
    if (!(i >= 0 && i < s.wires.length)) return null;
    const wires = s.wires.map((w) => ({ earth: w.earth.slice(), heaven: w.heaven }));
    const w = wires[i];
    if (bead === "heaven") {
      if (!w.heaven && value(s, i) === s.radix / 2 - 1) w.earth.fill(false);
      w.heaven = !w.heaven;
    } else {
      const k = Number(bead);
      if (!(Number.isInteger(k) && k >= 0 && k < w.earth.length)) return null;
      if (w.earth[k]) for (let j = 0; j <= k; j++) w.earth[j] = false;
      else for (let j = k; j < w.earth.length; j++) w.earth[j] = true;
    }
    return { ...s, wires };
  }

  /** The digits under the wires (leading zeros blank), and the number in base 10. */
  function reading(s) {
    let started = false, n = 0;
    const digits = s.wires.map((_, i) => {
      const v = value(s, i);
      n = n * s.radix + v;
      if (v || started) { started = true; return DIGITS[v]; }
      return "";
    });
    return { digits, inRadix: digits.join("") || "0", decimal: n };
  }

  /** The beads that show a digit d on a wire (the inverse of value), for the tutor and tests. */
  function setDigit(s, i, d) {
    if (!(i >= 0 && i < s.wires.length) || !(Number.isInteger(d) && d >= 0 && d < s.radix)) return null;
    const half = s.radix / 2, wires = s.wires.map((w) => ({ earth: w.earth.slice(), heaven: w.heaven }));
    const ones = d % half, heaven = d >= half;
    wires[i] = { earth: wires[i].earth.map((_, j) => j >= wires[i].earth.length - ones), heaven };
    return { ...s, wires };
  }

  return { RADICES, WIRES, DIGITS, start, value, click, reading, setDigit };
})();
