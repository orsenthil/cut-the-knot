"use strict";

/*
 * The page for Fagnano: drawing and input only; the reflections are in
 * fagnano-core.js. A 550 by 270 view of the 500 by 400 applet canvas holds
 * the original triangle, the five reflected copies and the six red pieces of
 * the folded line. Drag A, B or C to change the triangle; drag P, Q or R to
 * change the inscribed triangle. The two checkboxes and the two buttons are
 * labelled in plain words; every dot is also a keyboard handle.
 */

(function () {
  const Core = FagnanoCore;
  const statusEl = document.getElementById("status");
  const altBox = document.getElementById("altBox");
  const namesBox = document.getElementById("namesBox");
  const resetBtn = document.getElementById("resetBtn");
  const orthicBtn = document.getElementById("orthicBtn");

  const board = Geom.board(document.getElementById("board"));
  const chainLayer = board.layer("chain");
  const redLayer = board.layer("red");
  const guideLayer = board.layer("guides");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start();

  /**
   * Shows a line under the picture. `kind` is "win", "lose" or "done" and is
   * how a play ends for the player's record. This is an illustration: there
   * is no win or loss, so no kind is ever passed here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Objects are made once and only updated, so a focused dot keeps focus. */
  const edges = [];
  for (let t = 0; t < 6; t++) {
    for (const side of ["AB", "BC", "CA"]) {
      edges.push(board.segment(state.A, state.B,
        t === 0 ? "tri-edge" : "tri-ghost", chainLayer));
    }
  }
  const redEdges = [];
  for (let i = 0; i < 6; i++) {
    redEdges.push(board.segment(state.P, state.Q, "fold-edge", redLayer));
  }
  const altitudes = [];
  const orthicEdges = [];
  const rightMarks = [];
  const footDots = [];
  for (let i = 0; i < 3; i++) {
    altitudes.push(board.line(state.A, state.A, "altitude", guideLayer));
    orthicEdges.push(board.segment(state.A, state.A, "orthic-edge", guideLayer));
    rightMarks.push(board.rightAngle(state.A, state.B, state.C, 9, "right-mark", guideLayer));
    footDots.push(board.point(state.A, "foot-dot", 4, dotLayer));
  }

  const texts = {};
  for (const name of ["A", "B", "C", "P", "Q", "R"]) {
    texts[name] = board.label(state.A, name, "point-label", 9, -9, labelLayer);
  }
  const ghostTexts = [];
  for (let t = 1; t < 6; t++) {
    for (const name of ["A", "B", "C"]) {
      ghostTexts.push({ t, name, node: board.label(state.A, name, "ghost-label", 7, -7, labelLayer) });
    }
  }

  const view = board.viewBox;
  const inside = (q) => ({
    x: Core.clamp(q.x, view.x + 8, view.x + view.width - 8),
    y: Core.clamp(q.y, view.y + 8, view.y + view.height - 8),
  });
  const clampVertex = (q) => inside(Core.clampPoint(q));
  const clampSide = (name) => (q) => Core.setSide(state, name, q)[name];
  const onMove = (name) => (q) => {
    state = ["A", "B", "C"].includes(name)
      ? Core.move(state, name, q)
      : Core.setSide(state, name, q);
    render();
  };

  const handles = {};
  for (const name of ["A", "B", "C", "P", "Q", "R"]) {
    const vertex = ["A", "B", "C"].includes(name);
    handles[name] = board.handle(name, state[name], {
      r: vertex ? 12 : 11,
      step: vertex ? 4 : 3,
      shift: 12,
      cls: vertex ? "geom-handle vertex-handle" : "geom-handle side-handle",
      label: `Point ${name}${vertex ? " of the triangle" : " on a side"}. ` +
        "Drag it, or focus it and use the arrow keys.",
      clamp: vertex ? clampVertex : clampSide(name),
      onMove: onMove(name),
      layer: handleLayer,
    });
  }

  function render() {
    const f = Core.compute(state);
    const o = f.orthic;

    let e = 0;
    for (const tri of f.chain) {
      for (const [p, q] of [[tri.A, tri.B], [tri.B, tri.C], [tri.C, tri.A]]) {
        edges[e++].set(p, q);
      }
    }
    for (let i = 0; i < 6; i++) {
      redEdges[i].set(f.path[i][0], f.path[i][1]);
    }

    const fromVertex = [state.A, state.B, state.C];
    for (let i = 0; i < 3; i++) {
      const foot = [o.P, o.Q, o.R][i];
      altitudes[i].set(fromVertex[i], foot);
      rightMarks[i].set(foot, fromVertex[i], [state.B, state.C, state.A][i], 9);
      footDots[i].set(foot);
    }
    orthicEdges[0].set(o.P, o.Q);
    orthicEdges[1].set(o.Q, o.R);
    orthicEdges[2].set(o.R, o.P);
    for (let i = 0; i < 3; i++) {
      const show = state.showAltitudes;
      altitudes[i].show(show);
      rightMarks[i].show(show);
      footDots[i].show(show);
      orthicEdges[i].show(show);
    }

    const offsets = {
      A: [-17, -12], B: [-17, 20], C: [8, 20],
      P: [8, 18], Q: [10, -11], R: [-18, -11],
    };
    for (const name of ["A", "B", "C", "P", "Q", "R"]) {
      const [dx, dy] = offsets[name];
      texts[name].show(state.showNames).set(state[name], name, dx, dy);
    }
    for (const g of ghostTexts) {
      const tri = f.chain[g.t];
      g.node.show(state.showNames).set(tri[g.name], g.name, 7, -7);
    }

    for (const name of ["A", "B", "C", "P", "Q", "R"]) {
      handles[name].set(state[name]);
    }
    altBox.checked = state.showAltitudes;
    namesBox.checked = state.showNames;

    const straight = f.bend < 1e-7 ? "Altitude feet: " : "";
    say(straight + Core.describe(state));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  altBox.addEventListener("change", () => {
    state = Core.option(state, "showAltitudes", altBox.checked);
    render();
  });
  namesBox.addEventListener("change", () => {
    state = Core.option(state, "showNames", namesBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });
  orthicBtn.addEventListener("click", () => {
    state = Core.orthicState(state);
    render();
  });

  board.onTheme(render);
  render();
})();
