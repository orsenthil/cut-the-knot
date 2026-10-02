"use strict";

/*
 * Pure point-vortex fluid simulation (no DOM), ported from Stephen
 * Montgomery-Smith's xscreensaver hack euler2d.c (2000), itself described in
 * his euler2d.tex. Everything here works with "domain coordinates": a swarm
 * of points living in the open unit disk, which the renderer then maps onto
 * the screen through a polynomial p (see below) or straight onto a circle.
 *
 * The physics: a handful of "vortex points" carry a fixed vorticity w_k and
 * drag every point x around them by the Biot-Savart law. On the whole plane
 * that law is u(x) = sum_k w_k (x-a_k)^perp / |x-a_k|^2. Confined to a disk,
 * each vortex also needs a mirror image reflected across the boundary
 * (a* = a/|a|^2) so that the flow never crosses the edge (u.n = 0 there) --
 * see derivs() below, which is the direct implementation of the K_2 kernel
 * from euler2d.tex section 3. Positions are advanced with the midpoint
 * method for the very first step and Adams-Bashforth (order 2) after that
 * (ode_solve() in the original C, odeSolve() here).
 *
 * To get boundaries more interesting than a plain disk, points in the unit
 * disk are pushed through a random bijective polynomial
 * p(z) = z + c_2 z^2 + ... + c_n z^n (sum k|c_k| = 1 keeps it injective).
 * The Biot-Savart kernel transported through p picks up a factor 1/|p'(z)|^2
 * (euler2d.tex section 3, "another example"); that's calcAllModDp2() below.
 */
