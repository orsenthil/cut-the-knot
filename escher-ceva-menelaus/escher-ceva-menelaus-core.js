"use strict";

/*
 * Escher Ceva Menelaus — the illustration on Bogomolny's page
 * "Theorems of Ceva and Menelaus, an Illustrated Generalization".
 *
 * A triangle A1A2A3 has two marked points on each side: B1, C1 on A2A3,
 * B2, C2 on A3A1 and B3, C3 on A1A2. The three lines C1B2, C2B3, C3B1
 * meet at one point exactly when the Klamkin–Liu number
 *   b1b2b3 + c1c2c3 + b1c1 + b2c2 + b3c3
 * is 1, where a mark i divisions along a side gives b = (N-i)/i for a B
 * point and c = i/(N-i) for a C point. The page's starting picture is one
 * of Escher's 3-4-5 patterns; this is not the Napoleon-hexagon Escher
 * theorem, which concerns 120-degree rotations and a tessellation.
 *
 * The code reproduces the applet's own methods: LineGrid.IntToMoveablebPoint
 * and Snap place the marks on an equally divided side, Ratio() and Formula()
 * compute the number from the drawn points, and ChangeGrid/SetN keep marks at
 * their integer indices when a spinner changes. It defines one global and
 * has no document, window or storage: all positions are plain data.
 */
