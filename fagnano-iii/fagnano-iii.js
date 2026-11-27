"use strict";

/*
 * The page for Fagnano III: drawing and input only; all the geometry lives
 * in fagnano-iii-core.js. A 360 by 240 SVG board holds the original triangle
 * ABC, the five rolled copies of it, the freely draggable point P on AB, and
 * (under the five checkboxes) the altitudes, the Samelson construction, the
 * mapping of P through the strip, the point names and the extra triangles.
 * Drag a handle, or focus one and use the arrow keys (Shift for bigger
 * steps). This is an illustration: there is no win or loss.
 */

(function () {
  const Core = FagnanoIIICore;
  const statusEl = document.getElementById("status");
  const boxes = {
    showAltitudes: document.getElementById("altitudesBox"),
    showConstruction: document.getElementById("constructionBox"),
    showMap: document.getElementById("mapBox"),
    moreTriangles: document.getElementById("moreBox"),
    showNames: document.getElementById("namesBox"),
  };
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const guides = board.layer("guides");
  const triangles = board.layer("triangles");
  const construction = board.layer("construction");
  const mapping = board.layer("mapping");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start();

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are how the player's record learns that a play has
   * ended. This illustration never ends, so no kind is ever used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** The applet itself used (10000,10000) for an undefined point. */
  const safe = (p) => Core.available(p) ? p : { x: 10000, y: 10000 };
  const corners = (tri) => [safe(tri.A), safe(tri.B), safe(tri.C)];

  /* Every object is made once and only its attributes change, so focus on a
     handle survives a redraw. */
  const tris = [];
  for (let i = 0; i < 6; i++) {
    tris.push(board.polygon(corners({ A: state.A, B: state.B, C: state.C }),
      i === 0 ? "tri tri-base" : i < 3 ? "tri tri-roll" : "tri tri-more", triangles));
  }

  const altitudes = [];
  for (let i = 0; i < 6; i++) {
    const three = [];
    for (let v = 0; v < 3; v++) three.push(board.segment(state.A, state.A, "altitude", guides));
    altitudes.push(three);
  }

  const cLines = [
    board.line(state.A, state.B, "c-line", construction),
    board.line(state.A, state.B, "c-line", construction),
  ];
  const bisectorLine = board.line(state.A, state.B, "bisector", construction);
  const projections = [
    board.segment(state.A, state.A, "projection", construction),
    board.segment(state.A, state.A, "projection", construction),
  ];
  const midSeg = board.segment(state.A, state.A, "mid-line", construction);
  const midSeg2 = board.segment(state.A, state.A, "mid-line", construction);

  const auxDots = {
    B1: board.point(state.A, "aux-dot", 3.5, dots),
    B2: board.point(state.A, "aux-dot", 3.5, dots),
    M1: board.point(state.A, "mid-dot", 4.5, dots),
    M2: board.point(state.A, "mid-dot", 4.5, dots),
    M3: board.point(state.A, "mid-dot", 4.5, dots),
    P2: board.point(state.A, "map-dot", 4, dots),
    P3: board.point(state.A, "map-dot", 4, dots),
  };
  const mapLines = [
    board.segment(state.A, state.A, "map-line", mapping),
    board.segment(state.A, state.A, "map-line", mapping),
  ];

  const text = {};
  for (const name of ["A", "B", "C", "P", "B1", "B2", "M1", "M2", "M3", "P2", "P3"]) {
    text[name] = board.label(state.A, name, "point-label", 7, -7, labels);
  }

  const onMove = (name) => (p) => {
    state = Core.move(state, name, p);
    render();
  };
  const handles = {};
  for (const name of ["A", "B", "C", "P"]) {
    handles[name] = board.handle(name, state[name], {
      r: name === "P" ? 7 : 9,
      step: 3,
      shift: 12,
      cls: name === "P" ? "geom-handle point-handle" : "geom-handle vertex-handle",
      label: `Point ${name}${name === "P" ? " on the side AB" : " of the triangle"}. ` +
        "Drag it, or focus it and use the arrow keys.",
      clamp: (q) => Core.clampPoint(state, name, q),
      onMove: onMove(name),
      layer: handlesLayer,
    });
  }

  function render() {
    const f = Core.compute(state);
    const allTris = [f.t0, f.t1, f.t2, f.t3, f.t4, f.t5];

    for (let i = 0; i < 6; i++) {
      const visible = i < 3 || state.moreTriangles;
      tris[i].show(visible).set(corners(allTris[i]));
      const vertices = corners(allTris[i]);
      for (let v = 0; v < 3; v++) {
        const others = [vertices[(v + 1) % 3], vertices[(v + 2) % 3]];
        const foot = safe(Core.altitude(vertices[v], others[0], others[1]));
        altitudes[i][v].show(state.showAltitudes && visible).set(vertices[v], foot);
      }
    }

    const showCon = state.showConstruction;
    cLines[0].show(showCon).set(safe(f.t0.A), safe(f.t0.B));
    cLines[1].show(showCon).set(safe(f.t2.A), safe(f.t2.B));
    bisectorLine.show(showCon).set(safe(f.O), safe(f.bisector));
    projections[0].show(showCon).set(safe(f.B1), safe(f.t2.B));
    projections[1].show(showCon).set(safe(f.B2), safe(f.t0.B));
    midSeg.show(showCon).set(safe(f.M1), safe(f.M2));
    midSeg2.show(showCon && state.moreTriangles).set(safe(f.M2), safe(f.M3));
    for (const name of ["B1", "B2", "M1", "M2"]) auxDots[name].show(showCon).set(safe(f[name]));
    auxDots.M3.show(showCon && state.moreTriangles).set(safe(f.M3));

    const showMap = state.showMap;
    auxDots.P2.show(showMap).set(safe(f.P2));
    auxDots.P3.show(showMap).set(safe(f.P3));
    mapLines[0].show(showMap).set(safe(f.P), safe(f.P2));
    mapLines[1].show(showMap).set(safe(f.P2), safe(f.P3));

    const at = {
      A: [state.A, -14, -9], B: [state.B, -14, 17], C: [state.C, 9, 17],
      P: [state.P, 8, -8],
      B1: [f.B1, 7, -8], B2: [f.B2, 7, -8],
      M1: [f.M1, 7, -8], M2: [f.M2, 7, -8], M3: [f.M3, 7, -8],
      P2: [f.P2, 8, -8], P3: [f.P3, 8, -8],
    };
    for (const name in at) {
      const [p, dx, dy] = at[name];
      const special = ["B1", "B2", "M1", "M2", "M3"].includes(name);
      const mapped = name === "P2" || name === "P3";
      const on = state.showNames && ((special && showCon) || (mapped && showMap) || !special && !mapped);
      const words = { B1: "B'", B2: "B'", M1: "M", M2: "M'", M3: "M''", P2: "P", P3: "P" }[name] || name;
      text[name].show(on).set(safe(p), words, dx, dy);
    }

    for (const name of ["A", "B", "C", "P"]) handles[name].set(state[name]);
    for (const key in boxes) boxes[key].checked = state[key];

    say(Core.describe(state, f));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  for (const key in boxes) {
    boxes[key].addEventListener("change", () => {
      state = Core.option(state, key, boxes[key].checked);
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
