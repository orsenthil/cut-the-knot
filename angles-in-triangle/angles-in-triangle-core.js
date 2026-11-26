"use strict";

/*
 * Angles in a Triangle, from Alexander Bogomolny's applet AnglesInTriangle.
 *
 * The Java applet draws a triangle ABC, picks the vertex with the largest
 * angle and folds the other two corners onto D, the foot of the altitude from
 * that vertex. Its own page ("Angles in Triangle Add to 180") proves that the
 * three folded angles fill the straight angle at D. The manifest's article
 * ("Angles in a Triangle: an Exercise") instead asks for the angle ADC of one
 * particular triangle: AB = AC, angle BAC = 120 degrees, BC = sqrt(5), with an
 * interior point D satisfying BD = 1 and CD = sqrt(2). Both claims are checked
 * here; the page offers the exercise as a preset on the same drawing.
 *
 * The geometry below follows the bytecode: the vertices and the copy's centre
 * P start as in AnglesInTriangleCanvas.init, FindLargestAngle picks the vertex,
 * FindFolding builds E, F, D, G, H, and Compute computes the copy translated
 * so that the centroid sits at P. No document, no window, no storage: this
 * file defines the global AnglesInTriangleCore and nothing else.
 */
const AnglesInTriangleCore = (() => {
  // The viewBox the page uses; the applet used its canvas size instead.
  const WIDTH = 360;
  const HEIGHT = 240;
  const TWO_THIRDS_PI = 2.0943951023931953; // applet's 120 degrees in radians

  // Scale and origin of the exercise preset in board units.
  const EX_SCALE = 110;
  const EX_ORIGIN = { x: 55, y: 170 };

  const ROOT2 = Math.SQRT2;
  const ROOT3 = Math.sqrt(3);
  const ROOT5 = Math.sqrt(5);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const degrees = (rad) => (rad * 180) / Math.PI;
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const copy = (p) => ({ x: p.x, y: p.y });

  /* GeoSDoub.ComputeAngle, from its bytecode. The core clamps the cosine so a
     dragged, nearly degenerate triangle still returns a number; the second
     transcription in the test does not clamp. */
  function angle(v, p, q) {
    const cos = (sqDist(v, p) + sqDist(v, q) - sqDist(p, q)) /
      (2 * dist(v, p) * dist(v, q));
    return Math.acos(clamp(cos, -1, 1));
  }

  /* GeoSDoub.NearestPoint(p, a, b), from its bytecode: the foot of the
     perpendicular from p to line(a,b), with the applet's own guard comparing
     |p-a| with sqrt(0.1) rather than the length of the segment. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return copy(p);
    const dot = (p.x - a.x) * dx + (p.y - a.y) * dy;
    const t = dot / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /* FindLargestAngle: strict bytecode order, so ties go to A, then B. */
  function largestVertex(s) {
    const a = angle(s.A, s.B, s.C);
    const b = angle(s.B, s.C, s.A);
    const c = angle(s.C, s.A, s.B);
    if (a >= b && a >= c) return { name: "A", point: s.A };
    if (b >= a && b >= c) return { name: "B", point: s.B };
    if (c >= a && c >= b) return { name: "C", point: s.C };
    return null;
  }

  /* FindFolding(K,L,M): K is the largest-angle vertex. E and F are the
     midpoints of KL and MK, D is the foot of the altitude from K onto LM, and
     G and H are the midpoints of DL and DM. */
  function folding(K, L, M) {
    const E = midpoint(K, L);
    const F = midpoint(M, K);
    const D = nearestPoint(K, L, M);
    const G = midpoint(D, L);
    const H = midpoint(D, M);
    return { K: copy(K), L: copy(L), M: copy(M), E, F, D, G, H };
  }

  /* A new picture: the same positions the applet builds in init(), scaled to
     this page's viewBox. R = min(W,H)/3; the triangle's centre is (W/3,H/2). */
  function start(options) {
    const o = options || {};
    const R = Math.min(WIDTH, HEIGHT) / 3;
    const cx = WIDTH / 3, cy = HEIGHT / 2;
    const A = { x: cx + R - WIDTH / 8, y: cy + HEIGHT / 6 };
    const B = { x: cx + R * Math.cos(TWO_THIRDS_PI), y: cy - R * Math.sin(TWO_THIRDS_PI) };
    const C = { x: cx + R * Math.cos(2 * TWO_THIRDS_PI), y: cy - R * Math.sin(2 * TWO_THIRDS_PI) };
    return {
      A: A, B: B, C: C,
      P: { x: 2 * cx, y: cy },
      exercisePoint: null,
      scale: EX_SCALE,
      preset: "folding",
      showNames: !!o.showNames,
    };
  }

  /* Canonical exercise, Solution 2 of the article: lengths in units where
     BC = sqrt(5). The maths convention has y pointing up; the board has it
     pointing down. */
  function exerciseGeometry() {
    return {
      B: { x: -2 / ROOT5, y: 0 },
      C: { x: 3 / ROOT5, y: 0 },
      D: { x: 0, y: 1 / ROOT5 },
      A: { x: 1 / (2 * ROOT5), y: ROOT5 / (2 * ROOT3) },
    };
  }

  function toBoard(p) {
    return {
      x: EX_ORIGIN.x + (p.x + 2 / ROOT5) * EX_SCALE,
      y: EX_ORIGIN.y - p.y * EX_SCALE,
    };
  }

  /** The exercise as a preset of the same folding drawing. */
  function exercisePreset(options) {
    const o = options || {};
    const g = exerciseGeometry();
    return {
      A: toBoard(g.A), B: toBoard(g.B), C: toBoard(g.C),
      // P is a little left of the applet's 2W/3 so the copy of this wide
      // exercise triangle stays inside the viewBox.
      P: { x: WIDTH * 0.625, y: HEIGHT / 2 },
      exercisePoint: toBoard(g.D),
      scale: EX_SCALE,
      preset: "exercise",
      showNames: o.showNames !== undefined ? !!o.showNames : true,
    };
  }

  function clampToBoard(p) {
    return { x: clamp(p.x, 12, WIDTH - 12), y: clamp(p.y, 12, HEIGHT - 12) };
  }

  /** Returns a new position with one draggable point moved. */
  function movePoint(s, name, p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return s;
    if (!["A", "B", "C", "P", "D"].includes(name)) return s;
    if (name === "D" && !s.exercisePoint) return s;
    return Object.assign({}, s, { [name === "D" ? "exercisePoint" : name]: clampToBoard(p) });
  }

  function setShowNames(s, on) {
    return Object.assign({}, s, { showNames: !!on });
  }

  /** All the derived geometry, recomputed from the position on every draw. */
  function compute(s) {
    const centroid = {
      x: (s.A.x + s.B.x + s.C.x) / 3,
      y: (s.A.y + s.B.y + s.C.y) / 3,
    };
    const shift = (p) => ({ x: s.P.x + p.x - centroid.x, y: s.P.y + p.y - centroid.y });
    const angles = {
      A: angle(s.A, s.B, s.C),
      B: angle(s.B, s.C, s.A),
      C: angle(s.C, s.A, s.B),
    };
    const vertex = largestVertex(s);
    const fold = vertex
      ? folding(vertex.point,
          vertex.name === "A" ? s.B : vertex.name === "B" ? s.C : s.A,
          vertex.name === "A" ? s.C : vertex.name === "B" ? s.A : s.B)
      : null;

    let folded = null;
    let foldedAngles = null;
    let sum = null;
    if (fold) {
      folded = {
        D: shift(fold.D), E: shift(fold.E), F: shift(fold.F),
        G: shift(fold.G), H: shift(fold.H),
        K: shift(fold.K), L: shift(fold.L), M: shift(fold.M),
      };
      /* Folding over EF sends K to D, over EG sends L to D, and over FH sends
         M to D. These are the three copies of the triangle's angles at D. */
      foldedAngles = {
        L: angle(fold.D, fold.G, fold.E),
        K: angle(fold.D, fold.E, fold.F),
        M: angle(fold.D, fold.F, fold.H),
      };
      sum = foldedAngles.K + foldedAngles.L + foldedAngles.M;
    }

    let exercise = null;
    if (s.exercisePoint) {
      const D = s.exercisePoint, scale = s.scale || EX_SCALE;
      const lengths = {
        AB: dist(s.A, s.B) / scale,
        AC: dist(s.A, s.C) / scale,
        BC: dist(s.B, s.C) / scale,
        BD: dist(D, s.B) / scale,
        CD: dist(D, s.C) / scale,
        AD: dist(D, s.A) / scale,
      };
      exercise = {
        point: copy(D),
        lengths: lengths,
        BAC: angle(s.A, s.B, s.C),
        ADC: angle(D, s.A, s.C),
        BDC: angle(D, s.B, s.C),
        cosBDC: (lengths.BD ** 2 + lengths.CD ** 2 - lengths.BC ** 2) /
          (2 * lengths.BD * lengths.CD),
      };
    }
    return {
      centroid: centroid,
      copy: { A: shift(s.A), B: shift(s.B), C: shift(s.C) },
      angles: angles,
      largest: vertex ? vertex.name : null,
      fold: fold,
      folded: folded,
      foldedAngles: foldedAngles,
      sum: sum,
      exercise: exercise,
    };
  }

  const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6);

  /** "1", "sqrt(2)", "sqrt(5)" for the exact preset, a decimal after a drag. */
  function lengthText(v) {
    if (near(v, 1, 1e-5)) return "1";
    if (near(v, ROOT2, 1e-5)) return "\u221a2";
    if (near(v, ROOT5, 1e-5)) return "\u221a5";
    return v.toFixed(2);
  }

  /** The line under the drawing. An illustration has no winner to announce. */
  function describe(s) {
    const g = compute(s);
    const parts = [];
    if (g.foldedAngles) {
      const a = Math.round(degrees(g.foldedAngles.K));
      const b = Math.round(degrees(g.foldedAngles.L));
      const c = Math.round(degrees(g.foldedAngles.M));
      parts.push(`Fold ${g.largest} and the other two corners onto D: ` +
        `${a}\u00b0 + ${b}\u00b0 + ${c}\u00b0 = ${a + b + c}\u00b0.`);
    }
    if (g.exercise) {
      const e = g.exercise;
      parts.push(`Exercise: BD = ${lengthText(e.lengths.BD)}, CD = ${lengthText(e.lengths.CD)}, ` +
        `so angle ADC = ${Math.round(degrees(e.ADC))}\u00b0.`);
    }
    return parts.join(" ");
  }

  /** No win, loss or finish: this is an illustration the player explores. */
  function result() {
    return null;
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, TWO_THIRDS_PI: TWO_THIRDS_PI,
    EX_SCALE: EX_SCALE, EX_ORIGIN: EX_ORIGIN,
    ROOT2: ROOT2, ROOT3: ROOT3, ROOT5: ROOT5,
    clamp: clamp, sqDist: sqDist, dist: dist, degrees: degrees,
    midpoint: midpoint, angle: angle, nearestPoint: nearestPoint,
    largestVertex: largestVertex, folding: folding,
    start: start, exerciseGeometry: exerciseGeometry, toBoard: toBoard,
    exercisePreset: exercisePreset, movePoint: movePoint,
    setShowNames: setShowNames, compute: compute, describe: describe,
    lengthText: lengthText, result: result,
  };
})();
