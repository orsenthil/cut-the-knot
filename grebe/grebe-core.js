"use strict";

/*
 * Grebe, from Alexander Bogomolny's applet Grebe (cut-the-knot.org,
 * "Grebe's Theorem", with the explanation on the Bride's Chair column).
 *
 * Drag a triangle ABC. A square is built on each side; the far sides of the
 * squares meet in a second triangle A'B'C'. Grebe's theorem says AA', BB'
 * and CC' all pass through one point K, the Lemoine (symmedian) point: the
 * two triangles are homothetic from K. The applet's other two modes show the
 * friendship of O (the circumcentre) and K: lines through K meet the
 * circumcentres of the flanks, and lines through O meet the Lemoine points
 * of those flanks.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, GrebeCore. Every point is a plain {x, y}
 * in board units, so the page and the tutor can save it as it is. The
 * construction follows GrebeCanvas.FormSquare(), DrawGrebe(), DrawOK(),
 * DrawKO(), ComputeLemoine(), ReflectPointInLine() and GeoSDoub's Rotate(),
 * Intersect(), FindAngleBisector(), FindAltitude() and FindCircumcenter().
 */
const GrebeCore = (() => {
  /** The SVG's user-unit rectangle, matching the applet's 600 x 550 canvas. */
  const VIEW = { width: 600, height: 550 };
  const MARGIN = 14;

  /*
   * GrebeCanvas.init(): cx = w/2, cy = h/2, s = w/12, pad = 10;
   * A = (cx - 2s, cy + pad), B = (cx, cy + pad),
   * C = (cx - s - s*cos(60), cy - s*sin(60) - 2*pad).
   */
  const HALF_PI = Math.PI / 2;
  const CX = VIEW.width / 2;
  const CY = VIEW.height / 2;
  const STEP = VIEW.width / 12;
  const PAD = 10;
  const START = {
    A: { x: CX - 2 * STEP, y: CY + PAD },
    B: { x: CX, y: CY + PAD },
    C: {
      x: CX - STEP - STEP * Math.cos(Math.PI / 3),
      y: CY - STEP * Math.sin(Math.PI / 3) - 2 * PAD,
    },
  };

  const MODES = ["grebe", "OK", "KO"];
  const NAMES = ["A", "B", "C"];
  const PRIMES = ["A\u2032", "B\u2032", "C\u2032"];
  const CENTRES = ["O_a", "O_b", "O_c"];
  const FLANKS = ["K_a", "K_b", "K_c"];

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finitePoint = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const cross = (a, b, c, d) => (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  const twiceArea = (A, B, Cc) => cross(A, B, A, Cc);
  const sideSquares = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

  function clampToBoard(p) {
    return {
      x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    };
  }

  /** GeoSDoub.Rotate(centre, point, angle, dir): turn point about centre. */
  function rotate(centre, point, angle, dir) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = point.x - centre.x, dy = point.y - centre.y;
    return {
      x: centre.x + c * dx - dir * s * dy,
      y: centre.y + dir * s * dx + c * dy,
    };
  }

  /** GeoSDoub.Intersect(): line coefficients from the bytecode, NaN if parallel. */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = b1 * a2 - b2 * a1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
  }

  /** GeoSDoub.FindAngleBisector(p, q, r): where q's bisector meets qr's side. */
  function angleBisector(p, q, r) {
    const pq = dist(p, q), pr = dist(p, r), qr = dist(q, r);
    const angle = Math.acos(((pq * pq + pr * pr - qr * qr) / 2) / (pq * pr));
    const turn = twiceArea(p, q, r) > 0 ? 1 : -1;
    return intersect(p, rotate(p, q, angle / 2, turn), q, r);
  }

  /** GeoSDoub.FindAltitude(p, q, r): foot of the perpendicular from p to qr. */
  function altitude(p, q, r) {
    const at = { x: p.x + r.y - q.y, y: p.y - r.x + q.x };
    return intersect(p, at, q, r);
  }

  /** GrebeCanvas.ReflectPointInLine(): reflect p in the line q-r. */
  function reflect(p, q, r) {
    const foot = altitude(p, q, r);
    return { x: 2 * foot.x - p.x, y: 2 * foot.y - p.y };
  }

  /** GrebeCanvas.ComputeLemoine(): reflected medians give the symmedians. */
  function lemoine(p, q, r) {
    const b1 = angleBisector(p, q, r);
    const b2 = angleBisector(q, p, r);
    const b3 = angleBisector(r, q, p);
    const m1 = midpoint(q, r), m2 = midpoint(p, r), m3 = midpoint(p, q);
    const s1 = intersect(reflect(m1, b1, p), p, q, r);
    const s2 = intersect(reflect(m2, b2, q), q, p, r);
    const s3 = intersect(reflect(m3, b3, r), r, p, q);
    return intersect(s1, p, s2, q);
  }

  /** GeoSDoub.FindCircumcenter(): perpendicular bisectors of AB and BC. */
  function circumcenter(p, q, r) {
    const m1 = midpoint(p, q), m2 = midpoint(q, r);
    const a1 = { x: m1.x + q.y - p.y, y: m1.y - q.x + p.x };
    const a2 = { x: m2.x + r.y - q.y, y: m2.y - r.x + q.x };
    return intersect(m1, a1, m2, a2);
  }

  /**
   * Everything the three applet modes draw, as plain data. The names of the
   * square corners follow the applet's fields: AB and AC are the two far
   * corners of the square on BC, and so on.
   */
  function construct(A, B, Cc) {
    const T = [A, B, Cc];
    // FormSquare(A,B,CA,CB), FormSquare(B,C,AB,AC), FormSquare(C,A,BC,BA).
    const corners = {
      CA: rotate(A, B, HALF_PI, 1), CB: rotate(B, A, HALF_PI, -1),
      AB: rotate(B, Cc, HALF_PI, 1), AC: rotate(Cc, B, HALF_PI, -1),
      BC: rotate(Cc, A, HALF_PI, 1), BA: rotate(A, Cc, HALF_PI, -1),
    };

    const K = lemoine(A, B, Cc);

    // Grebe mode: the outer side of each square, and their intersections A',
    // B', C'. The order of the intersection calls is the applet's own.
    const outer = [intersect(corners.AB, corners.AC, corners.BA, corners.BC),
      intersect(corners.BA, corners.BC, corners.CA, corners.CB),
      intersect(corners.CA, corners.CB, corners.AB, corners.AC)];
    const primes = [outer[1], outer[2], outer[0]]; // A', B', C'

    // van Lamoen (OK): midlines of the squares through opposite side midpoints.
    const mid = {
      BAB: midpoint(B, corners.AB), CAC: midpoint(Cc, corners.AC),
      CBC: midpoint(Cc, corners.BC), ABA: midpoint(A, corners.BA),
      ACA: midpoint(A, corners.CA), BCB: midpoint(B, corners.CB),
    };
    const centreLines = [
      intersect(mid.BAB, mid.CAC, mid.CBC, mid.ABA),
      intersect(mid.CBC, mid.ABA, mid.ACA, mid.BCB),
      intersect(mid.ACA, mid.BCB, mid.BAB, mid.CAC),
    ];
    const flankCentres = [centreLines[1], centreLines[2], centreLines[0]]; // AO, BO, CO

    // van Lamoen (KO): the circumcentre O, and the Lemoine points of the
    // three flanks (each vertex with the two far corners next to it).
    const O = circumcenter(A, B, Cc);
    const flankK = [lemoine(A, corners.BA, corners.CA),
      lemoine(B, corners.CB, corners.AB),
      lemoine(Cc, corners.AC, corners.BC)];

    const points = [K, ...Object.values(corners), ...outer, ...centreLines,
      ...flankCentres, O, ...flankK];
    return {
      valid: points.every(finitePoint),
      A, B, C: Cc, corners, K, outer, primes, flankCentres, centreLines,
      O, flankK,
    };
  }

  /** K in barycentric coordinates: a^2 : b^2 : c^2 for the sides a=BC, etc. */
  function barycentric(p, A, B, Cc) {
    const d = twiceArea(A, B, Cc);
    if (d === 0) return null;
    const l2 = ((p.x - A.x) * (Cc.y - A.y) - (p.y - A.y) * (Cc.x - A.x)) / d;
    const l3 = ((B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x)) / d;
    return [1 - l2 - l3, l2, l3];
  }

  /** K as a weighted average of the corners, with weights a^2, b^2, c^2. */
  function lemoineClosed(A, B, Cc) {
    const w = [sideSquares(B, Cc), sideSquares(Cc, A), sideSquares(A, B)];
    const sum = w[0] + w[1] + w[2];
    return {
      x: (w[0] * A.x + w[1] * B.x + w[2] * Cc.x) / sum,
      y: (w[0] * A.y + w[1] * B.y + w[2] * Cc.y) / sum,
    };
  }

  /** The fixed scale of A'B'C' from ABC about K: (D - S) / D. */
  function factor(A, B, Cc) {
    const S = sideSquares(B, Cc) + sideSquares(Cc, A) + sideSquares(A, B);
    const D = twiceArea(A, B, Cc);
    return (D - S) / D;
  }

  /** Perpendicular distance from p to the line through a and b. */
  function distanceToSide(p, a, b) {
    return Math.abs(cross(a, b, a, p)) / dist(a, b);
  }

  function defaultOptions() {
    return { names: false, mode: "grebe" };
  }

  /** The applet's defaults: Show names off, the Grebe radio button selected. */
  function start(options) {
    const opts = defaultOptions();
    if (options) {
      if ("names" in options) opts.names = Boolean(options.names);
      if (MODES.includes(options.mode)) opts.mode = options.mode;
    }
    return {
      A: { ...START.A }, B: { ...START.B }, C: { ...START.C },
      options: opts, touches: 0,
    };
  }

  /** Move one corner; the old position is not changed. */
  function moveVertex(state, name, point) {
    if (!NAMES.includes(name) || !finitePoint(point)) return state;
    return { ...state, [name]: clampToBoard(point), touches: state.touches + 1 };
  }

  /** The applet also lets the whole triangle be dragged. */
  function moveAll(state, dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return state;
    return {
      ...state,
      A: clampToBoard({ x: state.A.x + dx, y: state.A.y + dy }),
      B: clampToBoard({ x: state.B.x + dx, y: state.B.y + dy }),
      C: clampToBoard({ x: state.C.x + dx, y: state.C.y + dy }),
      touches: state.touches + 1,
    };
  }

  /** The panel's Show names checkbox and its three-way mode group. */
  function setOption(state, name, value) {
    if (name === "names") {
      return { ...state, options: { ...state.options, names: Boolean(value) } };
    }
    if (name === "mode" && MODES.includes(value)) {
      return { ...state, options: { ...state.options, mode: value } };
    }
    return state;
  }

  /** An illustration has no win or loss: Track counts it once explored. */
  function result() {
    return null;
  }

  /** The status line: the invariant the player can watch in the chosen mode. */
  function label(g, mode) {
    if (!g || !g.valid) return "Move the corners apart so the lines have room to meet.";
    if (mode === "OK") {
      return "van Lamoen (OK): the lines through K meet the circumcentres O_a, O_b and O_c of the flanks.";
    }
    if (mode === "KO") {
      return "van Lamoen (KO): the lines through O meet the Lemoine points K_a, K_b and K_c of the flanks.";
    }
    const r = factor(g.A, g.B, g.C);
    return `Grebe: A–A\u2032, B–B\u2032 and C–C\u2032 meet at K. A\u2032B\u2032C\u2032 is a ${r.toFixed(2)} times copy of ABC, centred at K.`;
  }

  return {
    VIEW, START, HALF_PI, MODES, NAMES, PRIMES, CENTRES, FLANKS,
    start, moveVertex, moveAll, setOption, result, construct, label,
    rotate, intersect, angleBisector, altitude, reflect, lemoine,
    circumcenter, barycentric, lemoineClosed, factor, distanceToSide,
    dist, midpoint, cross, twiceArea, sideSquares, finitePoint, clampToBoard,
  };
})();
