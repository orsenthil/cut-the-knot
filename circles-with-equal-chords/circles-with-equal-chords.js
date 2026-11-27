"use strict";

/*
 * Browser page for Circles With Equal Chords. The theorem and the applet's
 * construction live in circles-with-equal-chords-core.js; this file only draws
 * them and takes input.
 *
 * Six focusable handles reproduce the applet's mouse behaviour: L1 slides the
 * given line parallel to itself, L2 turns it, O and O' move the two circles,
 * R and R' change their radii. The two checkboxes are the applet's "hint" and
 * "names" switches. Tick hint to see T, the translated circle C(T) and the
 * construction lines; the green line is always the solution when one exists.
 */

(() => {
  const C = CirclesWithEqualChordsCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circles: board.layer("circles"),
    guides: board.layer("guides"),
    lines: board.layer("lines"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = C.start();

  /** The status line; only "win", "lose" and "done" mean anything to Track. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Every object is built once and moved with .set(), so a handle keeps its
     keyboard focus while the picture changes. */
  const circle1 = board.circle(state.O, 100, "given-circle", layers.circles);
  const circle3 = board.circle(state.O2, 60, "given-circle other-circle", layers.circles);
  const translated = board.circle(state.O, 100, "translated-circle", layers.guides);
  const guide1 = board.line(state.O, state.R, "guide-line", layers.guides);
  const guide2 = board.line(state.O2, state.R2, "guide-line", layers.guides);
  const givenLine = board.line(state.L1, state.L2, "given-line", layers.lines);
  const solutionLine = board.line(state.L1, state.L2, "solution-line", layers.lines);

  const dots = {
    A: board.point(state.O, "end-dot", 4, layers.dots),
    B: board.point(state.O, "end-dot", 4, layers.dots),
    C: board.point(state.O2, "end-dot second-dot", 4, layers.dots),
    D: board.point(state.O2, "end-dot second-dot", 4, layers.dots),
    T: board.point(state.O, "t-dot", 4.5, layers.dots),
    F: board.point(state.O2, "foot-dot", 3.4, layers.dots),
  };
  const offsets = {
    O: [-13, -10], O2: [9, -8], A: [-14, -9], B: [-14, 17],
    C: [8, -9], D: [8, 17], T: [8, -9],
  };
  const labels = {};
  for (const name of Object.keys(offsets)) {
    labels[name] = board.label(state.O, name === "O2" ? "O'" : name,
      "pt-label", offsets[name][0], offsets[name][1], layers.labels);
  }

  const handleLabels = {
    L1: "Point L on the given line. Drag it, or focus it and use the arrow keys, to slide the line parallel to itself.",
    L2: "End of the given line. Drag it, or focus it and use the arrow keys, to turn the line.",
    O: "Centre O of the first circle. Drag it, or focus it and use the arrow keys, to move the circle.",
    R: "Radius point R of the first circle. Drag it, or focus it and use the arrow keys, to resize the circle.",
    O2: "Centre O' of the second circle. Drag it, or focus it and use the arrow keys, to move the circle.",
    R2: "Radius point R' of the second circle. Drag it, or focus it and use the arrow keys, to resize the circle.",
  };
  const note = {
    L1: "Line L slid.", L2: "Line L turned.",
    O: "First circle moved.", R: "First circle resized.",
    O2: "Second circle moved.", R2: "Second circle resized.",
  };
  const handles = {};
  for (const name of Object.keys(handleLabels)) {
    const h = board.handle(name, state[name], {
      r: 8,
      step: 4,
      shift: 20,
      layer: layers.handles,
      label: handleLabels[name],
      clamp: (p) => C.clampToBoard(p),
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      onMove: (p, which) => {
        state = C.movePoint(state, which, p);
        render(note[which] + " ");
      },
    });
    h.node.setAttribute("id", "handle-" + name);
    handles[name] = h;
  }

  function statusText(g) {
    if (!g.valid) {
      if (g.reason === "radius") return "Make both circles at least two drawing units wide, then the construction can start.";
      if (g.reason === "near-line") return "O' is almost on line L. Move it away so a perpendicular can be drawn.";
      if (g.reason === "short-chord") return "The two circles touch too closely to give a chord. Move a circle or L.";
      return "No line cuts equal chords here: the circle through T does not cross the second circle. Drag L or a circle.";
    }
    return "The green line cuts equal chords: AB = CD = " + g.chord1.toFixed(1) +
      " drawing units. Drag L, O or O' and they stay equal.";
  }

  function place(name, point, show) {
    const label = labels[name];
    label.show(Boolean(show && point));
    if (show && point) label.set(point);
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render(prefix) {
    const g = C.geometry(state);
    for (const name in handles) handles[name].set(state[name]);
    circle1.set(state.O, g.r1 || C.dist(state.O, state.R)).show(true);
    circle3.set(state.O2, g.r2 || C.dist(state.O2, state.R2)).show(true);
    givenLine.set(state.L1, state.L2).show(true);
    guide1.set(state.O, state.R).show(true);
    guide2.set(state.O2, state.R2).show(true);

    const hint = Boolean(state.options.hint);
    translated.set(g.circle2 ? g.circle2.center : state.O, g.circle2 ? g.circle2.radius : 1).show(hint && g.valid);
    solutionLine.show(false);
    for (const key in dots) dots[key].show(false);
    for (const name in labels) labels[name].show(false);
    place("O", state.O, state.options.names);
    place("O2", state.O2, state.options.names);

    if (g.valid) {
      solutionLine.set(g.C, g.D).show(true);
      for (const name of ["A", "B"]) dots[name].set(g[name]).show(true);
      for (const name of ["C", "D"]) dots[name].set(g[name]).show(true);
      dots.T.set(g.T).show(hint);
      dots.F.set(g.foot2).show(hint);
      if (hint) {
        guide1.set(g.o1.a, g.o1.b).show(true);
        guide2.set(g.o2.a, g.o2.b).show(true);
      }
      if (state.options.names) {
        for (const name of ["A", "B", "C", "D"]) place(name, g[name], true);
        place("T", g.T, hint);
      }
    }
    say((prefix || "") + statusText(g), null);
    if (window.Track) window.Track.state(state);
  }

  const toggles = {
    names: document.getElementById("namesCheck"),
    hint: document.getElementById("hintCheck"),
  };
  for (const key in toggles) {
    const box = toggles[key];
    box.checked = state.options[key];
    box.addEventListener("change", () => {
      state = C.setOption(state, key, box.checked);
      render(box.checked ? "Showing " + box.dataset.label + ". " : "Hid " + box.dataset.label + ". ");
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = C.start(state.options);
    render("Back to the opening picture. ");
  });

  // Classes use CSS tokens, so a theme flip needs no new colours; redraw
  // anyway so the board stays in step with the site's themechange event.
  board.onTheme(() => render());
  render();
})();
