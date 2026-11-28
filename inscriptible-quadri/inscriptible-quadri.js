"use strict";

/*
 * The page for Inscriptible Quadri: drawing and input only. The geometry is in
 * inscriptible-quadri-core.js. An SVG board holds the circle, the four tangent
 * lines and the four-sided figure they make. M, Q, N and P are draggable Geom
 * handles constrained to the circle, and the centre handle translates the
 * whole picture, as the applet's MoveableCircle does. The four checkboxes are
 * the applet's "vertices", "tangency points", "tangents" and "sides" switches.
 */

(function () {
  const Core = InscriptibleQuadriCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circle: board.layer("circle"),
    tangents: board.layer("tangents"),
    sides: board.layer("sides"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** Status line; "done" is how a demonstration tells the record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Objects are made once and re-set on every redraw, so a handle keeps its
     keyboard focus while the rest of the picture changes. */
  const givenCircle = board.circle(state.O, state.r, "given-circle", layers.circle);
  const sides = board.polygon([state.M, state.Q, state.N, state.P], "side", layers.sides);
  const segmentPairs = [
    ["A", "M"], ["A", "P"], ["B", "P"], ["B", "N"],
    ["C", "N"], ["C", "Q"], ["D", "Q"], ["D", "M"],
  ];
  const tangentSegs = segmentPairs.map(() => board.segment(state.M, state.Q, "tangent-seg", layers.tangents));
  const touchDots = {};
  for (const name of Core.HANDLES) touchDots[name] = board.point(state[name], "touchdot", 4, layers.dots);

  const labels = {};
  const labelSpots = {
    A: ["A", -13, -10], B: ["B", 7, -10], C: ["C", 7, 16], D: ["D", -13, 16],
    M: ["A′", -6, -11], Q: ["D′", -6, 16], N: ["C′", 7, 16], P: ["B′", 7, -11],
    hM: ["M", -13, 17], hQ: ["Q", -13, 17], hN: ["N", -13, 17], hP: ["P", -13, 17],
  };
  for (const key of Object.keys(labelSpots)) {
    const [text, dx, dy] = labelSpots[key];
    const kind = key.startsWith("h") ? "handle-label"
      : "ABCD".includes(key) ? "vertex-label" : "primed-label";
    labels[key] = board.label(state.M, text, "geom-label point-label " + kind, dx, dy, layers.labels);
  }

  const handleLabels = {
    M: "Dot M on the circle. Drag it, or focus it and use the arrow keys to slide it round the circle",
    Q: "Dot Q on the circle. Drag it, or focus it and use the arrow keys to slide it round the circle",
    N: "Dot N on the circle. Drag it, or focus it and use the arrow keys to slide it round the circle",
    P: "Dot P on the circle. Drag it, or focus it and use the arrow keys to slide it round the circle",
    O: "Centre of the circle. Drag it, or focus it and use the arrow keys to move the whole picture",
  };
  const describe = (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".";
  const handles = {};
  for (const name of [...Core.HANDLES, "O"]) {
    const isCentre = name === "O";
    handles[name] = board.handle(name, isCentre ? state.O : state[name], {
      r: isCentre ? 8 : 9,
      step: 3,
      layer: layers.handles,
      cls: isCentre ? "geom-handle centre-handle" : "geom-handle",
      label: handleLabels[name],
      describe,
      clamp: (q) => (isCentre
        ? {
          x: Core.clamp(q.x, Core.PAD + state.r, Core.WIDTH - Core.PAD - state.r),
          y: Core.clamp(q.y, Core.PAD + state.r, Core.HEIGHT - Core.PAD - state.r),
        }
        : Core.clampPoint(q)),
      onMove: (p, which) => (isCentre
        ? apply({ type: "circle", point: p }, "Moved the circle.")
        : apply({ type: "point", name: which, point: p }, "Moved dot " + which + ".")),
    });
  }

  const show = (shape, on) => { shape.show(on); return shape; };
  const fmt = (n) => n.toFixed(1);

  /** Words, not just a tint: say which pair of sides matches and why. */
  function statusText(g) {
    if (!g.valid) return "Two lines are parallel just now. Drag a dot away from the one opposite it.";
    const res = g.residuals;
    if (g.inscribed) {
      return "Circle inside: AB + CD = " + fmt(g.sides.AB + g.sides.CD) +
        " and BC + DA = " + fmt(g.sides.BC + g.sides.DA) + ". The two totals match.";
    }
    if (Math.abs(res.exscriptibleB) < Math.abs(res.exscriptibleA)) {
      return "Circle outside: AB + BC = " + fmt(g.sides.AB + g.sides.BC) +
        " and CD + DA = " + fmt(g.sides.CD + g.sides.DA) +
        ". Pitot's pair no longer matches; drag a dot round the circle.";
    }
    return "Circle outside: AB + DA = " + fmt(g.sides.AB + g.sides.DA) +
      " and BC + CD = " + fmt(g.sides.BC + g.sides.CD) +
      ". Pitot's pair no longer matches; drag a dot round the circle.";
  }

  function draw(g) {
    for (const name of Core.HANDLES) handles[name].set(state[name]);
    handles.O.set(state.O);
    givenCircle.set(g.circle ? g.circle.O : state.O, g.circle ? g.circle.r : state.r).show(true);

    if (!g.valid) {
      for (const shape of [sides, ...tangentSegs, ...Object.values(touchDots), ...Object.values(labels)]) {
        show(shape, false);
      }
      return;
    }

    const v = g.v;
    sides.set([v.A, v.B, v.C, v.D]).show(state.showSides);
    tangentSegs.forEach((shape, i) => {
      const [corner, dot] = segmentPairs[i];
      shape.set(v[corner], state[dot]).show(state.showTangents);
    });
    for (const name of Core.HANDLES) {
      touchDots[name].set(state[name]).show(state.showTangency);
      // The draggable dots keep their letters so the status and rules make sense.
      labels["h" + name].set(state[name]).show(true);
    }
    labels.A.set(v.A).show(state.showNames);
    labels.B.set(v.B).show(state.showNames);
    labels.C.set(v.C).show(state.showNames);
    labels.D.set(v.D).show(state.showNames);
    labels.M.set(state.M).show(state.showNames && state.showTangency);
    labels.Q.set(state.Q).show(state.showNames && state.showTangency);
    labels.N.set(state.N).show(state.showNames && state.showTangency);
    labels.P.set(state.P).show(state.showNames && state.showTangency);
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render(note) {
    geometry = Core.compute(state);
    draw(geometry);
    say((note ? note + " " : "") + statusText(geometry), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an impossible one leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      say("That move is not allowed.");
      return false;
    }
    state = next;
    render(note);
    return true;
  }

  const checkboxes = {
    showNames: document.getElementById("namesBox"),
    showTangency: document.getElementById("tangencyBox"),
    showTangents: document.getElementById("tangentsBox"),
    showSides: document.getElementById("sidesBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    const box = checkboxes[key];
    box.checked = state[key];
    box.addEventListener("change", () => {
      apply({ type: "option", key, value: box.checked },
        box.checked ? "Showing " + box.dataset.label + "." : "Hid " + box.dataset.label + ".");
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" }, "Back to the opening picture.");
  });

  // Classes use CSS tokens, so a theme flip needs no new colours; redraw anyway
  // to keep the picture in step with the site's themechange event.
  board.onTheme(() => draw(Core.compute(state)));

  render();
})();
