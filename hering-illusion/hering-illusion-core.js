"use strict";

/*
 * Hering Illusion — the geometry behind Bogomolny's applet HeringIllusion.
 *
 * The applet paints a fan of straight lines through the middle of its canvas
 * and two bundles of straight, horizontal blue lines above and below the
 * middle. Nothing is curved: the two blue bundles only look bowed because the
 * fan crosses them. The exact claim we can test is geometric — every line the
 * applet draws is a straight segment, the fan lines all aim at the middle, the
 * blue lines are one unit apart, and the two bundles are Diff units apart.
 * Whether a person sees a bend is a fact about eyesight, not about this code.
 *
 * The numbers below are transcribed from the applet's bytecode: the three
 * scrollbars in HeringIllusionPanel, the fields and constructor of
 * HeringIllusionCanvas, and every drawLine call in Draw(g). Java's Math.round
 * and int division are kept, so a second transcription in
 * porting/check-hering-illusion.mjs can compare them over the whole range.
 *
 * This is the logic and nothing else: no document, no window, no storage. It
 * defines one global, HeringIllusionCore, so the page loads it with a plain
 * <script> and the logic test evaluates it in Node. The position is plain data
 * (three integers); functions take a position and return a new one.
 */
const HeringIllusionCore = (() => {
  /* HeringIllusionPanel:
   *   N     = new Scrollbar(0, 25, 5, 0, 50)
   *   Diff  = new Scrollbar(0, 80, 5, 0, 200)
   *   Width = new Scrollbar(0,  3, 1, 1,  30)
   * An AWT scrollbar can only take values up to maximum - visibleAmount. */
  const RANGES = Object.freeze({
    n: { min: 0, max: 45, visible: 5, scrollMax: 50, start: 25 },
    diff: { min: 0, max: 195, visible: 5, scrollMax: 200, start: 80 },
    width: { min: 1, max: 29, visible: 1, scrollMax: 30, start: 3 },
  });
  const DEFAULTS = Object.freeze({ n: 25, diff: 80, width: 3 });
  const KEYS = Object.freeze(["n", "diff", "width"]);

  /** Java Math.round(double): floor(x + 0.5), even for negative x. */
  const jround = (x) => Math.floor(x + 0.5);
  /** Java int division, i.e. truncation towards zero. */
  const itrunc = (x) => Math.trunc(x);
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, itrunc(Number(v) || 0)));
  const clampKey = (key, v) => clampInt(v, RANGES[key].min, RANGES[key].max);

  /** The position a new picture starts from, matching the three scrollbars. */
  function start(options) {
    const o = options || {};
    const s = {};
    for (const key of KEYS) {
      s[key] = o[key] === undefined ? DEFAULTS[key] : clampKey(key, o[key]);
    }
    return s;
  }

  /** A new position with one scrollbar moved; the input is not changed. */
  function withSetting(state, key, value) {
    const next = start(state);
    if (KEYS.includes(key)) next[key] = clampKey(key, value);
    return next;
  }

  /**
   * HeringIllusionCanvas.Draw(g): one entry for every drawLine call, in the
   * order the bytecode makes them. Coordinates are in the applet's canvas,
   * where (0, 0) is the top left and Width/Height are the canvas dimensions.
   *
   *   double d = 3.0 * Width / N;              // only when N != 0
   *   for (i = 0; i <= N; i++)
   *     drawLine(round(-Width + d*i), 0,
   *              round(2*Width - d*i), Height);
   *   int y0 = (Height - Diff) / 2;
   *   for (w = -Width; w <= Width; w++) {
   *     drawLine(0, y0 + w, Width, y0 + w);
   *     drawLine(0, Height - y0 + w, Width, Height - y0 + w);
   *   }
   *
   * Here the state's `width` is the thickness option, called Width in the
   * scrollbar and in the second loop; the canvas width is passed separately.
   */
  function layout(state, canvas) {
    const s = start(state);
    const cw = Math.max(1, itrunc(Number(canvas && canvas.width) || 0));
    const ch = Math.max(1, itrunc(Number(canvas && canvas.height) || 0));
    const center = { x: cw / 2, y: ch / 2 };
    const calls = [];

    /* The fan: i <= N is deliberate, so N>0 gives N+1 lines and N=0 gives
       none (and avoids dividing by zero). */
    const step = s.n === 0 ? null : (3.0 * cw) / s.n;
    if (s.n !== 0) {
      for (let i = 0; i <= s.n; i++) {
        calls.push({
          kind: "ray", i,
          x1: jround(-cw + step * i), y1: 0,
          x2: jround(2 * cw - step * i), y2: ch,
        });
      }
    }

    /* The two blue bundles: 2*thickness+1 lines each. */
    const y0 = itrunc((ch - s.diff) / 2);
    for (let w = -s.width; w <= s.width; w++) {
      calls.push({
        kind: "bandTop", j: w,
        x1: 0, y1: y0 + w, x2: cw, y2: y0 + w,
      });
    }
    for (let w = -s.width; w <= s.width; w++) {
      calls.push({
        kind: "bandBottom", j: w,
        x1: 0, y1: ch - y0 + w, x2: cw, y2: ch - y0 + w,
      });
    }

    const rays = calls.filter((c) => c.kind === "ray");
    const top = calls.filter((c) => c.kind === "bandTop");
    const bottom = calls.filter((c) => c.kind === "bandBottom");
    return {
      canvas: { width: cw, height: ch }, center, step, y0,
      n: s.n, diff: s.diff, thickness: s.width,
      calls, rays, top, bottom,
      counts: { rays: rays.length, top: top.length, bottom: bottom.length },
    };
  }

  /** Where the handle that changes Diff sits: the middle line of the top band. */
  function handlePoint(state, canvas) {
    const L = layout(state, canvas);
    return { x: L.canvas.width - 24, y: L.y0 };
  }

  /** Drag height -> scrollbar value, clamped to what Diff can actually take. */
  function diffFromY(y, canvas) {
    const ch = Math.max(1, itrunc(Number(canvas && canvas.height) || 0));
    return clampKey("diff", ch - 2 * itrunc(Number(y) || 0));
  }

  /**
   * The page's claim, reduced to facts a program can check. Perception cannot
   * be checked; straightness, spacing and the aim of the fan can.
   */
  function claims(state, canvas) {
    const L = layout(state, canvas);
    let maxCenterError = 0;
    for (const r of L.rays) {
      /* At y = Height/2 the segment is halfway along, so its x is the mean
         of the two rounded ends. */
      maxCenterError = Math.max(maxCenterError, Math.abs((r.x1 + r.x2) / 2 - L.center.x));
    }
    const straightRays = L.rays.every((r) =>
      r.y1 === 0 && r.y2 === L.canvas.height);
    const straightBands = L.top.concat(L.bottom).every((b) =>
      b.x1 === 0 && b.x2 === L.canvas.width && b.y1 === b.y2);
    const equalSpacing = L.top.every((b, i, all) => i === 0 || b.y1 - all[i - 1].y1 === 1) &&
      L.bottom.every((b, i, all) => i === 0 || b.y1 - all[i - 1].y1 === 1);
    /* j = 0 is the middle line of each bundle: top[thickness] and
       bottom[thickness] are the two lines Diff is measured between. */
    const gap = L.bottom[L.thickness].y1 - L.top[L.thickness].y1;
    const expectedGap = L.canvas.height - 2 * itrunc((L.canvas.height - L.diff) / 2);
    const fanEndsOrdered = L.rays.every((r, i, all) =>
      i === 0 || (r.x1 > all[i - 1].x1 && r.x2 < all[i - 1].x2));
    return {
      rayCount: L.counts.rays,
      bandLines: L.counts.top,
      bandGap: gap, expectedGap,
      maxCenterError,
      straightRays, straightBands, equalSpacing, fanEndsOrdered,
      noCurves: L.calls.every((c) =>
        (c.kind === "ray" && c.y1 === 0 && c.y2 === L.canvas.height) ||
        (c.kind !== "ray" && c.y1 === c.y2)),
      bundlesOverlap: gap === 0,
      centerIsCanvasMiddle: L.center.x === L.canvas.width / 2 && L.center.y === L.canvas.height / 2,
    };
  }

  /* The applet has no game to win or lose: only three scrollbars. */
  function result(/* state */) {
    return null;
  }

  return {
    RANGES, DEFAULTS, KEYS, start, withSetting, layout, handlePoint,
    diffFromY, claims, result, jround,
  };
})();