const Euler2DCore = (() => {
  const DEG_P = 6; // degree of the boundary-shaping polynomial p
  const N_BOUND_P = 160; // points used to trace the boundary curve
  const NR_ROTATES = 18; // candidate rotations tried to best-fill the canvas
  const NUM_VORTEX_POINTS = 20;
  const MIN_POWER = 0.5;
  const MAX_POWER = 3.0;

  function rnd(v) {
    return Math.random() * v;
  } // uniform on [0, v)
  function balanced(v) {
    return Math.random() * v - v / 2;
  } // uniform on [-v/2, v/2)
  function nrand(n) {
    return Math.floor(Math.random() * n);
  } // uniform integer on [0, n)

  // Complex helpers: points are passed around as [re, im] pairs.
  function cMul(a, b) {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  }
  function cAdd(a, b) {
    return [a[0] + b[0], a[1] + b[1]];
  }

  // p(z) = z + c_2 z^2 + ... + c_deg z^deg, evaluated by Horner's method.
  function calcP(z1, z2, pCoef) {
    let p = [0, 0];
    const z = [z1, z2];
    for (let i = DEG_P; i >= 2; i--) {
      p = cAdd(p, [pCoef[(i - 2) * 2], pCoef[(i - 2) * 2 + 1]]);
      p = cMul(p, z);
    }
    p = cAdd(p, [1, 0]);
    p = cMul(p, z);
    return p;
  }

  // |p'(z)|^2, needed to transport the Biot-Savart kernel through p.
  function calcModDp2(z1, z2, pCoef) {
    let mp = [0, 0];
    const z = [z1, z2];
    for (let i = DEG_P; i >= 2; i--) {
      mp = cAdd(mp, [i * pCoef[(i - 2) * 2], i * pCoef[(i - 2) * 2 + 1]]);
      mp = cMul(mp, z);
    }
    mp = cAdd(mp, [1, 0]);
    return mp[0] * mp[0] + mp[1] * mp[1];
  }

  function calcAllP(sp) {
    for (let j = 0; j < sp.N; j++) {
      if (sp.dead[j]) continue;
      const [p1, p2] = calcP(sp.x[2 * j], sp.x[2 * j + 1], sp.pCoef);
      sp.p[2 * j] = p1;
      sp.p[2 * j + 1] = p2;
    }
  }

  function calcAllModDp2(xArr, sp) {
    for (let j = 0; j < sp.N; j++) {
      if (sp.dead[j]) continue;
      sp.modDp2[j] = calcModDp2(xArr[2 * j], xArr[2 * j + 1], sp.pCoef);
    }
  }

  // The right-hand side of the ODE: velocity at every point, induced by the
  // vortex points, via the (possibly power-law-generalized) Biot-Savart
  // kernel on the unit disk.
  function derivs(x, sp) {
    const power = sp.power;

    if (sp.variableBoundary) calcAllModDp2(sp.x, sp);

    for (let j = 0; j < sp.Nvortex; j++) {
      if (sp.dead[j]) continue;
      const nx = x[2 * j] * x[2 * j] + x[2 * j + 1] * x[2 * j + 1];
      if (nx < 1e-10) {
        sp.xIsZero[j] = 1;
      } else {
        sp.xIsZero[j] = 0;
        sp.xs[2 * j] = x[2 * j] / nx;
        sp.xs[2 * j + 1] = x[2 * j + 1] / nx;
      }
    }

    sp.diffx.fill(0);

    for (let i = 0; i < sp.N; i++) {
      if (sp.dead[i]) continue;
      const x1 = x[2 * i];
      const x2 = x[2 * i + 1];

      for (let j = 0; j < sp.Nvortex; j++) {
        if (sp.dead[j]) continue;

        // Direct term: the vortex at a=(x[2j],x[2j+1]) acting at (x1,x2).
        // Plane Biot-Savart is u = (x-a)^perp / |x-a|^2 (or its power-law
        // generalization |x-a|^-(power+1)); (dx,dy) -> (dy,-dx) is "perp".
        let xij1 = x1 - x[2 * j];
        let xij2 = x2 - x[2 * j + 1];
        let nxij = power === 1 ? xij1 * xij1 + xij2 * xij2 : Math.pow(xij1 * xij1 + xij2 * xij2, (power + 1) / 2);

        let u1, u2;
        if (nxij >= 1e-4) {
          u1 = xij2 / nxij;
          u2 = -xij1 / nxij;
        } else {
          u1 = 0;
          u2 = 0;
        }

        // Mirror term: subtract the same kernel for the reflection
        // a* = a/|a|^2, which cancels the flow across the unit circle.
        if (!sp.xIsZero[j]) {
          xij1 = x1 - sp.xs[2 * j];
          xij2 = x2 - sp.xs[2 * j + 1];
          nxij = power === 1 ? xij1 * xij1 + xij2 * xij2 : Math.pow(xij1 * xij1 + xij2 * xij2, (power + 1) / 2);

          if (nxij < 1e-5) {
            sp.dead[i] = 1;
            u1 = 0;
            u2 = 0;
          } else {
            u1 -= xij2 / nxij;
            u2 += xij1 / nxij;
          }
        }

        if (!sp.dead[i]) {
          sp.diffx[2 * i] += u1 * sp.w[j];
          sp.diffx[2 * i + 1] += u2 * sp.w[j];
        }
      }

      if (!sp.dead[i] && sp.variableBoundary) {
        if (sp.modDp2[i] < 1e-5) {
          sp.dead[i] = 1;
        } else {
          sp.diffx[2 * i] /= sp.modDp2[i];
          sp.diffx[2 * i + 1] /= sp.modDp2[i];
        }
      }
    }
  }

  // ret = x + k, except a point that would jump too far or leave the disk
  // is retired (dead) instead of corrupting the simulation with a blow-up.
  function perturb(ret, x, k, sp) {
    for (let i = 0; i < sp.N; i++) {
      if (sp.dead[i]) continue;
      const x1 = x[2 * i];
      const x2 = x[2 * i + 1];
      const k1 = k[2 * i];
      const k2 = k[2 * i + 1];
      if (k1 * k1 + k2 * k2 > 0.1 || x1 * x1 + x2 * x2 > 1 - 1e-5) {
        sp.dead[i] = 1;
      } else {
        ret[2 * i] = x1 + k1;
        ret[2 * i + 1] = x2 + k2;
      }
    }
  }

  function odeSolve(sp) {
    const n2 = sp.N * 2;
    if (sp.count < 1) {
      // Midpoint method, used only to bootstrap the first step.
      derivs(sp.x, sp);
      sp.olddiffx.set(sp.diffx);
      for (let i = 0; i < sp.N; i++) {
        if (sp.dead[i]) continue;
        sp.tempdiffx[2 * i] = 0.5 * sp.deltaT * sp.diffx[2 * i];
        sp.tempdiffx[2 * i + 1] = 0.5 * sp.deltaT * sp.diffx[2 * i + 1];
      }
      perturb(sp.tempx, sp.x, sp.tempdiffx, sp);
      derivs(sp.tempx, sp);
      for (let i = 0; i < sp.N; i++) {
        if (sp.dead[i]) continue;
        sp.tempdiffx[2 * i] = sp.deltaT * sp.diffx[2 * i];
        sp.tempdiffx[2 * i + 1] = sp.deltaT * sp.diffx[2 * i + 1];
      }
      perturb(sp.x, sp.x, sp.tempdiffx, sp);
    } else {
      // Adams-Bashforth, order 2: extrapolate from the last two velocities.
      derivs(sp.x, sp);
      for (let i = 0; i < sp.N; i++) {
        if (sp.dead[i]) continue;
        sp.tempdiffx[2 * i] = sp.deltaT * (1.5 * sp.diffx[2 * i] - 0.5 * sp.olddiffx[2 * i]);
        sp.tempdiffx[2 * i + 1] = sp.deltaT * (1.5 * sp.diffx[2 * i + 1] - 0.5 * sp.olddiffx[2 * i + 1]);
      }
      perturb(sp.x, sp.x, sp.tempdiffx, sp);
      const tmp = sp.olddiffx;
      sp.olddiffx = sp.diffx;
      sp.diffx = tmp;
    }
    void n2;
  }

  /*
   * Build the boundary polynomial p and figure out the rotation and scale
   * that make its image fill as much of the canvas as possible, mirroring
   * init_euler2d's "nr_rotates" search: sample the boundary at N_BOUND_P
   * points, and for each of NR_ROTATES candidate rotation angles track how
   * wide the shape is along that direction and the perpendicular one, so we
   * can pick the rotation with the best (smallest) bounding box.
   */
  function setupVariableBoundary(sp) {
    let mag = 0;
    for (let k = 2; k <= DEG_P; k++) {
      const r = rnd(1.0 / k);
      const theta = balanced(2 * Math.PI);
      sp.pCoef[2 * (k - 2)] = r * Math.cos(theta);
      sp.pCoef[2 * (k - 2) + 1] = r * Math.sin(theta);
      mag += k * r;
    }
    if (mag > 0.0001) {
      for (let k = 2; k <= DEG_P; k++) {
        sp.pCoef[2 * (k - 2)] /= mag;
        sp.pCoef[2 * (k - 2) + 1] /= mag;
      }
    }

    const low = new Array(NR_ROTATES).fill(1e5);
    const high = new Array(NR_ROTATES).fill(-1e5);

    for (let k = 0; k < N_BOUND_P; k++) {
      const [p1, p2] = calcP(Math.cos((k / N_BOUND_P) * 2 * Math.PI), Math.sin((k / N_BOUND_P) * 2 * Math.PI), sp.pCoef);
      const [pp1, pp2] = calcP(Math.cos(((k - 1) / N_BOUND_P) * 2 * Math.PI), Math.sin(((k - 1) / N_BOUND_P) * 2 * Math.PI), sp.pCoef);
      const [pn1, pn2] = calcP(Math.cos(((k + 1) / N_BOUND_P) * 2 * Math.PI), Math.sin(((k + 1) / N_BOUND_P) * 2 * Math.PI), sp.pCoef);

      let angle1 = (NR_ROTATES / Math.PI) * Math.atan2(p2 - pp2, p1 - pp1) - NR_ROTATES / 2;
      let angle2 = (NR_ROTATES / Math.PI) * Math.atan2(pn2 - p2, pn1 - p1) - NR_ROTATES / 2;
      while (angle1 < 0) angle1 += NR_ROTATES * 2;
      while (angle2 < 0) angle2 += NR_ROTATES * 2;
      if (angle1 > NR_ROTATES * 1.75 && angle2 < NR_ROTATES * 0.25) angle2 += NR_ROTATES * 2;
      if (angle1 < NR_ROTATES * 0.25 && angle2 > NR_ROTATES * 1.75) angle1 += NR_ROTATES * 2;
      if (angle2 < angle1) {
        const t = angle1;
        angle1 = angle2;
        angle2 = t;
      }
      for (let i = Math.floor(angle1); i < Math.ceil(angle2); i++) {
        const dist = Math.cos((i * Math.PI) / NR_ROTATES) * p1 + Math.sin((i * Math.PI) / NR_ROTATES) * p2;
        const bucket = i % NR_ROTATES;
        if (i % (NR_ROTATES * 2) < NR_ROTATES) {
          if (dist > high[bucket]) high[bucket] = dist;
          if (dist < low[bucket]) low[bucket] = dist;
        } else {
          if (-dist > high[bucket]) high[bucket] = -dist;
          if (-dist < low[bucket]) low[bucket] = -dist;
        }
      }
    }

    let bestScale = 0;
    let besti = 0;
    for (let i = 0; i < NR_ROTATES; i++) {
      const xscale = (sp.width - 5.0) / (high[i] - low[i]);
      const j = (i + NR_ROTATES / 2) % NR_ROTATES;
      const yscale = (sp.height - 5.0) / (high[j] - low[j]);
      const scale = Math.min(xscale, yscale);
      if (scale > bestScale) {
        bestScale = scale;
        besti = i;
      }
    }

    // Rotate p by replacing it with a^{-1} p(a z), a = exp(i * best angle):
    // coefficient c_k picks up a factor a^{k-1}.
    let a = [1, 0];
    const rot = [Math.cos((besti * Math.PI) / NR_ROTATES), Math.sin((besti * Math.PI) / NR_ROTATES)];
    for (let k = 2; k <= DEG_P; k++) {
      a = cMul(a, rot);
      const c = cMul([sp.pCoef[2 * (k - 2)], sp.pCoef[2 * (k - 2) + 1]], a);
      sp.pCoef[2 * (k - 2)] = c[0];
      sp.pCoef[2 * (k - 2) + 1] = c[1];
    }

    sp.scale = bestScale;
    sp.xshift = (-(low[besti] + high[besti]) / 2) * sp.scale + sp.width / 2;
    if (besti < NR_ROTATES / 2) {
      const j = besti + NR_ROTATES / 2;
      sp.yshift = (-(low[j] + high[j]) / 2) * sp.scale + sp.height / 2;
    } else {
      const j = besti - NR_ROTATES / 2;
      sp.yshift = ((low[j] + high[j]) / 2) * sp.scale + sp.height / 2;
    }

    sp.boundary = [];
    for (let k = 0; k < N_BOUND_P; k++) {
      const [p1, p2] = calcP(Math.cos((k / N_BOUND_P) * 2 * Math.PI), Math.sin((k / N_BOUND_P) * 2 * Math.PI), sp.pCoef);
      sp.boundary.push([p1 * sp.scale + sp.xshift, p2 * sp.scale + sp.yshift]);
    }
  }

  // Scatter the N - Nvortex "tracer" points uniformly inside the domain.
  // In the unit disk, uniform means r = sqrt(uniform(0,1)). When the domain
  // is p(disk), the image density is weighted by 1/|p'|^2, so points are
  // rejected with probability proportional to |p'|^2 to compensate.
  function scatterPoints(sp) {
    for (let i = sp.Nvortex; i < sp.N; i++) {
      let x, y;
      do {
        const r = Math.sqrt(rnd(1.0));
        const theta = balanced(2 * Math.PI);
        x = r * Math.cos(theta);
        y = r * Math.sin(theta);
      } while (sp.variableBoundary && calcModDp2(x, y, sp.pCoef) < rnd(4));
      sp.x[2 * i] = x;
      sp.x[2 * i + 1] = y;
    }
  }

  // A handful of tight clusters of vortex points, alternating sign, give
  // the flow its characteristic swirl-and-orbit look.
  function scatterVortices(sp) {
    const n = nrand(4) + 2;
    let np;
    if (n % 2) {
      np = nrand(n + 1);
    } else {
      np = nrand(n + 2);
      if (np === n + 1) np = n / 2;
    }
    for (let k = 0; k < n; k++) {
      const r = Math.sqrt(rnd(0.77));
      const theta = balanced(2 * Math.PI);
      const cx = r * Math.cos(theta);
      const cy = r * Math.sin(theta);
      const spread = 0.02 + rnd(0.1);
      const w = (2 * (k < np ? 1 : 0) - 1) * (2.0 / sp.Nvortex);
      const lo = Math.floor((sp.Nvortex * k) / n);
      const hi = Math.floor((sp.Nvortex * (k + 1)) / n);
      for (let i = lo; i < hi; i++) {
        const t = balanced(2 * Math.PI);
        sp.x[2 * i] = cx + spread * Math.cos(t);
        sp.x[2 * i + 1] = cy + spread * Math.sin(t);
        sp.w[i] = w;
      }
    }
  }

  function clampPower(power) {
    if (power < MIN_POWER) return MIN_POWER;
    if (power > MAX_POWER) return MAX_POWER;
    return power;
  }

  // Create (or re-create) a flow: new boundary shape, new vortices, new
  // tracer positions, but keeping the canvas size, particle count and power
  // law. This is what "New flow" does, and what happens automatically once
  // a flow has run for its allotted number of steps.
  function randomize(sp) {
    sp.count = 0;
    sp.dead.fill(0);
    sp.diffx.fill(0);
    sp.olddiffx.fill(0);

    if (sp.variableBoundary) {
      setupVariableBoundary(sp);
    } else {
      sp.radius = (sp.width > sp.height ? sp.height : sp.width) / 2 - 5;
      sp.boundary = null;
    }

    scatterPoints(sp);
    scatterVortices(sp);

    if (sp.variableBoundary) calcAllP(sp);
    for (let i = 0; i < sp.N; i++) {
      const [sx, sy] = screenPos(sp, i);
      sp.lastScreen[2 * i] = sx;
      sp.lastScreen[2 * i + 1] = sy;
    }
  }

  function screenPos(sp, i) {
    if (sp.variableBoundary) {
      return [sp.p[2 * i] * sp.scale + sp.xshift, sp.p[2 * i + 1] * sp.scale + sp.yshift];
    }
    return [sp.x[2 * i] * sp.radius + sp.width / 2, sp.x[2 * i + 1] * sp.radius + sp.height / 2];
  }

  function create(width, height, opts) {
    const power = clampPower(opts.power);
    const nParticles = Math.max(2, Math.round(opts.particles));
    const N = nParticles + NUM_VORTEX_POINTS;
    const sp = {
      width,
      height,
      power,
      variableBoundary: power === 1,
      deltaT: 0.001 * (power > 1 ? Math.pow(0.1, power - 1) : 1),
      cycles: Math.max(1, Math.round(opts.cycles)),
      N,
      Nvortex: NUM_VORTEX_POINTS,
      count: 0,
      x: new Float64Array(N * 2),
      w: new Float64Array(NUM_VORTEX_POINTS),
      diffx: new Float64Array(N * 2),
      olddiffx: new Float64Array(N * 2),
      tempx: new Float64Array(N * 2),
      tempdiffx: new Float64Array(N * 2),
      xs: new Float64Array(NUM_VORTEX_POINTS * 2),
      xIsZero: new Uint8Array(NUM_VORTEX_POINTS),
      p: new Float64Array(N * 2),
      modDp2: new Float64Array(N),
      dead: new Uint8Array(N),
      pCoef: new Float64Array(2 * (DEG_P - 1)),
      boundary: null,
      radius: 0,
      scale: 0,
      xshift: 0,
      yshift: 0,
      lastScreen: new Float64Array(N * 2),
    };
    randomize(sp);
    return sp;
  }

  // Advance one time step and report the screen-space segment each live
  // point just traced, split into tracers and vortex points so the caller
  // can style (or hide) them differently.
  function step(sp) {
    odeSolve(sp);
    if (sp.variableBoundary) calcAllP(sp);

    const particles = [];
    const vortices = [];
    for (let i = 0; i < sp.N; i++) {
      if (sp.dead[i]) continue;
      const [sx, sy] = screenPos(sp, i);
      const seg = { x1: sp.lastScreen[2 * i], y1: sp.lastScreen[2 * i + 1], x2: sx, y2: sy, index: i };
      sp.lastScreen[2 * i] = sx;
      sp.lastScreen[2 * i + 1] = sy;
      if (i < sp.Nvortex) vortices.push(seg);
      else particles.push(seg);
    }

    sp.count++;
    const finished = sp.count > sp.cycles;
    return { particles, vortices, finished, aliveParticles: particles.length, aliveVortices: vortices.length };
  }

  function getBoundary(sp) {
    if (sp.variableBoundary) return { kind: "polygon", points: sp.boundary };
    return { kind: "circle", cx: sp.width / 2, cy: sp.height / 2, r: sp.radius };
  }

  return { create, step, randomize, getBoundary, MIN_POWER, MAX_POWER, NUM_VORTEX_POINTS };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Euler2DCore;
