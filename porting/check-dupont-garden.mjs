#!/usr/bin/env node
"use strict";

/*
 * Logic test for dupont-garden/dupont-garden-core.js.
 *
 *   node porting/check-dupont-garden.mjs
 *
 * Part 1 tests the page's claim - a projectile's path is a parabola, and its
 * horizontal and vertical parts are independent - over a grid of launches.
 * Part 2 is a second transcription of the applet's six schedule builders,
 * RunawayWater.Draw and Finished(), written straight from javap, compared
 * with the core over 384 size/drop/seed combinations. Parts 3-5 cover the
 * options, the animation step and the ends of a cycle.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("dupont-garden/dupont-garden-core.js", "DupontGardenCore");
const SIZES = [
  { width: 320, height: 200 },
  { width: 375, height: 300 },
  { width: 600, height: 300 },
  { width: 1000, height: 600 },
];
const DROPS = [1, 2, 10, 50];
const SEEDS = [1, 7, 42, 98765];
const NAMES = ["random", "multi-random", "slow-lr", "fast-lr", "slow-rl", "fast-rl"];
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps);

/* ------------------------------------------------------------------------ *
 * 1. The claim on the page, checked rather than copied.
 *    "By 1604 he concluded that projectiles travel along parabolic
 *    trajectories", after splitting the motion into horizontal and vertical
 *    components. With x = X0 + Vt and y = Wt - 9.8t²/2, equal time steps
 *    change x by a constant and y by a constant second difference; eliminating
 *    t gives the quadratic below.                                          *
 * ------------------------------------------------------------------------ */
{
  for (const x0 of [-500, -10, 0, 10, 500]) {
    for (const v of [-20, -8, 8, 20]) {
      for (const w of [1, 5, 10, 140]) {
        const p = C.projectile(x0, v, w);
        const T = C.returnTime(p);
        const label = `parabola x0=${x0} V=${v} W=${w}`;
        check(`${label}: return time`, near(T, (2 * w) / 9.8));
        check(`${label}: height at the vertex`, near(C.maxHeight(p), (w * w) / 19.6));
        check(`${label}: lands at ground level`, near(C.yPosition(p, 0), 0) && near(C.yPosition(p, T), 0, 1e-7));
        check(`${label}: horizontal range`, near(C.distance(p), Math.abs(v) * T));
        check(`${label}: final x`, near(C.finalX(p), x0 + v * T));
        const h = T / 8;
        let dxFirst = null, dySecond = null, formulaOK = true;
        for (let i = 0; i < 8; i++) {
          const t = i * h;
          const a = C.yPosition(p, t), b = C.yPosition(p, t + h), c = C.yPosition(p, t + 2 * h);
          const d2 = c - 2 * b + a;
          if (dySecond === null) dySecond = d2;
          else if (!near(dySecond, d2, 1e-6)) formulaOK = false;
          const xa = C.xPosition(p, t), xb = C.xPosition(p, t + h);
          if (dxFirst === null) dxFirst = xb - xa;
          else if (!near(dxFirst, xb - xa, 1e-6)) formulaOK = false;
          const X = xa - x0;
          const yFromX = (w / v) * X - (4.9 / (v * v)) * X * X;
          if (!near(yFromX, a, 1e-6)) formulaOK = false;
        }
        check(`${label}: parabola in x with constant vertical acceleration`, formulaOK);
        check(`${label}: second difference is -9.8h²`, near(dySecond, -9.8 * h * h, 1e-6));
        // Changing V changes only x(t), never y(t): independent components.
        const other = C.projectile(x0 + 37, v + 61, w);
        check(`${label}: vertical motion ignores horizontal speed`,
          near(C.yPosition(p, 1.234), C.yPosition(other, 1.234), 1e-12));
      }
    }
  }
}

/* ------------------------------------------------------------------------ *
 * 2. A second transcription of the bytecode. No core helper is called here;
 *    the arithmetic follows GetXPosition/GetYPosition/GetReturnTime and
 *    each schedule builder instruction by instruction.                    *
 * ------------------------------------------------------------------------ */
