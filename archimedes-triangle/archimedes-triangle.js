"use strict";

/*
 * The page for Archimedes Triangle: drawing and input only. The geometry is
 * in archimedes-triangle-core.js. An SVG board holds the parabola, the two
 * tangents and the triangle they make; A and B are draggable Geom handles
 * constrained to the curve, with arrow keys moving them along it. The four
 * checkboxes reproduce the applet's "names", "Lemma", "Theorem" and
 * "filled triangles" switches (the last is disabled until Theorem is on).
 */

(function () {
  const Core = ArchimedesTriangleCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    curve: board.layer("curve"),
    guides: board.layer("guides"),
    fill: board.layer("fill"),
    triangle: board.layer("triangle"),
    theorem: board.layer("theorem"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();

  /** Status line; "done" tells the player's record a demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* The curve itself is a sampled path, the one shape Geom has no helper for. */
  function curvePath() {
    let d = "";
    for (let t = Core.T_MIN - 4; t <= Core.T_MAX + 4; t += 2) {
      const p = Core.pointAt(t);
      d += (d ? " L " : "M ") + p.x.toFixed(2) + " " + p.y.toFixed(2);
    }
    return d;
  }
  const curve = board.el("path", null, "parabola", layers.curve);
  curve.setAttribute("d", curvePath());

  const axis = board.line({ x: Core.CX, y: 0 }, { x: Core.CX, y: Core.HEIGHT }, "axis", layers.guides);
  const directrix = board.line({ x: 0, y: Core.VY + Core.A_FOCAL },
    { x: Core.WIDTH, y: Core.VY + Core.A_FOCAL }, "directrix", layers.guides);
  const focusDot = board.point({ x: Core.CX, y: Core.VY - Core.A_FOCAL }, "focus-dot", 4, layers.guides);
  const projections = [
    board.line({ x: 0, y: 0 }, { x: 0, y: 1 }, "projection", layers.guides),
    board.line({ x: 0, y: 0 }, { x: 0, y: 1 }, "projection", layers.guides),
  ];

  const filled = [
    board.polygon([{ x: 0, y: 0 }], "filled-triangle", layers.fill),
    board.polygon([{ x: 0, y: 0 }], "filled-triangle", layers.fill),
  ];
  const chord = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "chord", layers.triangle);
  const sides = [
    board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "side", layers.triangle),
    board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "side", layers.triangle),
  ];
  const tangents = [
    board.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "tangent", layers.triangle),
    board.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "tangent", layers.triangle),
  ];
  const median = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "median", layers.guides);
  const tangentO = board.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "tangent-o", layers.theorem);
  const innerSides = [
    board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "inner-side", layers.theorem),
    board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "inner-side", layers.theorem),
  ];

  const dots = {
    S: board.point({ x: 0, y: 0 }, "construction-dot", 3.5, layers.dots),
    M: board.point({ x: 0, y: 0 }, "construction-dot", 3.5, layers.dots),
    O: board.point({ x: 0, y: 0 }, "inner-dot", 4, layers.dots),
    A1: board.point({ x: 0, y: 0 }, "inner-dot", 3.5, layers.dots),
    B1: board.point({ x: 0, y: 0 }, "inner-dot", 3.5, layers.dots),
    F: board.point({ x: 0, y: 0 }, "focus-dot", 4, layers.guides),
    AP: board.point({ x: 0, y: 0 }, "construction-dot", 3, layers.guides),
    BP: board.point({ x: 0, y: 0 }, "construction-dot", 3, layers.guides),
  };
  focusDot.show(false);

  const labelOffsets = {
    A: [-10, -10], B: [8, -10], S: [7, 14], M: [-18, -8], O: [7, -8],
    A1: [-22, -8], B1: [8, -8], F: [7, -7], AP: [-18, 14], BP: [-18, 14],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label({ x: 0, y: 0 }, name === "AP" ? "A′" : name === "BP" ? "B′" : name,
      "geom-label point-label", labelOffsets[name][0], labelOffsets[name][1], layers.labels);
    labels[name].show(false);
  }

  /** Turn a pointer or key position into the nearest parabola parameter. */
  function tNear(q, name) {
    const key = name === "A" ? "t1" : "t2";
    const current = handles[name].point;
    let t;
    if (Math.abs(q.x - current.x) > 1e-6) {
      t = q.x - Core.CX; // dragging sideways picks the point directly under the finger
    } else {
      const above = 4 * Core.A_FOCAL * (Core.VY - q.y); // up/down keys walk along the curve
      t = (state[key] < 0 ? -1 : 1) * Math.sqrt(Math.max(0, above));
    }
    return Core.clamp(Math.round(t), Core.T_MIN, Core.T_MAX);
  }
  const clampToCurve = (q, name) => Core.pointAt(tNear(q, name));

  const handles = {
    A: board.handle("A", Core.pointAt(state.t1), {
      r: 11, step: 4, shift: 5, layer: layers.handles, clamp: clampToCurve,
      label: "Point A on the parabola. Drag it, or focus it and use the arrow keys to move it along the curve.",
      describe: (p) => "at curve position " + Math.round(p.x - Core.CX) + ".",
      onMove: (p, which) => apply({ type: "point", name: which, t: p.x - Core.CX }, which + " moved."),
    }),
    B: board.handle("B", Core.pointAt(state.t2), {
      r: 11, step: 4, shift: 5, layer: layers.handles, clamp: clampToCurve,
      label: "Point B on the parabola. Drag it, or focus it and use the arrow keys to move it along the curve.",
      describe: (p) => "at curve position " + Math.round(p.x - Core.CX) + ".",
      onMove: (p, which) => apply({ type: "point", name: which, t: p.x - Core.CX }, which + " moved."),
    }),
  };

  function tipOf(l, t) {
    return { x: l.p.x + 50, y: l.p.y - 50 * (t / (2 * Core.A_FOCAL)) };
  }

  function show(shape, on) { shape.show(on); return shape; }

  function draw(g) {
    handles.A.set(Core.pointAt(state.t1));
    handles.B.set(Core.pointAt(state.t2));

    show(axis, state.showLemma);
    show(directrix, state.showLemma);
    focusDot.show(state.showLemma).set(g.F);
    projections[0].set(g.AP, { x: g.AP.x, y: g.directrixY }).show(state.showLemma);
    projections[1].set(g.BP, { x: g.BP.x, y: g.directrixY }).show(state.showLemma);
    dots.AP.set(g.AP).show(state.showLemma);
    dots.BP.set(g.BP).show(state.showLemma);

    chord.set(g.A, g.B).show(true);
    sides[0].set(g.A, g.S).show(true);
    sides[1].set(g.B, g.S).show(true);
    tangents[0].set(g.lA.p, tipOf(g.lA, state.t1)).show(true);
    tangents[1].set(g.lB.p, tipOf(g.lB, state.t2)).show(true);
    median.set(g.S, g.M).show(state.showLemma);
    dots.S.set(g.S).show(state.showNames || state.showLemma);
    dots.M.set(g.M).show(state.showNames || state.showLemma);

    tangentO.set(g.lO.p, tipOf(g.lO, g.tO)).show(state.showTheorem);
    innerSides[0].set(g.A, g.O).show(state.showTheorem);
    innerSides[1].set(g.B, g.O).show(state.showTheorem);
    dots.O.set(g.O).show(state.showTheorem);
    dots.A1.set(g.A1).show(state.showTheorem);
    dots.B1.set(g.B1).show(state.showTheorem);

    // The pink triangles the applet fills are the inner triangles of AA1O and
    // BB1O: their apexes are the parabola points above A1 and B1.
    const apexA = Core.pointAt((3 * state.t1 + state.t2) / 4);
    const apexB = Core.pointAt((3 * state.t2 + state.t1) / 4);
    filled[0].set([apexA, g.A, g.O]).show(g.showFill);
    filled[1].set([apexB, g.B, g.O]).show(g.showFill);

    const at = { A: g.A, B: g.B, S: g.S, M: g.M, O: g.O, A1: g.A1, B1: g.B1,
      F: g.F, AP: g.AP, BP: g.BP };
    for (const name of Object.keys(at)) labels[name].set(at[name]);
    labels.A.show(state.showNames);
    labels.B.show(state.showNames);
    labels.S.show(state.showNames);
    labels.M.show(state.showNames);
    labels.F.show(state.showNames && state.showLemma);
    labels.AP.show(state.showNames && state.showLemma);
    labels.BP.show(state.showNames && state.showLemma);
    labels.O.show(state.showNames && state.showTheorem);
    labels.A1.show(state.showNames && state.showTheorem);
    labels.B1.show(state.showNames && state.showTheorem);
  }

  function statusText(g) {
    const ratio = g.areaSegment / g.areaABS;
    const claim = "The curved segment has " + ratio.toFixed(4)
      + " of the triangle's area — exactly 2/3.";
    if (state.showTheorem) {
      return claim + " A1 and B1 are the midpoints of the sides, and O is the midpoint of MS.";
    }
    if (state.showLemma) {
      return claim + " MS runs straight up from the base, parallel to the parabola's axis.";
    }
    return claim + " Tick Lemma, then Theorem, to see why. Drag A or B along the curve.";
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render(note) {
    const g = Core.compute(state);
    draw(g);
    say((note ? note + " " : "") + statusText(g), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render(note);
    return true;
  }

  const checkboxes = {
    showNames: document.getElementById("namesBox"),
    showLemma: document.getElementById("lemmaBox"),
    showTheorem: document.getElementById("theoremBox"),
    showFill: document.getElementById("fillBox"),
  };
  const descriptions = {
    showNames: "names", showLemma: "the lemma", showTheorem: "the theorem",
    showFill: "the filled triangles",
  };
  for (const key of Object.keys(checkboxes)) {
    const box = checkboxes[key];
    box.checked = state[key];
    box.addEventListener("change", () => {
      apply({ type: "option", key, value: box.checked },
        box.checked ? "Showing " + descriptions[key] + "." : "Hid " + descriptions[key] + ".");
    });
  }
  // The applet greys out "filled triangles" until Theorem is ticked.
  function syncFill() {
    checkboxes.showFill.disabled = !state.showTheorem;
  }

  document.getElementById("newBtn").addEventListener("click", () => {
    apply({ type: "reset" }, "Back to the opening triangle.");
    for (const key of Object.keys(checkboxes)) checkboxes[key].checked = state[key];
  });

  board.onTheme(() => draw(Core.compute(state)));

  syncFill();
  // Keep the disabled switch in step with Theorem without hiding the note.
  checkboxes.showTheorem.addEventListener("change", () => {
    syncFill();
    if (!state.showTheorem && state.showFill) {
      apply({ type: "option", key: "showFill", value: false }, "Filled triangles need Theorem.");
      checkboxes.showFill.checked = false;
    }
  });
  render();
})();