const EscherCevaMenelausCore = (() => {
  const DIV_MIN = 2;                 // JSpinner model (2, 30, 3/4/5, 1)
  const DIV_MAX = 30;
  const PANEL_START = { AB: 3, BC: 4, CA: 5 };
  /* The canvas starts with 3, 5, 4 divisions while the panel reads 3, 4, 5.
     EscherCevaMenelausCanvas.init() has GridBC(5) and GridCA(4); the panel's
     stateChanged() only writes the grids after the player moves a spinner. */
  const GRID_START = { AB: 3, BC: 5, CA: 4 };
  const MARKS_START = { B1: 4, C1: 3, B2: 1, C2: 0, B3: 2, C3: 1 };
  const SIDE_OF = {
    B1: "BC", C1: "BC", B2: "CA", C2: "CA", B3: "AB", C3: "AB",
  };
  const ENDS_OF = { AB: ["A1", "A2"], BC: ["A2", "A3"], CA: ["A3", "A1"] };
  const MARKS = ["B1", "C1", "B2", "C2", "B3", "C3"];
  const EPS = 1e-9;

  const copy = (p) => ({ x: p.x, y: p.y });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const round = (v) => Math.round(v);
  const clampDiv = (v, fallback) => {
    const n = round(Number(v));
    return Number.isFinite(n) ? Math.max(DIV_MIN, Math.min(DIV_MAX, n)) : fallback;
  };

  /** The three spinner values, clamped to the applet's 2..30 range. */
  function options(o) {
    const src = o || {};
    return {
      AB: clampDiv(src.AB === undefined ? PANEL_START.AB : src.AB, PANEL_START.AB),
      BC: clampDiv(src.BC === undefined ? PANEL_START.BC : src.BC, PANEL_START.BC),
      CA: clampDiv(src.CA === undefined ? PANEL_START.CA : src.CA, PANEL_START.CA),
    };
  }

  function start(o) {
    const src = o || {};
    const w = src.width === undefined ? 420 : src.width;
    const h = src.height === undefined ? 300 : src.height;
    let corners;
    if (src.corners) {
      corners = { A1: copy(src.corners.A1), A2: copy(src.corners.A2), A3: copy(src.corners.A3) };
    } else {
      /* EscherCevaMenelausCanvas.init(): (width/2, height/3),
         (width/3, 4*height/5), (3*width/4, 3*height/4). */
      corners = {
        A1: { x: w / 2, y: h / 3 },
        A2: { x: w / 3, y: 4 * h / 5 },
        A3: { x: 3 * w / 4, y: 3 * h / 4 },
      };
    }
    const panel = options(src.divisions);
    const grid = src.divisions ? { ...panel } : { ...GRID_START };
    if (src.grid) {
      grid.AB = clampDiv(src.grid.AB, grid.AB);
      grid.BC = clampDiv(src.grid.BC, grid.BC);
      grid.CA = clampDiv(src.grid.CA, grid.CA);
    }
    const marks = { ...MARKS_START };
    if (src.marks) for (const m of MARKS) if (src.marks[m] !== undefined) marks[m] = round(src.marks[m]);
    return { corners, divisions: panel, grid, marks };
  }

  /** LineGrid.IntToMoveablebPoint(i): m_1 + i*(m_2-m_1)/N. */
  function pointOnSide(pos, name) {
    const side = SIDE_OF[name];
    const [a, b] = ENDS_OF[side];
    const i = pos.marks[name];
    const n = pos.grid[side];
    const step = { x: (pos.corners[b].x - pos.corners[a].x) / n,
                   y: (pos.corners[b].y - pos.corners[a].y) / n };
    return { x: pos.corners[a].x + i * step.x, y: pos.corners[a].y + i * step.y };
  }

  /** All nine points of the drawing, as plain data in board units. */
  function points(pos) {
    const out = {};
    for (const k of ["A1", "A2", "A3"]) out[k] = copy(pos.corners[k]);
    for (const m of MARKS) out[m] = pointOnSide(pos, m);
    return out;
  }

  /** A corner moved by a pointer or an arrow key; marks stay at their indices. */
  function moveCorner(pos, name, p) {
    if (!pos.corners[name]) return pos;
    return { ...pos, corners: { ...pos.corners, [name]: copy(p) } };
  }

  /** LineGrid.Snap(): project onto the side and round to the nearest integer index. */
  function dragMark(pos, name, p) {
    if (!SIDE_OF[name]) return pos;
    const side = SIDE_OF[name];
    const [a, b] = ENDS_OF[side];
    const step = { x: (pos.corners[b].x - pos.corners[a].x) / pos.grid[side],
                   y: (pos.corners[b].y - pos.corners[a].y) / pos.grid[side] };
    const len2 = dot(step, step);
    if (len2 < 0.001) return pos; // the applet returns without snapping
    const t = (step.x * (p.x - pos.corners[a].x) + step.y * (p.y - pos.corners[a].y)) / len2;
    const i = round(t);
    if (i === pos.marks[name]) return pos;
    return { ...pos, marks: { ...pos.marks, [name]: i } };
  }

  /** Keyboard: step a mark one division along its side (Shift multiplies in the UI). */
  function stepMark(pos, name, delta) {
    if (!SIDE_OF[name]) return pos;
    return { ...pos, marks: { ...pos.marks, [name]: pos.marks[name] + round(delta) } };
  }

  /** EscherCevaMenelausPanel.stateChanged(): SetN on each grid, then MaintainPoints. */
  function setDivisions(pos, values) {
    const panel = options(values === undefined ? pos.divisions : values);
    return { ...pos, divisions: panel, grid: { ...panel } };
  }

  /** EscherCevaMenelausCanvas.Ratio(p1,p2,p3), transcribed from the bytecode. */
  function ratio(p1, p2, p3) {
    const s4 = p3.x - p2.x, s6 = p3.y - p2.y;
    const s8 = p2.x - p1.x, s10 = p2.y - p1.y;
    const s12 = p3.x - p1.x, s14 = p3.y - p1.y;
    return (s12 * s4 + s14 * s6) / (s12 * s8 + s14 * s10);
  }

  /** EscherCevaMenelausCanvas.Formula(), transcribed from the bytecode. */
  function formula(pos) {
    const p = points(pos);
    const b1 = ratio(p.A2, p.B1, p.A3);
    const b2 = ratio(p.A3, p.B2, p.A1);
    const b3 = ratio(p.A1, p.B3, p.A2);
    const c1 = 1 / ratio(p.A2, p.C1, p.A3);
    const c2 = 1 / ratio(p.A3, p.C2, p.A1);
    const c3 = 1 / ratio(p.A1, p.C3, p.A2);
    return b1 * b2 * b3 + c1 * c2 * c3 + b1 * c1 + b2 * c2 + b3 * c3;
  }

  /** The same six numbers straight from the integer indices, without geometry. */
  function numbers(pos) {
    const out = {};
    for (const m of MARKS) {
      const i = pos.marks[m], n = pos.grid[SIDE_OF[m]];
      out[m] = m[0] === "B" ? (n - i) / i : i / (n - i);
    }
    return out;
  }

  /** The page's (*) left-hand side from integer indices: F = 1 means concurrence. */
  function formulaFromIndices(pos) {
    const v = numbers(pos);
    return v.B1 * v.B2 * v.B3 + v.C1 * v.C2 * v.C3 +
      v.B1 * v.C1 + v.B2 * v.C2 + v.B3 * v.C3;
  }

  /** Signed barycentric coordinates of a point in the triangle. */
  function barycentric(pos, p) {
    const { A1, A2, A3 } = pos.corners;
    const total = cross(A1, A2, A3);
    if (Math.abs(total) < EPS) return null;
    return {
      x: cross(A2, A3, p) / total,
      y: cross(A3, A1, p) / total,
      z: cross(A1, A2, p) / total,
    };
  }

  /** The barycentric line through two points: their cross product. */
  function lineThrough(pos, p, q) {
    const a = barycentric(pos, p), b = barycentric(pos, q);
    if (!a || !b) return null;
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  /** The three lines C1B2, C2B3, C3B1 of the page, from actual point positions. */
  function lines(pos) {
    const p = points(pos);
    return [
      lineThrough(pos, p.C1, p.B2),
      lineThrough(pos, p.C2, p.B3),
      lineThrough(pos, p.C3, p.B1),
    ];
  }

  /** Determinant of the three line coefficient rows: zero means concurrent. */
  function lineDeterminant(pos) {
    const [l, m, n] = lines(pos);
    if (!l || !m || !n) return NaN;
    return l.x * (m.y * n.z - m.z * n.y)
      - l.y * (m.x * n.z - m.z * n.x)
      + l.z * (m.x * n.y - m.y * n.x);
  }

  const norm = (l) => Math.hypot(l.x, l.y, l.z);
  /** Independent concurrency test: the determinant, scaled by the line sizes. */
  function concurrent(pos) {
    const ls = lines(pos);
    if (ls.some((l) => !l || norm(l) < EPS)) return false;
    const d = lineDeterminant(pos);
    const scale = norm(ls[0]) * norm(ls[1]) * norm(ls[2]);
    return Number.isFinite(d) && Math.abs(d) <= 1e-9 * Math.max(1, scale);
  }

  /** Cart where two barycentric lines meet, or null for a point at infinity. */
  function lineIntersection(pos, l, m) {
    const w = {
      x: l.y * m.z - l.z * m.y,
      y: l.z * m.x - l.x * m.z,
      z: l.x * m.y - l.y * m.x,
    };
    const s = w.x + w.y + w.z;
    if (Math.abs(s) < 1e-9) return null;
    const { A1, A2, A3 } = pos.corners;
    return {
      x: (w.x * A1.x + w.y * A2.x + w.z * A3.x) / s,
      y: (w.x * A1.y + w.y * A2.y + w.z * A3.y) / s,
    };
  }

  /** The three crossings and their barycenter; the applet shows P when finished. */
  function crossings(pos) {
    const [l, m, n] = lines(pos);
    if (!l || !m || !n) return { points: [null, null, null], center: null };
    const pts = [
      lineIntersection(pos, l, m),
      lineIntersection(pos, m, n),
      lineIntersection(pos, n, l),
    ];
    const finite = pts.filter(Boolean);
    const center = finite.length
      ? { x: finite.reduce((s, p) => s + p.x, 0) / finite.length,
          y: finite.reduce((s, p) => s + p.y, 0) / finite.length }
      : null;
    return { points: pts, center };
  }

  /** Compute(): the applet's Finished flag is |1 - F| < 0.01. */
  function finished(pos) {
    return Math.abs(1 - formula(pos)) < 0.01;
  }

  /** The full result the page shows under the picture. */
  function evaluate(pos) {
    const f = formula(pos);
    return {
      formula: f,
      numbers: numbers(pos),
      finished: Math.abs(1 - f) < 0.01,
      concurrent: concurrent(pos),
      crossings: crossings(pos),
    };
  }

  /** Six integer indices, for the "Escher pattern" enumeration in the tests. */
  function fromIndices(divisions, iB1, iC1, iB2, iC2, iB3, iC3) {
    return start({ divisions, grid: divisions,
      marks: { B1: iB1, C1: iC1, B2: iB2, C2: iC2, B3: iB3, C3: iC3 } });
  }

  function format(value, digits) {
    if (!Number.isFinite(value)) return String(value);
    const d = Math.max(0, Math.min(6, round(digits === undefined ? 3 : digits)));
    return value.toFixed(d).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  /** An illustration has no winner and no loser. */
  function result(/* pos */) { return null; }

  return {
    DIV_MIN, DIV_MAX, PANEL_START, GRID_START, MARKS_START, SIDE_OF, ENDS_OF, MARKS,
    options, start, pointOnSide, points, moveCorner, dragMark, stepMark, setDivisions,
    ratio, formula, numbers, formulaFromIndices,
    barycentric, lineThrough, lines, lineDeterminant, concurrent,
    lineIntersection, crossings, finished, evaluate, fromIndices, format, result,
  };
})();
