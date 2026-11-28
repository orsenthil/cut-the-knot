"use strict";

/*
 * Homothety, from Alexander Bogomolny's applet Homothety.
 *
 * A homothety has a center O and a coefficient k: it sends P to
 *     P' = O + k * (P - O).
 * The applet draws one slider per homothety: its orange point O reads 0, its
 * red point U reads 1, and its blue point V reads k. CTKHSlider.Value() is
 * (V.x - O.x) / (U.x - O.x), but only when |U.x - O.x| is greater than 1;
 * dragging O or U instead moves V to O + (U - O) * k and keeps k unchanged.
 * This file is that arithmetic only: no document, no window, no storage. It
 * defines one global, HomothetyCore, so the page loads it with a plain script
 * and porting/check-homothety.mjs loads it in Node. Positions are plain data.
 */
const HomothetyCore = (() => {
  "use strict";

  // The applet's default canvas is 400 by 300; the page gives the sliders a
  // little extra room at the bottom so twenty rows still fit on a phone.
  const WIDTH = 400;
  const HEIGHT = 300;
  const LIMITS = { count: [1, 20], sides: [3, 20] };
  const SLIDER = { originX: 30, unitX: 60, firstValue: 1.5, firstRow: 20, rowStep: 15 };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function option(v, fallback, lo, hi) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return clamp(Math.round(n), lo, hi);
  }

  /* The applet uses Math.random for its centers and polygons. A fixed seed
   * makes the starting arrangement reproducible, without changing the rules. */
  function nextRandom(seed) {
    let t = (seed + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: t | 0 };
  }

  function makeSlider(i) {
    const y = SLIDER.firstRow + i * SLIDER.rowStep;
    return {
      O: { x: SLIDER.originX, y: y },
      U: { x: SLIDER.unitX, y: y },
      V: { x: SLIDER.originX + (SLIDER.unitX - SLIDER.originX) * SLIDER.firstValue, y: y },
      k: SLIDER.firstValue,
    };
  }

  /* Reset(): center = round((random + 0.9) / 2 * size), slider origin x = 30,
   * unit x = 60, value = 1.5. */
  function makeTransform(i, seed) {
    const rx = nextRandom(seed);
    const ry = nextRandom(rx.seed);
    return {
      name: "H" + (i + 1),
      center: {
        x: Math.round(((rx.value + 0.9) / 2) * WIDTH),
        y: Math.round(((ry.value + 0.9) / 2) * HEIGHT),
      },
      slider: makeSlider(i),
      seed: ry.seed,
    };
  }

  /* AddNGon(): center x = (2*width/3 + random*15 - 30) truncated to an int,
   * center y = (height/2 + random*15 - 30) truncated, radius 30, vertices
   * spaced 2*pi/sides apart, and a random translucent fill colour. */
  function makePolygon(sides, seed, index) {
    const rx = nextRandom(seed);
    const ry = nextRandom(rx.seed);
    const rt = nextRandom(ry.seed);
    const cx = Math.trunc(((WIDTH * 2) / 3 + rx.value * 15) - 30);
    const cy = Math.trunc((HEIGHT / 2 + ry.value * 15) - 30);
    const step = (2 * Math.PI) / sides;
    const vertices = [];
    for (let i = 0; i < sides; i++) {
      vertices.push({ x: cx + 30 * Math.cos(i * step), y: cy + 30 * Math.sin(i * step) });
    }
    return { index: index, tint: rt.value, vertices: vertices, seed: rt.seed };
  }

  /** The position a new arrangement starts from: one dilation, no polygons. */
  function start(options) {
    const opt = options || {};
    const count = option(opt.count, 1, LIMITS.count[0], LIMITS.count[1]);
    const sides = option(opt.sides, 5, LIMITS.sides[0], LIMITS.sides[1]);
    const seed = Number.isFinite(Number(opt.seed)) && Number(opt.seed) !== 0
      ? Number(opt.seed) >>> 0 : 1;
    let s = seed;
    const transforms = [];
    for (let i = 0; i < count; i++) {
      const t = makeTransform(i, s);
      s = t.seed;
      transforms.push(t);
    }
    return {
      count: count,
      sides: sides,
      seed: seed,
      transforms: transforms,
      polygons: [],
      showLines: false,
      showDragControls: true,
      showProduct: false,
    };
  }

  /** CTKHSlider.UpdateValue(): ignore a slider shorter than two pixels. */
  function sliderValue(slider, v) {
    return Math.abs(slider.U.x - slider.O.x) > 1
      ? (v - slider.O.x) / (slider.U.x - slider.O.x)
      : slider.k;
  }

  /** CTKHSlider.UpdateValuePoint(): place V at O + (U - O) * k. */
  function sliderValuePoint(slider) {
    return slider.O.x + (slider.U.x - slider.O.x) * slider.k;
  }

  /** The coefficient of a dilation, as Value() would report it. */
  function coefficient(t) {
    return sliderValue(t.slider, t.slider.V.x);
  }

  /** Transform.PerformTransform(): the image of one point. */
  function transformPoint(t, p) {
    const k = coefficient(t);
    return {
      x: t.center.x + k * (p.x - t.center.x),
      y: t.center.y + k * (p.y - t.center.y),
    };
  }

  function withTransformPoint(state, i, name, p) {
    const ts = state.transforms.slice();
    const t = ts[i];
    if (!t) return state;
    const slider = t.slider;
    const q = { x: p.x, y: p.y };
    if (name === "center") {
      ts[i] = Object.assign({}, t, { center: q });
    } else if (name === "O" || name === "U") {
      const next = Object.assign({}, slider, { [name]: q });
      next.V = { x: sliderValuePoint(next), y: slider.O.y };
      ts[i] = Object.assign({}, t, { slider: next });
    } else if (name === "V") {
      const next = Object.assign({}, slider, { V: { x: q.x, y: slider.O.y } });
      next.k = sliderValue(slider, q.x);
      ts[i] = Object.assign({}, t, { slider: next });
    } else {
      return state;
    }
    return Object.assign({}, state, { transforms: ts });
  }

  /** SetN() followed by Reset(): keep old dilations, add or drop at the end. */
  function setCount(state, n) {
    const count = option(n, state.count, LIMITS.count[0], LIMITS.count[1]);
    if (count === state.count) return state;
    const ts = state.transforms.slice(0, count);
    let seed = state.seed;
    while (ts.length < count) {
      const t = makeTransform(ts.length, seed);
      seed = t.seed;
      ts.push(t);
    }
    return Object.assign({}, state, { count: count, transforms: ts, seed: seed });
  }

  /** AddNGon(sides): append a new regular polygon with the given side count. */
  function addPolygon(state, sides) {
    const n = option(sides === undefined ? state.sides : sides, state.sides,
      LIMITS.sides[0], LIMITS.sides[1]);
    const poly = makePolygon(n, state.seed, state.polygons.length);
    return Object.assign({}, state, {
      sides: n,
      polygons: state.polygons.concat([poly]),
      seed: poly.seed,
    });
  }

  /** RemoveNGon(): take away the last polygon and its draggable vertices. */
  function removeLastPolygon(state) {
    if (!state.polygons.length) return state;
    return Object.assign({}, state, { polygons: state.polygons.slice(0, -1) });
  }

  function withVertex(state, polygonIndex, vertexIndex, p) {
    const polys = state.polygons.slice();
    const poly = polys[polygonIndex];
    if (!poly || !poly.vertices[vertexIndex]) return state;
    const vertices = poly.vertices.slice();
    vertices[vertexIndex] = { x: p.x, y: p.y };
    polys[polygonIndex] = Object.assign({}, poly, { vertices: vertices });
    return Object.assign({}, state, { polygons: polys });
  }

  function withFlag(state, name, on) {
    const key = name === "lines" ? "showLines"
      : name === "drags" ? "showDragControls"
        : name === "product" ? "showProduct" : null;
    return key ? Object.assign({}, state, { [key]: !!on }) : state;
  }

  /* DrawHomotheties(): each dilation is applied to the shapes left by the
   * previous one, so the images are chained, not all drawn from the original. */
  function images(state) {
    let shapes = state.polygons.map((p) => p.vertices);
    const out = [];
    for (let i = 0; i < state.transforms.length; i++) {
      shapes = shapes.map((poly) => poly.map((p) => transformPoint(state.transforms[i], p)));
      out.push(shapes);
    }
    return out;
  }

  function finalPolygons(state) {
    const all = images(state);
    return all.length ? all[all.length - 1] : state.polygons.map((p) => p.vertices);
  }

  /* H2(H1(P)) = K*P + (1-k1)*k2*C1 + (1-k2)*C2, with K = k1*k2. When K is 1
   * the P coefficient vanishes: it is a translation along C1C2. Otherwise it
   * is a homothety whose center is the fixed point of that affine map. */
  function composition(t1, t2) {
    const k1 = coefficient(t1), k2 = coefficient(t2);
    const c1 = t1.center, c2 = t2.center;
    const K = k1 * k2;
    const dx = (1 - k1) * k2 * c1.x + (1 - k2) * c2.x;
    const dy = (1 - k1) * k2 * c1.y + (1 - k2) * c2.y;
    if (Math.abs(K - 1) < 1e-12) return { kind: "translation", dx: dx, dy: dy };
    return {
      kind: "homothety",
      k: K,
      center: { x: dx / (1 - K), y: dy / (1 - K) },
    };
  }

  function applyComposition(h, p) {
    if (h.kind === "translation") return { x: p.x + h.dx, y: p.y + h.dy };
    return {
      x: h.center.x + h.k * (p.x - h.center.x),
      y: h.center.y + h.k * (p.y - h.center.y),
    };
  }

  /** This is an illustration; it has no win, loss or finishing condition. */
  function result(state) {
    return null;
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, LIMITS: LIMITS, SLIDER: SLIDER,
    start: start, result: result, coefficient: coefficient,
    sliderValue: sliderValue, sliderValuePoint: sliderValuePoint,
    transformPoint: transformPoint, withTransformPoint: withTransformPoint,
    setCount: setCount, addPolygon: addPolygon, removeLastPolygon: removeLastPolygon,
    withVertex: withVertex, withFlag: withFlag, images: images,
    finalPolygons: finalPolygons, composition: composition,
    applyComposition: applyComposition,
  };
})();