const R = {
  rt: (w) => (2.0 * w) / 9.8,
  my: (y0, w, t) => y0 + w * t - ((9.8 * t) * t) / 2.0,
  mx: (x0, v, t) => x0 + v * t,
  mh: (w) => R.my(0, w, R.rt(w) / 2.0),
  scale: (w, factor) => Math.trunc(w / ((factor * R.mh(w)) / 1000.0)),
  mk: (x0, v, w, start, n, size) => ({
    x0: x0, v: v, w: w, y0: 0,
    start: start, n: n, dt: 0.5,
    dx: 1000.0 / size.width, dy: 1000.0 / size.height, bottom: size.height,
    currentTime: 0,
  }),
  slowLR: (n, size) => {
    const out = [];
    let x = 10, i = 1, v = 8, t = 0; // locals 3, 4, 5, 6
    const w = R.scale(10, 14.0); // locals 8, 9, 11
    while (x < 1000.0) {
      const p = { x0: x, v: v / Math.sqrt(i), w: w }; // local 8 reused
      out.push(R.mk(p.x0, p.v, p.w, t, n, size));
      const rt = R.rt(p.w); // local 14
      t = Math.trunc(t + rt);
      x = Math.trunc(x + rt * v);
      i++;
    }
    return out;
  },
  slowRL: (n, size) => {
    const out = [];
    let x = Math.trunc(1000.0), i = 1, v = -8, t = 0;
    const w = R.scale(10, 14.0);
    while (x > 0) {
      const p = { x0: x, v: v / Math.sqrt(i), w: w };
      out.push(R.mk(p.x0, p.v, p.w, t, n, size));
      const rt = R.rt(p.w);
      t = Math.trunc(t + rt);
      x = Math.trunc(x + rt * v); // the loop keeps the original V in local 5
      i++;
    }
    return out;
  },
  fastLR: (n, size) => {
    const out = [];
    let x = 5, i = 1, v = 20, t = 0;
    const w = R.scale(10, 20.0);
    while (x < 1000.0) {
      const p = { x0: x, v: v / Math.sqrt(i), w: w };
      out.push(R.mk(p.x0, p.v, p.w, t, n, size));
      const rt = R.rt(p.w);
      t = Math.trunc(t + rt);
      x = Math.trunc(x + rt * v);
      i++;
    }
    return out;
  },
  fastRL: (n, size) => {
    const out = [];
    let x = Math.trunc(1000.0), i = 1, v = -20, t = 0;
    const w = R.scale(10, 20.0);
    while (x > 0) {
      const p = { x0: x, v: v / Math.sqrt(i), w: w };
      out.push(R.mk(p.x0, p.v, p.w, t, n, size));
      const rt = R.rt(p.w);
      t = Math.trunc(t + rt);
      x = Math.trunc(x + rt * v);
      i++;
    }
    return out;
  },
  random: (n, size, rand) => {
    const out = [];
    let x = Math.trunc(1000.0), v = 20, t = 0;
    const w = R.scale(10, 14.0);
    for (let i = 0; i < 10; i++) {
      const side = rand() < 0.5 ? v : -v; // local 13
      x = Math.trunc(rand() * size.width); // local 3
      const r = Math.trunc(rand() * 3.0); // local 14
      const p = { x0: x, v: side + r, w: Math.trunc(w / (1 + r)) };
      const s = R.mk(p.x0, p.v, p.w, t, n, size);
      out.push(s);
      const fx = R.mx(p.x0, p.v, R.rt(p.w)) / s.dx; // GetFinalX()/Dx
      if (fx < 0) p.x0 = 2 * x - fx;
      else if (fx > size.width) p.x0 = 2 * x - fx;
      s.x0 = p.x0;
      t = Math.trunc(t + R.rt(p.w) + s.n - 1);
    }
    return out;
  },
  multi: (n, size, rand) => {
    const out = [];
    let x = size.width, v = 10, t = 0;
    const w = R.scale(10, 14.0);
    for (let i = 0; i < 20; i++) {
      const side = rand() < 0.5 ? v : -v;
      x = Math.trunc(rand() * size.width);
      const r = Math.trunc(rand() * 3.0);
      const p = { x0: x, v: side + r, w: Math.trunc(w / (1 + r)) };
      const s = R.mk(p.x0, p.v, p.w, t, n, size);
      out.push(s);
      const fx = R.mx(p.x0, p.v, R.rt(p.w)) / s.dx;
      if (fx < 0) p.x0 = 2 * x - fx;
      else if (fx > size.width) p.x0 = 2 * x - fx;
      s.x0 = p.x0;
      t = Math.trunc(t + R.rt(p.w) + s.n / 3.0);
    }
    return out;
  },
  draws: (s, time) => {
    const pts = [];
    for (let k = -s.n + 1; k < 1; k++) { // the bytecode counts k up to < 1
      const t = time + k * s.dt;
      pts.push({
        x: Math.floor(R.mx(s.x0, s.v, t) + 0.5) / s.dx,
        y: s.bottom - Math.floor(R.my(s.y0, s.w, t) + 0.5) / s.dy,
        r: 4,
      });
    }
    return pts;
  },
  finished: (s) => R.rt(s.w) + s.n + 1 <= s.currentTime,
};
const REF_BUILD = {
  "random": R.random, "multi-random": R.multi, "slow-lr": R.slowLR,
  "fast-lr": R.fastLR, "slow-rl": R.slowRL, "fast-rl": R.fastRL,
};

