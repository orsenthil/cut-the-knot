"use strict";

/*
 * Hinged Dissection of a Vase, after Alexander Bogomolny's applet
 * HingedDissectionOfVase (Cut-the-Knot, Curriculum/Geometry).
 *
 * The vase's outline is a 270-degree circular arc of radius R with three
 * quarter-circle arcs making the neck above it. Three quarter-disks colour
 * the bottom of the vase. The applet's scroll bar turns those three pieces
 * about their hinges; at 180 degrees they sit in three corners of a diamond
 * whose sides are 2R. The fourth corner is filled by the top of the vase, so
 * the vase and the square have the same area, 4R^2.
 *
 * The key idea the code relies on is that Java's Graphics arcs use degrees
 * measured from three o'clock with positive angles going up the screen, so
 * a Java angle d is the SVG angle -d: point(d) = (cx + R cos d, cy - R sin d).
 * All three moving sectors and every arc below are copied from the applet's
 * Draw(), DrawArc(), FillArc(), DrawRadius() and init() methods.
 *
 * This file is only the geometry: no document, no window, no storage. It
 * defines one global, HingedDissectionOfVaseCore, and every position is plain
 * data that can be handed to the player's record and the tutor.
 */
const HingedDissectionOfVaseCore = (() => {
  const WIDTH = 460;                 // the applet's <APPLET WIDTH=460 HEIGHT=460>
  const HEIGHT = 460;
  const ANGLE_MIN = 0;               // JScrollBar(0, 0, 1, 0, 181): 0..180, step 1
  const ANGLE_MAX = 180;
  const ANGLE_DEFAULT = 0;
  const ANGLE_STEP = 1;
  const QUARTER = Math.PI / 4;
  const THREE_QUARTER = (3 * Math.PI) / 4;
  const ROOT2 = Math.SQRT2;
  const DEG = Math.PI / 180;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v) => Math.round(v); // the applet's private int a(double)

  /** init(): Cx = 2*width/5, Cy = 2*height/3, R = min(width,height)/6, all int. */
  function init(width, height) {
    const w = Math.trunc(width);
    const h = Math.trunc(height);
    return {
      cx: Math.trunc((2 * w) / 5),
      cy: Math.trunc((2 * h) / 3),
      R: Math.trunc(Math.min(w, h) / 6),
    };
  }

  /** The position a new illustration starts from. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : Math.trunc(o.width);
    const height = o.height === undefined ? HEIGHT : Math.trunc(o.height);
    return Object.assign({ width, height }, init(width, height), {
      angle: clamp(Math.trunc(o.angle === undefined ? ANGLE_DEFAULT : o.angle), ANGLE_MIN, ANGLE_MAX),
      nSectors: o.nSectors === undefined ? 4 : Math.trunc(o.nSectors), // NSectors is read but unused
      explored: false,
    });
  }

  /**
   * The scroll bar has only one action: set the hinge angle. "reset" restores
   * the applet's opening picture. Both return a new position and leave the old
   * one untouched.
   */
  function move(state, action) {
    const a = typeof action === "number" ? { type: "angle", value: action } : action || {};
    if (a.type === "reset") return start({ width: state.width, height: state.height });
    if (a.type !== "angle") return state;
    const angle = clamp(round(a.value), ANGLE_MIN, ANGLE_MAX);
    if (angle === state.angle && state.explored) return state;
    return Object.assign({}, state, { angle, explored: true });
  }

  /** A point on a Java arc: y is flipped because screen y grows downwards. */
  function arcPoint(center, radius, startDeg) {
    const a = startDeg * DEG;
    return { x: center.x + radius * Math.cos(a), y: center.y - radius * Math.sin(a) };
  }

  /**
   * The three coloured quarter-disks, transcribed from Draw()'s FillArc
   * calls. x and y of each centre are rounded by the applet before drawing.
   * The blue sector keeps the applet's tiny -0.5/+0.5 pixel correction and
   * its (2*Angle+1) degree offset: a harmless quirk, not part of the puzzle.
   */
  function sectors(state) {
    const { cx, cy, R, angle } = state;
    const t = angle * DEG;

    // Red sector.
    const y4 = cy + R * Math.sin(-QUARTER);
    const x6 = cx + R * Math.cos(-QUARTER);
    const phi1 = THREE_QUARTER - t;
    const y8 = y4 + R * Math.sin(phi1);
    const x10 = x6 + R * Math.cos(phi1);
    const red = { name: "red", c: { x: round(x10), y: round(y8) }, start: -45 + angle, extent: 90 };

    // Blue sector, hinged to the endpoint of the red one.
    const y12 = y8 + R * Math.sin(QUARTER - t);
    const x14 = x10 + R * Math.cos(QUARTER - t);
    const phi2 = -THREE_QUARTER - (2 * angle + 1) * DEG;
    const y16 = y12 + R * Math.sin(phi2) - 0.5;
    const x18 = x14 + R * Math.cos(phi2) + 0.5;
    const blue = { name: "blue", c: { x: round(x18), y: round(y16) }, start: -135 + 2 * angle, extent: 90 };

    // Green sector, hinged to the other endpoint of the red one.
    const y4g = cy + R * Math.sin(-THREE_QUARTER);
    const x6g = cx + R * Math.cos(-THREE_QUARTER);
    const phig = QUARTER + t;
    const y8g = y4g + R * Math.sin(phig);
    const x10g = x6g + R * Math.cos(phig);
    const green = { name: "green", c: { x: round(x10g), y: round(y8g) }, start: 135 - angle, extent: 90 };

    return [red, blue, green];
  }

  /** The fixed outline: the bowl and the three arcs of the neck (+2 px shift). */
  function outline(state) {
    const { cx, cy, R } = state;
    const d = R * ROOT2;
    return {
      bowl: { c: { x: cx, y: cy }, r: R, start: 135, extent: 270 },
      neck: [
        { name: "right", c: { x: round(cx + d), y: round(cy - d + 2) }, r: R, start: 135, extent: 90 },
        { name: "left", c: { x: round(cx - d), y: round(cy - d + 2) }, r: R, start: -45, extent: 90 },
        { name: "top", c: { x: cx, y: round(cy - 2 * d + 2) }, r: R, start: -135, extent: 90 },
      ],
      // DrawRadius(-PI/4) at 180 degrees: the square's four corners in order.
      diamond: [
        { x: cx, y: cy },
        { x: round(cx + d), y: round(cy - d) },
        { x: cx, y: round(cy - 2 * d) },
        { x: round(cx - d), y: round(cy - d) },
      ],
    };
  }

  /**
   * Exact areas, with R as the unit. The three inward neck bulges and the
   * downward top bulge each cut off a 90-degree circular segment of area
   * (pi/4 - 1/2)R^2 from the 2R^2 rectangle between the neck's endpoints.
   */
  function areas(R) {
    const r2 = R * R;
    const segment = (Math.PI / 4 - 0.5) * r2;
    const bottom = (3 * Math.PI / 4) * r2;
    const triangle = 0.5 * r2;                 // between the two radii and their chord
    const neck = 2 * r2 - 3 * segment;         // region above that chord
    const top = triangle + neck;
    return {
      segment, bottom, triangle, neck, top,
      vase: bottom + top,
      square: 4 * r2,                          // diamond: diagonals 2*sqrt(2)R
    };
  }

  /** Everything the page needs to draw one position, in board units. */
  function geometry(state) {
    const o = outline(state);
    return {
      cx: state.cx, cy: state.cy, R: state.R,
      sectors: sectors(state),
      bowl: o.bowl,
      neck: o.neck,
      diamond: o.diamond,
      // DrawLine(g, +/-PI/4) and the full guide oval appear once the hinge moves.
      guides: state.angle !== 0,
      bowlVisible: state.angle === 0,
      neckVisible: state.angle !== ANGLE_MAX,
      squareVisible: state.angle === ANGLE_MAX,
      area: areas(state.R),
    };
  }

  /** "done" is the record's word for a finished exploration of a demo. */
  function result(state) { return state.explored ? "done" : null; }

  /** Plain data, safe to save for the tutor. */
  function snapshot(state) {
    return {
      width: state.width, height: state.height,
      cx: state.cx, cy: state.cy, R: state.R,
      angle: state.angle, explored: state.explored,
    };
  }

  return {
    WIDTH, HEIGHT, ANGLE_MIN, ANGLE_MAX, ANGLE_DEFAULT, ANGLE_STEP,
    init, start, move, clamp, round, arcPoint, sectors, outline, areas,
    geometry, result, snapshot,
  };
})();
