"use strict";

/*
 * Gergonne and Soddy lines, from Alexander Bogomolny's applet
 * GergonneAndSoddy (cut-the-knot.org/Curriculum/Geometry/GergonneAndSoddy.shtml).
 *
 * The page's claim: wherever the Soddy line is uniquely defined (in
 * particular in a scalene triangle), it is perpendicular to the Gergonne line.
 * GergonneAndSoddyCanvas.Compute() supplies this construction:
 *
 *   I      = GeoSDoub.FindIncenter(A, B, C)
 *   A1/B1/C1 = feet of I on BC / CA / AB       (GeoSDoub.NearestPoint)
 *   A2     = BC   intersect B1C1
 *   B2     = CA   intersect C1A1                (the three Nobbs points)
 *   C2     = AB   intersect A1B1
 *   Ge     = average of AA^BB, BB^CC, CC^AA    (the Gergonne point)
 *   SL     = line Ge-I, unless they are nearer than 2 pixels
 *   GL     = a line through two of A2, B2, C2, chosen by InsideTest
 *   S      = GL intersect SL
 *
 * ShowStatement() marks the right angle at S; ShowInversion() inverts AB, BC,
 * CA, GL, B1C1, C1A1 and A1B1 in the incircle (InvLine.InvertLinC). All four
 * of the applet's checkboxes are options here. The first on-page applet has
 * no Show parameter (names and statement off); the proof applet has Show=1
 * (both on). This port opens in the proof view, with names and statement on.
 *
 * No DOM, no window, no storage: the position is plain data and every
 * function returns new values. The drawing script only renders it.
 */
