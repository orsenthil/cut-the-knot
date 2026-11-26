"use strict";

/*
 * Suan Pan in Various Number Systems, from Alexander Bogomolny's applet
 * SuanPan.
 *
 * The Chinese suan pan has, on every wire, five beads below the bar (earth,
 * worth one each) and two above it (heaven, worth five each), so a wire can
 * hold anything from 0 to 15, more than a digit needs: one bead in each
 * region is redundant. In an even base r the earth holds r/2 beads and each
 * heaven bead is worth r/2. The applet tidies up after you: when all the
 * earth beads are up they are traded for a heaven bead, and two heaven
 * beads down are traded for one bead carried to the next wire, each after a
 * short pause so you can see it happen.
 *
 * Transcribed from SuanPanDevice$Wire. Beads: earth 0 (far from the bar) ..
 * r/2 - 1 (next to it); heaven 0 next to the bar, heaven 1 above it. A click
 * on an earth bead works as on the soroban; on a heaven bead at the bar it
 * lifts that bead and the one beyond, away from it it lowers it and the one
 * between. CheckForAlerts then starts a countdown of AlertMax = 6 ticks
 * (200 ms each): all earth beads up with no heaven bead becomes a heaven
 * bead (FiveDown); all earth up with one heaven bead becomes two heaven
 * beads (TenDown) and then a carry; two heaven beads become a carry: one
 * bead added to the wire on the left (AddOne) as the two are lifted.
 *
 * Three slips in the applet are mended, because they lose value: FiveDown
 * is never cleared, so a later carry on that wire puts a heaven bead back
 * down instead of lifting both; a carry also wipes the wire's earth beads,
 * though only the heaven beads were carried; and only the rightmost busy
 * wire is checked for its carry each tick, so a carry on another wire is
 * dropped. Here each flag is cleared once acted on, a carry lifts only the
 * heaven beads, and every wire is checked, right to left.
 * When the leftmost wire carries, the carry is lost, as on the real device.
 *
 * Radix 2..20 (even, 10 to start), 1..10 wires (7 to start).
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SuanPanCore. The position is plain data.
 */
const SuanPanCore = (() => {
  const RADICES = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  const WIRES = { min: 1, max: 10, def: 7 };
  const ALERT_MAX = 6, TICK_MS = 200;
  const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const blankWire = (r) => ({ earth: new Array(r / 2).fill(false), heaven: [false, false], alert: 0, fiveDown: false, tenDown: false, carry: false });

  function start(options = {}) {
    const radix = RADICES.includes(Number(options.radix)) ? Number(options.radix) : 10;
    const w = Math.round(Number(options.wires ?? WIRES.def));
    const n = Number.isFinite(w) ? Math.max(WIRES.min, Math.min(WIRES.max, w)) : WIRES.def;
    return { radix, wires: Array.from({ length: n }, () => blankWire(radix)) };
  }

  const copy = (s) => ({ ...s, wires: s.wires.map((w) => ({ ...w, earth: w.earth.slice(), heaven: w.heaven.slice() })) });

  /** Wire.Value: earth beads up plus r/2 for each heaven bead down (0 .. 3r/2). */
  function value(s, i) {
    const w = s.wires[i], half = s.radix / 2;
    const first = w.earth.indexOf(true);
    return (first >= 0 ? half - first : 0) + half * (w.heaven[0] ? 1 : 0) + half * (w.heaven[1] ? 1 : 0);
  }

  /** CheckForAlerts. */
  function checkForAlerts(w) {
    if (w.earth[0]) {
      w.alert = ALERT_MAX;
      if (w.heaven[0]) { w.tenDown = true; w.fiveDown = false; }
      else w.fiveDown = true;
    }
    if (w.heaven[1]) { w.carry = true; w.alert = ALERT_MAX; }
  }

  /** CheckBone on bead `bead` of wire i: an earth index, or "h0" / "h1". */
  function click(s, i, bead) {
    if (!(i >= 0 && i < s.wires.length)) return null;
    const t = copy(s), w = t.wires[i];
    if (bead === "h0" || bead === "h1") {
      const k = bead === "h0" ? 0 : 1;
      if (w.heaven[k]) for (let j = k; j < 2; j++) w.heaven[j] = false;
      else for (let j = 0; j <= k; j++) w.heaven[j] = true;
    } else {
      const k = Number(bead);
      if (!(Number.isInteger(k) && k >= 0 && k < w.earth.length)) return null;
      if (w.earth[k]) for (let j = 0; j <= k; j++) w.earth[j] = false;
      else for (let j = k; j < w.earth.length; j++) w.earth[j] = true;
    }
    checkForAlerts(w);
    return t;
  }

  /** AdjustAlert, with each flag cleared once acted on. */
  function adjustAlert(w) {
    if (w.alert <= 0) return;
    w.alert -= 1;
    if (w.alert !== 0) return;
    if (w.fiveDown) { w.heaven[0] = true; w.fiveDown = false; w.earth.fill(false); }
    else if (w.tenDown) { w.heaven[1] = true; w.alert = ALERT_MAX; w.carry = true; w.tenDown = false; w.earth.fill(false); }
    else if (w.carry) { w.heaven[0] = false; w.heaven[1] = false; w.carry = false; }
  }

  /** AddOne: the next earth bead up (from the bar outwards), then the checks. */
  function addOne(w) {
    for (let k = w.earth.length - 1; k >= 0; k--) {
      if (!w.earth[k]) { w.earth[k] = true; checkForAlerts(w); return true; }
    }
    return false;
  }

  /** One 200 ms tick of the run loop: carries (right to left), then every wire's countdown. */
  function tick(s) {
    const t = copy(s);
    for (let i = t.wires.length - 1; i >= 0; i--) {
      const w = t.wires[i];
      if (w.alert > 0 && w.carry && w.alert === 1) {
        if (i >= 1 && !addOne(t.wires[i - 1])) {
          // the wire on the left is full of earth beads waiting to be traded: wait a tick
          continue;
        }
        adjustAlert(w);
        w.carry = false;
      }
    }
    t.wires.forEach(adjustAlert);
    return t;
  }

  const busy = (s) => s.wires.some((w) => w.alert > 0);

  /** Ticks until everything is tidied (bounded). */
  function settle(s, max = 1000) {
    let t = s;
    for (let k = 0; k < max && busy(t); k++) t = tick(t);
    return t;
  }

  function total(s) {
    return s.wires.reduce((n, _, i) => n * s.radix + value(s, i), 0);
  }

  /** The digits under the wires, leading zeros blank; a wire worth r or more shows a two-digit value in brackets. */
  function reading(s) {
    let started = false;
    const digits = s.wires.map((_, i) => {
      const v = value(s, i);
      if (!v && !started) return "";
      started = true;
      return v < s.radix ? DIGITS[v] : `(${DIGITS[Math.floor(v / s.radix)]}${DIGITS[v % s.radix]})`;
    });
    return { digits, decimal: total(s) };
  }

  return { RADICES, WIRES, ALERT_MAX, TICK_MS, DIGITS, start, value, click, tick, busy, settle, total, reading, checkForAlerts, adjustAlert };
})();
