"use strict";

/*
 * Dupont Garden, from Alexander Bogomolny's Java applet DupontGarden.
 *
 * The applet animates jumping jets of water: each jet is a projectile with
 * horizontal speed V and vertical speed W under gravity g = 9.8, so its path
 * is y = Wt - gt²/2 while x = X0 + Vt. Eliminating t gives a parabola. The
 * code below transcribes the applet's six jet schedules, its drop positions,
 * its 1..50 drops and 10..1000 ms delay options, and its Run/Stop behaviour.
 * It also adds two non-changing probes on the visible flight path: those are
 * only for reading the graph, never for changing the water.
 *
 * No document, no window, no storage: one global, DupontGardenCore. Every
 * function takes a plain-data position and returns a new one.
 */
const DupontGardenCore = (() => {
  const G = 9.8;
  const BIG_X = 1000; // the applet's fixed model width
  const BIG_Y = 1000; // the applet's fixed model height
  const WIDTH = 600; // page's <APPLET WIDTH=600 HEIGHT=300>
  const HEIGHT = 300;
  const RADIUS = 4; // Projectile.R
  const DT = 0.5; // RunawayWater.Dt
  const LIMITS = {
    drops: { min: 1, max: 50, initial: 10 },
    delay: { min: 10, max: 1000, initial: 50 },
  };
  // The order in DupontGardenCanvas.init(): reset() picks one of these at random.
  const SCHEDULES = ["random", "multi-random", "slow-lr", "fast-lr", "slow-rl", "fast-rl"];

  /* Java's numeric conversions, needed where the bytecode uses i2d / d2i. */
  const jInt = (x) => Math.trunc(x); // d2i: truncate towards zero
  const jRound = (x) => Math.floor(x + 0.5); // Math.round(double)
  const jDiv = (a, b) => jInt(a / b); // int / int

  function clampOption(name, value) {
    const range = LIMITS[name];
    const n = Number(value);
    if (!Number.isFinite(n)) return range.initial;
    return Math.min(range.max, Math.max(range.min, jInt(n)));
  }

  /* ------------------------------------------------------------ Projectile */

  function projectile(x0, v, w, y0) {
    return { x0: x0, v: v, w: w, y0: y0 === undefined ? 0 : y0 };
  }
  const xPosition = (p, t) => p.x0 + p.v * t;
  const yPosition = (p, t) => p.y0 + p.w * t - (9.8 * t * t) / 2;
  const returnTime = (p) => (2 * p.w) / 9.8;
  const maxHeight = (p) => yPosition(p, returnTime(p) / 2);
  const distance = (p) => Math.abs(p.v * returnTime(p));
  const finalX = (p) => p.x0 + p.v * returnTime(p);

  /* --------------------------------------------------------- RunawayWater */

  function stream(p, start, n, size) {
    const w = (size && size.width) || WIDTH;
    const h = (size && size.height) || HEIGHT;
    return {
      x0: p.x0, v: p.v, w: p.w, y0: p.y0,
      start: start, n: n, dt: DT,
      dx: BIG_X / w, dy: BIG_Y / h, bottom: h,
      currentTime: 0,
    };
  }
  const isFinished = (s) => returnTime(s) + s.n + 1 <= s.currentTime;

  /** The applet's Draw loop, for k = -N+1 .. 0: positions in canvas pixels. */
  function dropsAt(s) {
    const out = [];
    for (let k = -s.n + 1; k < 1; k++) {
      const t = s.currentTime + k * s.dt;
      out.push({
        x: jRound(xPosition(s, t)) / s.dx,
        y: s.bottom - jRound(yPosition(s, t)) / s.dy,
        r: RADIUS,
      });
    }
    return out;
  }

  /** Where a flight crosses a given canvas x, for the two reading probes. */
  function pointOnFlight(s, canvasX) {
    const t = (canvasX * s.dx - s.x0) / s.v;
    return { x: canvasX, y: s.bottom - yPosition(s, t) / s.dy };
  }
  function flightRange(s) {
    const a = s.x0 / s.dx;
    const b = finalX(s) / s.dx;
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.min(s.bottom * 2, Math.max(a, b));
    return hi > lo + 1 ? [lo, hi] : [0, s.bottom * 2];
  }
  function flightPoints(s, count) {
    const steps = count || 48;
    const tMax = returnTime(s);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = (tMax * i) / steps;
      pts.push({ x: xPosition(s, t) / s.dx, y: s.bottom - yPosition(s, t) / s.dy });
    }
    return pts;
  }

  /* ----------------------------------------------------------- schedules */

  /** The applet scales W from a reference projectile before each schedule. */
  function scaleW(w, factor) {
    return jInt(w / ((factor * maxHeight(projectile(0, 0, w))) / BIG_Y));
  }
  function makeStream(x, w, start, v, drops, size) {
    return stream(projectile(x, v, w), start, drops, size);
  }

  /* SlowScheduleLR: X=10, V=8, Dt=0.5, W scaled by 14, jets to the right. */
  function slowLR(drops, size) {
    const out = [];
    let x = 10, dir = 1, v = 8, t = 0;
    const w = scaleW(10, 14);
    while (x < BIG_X) {
      const p = projectile(x, v / Math.sqrt(dir), w);
      out.push(stream(p, t, drops, size));
      const rt = returnTime(p);
      t = jInt(t + rt);
      x = jInt(x + rt * v);
      dir++;
    }
    return out;
  }
  /* SlowScheduleRL: X=(int)BigX, V=-8, jets to the left. */
  function slowRL(drops, size) {
    const out = [];
    let x = jInt(BIG_X), dir = 1, v = -8, t = 0;
    const w = scaleW(10, 14);
    while (x > 0) {
      const p = projectile(x, v / Math.sqrt(dir), w);
      out.push(stream(p, t, drops, size));
      const rt = returnTime(p);
      t = jInt(t + rt);
      x = jInt(x + rt * v);
      dir++;
    }
    return out;
  }
  /* FastScheduleLR: X=5, V=20, W scaled by 20. */
  function fastLR(drops, size) {
    const out = [];
    let x = 5, dir = 1, v = 20, t = 0;
    const w = scaleW(10, 20);
    while (x < BIG_X) {
      const p = projectile(x, v / Math.sqrt(dir), w);
      out.push(stream(p, t, drops, size));
      const rt = returnTime(p);
      t = jInt(t + rt);
      x = jInt(x + rt * v);
      dir++;
    }
    return out;
  }
  /* FastScheduleRL: X=(int)BigX, V=-20. */
  function fastRL(drops, size) {
    const out = [];
    let x = jInt(BIG_X), dir = 1, v = -20, t = 0;
    const w = scaleW(10, 20);
    while (x > 0) {
      const p = projectile(x, v / Math.sqrt(dir), w);
      out.push(stream(p, t, drops, size));
      const rt = returnTime(p);
      t = jInt(t + rt);
      x = jInt(x + rt * v);
      dir++;
    }
    return out;
  }
  /* Random(): ten jets from random pixels, with an edge fix-up on X0. */
  function randomSchedule(drops, size, rng) {
    const rand = rng || Math.random;
    const width = (size && size.width) || WIDTH;
    const out = [];
    let x = jInt(BIG_X), v = 20, t = 0;
    const w = scaleW(10, 14);
    for (let i = 0; i < 10; i++) {
      const side = rand() < 0.5 ? v : -v;
      x = jInt(rand() * width);
      const r = jInt(rand() * 3);
      const p = projectile(x, side + r, jDiv(w, 1 + r));
      const s = stream(p, t, drops, size);
      out.push(s);
      const fx = finalX(p) / s.dx;
      if (fx < 0) p.x0 = 2 * x - fx;
      else if (fx > width) p.x0 = 2 * x - fx;
      s.x0 = p.x0;
      t = jInt(t + returnTime(p) + s.n - 1);
    }
    return out;
  }
  /* MultiRandom(): twenty jets; starts are spaced by T + N/3. */
  function multiRandom(drops, size, rng) {
    const rand = rng || Math.random;
    const width = (size && size.width) || WIDTH;
    const out = [];
    let x = width, v = 10, t = 0;
    const w = scaleW(10, 14);
    for (let i = 0; i < 20; i++) {
      const side = rand() < 0.5 ? v : -v;
      x = jInt(rand() * width);
      const r = jInt(rand() * 3);
      const p = projectile(x, side + r, jDiv(w, 1 + r));
      const s = stream(p, t, drops, size);
      out.push(s);
      const fx = finalX(p) / s.dx;
      if (fx < 0) p.x0 = 2 * x - fx;
      else if (fx > width) p.x0 = 2 * x - fx;
      s.x0 = p.x0;
      t = jInt(t + returnTime(p) + s.n / 3);
    }
    return out;
  }

  const BUILDERS = {
    "random": randomSchedule,
    "multi-random": multiRandom,
    "slow-lr": slowLR,
    "fast-lr": fastLR,
    "slow-rl": slowRL,
    "fast-rl": fastRL,
  };
  function buildSchedule(name, drops, size, rng) {
    const build = BUILDERS[name] || slowLR;
    return build(drops, size, rng);
  }

  function initialProbes(streams) {
    const s = streams[0];
    const [lo, hi] = flightRange(s);
    return { A: lo + (hi - lo) * 0.25, B: lo + (hi - lo) * 0.75 };
  }

  /* ---------------------------------------------------------------- state */

  function start(options) {
    const o = options || {};
    const drops = clampOption("drops", o.drops === undefined ? LIMITS.drops.initial : o.drops);
    const delay = clampOption("delay", o.delay === undefined ? LIMITS.delay.initial : o.delay);
    const name = o.schedule === undefined || !BUILDERS[o.schedule] ? "auto" : o.schedule;
    const streams = buildSchedule(name === "auto" ? "slow-lr" : name, drops, o.size, o.rng);
    return {
      schedule: name, drops: drops, delay: delay, size: o.size ? { width: o.size.width, height: o.size.height } : null,
      running: false, tick: -1, streams: streams, cycle: 0, complete: false,
      probe: initialProbes(streams),
    };
  }

  /** reset(): as in the applet, "auto" draws one of its six schedules uniformly. */
  function reset(state, rng) {
    const rand = rng || Math.random;
    const name = state.schedule === "auto" ? SCHEDULES[jInt(rand() * SCHEDULES.length)] : state.schedule;
    const streams = buildSchedule(name, state.drops, state.size, rand);
    return {
      ...state, schedule: state.schedule, streams: streams, tick: -1,
      running: true, complete: false, cycle: state.cycle + 1, probe: initialProbes(streams),
    };
  }

  const run = (state, rng) => (state.running ? state : reset(state, rng));
  const stop = (state) => ({ ...state, running: false });

  function setDrops(state, value) {
    return { ...state, drops: clampOption("drops", value) }; // applied on the next reset
  }
  function setDelay(state, value, rng) {
    const delay = clampOption("delay", value);
    return reset({ ...state, delay: delay }, rng); // SetInterval sets ShouldReset
  }
  function setSchedule(state, name, rng) {
    const key = BUILDERS[name] ? name : "auto";
    const streams = buildSchedule(key === "auto" ? "slow-lr" : key, state.drops, state.size, rng);
    return {
      ...state, schedule: key, streams: streams, tick: -1, running: false,
      complete: false, probe: initialProbes(streams),
    };
  }

  /**
   * One repaint: PrivateTimer increases by one; each unfinished jet whose
   * start time has passed gets one more drop. Drop positions use that timer.
   */
  function step(state) {
    const tick = state.tick + 1;
    const streams = state.streams.map((s) =>
      isFinished(s) || s.start >= tick ? s : { ...s, currentTime: s.currentTime + 1 });
    const complete = streams.length > 0 && streams.every(isFinished);
    return { ...state, tick: tick, streams: streams, complete: complete };
  }

  function setProbe(state, name, canvasX) {
    const s = activeStream(state);
    const [lo, hi] = flightRange(s);
    const key = name === "B" ? "B" : "A";
    return { ...state, probe: { ...state.probe, [key]: Math.min(hi, Math.max(lo, canvasX)) } };
  }
  function activeStream(state) {
    return state.streams.find((s) => !isFinished(s)) || state.streams[0];
  }
  const result = () => null; // an illustration: nothing to win or lose

  return {
    G, BIG_X, BIG_Y, WIDTH, HEIGHT, RADIUS, DT, LIMITS, SCHEDULES,
    clampOption, projectile, xPosition, yPosition, returnTime, maxHeight, distance, finalX,
    jInt, jRound, jDiv, stream, isFinished, dropsAt, pointOnFlight, flightRange, flightPoints,
    scaleW, slowLR, slowRL, fastLR, fastRL, randomSchedule, multiRandom, buildSchedule,
    start, reset, run, stop, setDrops, setDelay, setSchedule, step, setProbe, activeStream,
    result,
  };
})();
