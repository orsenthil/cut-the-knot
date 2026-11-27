"use strict";

/*
 * Four Centroids — drawing and input only.  The geometry, the four checkbox
 * states and the (absent) ending live in four-centroids-core.js.
 *
 * The board holds the triangle ABC, the cevians to P, the small triangle
 * GaGbGc, the midpoints and centroids, and the extra lines the applet's four
 * checkboxes switch on: premises (the medians used in the proof), statement 1
 * (the three parallels through Ga, Gb, Gc) and statement 2 (the lines from the
 * vertices to Ga, Gb, Gc and the line GP with J on it).  Everything is made
 * once and only updated on a redraw, so a handle keeps focus after arrow keys.
 */

(function () {
  const Core = FourCentroidsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const boxes = {
    names: document.getElementById("names"),
    statement1: document.getElementById("statement1"),
    statement2: document.getElementById("statement2"),
    premises: document.getElementById("premises"),
  };
  const resetBtn = document.getElementById("resetBtn");

  /* A state from the core; the page's second embedded copy of the applet has
   * Show=1, so names start checked as they do there. */
  let state = Core.start({ show: "1" });

  /* Layers, back to front. */
  const premiseLayer = board.layer("premises");
  const parallelLayer = board.layer("parallels");
  const baseLayer = board.layer("bases");
  const spokeLayer = board.layer("spokes");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const zero = Core.point(0, 0);
  const baseA = state.A[0], baseP = state.P;

  /* Applet Draw(): the three sides, the cevians and the small triangle. */
  const sides = Array.from({ length: 3 }, () => board.segment(baseA, baseA, "side", baseLayer));
  const cevians = Array.from({ length: 3 }, () => board.segment(baseA, baseP, "cevian", baseLayer));
  const smallTri = board.polygon(state.A, "small-tri", baseLayer);

  /* Applet ShowPremise(): P to M[i], A[i] to N[i+1], A[i] to N[i+2], then the
   * three red medians A[i] to M[i]. */
  const premiseLines = Array.from({ length: 9 }, () => board.segment(baseA, baseA, "premise-line", premiseLayer));
  const premiseMedians = Array.from({ length: 3 }, () => board.segment(baseA, baseA, "premise-median", premiseLayer));

  /* Applet ShowStatement1(): the line through G[i] in direction P-A[i]. */
  const parallels = Array.from({ length: 3 }, () => board.line(zero, zero, "parallel-line", parallelLayer));

  /* Applet ShowStatement2(): A[i] to G[i], and the thick line G-P. */
  const spokes = Array.from({ length: 3 }, () => board.segment(baseA, baseA, "spoke", spokeLayer));
  const gpLine = board.segment(baseA, baseP, "gp-line", spokeLayer);

  const gDots = Array.from({ length: 3 }, () => board.point(baseA, "g-dot", 5, dotLayer));
  const gDot = board.point(baseA, "g-center-dot", 6, dotLayer);
  const jDot = board.point(baseA, "j-dot", 6, dotLayer);
  const mDots = Array.from({ length: 3 }, () => board.point(baseA, "premise-dot", 4, dotLayer));
  const nDots = Array.from({ length: 3 }, () => board.point(baseA, "premise-dot", 4, dotLayer));

  const vertexLabels = Array.from({ length: 3 }, () => board.label(baseA, "", "point-label", 9, -9, labelLayer));
  const gLabels = Array.from({ length: 3 }, () => board.label(baseA, "", "point-label g-label", -22, -10, labelLayer));
  const gCenterLabel = board.label(baseA, "G", "point-label g-center-label", -18, -10, labelLayer);
  const pLabel = board.label(baseP, "P", "point-label p-label", 9, -9, labelLayer);
  const jLabel = board.label(baseA, "J", "point-label j-label", 9, 16, labelLayer);
  const mLabels = Array.from({ length: 3 }, () => board.label(baseA, "", "point-label m-label", -8, 16, labelLayer));
  const nLabels = Array.from({ length: 3 }, () => board.label(baseA, "", "point-label n-label", -8, -11, labelLayer));

  const handles = Core.NAMES.concat(["P"]).map((name) => board.handle(name, state.A[0], {
    r: 10, step: 4, shift: 16, layer: handleLayer,
    cls: name === "P" ? "geom-handle p-handle" : "geom-handle",
    clamp: (p) => Core.clampPoint(p),
    label: name === "P"
      ? "Point P. Drag it, or focus it and use the arrow keys to move the third triangle"
      : `Point ${name}. Drag it, or focus it and use the arrow keys to move the triangle`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)} in the drawing`,
    onMove: (p, which) => {
      state = Core.movePoint(state, which, p);
      render();
    },
  }));

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const s = state.show;

    for (let i = 0; i < 3; i++) {
      const k1 = (i + 1) % 3;
      handles[i].set(state.A[i]);
      handles[3].set(state.P);
      sides[i].show(true).set(state.A[i], state.A[k1]);
      cevians[i].show(true).set(state.A[i], state.P);
    }
    handles[3].show(true);

    for (const key of Core.OPTION_KEYS) boxes[key].checked = !!s[key];
    resetBtn.setAttribute("aria-label", "Put A, B, C and P back at their starting places, keeping the checkbox settings");

    if (!g) {
      for (const shape of [smallTri, gpLine, gDot, jDot, gCenterLabel, pLabel, jLabel]
        .concat(sides, cevians, gDots, mDots, nDots, parallels, spokes, premiseLines,
          premiseMedians, vertexLabels, gLabels, mLabels, nLabels)) shape.show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(Core.snapshot(state));
      return;
    }

    smallTri.show(true).set(g.G);

    for (let i = 0; i < 3; i++) {
      const k1 = (i + 1) % 3, k2 = (i + 2) % 3;
      /* Premises: six dashed lines of the two small triangles, then three
       * medians from the vertices to the opposite side midpoints. */
      premiseLines[3 * i].show(s.premises).set(state.P, g.M[i]);
      premiseLines[3 * i + 1].show(s.premises).set(state.A[i], g.N[k1]);
      premiseLines[3 * i + 2].show(s.premises).set(state.A[i], g.N[k2]);
      premiseMedians[i].show(s.premises).set(state.A[i], g.M[i]);

      /* The parallel through G[i] is drawn a hundred steps along P-A[i],
       * exactly as GeoSDoub.GetParallelTo does in the applet. */
      const far = Core.add(g.G[i], Core.mul(Core.sub(state.P, state.A[i]), 100));
      parallels[i].show(s.statement1).set(g.G[i], far);

      spokes[i].show(s.statement2).set(state.A[i], g.G[i]);

      gDots[i].show(true).set(g.G[i]);
      mDots[i].show(s.premises).set(g.M[i]);
      nDots[i].show(s.premises).set(g.N[i]);

      vertexLabels[i].show(s.names).set(state.A[i], Core.NAMES[i]);
      gLabels[i].show(s.names).set(g.G[i], "G" + "abc"[i]);
      mLabels[i].show(s.names && s.premises).set(g.M[i], "LMN"[i]);
      nLabels[i].show(s.names && s.premises).set(g.N[i], "UVW"[i]);
    }
    gpLine.show(s.statement2).set(g.Gabc, state.P);
    gDot.show(true).set(g.Gabc);
    gCenterLabel.show(s.names).set(g.Gabc);
    pLabel.show(s.names).set(state.P);
    jDot.show(s.statement2 && !!g.J).set(g.J || zero);
    jLabel.show(s.names && s.statement2 && !!g.J).set(g.J || zero);

    say(Core.describe(state), state.explored ? "done" : null);
    /* The position, in board units, for the player's record and the tutor. */
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  for (const key of Core.OPTION_KEYS) {
    boxes[key].addEventListener("change", () => {
      state = Core.setShow(state, key, boxes[key].checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  /* Class-styled SVG needs no colour repaint; keep the shared hook anyway. */
  board.onTheme(render);
  render();
})();