const GergonneAndSoddyCore = (() => {
  /** The board in SVG user units. The live page embeds two 500x500 applets. */
  const WIDTH = 500;
  const HEIGHT = 500;
  const MARGIN = 2; // the applet's PointIsEligible keeps draggable points inside

  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const cross = (p, q) => p.x * q.y - p.y * q.x;

  const clampToBoard = (p, width, height) => ({
    x: Math.max(MARGIN, Math.min(width - MARGIN, p.x)),
    y: Math.max(MARGIN, Math.min(height - MARGIN, p.y)),
  });

  /** GeoSDoub.NearestPoint(P,A,B), including its SqDist(A,B) < 0.1 guard. */
  function nearest(p, a, b) {
    if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 <= 0) return { x: p.x, y: p.y };
    const t = dot(sub(p, a), d) / len2;
    return { x: a.x + d.x * t, y: a.y + d.y * t };
  }

  /** GeoSDoub.Intersect of two infinite lines, with its |det| < 1 guard. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** Side-length weights, equal to FindIncenter's two bisectors' intersection. */
  function incenter(A, B, C) {
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const sum = a + b + c;
    if (!Number.isFinite(sum) || sum < 1e-12) return { x: NaN, y: NaN };
    return {
      x: (a * A.x + b * B.x + c * C.x) / sum,
      y: (a * A.y + b * B.y + c * C.y) / sum,
    };
  }

  /** InsideTest.IsInside(P,A,B): dot(P-A, P-B) <= 0. */
  const isInside = (p, a, b) => dot(sub(p, a), sub(p, b)) <= 0;

  const line = (p, q) => ({ p: { x: p.x, y: p.y }, q: { x: q.x, y: q.y } });
  const average = (p, q, r) => ({
    x: (p.x + q.x + r.x) / 3,
    y: (p.y + q.y + r.y) / 3,
  });

  /** Distance from a point to the infinite line through p and q. */
  function lineDistance(z, l) {
    const d = sub(l.q, l.p);
    const len = Math.hypot(d.x, d.y);
    return len < 1e-12 ? Infinity : Math.abs(cross(sub(z, l.p), d)) / len;
  }

  /** InvLine.InvertLinC: a line becomes a circle through I (or stays a line). */
  function invertLine(l, I, r) {
    const d = lineDistance(I, l);
    if (!Number.isFinite(d) || d <= 0.1) return { kind: "line", line: l };
    const f = nearest(I, l.p, l.q);
    const k = (r * r) / (d * d);
    const far = { x: I.x + k * (f.x - I.x), y: I.y + k * (f.y - I.y) };
    return {
      kind: "circle",
      c: { x: (I.x + far.x) / 2, y: (I.y + far.y) / 2 },
      r: dist(I, far) / 2,
    };
  }

  /** Applet init(): A=(3W/4,2H/3), B=(5W/9,H/3), C=(5W/11,H/2). */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    return {
      width: width,
      height: height,
      A: { x: (3 * width) / 4, y: (2 * height) / 3 },
      B: { x: (5 * width) / 9, y: height / 3 },
      C: { x: (5 * width) / 11, y: height / 2 },
      names: true,         // the proof applet's <param name="Show" value="1">
      premises: false,     // the panel's four checkboxes start unchecked
      statement: true,
      inversion: false,
    };
  }

  function reset(state) {
    const fresh = start({ width: state.width, height: state.height });
    return {
      ...fresh,
      names: state.names,
      premises: state.premises,
      statement: state.statement,
      inversion: state.inversion,
    };
  }

  function setPoint(state, name, p) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    if (!finite(p)) return state;
    return { ...state, [name]: clampToBoard(p, state.width, state.height) };
  }

  function setOption(state, key, on) {
    if (!(key in { names: 1, premises: 1, statement: 1, inversion: 1 })) return state;
    return { ...state, [key]: Boolean(on) };
  }

  /** What the player's record and the tutor see: points in board units. */
  function position(state) {
    return {
      A: state.A, B: state.B, C: state.C,
      names: state.names, premises: state.premises,
      statement: state.statement, inversion: state.inversion,
    };
  }

  /**
   * The whole figure. Every number is finite for a non-degenerate triangle;
   * `valid: false` means the construction has no picture to draw.
   */
  function geometry(state) {
    const { A, B, C } = state;
    if (!finite(A) || !finite(B) || !finite(C)) return { valid: false };
    const area = cross(sub(B, A), sub(C, A));
    if (Math.abs(area) < 1e-6) return { valid: false };

    const I = incenter(A, B, C);
    if (!finite(I)) return { valid: false };

    // Compute(): the three touch points and the lines through them.
    const C1 = nearest(I, B, A);   // on AB
    const B1 = nearest(I, A, C);   // on AC
    const A1 = nearest(I, C, B);   // on BC
    const r = (
      dist(I, nearest(I, A, B)) + dist(I, nearest(I, B, C)) + dist(I, nearest(I, C, A))
    ) / 3;
    if (!finite(A1) || !finite(B1) || !finite(C1) || !Number.isFinite(r) || r <= 0) {
      return { valid: false };
    }

    const AB = line(A, B), BC = line(B, C), CA = line(C, A);
    const AA = line(A, A1), BB = line(B, B1), CC = line(C, C1);
    const A1B1 = line(A1, B1), B1C1 = line(B1, C1), C1A1 = line(C1, A1);

    const A2 = intersect(BC.p, BC.q, B1C1.p, B1C1.q);
    const B2 = intersect(CA.p, CA.q, C1A1.p, C1A1.q);
    const C2 = intersect(AB.p, AB.q, A1B1.p, A1B1.q);
    if (!finite(A2) || !finite(B2) || !finite(C2)) return { valid: false };

    // Ge is the average of the three pairwise cevian intersections.
    const Ge = average(
      intersect(AA.p, AA.q, BB.p, BB.q),
      intersect(BB.p, BB.q, CC.p, CC.q),
      intersect(CC.p, CC.q, AA.p, AA.q),
    );
    if (!finite(Ge) || Math.abs(Ge.x) > 1e8 || Math.abs(Ge.y) > 1e8) return { valid: false };

    // SL: GetLine(Ge, Incircle, SLine) reuses the old line when Ge is within
    // two pixels of I. On the first computation that means no Soddy line.
    const soddyDefined = dist(Ge, I) >= 2;
    const SL = soddyDefined ? line(I, Ge) : null;

    // GL: pick the two Nobbs points with no third point between them.
    let GL;
    if (isInside(B2, A2, C2)) GL = line(A2, C2);
    else if (isInside(C2, A2, B2)) GL = line(A2, B2);
    else GL = line(B2, C2);

    const S = SL ? intersect(SL.p, SL.q, GL.p, GL.q) : null;
    const glDir = sub(GL.q, GL.p);
    const slDir = SL ? sub(SL.q, SL.p) : null;
    const glLen = Math.hypot(glDir.x, glDir.y);
    const slLen = slDir ? Math.hypot(slDir.x, slDir.y) : 0;
    const cosAngle = glLen > 1e-9 && slLen > 1e-9
      ? dot(glDir, slDir) / (glLen * slLen) : null;
    const angle = cosAngle === null ? null
      : (Math.acos(Math.max(-1, Math.min(1, Math.abs(cosAngle)))) * 180) / Math.PI;

    // ShowStatement(): mark the right angle at S against the two Nobbs
    // points that straddle the third one.
    const marks = [];
    if (isInside(A2, B2, C2)) marks.push(B2, C2);
    if (isInside(B2, C2, A2)) marks.push(C2, A2);
    if (isInside(C2, A2, B2)) marks.push(A2, B2);

    // ShowInversion(): the same seven lines, in the applet's own order.
    const sources = [
      { key: "AB", line: AB }, { key: "BC", line: BC }, { key: "CA", line: CA },
      { key: "GL", line: GL }, { key: "B1C1", line: B1C1 },
      { key: "C1A1", line: C1A1 }, { key: "A1B1", line: A1B1 },
    ];
    const inversions = sources.map((s) => ({ key: s.key, ...invertLine(s.line, I, r) }));

    return {
      valid: true, I, r, A1, B1, C1, A2, B2, C2, Ge, S,
      lines: { AB, BC, CA, AA, BB, CC, A1B1, B1C1, C1A1, GL, SL },
      nobbsOrder: [A2, B2, C2],
      angle: angle === null ? null : Math.min(angle, 180 - angle),
      soddyDefined, marks, inversions,
    };
  }

  return {
    WIDTH, HEIGHT, MARGIN,
    start, reset, setPoint, setOption, position, geometry,
    nearest, intersect, incenter, isInside, line, lineDistance, invertLine,
  };
})();
