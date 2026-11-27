"use strict";

/*
 * The page for Conjugate Diameters: drawing and input only; the geometry is in
 * conjugate-diameters-core.js. An SVG holds the ellipse and its four rectangle
 * handles, the moving point P, and the chord midpoint R that slides along the
 * diameter PP. Everything is created once and only moved on a redraw, so a
 * handle keeps keyboard focus while the tangents and labels follow it.
 */

(function () {
  const Core = ConjugateDiametersCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const view = board.viewBox;

  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 6, view.x + view.width - 6),
    y: Geom.clamp(p.y, view.y + 6, view.y + view.height - 6),
  });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  let state = Core.start({ width: view.width, height: view.height });

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const diametersLayer = board.layer("diameters");
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
    show: function (on) {
      ellipseNode.style.display = on ? "" : "none";
      return ellipse;
    },
  };
  const rectGuide = board.polygon(state.V, "rect-guide", guides);

  const initial = Core.compute(state);
  const ppLine = board.line(initial.PP.p, initial.PP.q, "diameter", diametersLayer);
  const qqLine = board.line(initial.QQ.p, initial.QQ.q, "conjugate", diametersLayer);
  const tangentP = board.line(initial.tangentP.p, initial.tangentP.q, "tangent", guides);
  const tangentPp = board.line(initial.tangentPp.p, initial.tangentPp.q, "tangent", guides);
  const chordLine = board.line(initial.chord.p, initial.chord.q, "chord", chordsLayer);
  const chordTangents = initial.tangentS.map((l) =>
    board.line(l.p, l.q, "chord-tangent", chordsLayer));
  const chordDots = initial.S.map((p) => board.point(p, "chord-dot", 4, marks));
  const uDot = board.point(initial.U, "u-dot", 6, marks);
  const centerDot = board.point(initial.ellipse.center, "center-dot", 4, marks);

  const nameList = [
    ["P", initial.P], ["P'", initial.Pp], ["R", initial.R], ["O", initial.ellipse.center],
    ["T", initial.S[0]], ["T'", initial.S[1]], ["U", initial.U],
  ];
  const labels = nameList.map(([text, p]) =>
    board.label(p, text, "point-label", 8, -8, labelsLayer));

  /**
   * #status is how the player's record sees an explored illustration. There is
   * no win or loss here: "done" means the player has checked the theorem.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function setLine(node, line) {
    const ok = Boolean(line && finite(line.p) && finite(line.q));
    node.show(ok);
    if (ok) node.set(line.p, line.q);
    return ok;
  }

  function render() {
    const g = Core.compute(state);
    const c = Core.claims(state);

    ellipse.set(g.ellipse).show(true);
    rectGuide.set(state.V).show(true);
    setLine(ppLine, g.PP);
    setLine(qqLine, g.QQ);
    setLine(tangentP, g.tangentP);
    setLine(tangentPp, g.tangentPp);
    setLine(chordLine, g.chord);

    g.tangentS.forEach((l, i) => setLine(chordTangents[i], l));
    const ends = g.S || [];
    chordDots.forEach((dot, i) => {
      const ok = finite(ends[i]);
      dot.show(ok);
      if (ok) dot.set(ends[i]);
    });
    const okU = finite(g.U);
    uDot.show(okU);
    if (okU) uDot.set(g.U);
    centerDot.set(g.ellipse.center).show(true);

    const spots = [g.P, g.Pp, state.R, g.ellipse.center,
      ends[0], ends[1], okU ? g.U : null];
    labels.forEach((label, i) => {
      const ok = state.names && finite(spots[i]);
      label.show(ok);
      if (ok) label.set(spots[i]);
    });

    handles.V.forEach((h, i) => h.set(state.V[i]));
    handles.P.set(state.P);
    handles.R.set(state.R);

    say(Core.describe(state),
      state.explored && c.chordMidpoint && c.uOnPP ? "done" : null);
    if (window.Track) window.Track.state(Core.position(state));
  }

  /* V0..V3 reshape the ellipse, P slides along it, R slides along PP. */
  const handles = { V: [], P: null, R: null };
  [0, 1, 2, 3].forEach((i) => {
    const name = "V" + i;
    handles.V.push(board.handle(name, state.V[i], {
      r: 7, step: 3, shift: 9, cls: "geom-handle rect-handle", layer: handlesLayer,
      clamp: (p) => Core.clampCorner(inside(p), state),
      label: `Ellipse corner ${i + 1}. Drag, or focus and use the arrow keys, to resize the ellipse.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, who) => {
        state = Core.move(state, who, inside(p));
        render();
      },
    }));
  });
  handles.P = board.handle("P", state.P, {
    r: 8, step: 3, shift: 9, layer: handlesLayer,
    clamp: (p) => inside(p),
    label: "Point P on the ellipse. Drag along the oval, or focus and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p, who) => {
      state = Core.move(state, who, inside(p));
      render();
    },
  });
  handles.R = board.handle("R", state.R, {
    r: 8, step: 3, shift: 9, layer: handlesLayer,
    clamp: (p) => inside(p),
    label: "Chord midpoint R. Drag along the diameter, or focus and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p, who) => {
      state = Core.move(state, who, inside(p));
      render();
    },
  });

  function reset() {
    state = Core.start({ width: view.width, height: view.height });
    render();
    handles.P.node.focus();
  }

  function check() {
    const c = Core.claims(state);
    if (c.chordMidpoint && c.uOnPP && c.uOnTangents) {
      state = { ...state, explored: true };
      render();
      say("U lies on PP, the diameter of the chord's midpoint. The theorem holds here too.", "done");
    } else {
      say("Move P away from a flat spot and try Check the theorem again.", null);
    }
  }

  function toggleNames() {
    state = { ...state, names: !state.names };
    namesBtn.setAttribute("aria-pressed", String(state.names));
    namesBtn.textContent = state.names ? "Hide names" : "Show names";
    render();
  }

  resetBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", check);
  namesBtn.addEventListener("click", toggleNames);
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") check();
    if (e.key === "n" || e.key === "N") toggleNames();
  });

  board.onTheme(render);
  render();
})();
