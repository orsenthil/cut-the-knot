"use strict";

/*
 * Integer Rectangles: Two Proofs, from Bogomolny's applet IntRectGraph.
 *
 * A rectangle tiled by rectangles each having a special side (an integer, or
 * any member of an additive subgroup) must itself have a special side. The
 * applet colours tiles with a special width H (dark orange) and those with a
 * special height V (red), and draws a graph: each H-tile joins its left and
 * right corners with two horizontal edges, each V-tile joins its bottom and
 * top corners with two vertical edges.
 *
 * The graph proof: the four ambient corners have degree 1, every other node
 * has degree 2 or 4, and an edge always joins special nodes. A trail from the
 * lower-left special corner must end at another special ambient corner.
 * The counting proof: each tile has 0, 2 or 4 special corners, so their sum
 * S is even; S = S1 + 2S2 + 4S4, hence S1 is even and at least two ambient
 * corners are special.
 *
 * The logic test checks both arguments on several tilings and a generalized
 * step (multiples of 1/2 instead of integers).
 *
 * No document, no window, no storage: one global, IntegerRectangleGraphCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const IntegerRectangleGraphCore = (() => {
  const key = (p) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)}`;

  function special(value, step = 1) {
    const scaled = value / step;
    return Math.abs(scaled - Math.round(scaled)) < 1e-9;
  }

  function specialPoint(p, step) {
    return special(p.x, step) && special(p.y, step);
  }

  function corners(t) {
    return [
      { x: t.x, y: t.y },
      { x: t.x + t.w, y: t.y },
      { x: t.x + t.w, y: t.y + t.h },
      { x: t.x, y: t.y + t.h },
    ];
  }

  function specialCornerCount(t, step) {
    return corners(t).filter((p) => specialPoint(p, step)).length;
  }

  function kind(t, step) {
    if (t.kind === "H" || t.kind === "V") return t.kind;
    if (special(t.w, step)) return "H";
    if (special(t.h, step)) return "V";
    return "H";
  }

  function start() {
    return {
      ambient: { x: 0, y: 0, w: 2.5, h: 2 },
      step: 1,
      tiles: [
        { x: 0, y: 0, w: 1, h: 0.7, kind: "H" },
        { x: 0, y: 0.7, w: 1, h: 1.3, kind: "H" },
        { x: 1, y: 0, w: 1.5, h: 1, kind: "V" },
        { x: 1, y: 1, w: 1.5, h: 1, kind: "V" },
      ],
    };
  }

  const PRESETS = {
    winkler: () => start(),
    squares: () => ({
      ambient: { x: 0, y: 0, w: 2.5, h: 2 },
      step: 1,
      tiles: [
        { x: 0, y: 0, w: 1, h: 1, kind: "H" },
        { x: 0, y: 1, w: 1, h: 1, kind: "H" },
        { x: 1, y: 0, w: 1.5, h: 1, kind: "V" },
        { x: 1, y: 1, w: 1.5, h: 1, kind: "V" },
      ],
    }),
    halfStep: () => ({
      ambient: { x: 0, y: 0, w: 2.5, h: 1.5 },
      step: 0.5,
      tiles: [
        { x: 0, y: 0, w: 0.5, h: 1.5, kind: "V" },
        { x: 0.5, y: 0, w: 2, h: 0.5, kind: "H" },
        { x: 0.5, y: 0.5, w: 2, h: 1, kind: "H" },
      ],
    }),
  };

  function buildGraph(tiles, step = 1) {
    const nodes = new Map();
    const edges = [];
    const addNode = (p) => {
      const k = key(p);
      if (!nodes.has(k)) nodes.set(k, { x: p.x, y: p.y });
      return k;
    };
    tiles.forEach((t, i) => {
      const [bl, br, tr, tl] = corners(t);
      if (kind(t, step) === "H") {
        edges.push({ from: addNode(bl), to: addNode(br), tile: i });
        edges.push({ from: addNode(tl), to: addNode(tr), tile: i });
      } else {
        edges.push({ from: addNode(bl), to: addNode(tl), tile: i });
        edges.push({ from: addNode(br), to: addNode(tr), tile: i });
      }
    });
    const degrees = {};
    for (const k of nodes.keys()) degrees[k] = 0;
    for (const e of edges) { degrees[e.from]++; degrees[e.to]++; }
    return { nodes, edges, degrees };
  }

  function cornerKeys(ambient) {
    return [
      key({ x: ambient.x, y: ambient.y }),
      key({ x: ambient.x + ambient.w, y: ambient.y }),
      key({ x: ambient.x + ambient.w, y: ambient.y + ambient.h }),
      key({ x: ambient.x, y: ambient.y + ambient.h }),
    ];
  }

  /** Walk from a node without reusing an edge until stuck. */
  function traverse(graph, fromKey) {
    const used = new Set();
    const path = [fromKey];
    let at = fromKey;
    for (;;) {
      const edge = graph.edges.find((e, i) => !used.has(i) && (e.from === at || e.to === at));
      if (!edge) break;
      const i = graph.edges.indexOf(edge);
      used.add(i);
      at = edge.from === at ? edge.to : edge.from;
      path.push(at);
    }
    return { path, end: at, edgesUsed: used.size };
  }

  function counting(tiles, step = 1) {
    const counts = new Map();
    let S = 0;
    for (const t of tiles) {
      const count = specialCornerCount(t, step);
      S += count;
      if (count % 2 !== 0) return { S, S1: 0, S2: 0, S4: 0, even: false, allTilesEven: false };
      for (const p of corners(t)) {
        if (!specialPoint(p, step)) continue;
        const k = key(p);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    let S1 = 0; let S2 = 0; let S4 = 0;
    for (const count of counts.values()) {
      if (count === 1) S1++;
      else if (count === 2) S2++;
      else if (count === 4) S4++;
    }
    return { S, S1, S2, S4, even: S % 2 === 0, allTilesEven: true, identity: S === S1 + 2 * S2 + 4 * S4 };
  }

  function validate(tiles, ambient) {
    const area = tiles.reduce((s, t) => s + t.w * t.h, 0);
    const ambientArea = ambient.w * ambient.h;
    let inside = true;
    let overlap = false;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.x < ambient.x - 1e-9 || t.y < ambient.y - 1e-9 ||
          t.x + t.w > ambient.x + ambient.w + 1e-9 || t.y + t.h > ambient.y + ambient.h + 1e-9) inside = false;
      for (let j = i + 1; j < tiles.length; j++) {
        const u = tiles[j];
        const ox = Math.min(t.x + t.w, u.x + u.w) - Math.max(t.x, u.x);
        const oy = Math.min(t.y + t.h, u.y + u.h) - Math.max(t.y, u.y);
        if (ox > 1e-9 && oy > 1e-9) overlap = true;
      }
    }
    const exact = Math.abs(area - ambientArea) < 1e-7;
    return { valid: exact && inside && !overlap, exact, inside, overlap, area, ambientArea };
  }

  function analyze(state) {
    const graph = buildGraph(state.tiles, state.step);
    const ambKeys = cornerKeys(state.ambient);
    const cornerDegrees = ambKeys.map((k) => graph.degrees[k] ?? 0);
    const interiorDegrees = [...graph.nodes.keys()]
      .filter((k) => !ambKeys.includes(k))
      .map((k) => graph.degrees[k]);
    const trail = traverse(graph, ambKeys[0]);
    const endIsCorner = ambKeys.includes(trail.end);
    return {
      graph,
      cornerDegrees,
      interiorDegrees,
      interiorEven: interiorDegrees.every((d) => d === 2 || d === 4),
      trail,
      endIsCorner,
      endSpecial: specialPoint(graph.nodes.get(trail.end) || { x: NaN, y: NaN }, state.step),
      counting: counting(state.tiles, state.step),
      tiling: validate(state.tiles, state.ambient),
      ambientSpecial: special(state.ambient.w, state.step) || special(state.ambient.h, state.step),
    };
  }

  function toggleKind(state, index) {
    const tiles = state.tiles.slice();
    if (index < 0 || index >= tiles.length) return state;
    tiles[index] = { ...tiles[index], kind: kind(tiles[index], state.step) === "H" ? "V" : "H" };
    return { ...state, tiles };
  }

  function resize(state, index, keyName, value) {
    const tiles = state.tiles.slice();
    if (index < 0 || index >= tiles.length) return state;
    const t = { ...tiles[index] };
    t[keyName] = Math.max(0.25, Number(value) || 0.25);
    tiles[index] = t;
    return { ...state, tiles };
  }

  return {
    key, special, specialPoint, corners, specialCornerCount, kind, start, PRESETS,
    buildGraph, cornerKeys, traverse, counting, validate, analyze, toggleKind, resize,
  };
})();
