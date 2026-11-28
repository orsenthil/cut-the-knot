"use strict";

/*
 * The page for La Hire in Ellipse: drawing and input only; the geometry is in
 * lahire-on-ellipse-core.js. The SVG holds the ellipse, its four rectangle
 * handles, the two draggable outside points A and B, the four contact points
 * and the two chords of contact. Chords and contact points are created once
 * and only moved on a redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = LahireOnEllipseCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const placeBtn = document.getElementById("placeBtn");
  const namesBtn = document.getElementById("namesBtn");
  const view = board.viewBox;
  const names = ["A", "B", "C", "D", "E", "F"];

  let state = Core.start({ width: view.width, height: view.height });

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const chordsLayer = board.layer("chords");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const ellipseNode = board.el("ellipse", {}, "ellipse", guides);
  const ellipse = {
    node: ellipseNode,
    set: function (e) {
      ellipseNode.setAttribute("cx", e.center.x);
      ellipseNode.setAttribute("cy", e.center.y);
      ellipseNode.setAttribute("rx", Math.abs(e.A));
      ellipseNode.setAttribute("ry", Math.abs(e.B));
      return ellipse;
    },
  };
  const rectGuide = board.polygon(state.V, "rect-guide", guides);
  const tangentLines = [0, 1, 2, 3].map((i) => board.segment(state.A, state.B, "tangent", guides));
  const chordA = board.line(state.A, state.B, "chord chord-a", chordsLayer);
  const chordB = board.line(state.A, state.B, "chord chord-b", chordsLayer);
  const contactDots = [0, 1, 2, 3].map((i) => board.point(state.A, "contact-dot", 4.5, marks));
  const pointLabels = names.map((n) => board.label(state.A, n, "point-label", 9, -9, labelsLayer));

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const c = Core.claims(state);
    ellipse.set(c.ellipse);
    rectGuide.set(state.V);

    const contacts = [c.C, c.D, c.E, c.F];
    for (let i = 0; i < 4; i++) {
      const ok = Core.finite(contacts[i]);
      contactDots[i].show(ok);
      if (ok) contactDots[i].set(contacts[i]);
    }
    const pairs = [[state.A, c.C], [state.A, c.D], [state.B, c.E], [state.B, c.F]];
    for (let i = 0; i < 4; i++) {
      const ok = Core.finite(pairs[i][1]);
      tangentLines[i].show(ok);
      if (ok) tangentLines[i].set(pairs[i][0], pairs[i][1]);
    }
    chordA.show(Boolean(c.lineA));
    if (c.lineA) chordA.set(c.C, c.D);
    chordB.show(Boolean(c.lineB));
    if (c.lineB) chordB.set(c.E, c.F);

    const shown = [state.A, state.B, c.C, c.D, c.E, c.F];
    for (let i = 0; i < 6; i++) {
      const ok = state.names && Core.finite(shown[i]);
      pointLabels[i].show(ok);
      if (ok) pointLabels[i].set(shown[i]);
    }
    handles.V.forEach((h, i) => h.set(state.V[i]));
    handles.A.set(state.A);
    handles.B.set(state.B);

    say(Core.describe(state), state.explored && c.touch ? "done" : null);
    /* The position, for the player's record and the tutor. */
    if (window.Track) window.Track.state(Core.position(state));
  }

  function drag(name, p) {
    state = Core.move(state, name, p);
    render();
  }

  /* V0..V3 reshape the ellipse; A and B are the two outside points. */
  const handles = { V: [], A: null, B: null };
  [0, 1, 2, 3].forEach((i) => {
    handles.V.push(board.handle("V" + i, state.V[i], {
      r: 7, step: 3, shift: 9, cls: "geom-handle rect-handle", layer: handlesLayer,
      clamp: (p) => Core.clampCorner(p, state),
      label: `Ellipse corner ${i + 1}. Drag, or focus and use the arrow keys, to reshape the ellipse.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, who) => drag(who, p),
    }));
  });
  ["A", "B"].forEach((name) => {
    handles[name] = board.handle(name, state[name], {
      r: 9, step: 4, shift: 12, layer: handlesLayer,
      clamp: (p) => Core.clamp(p, state),
      label: `Point ${name}. Drag, or focus and use the arrow keys, to move it around the ellipse.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, who) => drag(who, p),
    });
  });

  function reset() {
    state = Core.start({ width: view.width, height: view.height });
    render();
    handles.A.node.focus();
  }

  function placeB() {
    state = Core.placeB(state);
    render();
    handles.B.node.focus();
  }

  function toggleNames() {
    state = { ...state, names: !state.names };
    namesBtn.setAttribute("aria-pressed", String(state.names));
    namesBtn.textContent = state.names ? "Hide names" : "Show names";
    render();
  }

  resetBtn.addEventListener("click", reset);
  placeBtn.addEventListener("click", placeB);
  namesBtn.addEventListener("click", toggleNames);
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "b" || e.key === "B") placeB();
    if (e.key === "n" || e.key === "N") toggleNames();
  });

  board.onTheme(render);
  render();
})();