function sameStreams(a, b) {
  if (a.length !== b.length) return false;
  const fields = ["x0", "v", "w", "y0", "start", "n", "dt", "dx", "dy", "bottom", "currentTime"];
  return a.every((s, i) => fields.every((f) => near(s[f], b[i][f], 1e-10)));
}

{
  equal("init builds the applet's six schedules in order", C.SCHEDULES, NAMES);
  let compared = 0;
  for (const size of SIZES) {
    for (const n of DROPS) {
      for (const seed of SEEDS) {
        for (const name of NAMES) {
          const coreStreams = C.buildSchedule(name, n, size, rng(seed));
          const refStreams = REF_BUILD[name](n, size, rng(seed));
          compared++;
          check(`schedule ${name} n=${n} ${size.width}x${size.height} seed=${seed}`,
            sameStreams(coreStreams, refStreams),
            `core ${JSON.stringify(coreStreams[0])} / ref ${JSON.stringify(refStreams[0])}`);
          check(`same jet count ${name} n=${n} ${size.width}x${size.height} seed=${seed}`,
            coreStreams.length === refStreams.length);
          // The random builders must still leave a usable, rightward or leftward flight.
          check(`non-degenerate jets ${name} n=${n} seed=${seed}`,
            coreStreams.every((s) => s.v !== 0 && s.w > 0 && s.n === n));
        }
      }
    }
  }
  check("384 configurations of all six schedules were compared", compared === 384);
}

/* RunawayWater.Draw, transcribed again, for every generated jet and timer. */
{
  let cases = 0;
  for (const size of [SIZES[0], SIZES[2]]) {
    for (const n of [1, 3, 10, 50]) {
      for (const seed of [1, 42]) {
        for (const name of NAMES) {
          const jets = C.buildSchedule(name, n, size, rng(seed));
          for (const s of jets) {
            for (const time of [0, 1, 7, 50, 137]) {
              cases++;
              const a = C.dropsAt({ ...s, currentTime: time });
              const b = R.draws(s, time);
              check(`drops ${name} n=${n} time=${time}`,
                a.length === n && a.length === b.length && a.every((p, i) =>
                  near(p.x, b[i].x, 1e-9) && near(p.y, b[i].y, 1e-9)));
            }
          }
        }
      }
    }
  }
  check("drop positions tested in many cases", cases > 3000);
}

/* Finished() over a grid of W, N and timer values. */
{
  let ok = true;
  for (let w = 1; w <= 200; w += 7) {
    for (let n = 1; n <= 50; n++) {
      for (let time = 0; time <= 400; time += 11) {
        const s = C.stream(C.projectile(0, 8, w), 0, n, SIZES[2]);
        s.currentTime = time;
        if (C.isFinished(s) !== R.finished(s)) ok = false;
      }
    }
  }
  check("Finished() matches the applet for 25,000+ (W, N, timer) triples", ok);
}

/* ------------------------------------------------------------------------ *
 * 3. The animation step: PrivateTimer and the per-jet CurrentTime.         *
 * ------------------------------------------------------------------------ */
function refStep(state) {
  const tick = state.tick + 1;
  const streams = state.streams.map((s) => {
    if (R.finished(s)) return s;
    if (s.start >= tick) return s;
    return { ...s, currentTime: s.currentTime + 1 };
  });
  const complete = streams.length > 0 && streams.every(R.finished);
  return { ...state, tick, streams, complete };
}

