"use strict";

/*
 * Hinged Napoleon — Alexander Bogomolny's applet HingedNapoleon, whose page
 * ("Napoleon on Hinges") still embeds the Java applet. It illustrates a proof
 * of Napoleon's theorem: the centres Ac, Bc, Cc of equilateral triangles
 * erected on BC, CA, AB themselves form an equilateral triangle. Two of the
 * three triangles ABcCc, BcAcCc and AcBcCc can be swivelled about their
 * centres; at 120 degrees the two hinged corners land on the third corner and
 * the hinged pieces close into the dissection of AcBcCc.
 *
 * Every formula here is transcribed from the applet's Compute() bytecode:
 * GeoSDoub.Rotate(centre, point, angle, -1) and CTKGeometryPlus.Barycenter of
 * three points. The scrollbar is Scrollbar(HORIZONTAL, 0, 5, 0, 125), so its
 * reachable values are 0..120 (Java caps value at maximum - visibleAmount),
 * and the panel's CheckboxGroup starts with "B, C" selected and "Show names"
 * off. The page's claims are measured separately, in geometry().
 *
 * No document, no window, no storage: one global, HingedNapoleonCore, with
 * plain-data positions in the SVG viewBox units.
 */

const HingedNapoleonCore = (() => {
  /* The Java canvas is 640 by 460 on the page; init() uses those dimensions. */
  const VIEW = { x: 0, y: 0, width: 640, height: 460 };
  const PAD = 12;
  const LIMITS = {
    angle: { min: 0, max: 120, initial: 0, step: 1 },
    swivel: { min: 0, max: 2, initial: 0, step: 1 },
  };
  const SWIVEL_NAMES = ["B, C", "A, C", "A, B"];
  /* The two centres about which the applet turns pieces, for each checkbox. */
  const SWIVEL_CENTRES = [["Cc", "Bc"], ["Cc", "Ac"], ["Bc", "Ac"]];
  /* The two hinged corners and the corner they land on at 120 degrees. */
  const SWIVEL_CORNERS = [["B", "C", "A"], ["A", "C", "B"], ["A", "B", "C"]];

  const point = (x, y) => ({ x, y });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (p, q, r) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const area = (p, q, r) => Math.abs(cross(p, q, r)) / 2;

  /** Angle at vertex v between rays v->p and v->q, in degrees. */
  function angle(v, p, q) {
    const a = point(p.x - v.x, p.y - v.y), b = point(q.x - v.x, q.y - v.y);
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!n) return NaN;
    const c = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / n));
    return Math.acos(c) * 180 / Math.PI;
  }

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /** GeoSDoub.Rotate(centre, moving, angle, orientation). */
  function rotate(centre, moving, radians, orientation) {
    const co = Math.cos(radians), si = Math.sin(radians);
    const s = orientation === undefined || orientation < 0 ? -1 : 1;
    return point(
      centre.x + co * (moving.x - centre.x) - s * si * (moving.y - centre.y),
      centre.y + s * si * (moving.x - centre.x) + co * (moving.y - centre.y),
    );
  }

  /** CTKGeometryPlus.Barycenter of three DoubPoints. */
  function barycenter(p, q, r) {
    return point((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
  }

  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, n = dx * dx + dy * dy;
    if (!n) return a;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / n;
    return point(a.x + dx * t, a.y + dy * t);
  }

  /** Reflection of p in the line through a and b (the page's Fermat clue). */
  function reflect(p, a, b) {
    const f = foot(p, a, b);
    return point(2 * f.x - p.x, 2 * f.y - p.y);
  }

  /** HingedNapoleonCanvas.init(): three points at the applet's fixed fractions. */
  function initialTriangle() {
    const w = VIEW.width, h = VIEW.height;
    return [
      point(w / 2, h / 4),
      point(2 * w / 3, h / 2),
      point(6 * w / 13, 8 * h / 15),
    ];
  }

  function normalize(name, raw) {
    const lim = LIMITS[name];
    if (!lim) return raw;
    const n = Number(raw);
    if (!Number.isFinite(n)) return lim.initial;
    return Math.round(Math.max(lim.min, Math.min(lim.max, n)));
  }

  function start(options) {
    const o = options || {};
    const [A, B, C] = initialTriangle();
    return {
      A, B, C,
      options: {
        angle: normalize("angle", o.angle === undefined ? LIMITS.angle.initial : o.angle),
        swivel: normalize("swivel", o.swivel === undefined ? LIMITS.swivel.initial : o.swivel),
        names: o.names === undefined ? false : !!o.names,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start({ names: state ? state.options.names : undefined });
    if (state) s.explored = !!state.explored;
    return s;
  }

  function move(state, name, p) {
    if (!state || !["A", "B", "C", "D"].includes(name)) return state;
    if (name === "D") return state; // the applet has no fourth draggable corner
    if (!finite(p)) return state;
    return Object.assign({}, state, { [name]: clamp(p), explored: true });
  }

  function setOption(state, name, value) {
    if (!state || !state.options || !Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    const v = name === "names" ? !!value : normalize(name, value);
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: v }), explored: true,
    });
  }

  /**
   * HingedNapoleonCanvas.Compute(), line for line. `orientation` is the
   * applet's final argument to GeoSDoub.Rotate: -1 for the outward triangles
   * the applet draws, +1 for the inward version of Napoleon's theorem.
   */
  function compute(a, b, c, angleDeg, swivel, orientation) {
    if (![a, b, c].every(finite)) return null;
    const deg = Number(angleDeg), sw = Number(swivel);
    if (!Number.isFinite(deg) || !Number.isFinite(sw)) return null;
    const s = orientation === undefined || orientation < 0 ? -1 : 1;
    const r60 = Math.PI / 3;
    const rad = deg * Math.PI / 180;

    const Ap = rotate(b, c, r60, s);
    const Bp = rotate(c, a, r60, s);
    const Cp = rotate(a, b, r60, s);
    const Ac = barycenter(Ap, b, c);
    const Bc = barycenter(a, Bp, c);
    const Cc = barycenter(a, b, Cp);
    const Aq = rotate(Bc, Cc, r60, s);
    const Bq = rotate(Cc, Ac, r60, s);
    const Cq = rotate(Ac, Bc, r60, s);

    const polys = [
      [a, Bc, Cc],
      [b, Cc, Ac],
      [c, Ac, Bc],
    ];
    let hinges, starKey, centreKeys, landingIndices, starIndices;
    const idx = Math.max(0, Math.min(2, Math.round(sw)));
    if (idx === 0) {
      hinges = [
        rotate(Cc, b, -rad, s), rotate(Cc, Ac, -rad, s),
        rotate(Bc, c, rad, s), rotate(Bc, Ac, rad, s),
      ];
      polys.push([Cc, hinges[0], hinges[1]], [Bc, hinges[2], hinges[3]]);
      starKey = "Aq"; centreKeys = SWIVEL_CENTRES[0];
      landingIndices = [0, 2]; starIndices = [1, 3];
    } else if (idx === 1) {
      hinges = [
        rotate(Cc, Bc, rad, s), rotate(Cc, a, rad, s),
        rotate(Ac, c, -rad, s), rotate(Ac, Bc, -rad, s),
      ];
      polys.push([Cc, hinges[0], hinges[1]], [Ac, hinges[2], hinges[3]]);
      starKey = "Bq"; centreKeys = SWIVEL_CENTRES[1];
      landingIndices = [1, 2]; starIndices = [0, 3];
    } else {
      hinges = [
        rotate(Bc, Cc, -rad, s), rotate(Bc, a, -rad, s),
        rotate(Ac, Cc, rad, s), rotate(Ac, b, rad, s),
      ];
      polys.push([Bc, hinges[0], hinges[1]], [Ac, hinges[2], hinges[3]]);
      starKey = "Cq"; centreKeys = SWIVEL_CENTRES[2];
      landingIndices = [1, 3]; starIndices = [0, 2];
    }

    const centres = { Ac, Bc, Cc };
    const vertices = { A: a, B: b, C: c };
    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, a));
    const tol = 1e-7 * scale;
    const sides = [dist(Ac, Bc), dist(Bc, Cc), dist(Cc, Ac)];
    const spread = (xs) => (xs.length ? Math.max(...xs) - Math.min(...xs) : Infinity);
    const baseAngles = [angle(a, b, c), angle(b, c, a), angle(c, a, b)];
    /* In the same A, B, C order as baseAngles, for the page's +60° claim. */
    const hingeAngles = [angle(a, Bc, Cc), angle(b, Ac, Cc), angle(c, Ac, Bc)];
    const angleGaps = hingeAngles.map((v, i) => v - baseAngles[i]);

    /* The page's dissection and Fermat claims, measured independently. */
    const reflected = [reflect(a, Bc, Cc), reflect(b, Ac, Cc), reflect(c, Ac, Bc)];
    const reflectionSpread = Math.max(
      dist(reflected[0], reflected[1]), dist(reflected[1], reflected[2]),
      dist(reflected[0], reflected[2]),
    );
    const fermatAngleSpread = spread([
      angle(reflected[0], a, b), angle(reflected[0], b, c), angle(reflected[0], c, a),
    ]);
    const dissectionError = Math.abs(area(Ac, Bc, Cc) -
      (area(a, Bc, Cc) + area(Ac, b, Cc) + area(Ac, Bc, c)));
    const [firstCorner, secondCorner, thirdCorner] = SWIVEL_CORNERS[idx];
    const star = { Aq, Bq, Cq }[starKey];

    return {
      A: a, B: b, C: c, Ap, Bp, Cp, Ac, Bc, Cc, Aq, Bq, Cq,
      hinges, polys, centres, star, starKey, centreKeys, landingIndices, starIndices,
      hingedCorners: [vertices[firstCorner], vertices[secondCorner]],
      landingCorner: vertices[thirdCorner],
      landingNames: [firstCorner, secondCorner, thirdCorner],
      sides, sideSpread: spread(sides),
      baseAngles, hingeAngles, angleGaps,
      reflectionSpread, fermatAngleSpread, dissectionError,
      allAnglesAtMost120: Math.max(...baseAngles) <= 120 + 1e-9,
      measures: { tol, scale },
      claims: {
        napoleonEquilateral: spread(sides) <= tol,
        /* Both moving corners turn onto the third corner. Which two slots
         * hold them depends on the swivel branch in Compute(). */
        hingedCornersLand: landingIndices.every((i) =>
          dist(hinges[i], vertices[thirdCorner]) <= tol),
        starCentresMeet: dist(hinges[starIndices[0]], hinges[starIndices[1]]) <= tol,
        angleSums360: Math.abs(hingeAngles[0] + hingeAngles[1] + hingeAngles[2] - 360) <= 1e-6,
        dissection: dissectionError <= 1e-6 * scale * scale,
        reflectionsMeet: reflectionSpread <= tol,
        fermatPoint: fermatAngleSpread <= 1e-6,
      },
    };
  }

  function geometry(state) {
    if (!state || !state.options) return null;
    return compute(state.A, state.B, state.C,
      state.options.angle, state.options.swivel, -1);
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Drag A, B or C to make a triangle.";
    const equal = g.claims.napoleonEquilateral
      ? "the three centre points make an equilateral triangle"
      : "the three centre points are not quite equilateral";
    if (state.options.angle >= 120) {
      const [p, q, r] = g.landingNames;
      return `At 120°, ${p} and ${q} land on ${r}, the two hinged pieces close, and ${equal}.`;
    }
    if (state.options.angle === 0) {
      return `Nothing has turned yet. ${equal.charAt(0).toUpperCase() + equal.slice(1)}; slide Turn to 120° to close the hinges.`;
    }
    return `Turned ${state.options.angle}° at ${SWIVEL_NAMES[state.options.swivel]}, and ${equal}.`;
  }

  /* An illustration, not a game: no win, no loss and no finishing move. */
  function result(state) {
    return null;
  }

  return {
    VIEW, PAD, LIMITS, SWIVEL_NAMES, SWIVEL_CENTRES, SWIVEL_CORNERS,
    point, finite, dist, cross, area, angle, clamp, rotate, barycenter,
    foot, reflect, initialTriangle, normalize, start, reset, move, setOption,
    compute, geometry, describe, result,
  };
})();
