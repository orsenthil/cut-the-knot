"use strict";

/*
 * The page for Desargues: drawing and input only; the geometry is in
 * desargues-core.js. Six focusable corner handles move with a pointer or the
 * arrow keys, and each whole triangle can be dragged by its shaded interior.
 * Direct mode shows the three lines through matching corners and the yellow
 * meeting dot; Converse mode shows the side lines, the crossings ab, bc, ca
 * and the line through them. There is no win or loss in the applet.
 */

(function () {
  const Core = DesarguesCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    guides: board.layer("guides"),
    triangles: board.layer("triangles"),
    hits: board.layer("hits"),
    axis: board.layer("axis"),
    marks: board.layer("marks"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();

  /** Status line and "done" marker for the player's record, in one place. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Objects are created once and re-set on every draw, so a handle keeps its
     keyboard focus while the rest of the picture changes. */
  const triangles = [
    board.polygon([state.A1, state.B1, state.C1], "triangle tri-one", layers.triangles),
    board.polygon([state.A2, state.B2, state.C2], "triangle tri-two", layers.triangles),
  ];
  const hitPolygons = [
    board.el("polygon", null, "shape-hit", layers.hits),
    board.el("polygon", null, "shape-hit", layers.hits),
  ];
  const vertexLines = [0, 1, 2].map(() => board.line(state.A1, state.A2, "vertex-line", layers.guides));
  const sideLines = [0, 1, 2, 3, 4, 5].map(() =>
    board.line(state.A1, state.B1, "side-line", layers.guides));
  const axisSegments = [0, 1, 2].map(() => board.line(state.A1, state.B1, "axis-line", layers.axis));
  const crossDots = Core.CROSS_NAMES.map(() => board.point(state.A1, "cross-dot", 5, layers.marks));
  const centreDot = board.point(state.A1, "centre-dot", 6, layers.marks);

  const offsets = {
    A1: [-17, -9], B1: [5, -9], C1: [-17, 20],
    A2: [-17, -9], B2: [5, -9], C2: [-17, 20],
    ab: [6, -8], bc: [6, -8], ca: [6, -8],
  };
  const labels = {};
  for (const name of Object.keys(offsets)) {
    labels[name] = board.label(state.A1, name, "point-label", offsets[name][0], offsets[name][1], layers.labels);
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name], {
      r: 11,
      step: 3,
      cls: "geom-handle corner-handle",
      layer: layers.handles,
      label: "Corner " + name + ". Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q, which) => {
        const inside = Core.clampPoint(q);
        return Core.NAMES.some((other) => other !== which && Core.dist(inside, state[other]) < Core.MIN_SEP)
          ? state[which] : inside;
      },
      onMove: (p, which) => apply({ type: "point", name: which, point: p }),
    });
  }

  function setPolygon(node, names) {
    node.setAttribute("points", names.map((n) => state[n].x + "," + state[n].y).join(" "));
  }

  function draw() {
    for (const [i, names] of [[0, Core.FIRST], [1, Core.SECOND]]) {
      setPolygon(triangles[i].node, names);
      setPolygon(hitPolygons[i], names);
    }
    for (const name of Core.NAMES) {
      handles[name].set(state[name]);
      labels[name].set(state[name]);
    }

    const g = Core.compute(state);
    const direct = state.mode === "direct";
    for (let i = 0; i < 3; i++) {
      vertexLines[i].set(g.vertexLines[i].a, g.vertexLines[i].b).show(direct);
      sideLines[2 * i].set(g.sideLines[2 * i].a, g.sideLines[2 * i].b).show(!direct);
      sideLines[2 * i + 1].set(g.sideLines[2 * i + 1].a, g.sideLines[2 * i + 1].b).show(!direct);
    }

    centreDot.set(dotVisible(g) ? g.direct.point : state.A1).show(direct && dotVisible(g));
    for (let i = 0; i < 3; i++) {
      const name = Core.CROSS_NAMES[i];
      const cross = g.crosses[name];
      const at = cross.nan ? state.A1 : cross.point;
      crossDots[i].set(at).show(!direct && !cross.nan);
      labels[name].set(at).show(!direct && !cross.nan);
      const segment = g.axisSegments[i];
      const usable = !direct && segment && segment.every(Core.finite);
      axisSegments[i].set(usable ? segment[0] : state.A1, usable ? segment[1] : state.A1).show(!!usable);
    }
  }

  /** The applet's dot can be near three lines but still outside the canvas. */
  function dotVisible(g) {
    const p = g.direct.point;
    return g.direct.shown && !!p && p.x >= 0 && p.x <= Core.WIDTH && p.y >= 0 && p.y <= Core.HEIGHT;
  }

  function statusText() {
    const g = Core.compute(state);
    const r = Core.residuals(state);
    if (state.mode === "direct") {
      if (dotVisible(g)) {
        return "Direct: the three lines through matching corners meet at the yellow dot, " +
          "and the three side crossings lie on one line.";
      }
      return "Direct: drag a corner or a triangle until A1A2, B1B2 and C1C2 meet at one point.";
    }
    // Pointer drags land on rounded board coordinates, so the spoken test is
    // the width of a drawn line, not the logic test's exact tolerance.
    if (Number.isFinite(r.collinearity) && r.collinearity < 0.25) {
      return "Converse: ab, bc and ca lie on one line, and the matching-corner lines meet at a point.";
    }
    return "Converse: drag until the three side crossings ab, bc and ca lie on one line.";
  }

  function updateButtons() {
    for (const mode of Core.MODES) buttons[mode].setAttribute("aria-pressed", String(state.mode === mode));
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render(note) {
    draw();
    updateButtons();
    say(note || statusText(), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; a refused move leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      if (m.type === "point") handles[m.name].set(state[m.name]);
      render("That spot is too close to another corner.");
      return false;
    }
    state = next;
    render(note);
    return true;
  }

  /* The applet lets a whole triangle be dragged, not just its corners. The
     hit polygons are above the visible triangles and below the handles. */
  let drag = null;
  for (let i = 0; i < 2; i++) {
    hitPolygons[i].addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const base = {};
      for (const name of Core.NAMES) base[name] = { ...state[name] };
      drag = { name: i === 0 ? "one" : "two", start: board.toLocal(e.clientX, e.clientY), base };
      if (board.root.setPointerCapture) board.root.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
  }
  board.root.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = board.toLocal(e.clientX, e.clientY);
    apply({ type: "shape", name: drag.name, base: drag.base,
      dx: p.x - drag.start.x, dy: p.y - drag.start.y });
    e.preventDefault();
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
    board.root.addEventListener(event, () => { drag = null; });
  }

  const buttons = {
    direct: document.getElementById("directBtn"),
    converse: document.getElementById("converseBtn"),
  };
  for (const mode of Core.MODES) {
    buttons[mode].addEventListener("click", () => {
      apply({ type: "mode", mode });
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" });
  });

  // Colours are CSS classes, so a theme flip just redraws the same picture.
  board.onTheme(() => draw());

  render();
})();
