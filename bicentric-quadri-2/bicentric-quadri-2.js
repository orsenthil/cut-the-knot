"use strict";

/*
 * Browser view of Easy Construction of Bicentric Quadrilateral II. All the
 * geometry is in bicentric-quadri-2-core.js; this file only draws it and takes
 * input. The stage shows the circle w, four draggable vertices A,B,C,D on it,
 * the crossing P of the diagonals, and the four perpendicular feet K,L,M,N.
 * KLMN always has P as its incenter; a green circumcircle appears exactly when
 * the applet's AreOrtho test says AC and BD cross at right angles. Shapes are
 * created once and only updated on a redraw, so a handle keeps keyboard focus.
 */

(() => {
  const Core = BicentricQuadri2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const makeBtn = document.getElementById("makeBtn");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = {
    names: document.getElementById("names"),
    incircle: document.getElementById("incircle"),
    diagonals: document.getElementById("diagonals"),
    extend: document.getElementById("extend"),
  };
  const names = ["A", "B", "C", "D"];
  const footNames = ["K", "L", "M", "N"];
  const extendedNames = ["K'", "L'", "M'", "N'"];
  let state = Core.start({});

  /* Layers, back to front. */
  const back = board.layer("circle");
  const guides = board.layer("guides");
  const feetLayer = board.layer("feet");
  const circles = board.layer("circles");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const circleW = board.circle(state.center, state.radius, "circle-w", back);
  const quad = board.polygon([], "quad", guides);
  const diagonals = [
    board.segment(state.center, state.center, "diagonal", guides),
    board.segment(state.center, state.center, "diagonal", guides),
  ];
  const perps = names.map(() => board.segment(state.center, state.center, "perp", guides));
  const feetQuad = board.polygon([], "feet-quad", feetLayer);
  const incircle = board.circle(state.center, 1, "incircle", circles);
  const circumcircle = board.circle(state.center, 1, "circumcircle", circles);
  const rightAngle = board.rightAngle(state.center, state.center, state.center, 9, "right-angle", marks);
  const pDot = board.point(state.center, "p-dot", 4, marks);
  const footDots = footNames.map(() => board.point(state.center, "foot-dot", 3.5, marks));
  const eDot = board.point(state.center, "extra-dot", 4, marks);
  const oDot = board.point(state.center, "circum-dot", 4, marks);
  const extLines = [];
  for (let i = 0; i < 7; i++) extLines.push(board.line(state.center, state.center, "extend", guides));
  const opDot = board.point(state.center, "extra-dot", 4, marks);
  const text = {};
  for (const key of names.concat(footNames, ["P", "E", "O"])) {
    text[key] = board.label(state.center, key, "point-label", 7, -7, labels);
  }
  for (const key of extendedNames) {
    text[key] = board.label(state.center, key, "extra-label", 7, -7, labels);
  }

  const vertexOptions = {
    step: 3, shift: 9, r: 9, layer: top,
    label: "Vertex. Drag it around the circle, or focus it and use the arrow keys.",
    describe: (p) => "at " + Math.round(Core.angleOf(state.center, p) * 180 / Math.PI) + " degrees",
  };
  const vertices = names.map((key, i) => board.handle(key, Core.handles(state)[key], Object.assign({}, vertexOptions, {
    label: `Vertex ${key}. Drag it around the circle, or focus it and use the arrow keys to move it.`,
    onMove: (p) => {
      state = Core.move(state, { type: "rotateTo", index: i, angle: Core.angleOf(state.center, p) });
      render();
    },
  })));
  const centreHandle = board.handle("O-center", Core.handles(state).O, {
    r: 7, step: 4, shift: 12, layer: top,
    label: "Circle centre. Drag it, or focus it and use the arrow keys to move the whole picture.",
    onMove: (p) => { state = Core.move(state, { type: "center", x: p.x, y: p.y }); render(); },
  });
  const radiusHandle = board.handle("radius", Core.handles(state).R, {
    r: 7, step: 4, shift: 12, layer: top,
    label: "Circle size. Drag it, or focus it and use the arrow keys to change the circle's size.",
    onMove: (p) => {
      state = Core.move(state, { type: "radius", value: Core.distance(p, state.center) });
      render();
    },
  });

  /** #status is how the player's record sees an explored illustration. */
  function say(content, kind) {
    statusEl.textContent = content;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showAll(shapes, on) {
    for (const s of shapes) s.show(on);
  }

  function render() {
    const h = Core.handles(state);
    const g = Core.geometry(state);
    for (let i = 0; i < 4; i++) vertices[i].set(h[names[i]]);
    centreHandle.set(h.O);
    radiusHandle.set(h.R);
    circleW.set(h.O, state.radius);

    if (!g) {
      for (const s of [quad, feetQuad, incircle, circumcircle, rightAngle, pDot, oDot, eDot, opDot]) s.show(false);
      showAll(diagonals.concat(perps, footDots, extLines), false);
      for (const key of Object.keys(text)) text[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    quad.set([g.A, g.B, g.C, g.D]).show(true);
    diagonals[0].set(g.A, g.C);
    diagonals[1].set(g.B, g.D);
    showAll(diagonals, true);
    const feet = [g.K, g.L, g.M, g.N];
    perps.forEach((line, i) => line.set(g.P, feet[i]));
    showAll(perps, true);
    feetQuad.set(feet).show(true);
    feet.forEach((f, i) => footDots[i].set(f));
    showAll(footDots, true);
    pDot.set(g.P).show(true);
    rightAngle.set(g.P, g.A, g.C, 9).show(g.orthodiagonal);
    incircle.set(g.P, g.inradius).show(state.options.incircle);
    // The applet draws its circumcircle when AreOrtho(A,C,B,D) is satisfied.
    circumcircle.set(g.O, g.circumradius).show(g.appletFinished);
    oDot.set(g.O).show(g.appletFinished);
    eDot.set(g.E || g.P).show(Boolean(g.E) && state.options.diagonals);

    // "Extend lines" reproduces the applet's K', L', M', N' and OP.
    const extended = state.options.extend ? [
      Core.intersect(g.P, g.K, g.C, g.D),
      Core.intersect(g.P, g.L, g.D, g.A),
      Core.intersect(g.P, g.M, g.A, g.B),
      Core.intersect(g.P, g.N, g.B, g.C),
    ] : [];
    const op = state.options.extend && extended.every(Boolean)
      ? Core.intersect(extended[0], extended[2], extended[1], extended[3]) : null;
    if (state.options.extend && extended.every(Boolean) && op) {
      extLines[0].set(g.P, extended[0]);
      extLines[1].set(g.P, extended[1]);
      extLines[2].set(g.P, extended[2]);
      extLines[3].set(g.P, extended[3]);
      extLines[4].set(extended[0], extended[2]);
      extLines[5].set(extended[1], extended[3]);
      extLines[6].set(g.P, op);
      opDot.set(op).show(true);
      showAll(extLines, true);
    } else {
      showAll(extLines, false);
      opDot.show(false);
    }

    const shown = state.options.names;
    for (let i = 0; i < 4; i++) {
      text[names[i]].set(h[names[i]], names[i]).show(shown);
      text[footNames[i]].set(feet[i], footNames[i]).show(shown);
      text[extendedNames[i]].set(extended[i] || g.P, extendedNames[i]).show(shown && Boolean(extended[i]));
    }
    text.P.set(g.P, "P").show(shown);
    text.E.set(g.E || g.P, "E").show(shown && Boolean(g.E) && state.options.diagonals);
    text.O.set(g.O, "O").show(shown && g.appletFinished);

    say(Core.describe(state), state.explored ? "done" : null);
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        center: { ...state.center },
        radius: state.radius,
        angles: state.angles.slice(),
        options: { ...state.options },
        selected: state.selected,
        A: h.A, B: h.B, C: h.C, D: h.D,
        P: g.P, K: g.K, L: g.L, M: g.M, N: g.N,
        O: g.O, E: g.E,
        orthodiagonal: g.orthodiagonal,
        cyclic: g.cyclic,
        inscriptible: g.inscriptible,
      });
    }
  }

  function act(m, words) {
    const next = Core.move(state, m);
    if (next === state) return;
    state = next;
    render();
    if (words) say(words + " " + Core.describe(state), "done");
  }

  for (const key of Object.keys(boxes)) {
    boxes[key].checked = state.options[key];
    boxes[key].addEventListener("change", () => {
      state = Core.move(state, { type: "option", key, value: boxes[key].checked });
      render();
    });
  }
  makeBtn.addEventListener("click", () =>
    act({ type: "bicentric" }, "I moved C until the diagonals cross at right angles."));
  resetBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "reset" });
    render();
  });

  // Keys 1-4 focus a vertex; B repeats the button for keyboard-only players.
  board.root.addEventListener("keydown", (ev) => {
    if (ev.key >= "1" && ev.key <= "4") {
      vertices[Number(ev.key) - 1].node.focus();
      ev.preventDefault();
    } else if (ev.key === "b" || ev.key === "B") {
      act({ type: "bicentric" }, "I moved C until the diagonals cross at right angles.");
      ev.preventDefault();
    }
  });

  board.onTheme(render);
  render();
})();