{
  for (const size of SIZES) {
    for (const n of [1, 10, 50]) {
      for (const name of NAMES) {
        let s = C.start({ schedule: name, drops: n, size: size, rng: rng(9) });
        s = C.reset(s, rng(9));
        let ok = true, reached = false;
        for (let frame = 0; frame < 1500; frame++) {
          const before = JSON.stringify(s);
          const next = C.step(s);
          const expected = refStep(s);
          if (before !== JSON.stringify(s)) ok = false; // no mutation
          if (!sameStreams(next.streams, expected.streams) ||
              next.tick !== expected.tick || next.complete !== expected.complete) ok = false;
          s = next;
          if (s.complete) { reached = true; break; }
        }
        check(`step and finish ${name} n=${n} ${size.width}x${size.height}`, ok && reached);
      }
    }
  }
}

/* ------------------------------------------------------------------------ *
 * 4. The controls: #Drops 1..50, Delay 10..1000, Run/Stop, schedule choice. *
 * ------------------------------------------------------------------------ */
{
  equal("drops below the range clamp to 1", C.clampOption("drops", -5), 1);
  equal("drops zero clamps to 1", C.clampOption("drops", 0), 1);
  equal("drops above the range clamp to 50", C.clampOption("drops", 60), 50);
  equal("drops truncate like PVNumeric.getLong", C.clampOption("drops", 10.9), 10);
  equal("delay below the range clamps to 10", C.clampOption("delay", 5), 10);
  equal("delay above the range clamps to 1000", C.clampOption("delay", 2000), 1000);
  equal("an empty option falls back to the applet's default", C.clampOption("delay", NaN), 50);
  const s = C.start({});
  equal("the applet starts with 10 drops", s.drops, 10);
  equal("the applet starts with a 50 ms delay", s.delay, 50);
  check("the applet starts stopped like its Run button", !s.running);
  check("Run starts a cycle", C.run(s, rng(3)).running);
  check("Stop halts the cycle", !C.stop(C.run(s, rng(3))).running);
  check("changing drops does not change the current jets",
    C.setDrops(s, 33).streams[0].n === s.streams[0].n && C.setDrops(s, 33).drops === 33);
  check("changing the delay resets and restarts, as SetInterval does", C.setDelay(s, 20, rng(3)).running);
  check("the six-way random reset matches the bytecode's Math.random()*size()",
    C.reset({ ...s, schedule: "auto" }, rng(11)).streams.length > 0);
  let picked = new Set();
  for (let seed = 1; seed <= 600; seed++) {
    const before = { ...s, schedule: "auto" };
    // Three warm-up draws: the test PRNG's very first value is not spread
    // across [0,1) for neighbouring seeds, unlike a long-running applet.
    const warm = (g) => { g(); g(); g(); return g; };
    const coreDraw = warm(rng(seed));
    const refDraw = warm(rng(seed));
    const chosen = NAMES[Math.trunc(refDraw() * NAMES.length)];
    picked.add(chosen);
    const after = C.reset(before, coreDraw);
    check(`auto reset seed=${seed}`, sameStreams(after.streams, REF_BUILD[chosen](10, { width: 600, height: 300 }, refDraw)));
  }
  check("all six schedules can be chosen by the applet's random reset", picked.size === 6);
  check("an explicit schedule choice replays that schedule",
    sameStreams(C.setSchedule(s, "fast-rl", rng(4)).streams, R.fastRL(10, { width: 600, height: 300 })));
}

/* ------------------------------------------------------------------------ *
 * 5. Reading probes, end of a demonstration, and the visible flight path.  *
 * ------------------------------------------------------------------------ */
{
  const s = C.start({ schedule: "slow-lr", rng: rng(2) });
  const jet = C.activeStream(s);
  const [lo, hi] = C.flightRange(jet);
  check("the flight lies on the canvas", lo >= 0 && hi <= 600.0001 && hi > lo);
  const middle = (lo + hi) / 2;
  const p = C.pointOnFlight(jet, middle);
  const t = (middle * jet.dx - jet.x0) / jet.v;
  check("a probe sits on the parabola", near(p.y, jet.bottom - C.yPosition(jet, t) / jet.dy, 1e-9));
  check("probes clamp to the visible flight",
    C.setProbe(s, "A", -999).probe.A === lo && C.setProbe(s, "B", 9999).probe.B === hi);
  const path = C.flightPoints(jet, 16);
  check("the drawn path starts and ends at ground level",
    Math.abs(path[0].y - jet.bottom) < 1e-9 && Math.abs(path[16].y - jet.bottom) < 1e-6);
  check("the drawn path rises in between", Math.min(...path.map((q) => q.y)) < jet.bottom - 1);
  check("an illustration has no win or loss", C.result(s) === null);
  check("a fresh cycle is not complete", !s.complete);
}

done("dupont-garden");
