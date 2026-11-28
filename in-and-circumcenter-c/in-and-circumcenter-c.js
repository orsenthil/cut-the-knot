"use strict";

/*
 * The page for In And Circumcenter C: drawing and input only; the construction
 * lives in in-and-circumcenter-c-core.js. A, B and C are draggable corners. The
 * board shows the two equal-length points D and E, the magenta pair of lines
 * DE and KL, and the dashed external bisectors through K, L, M. The five
 * switches are the Java panel's "names", "circle A/B/C" and "center line".
 * There is no win or loss: this is an illustration that can be explored.
 */

(() => {
  const Core = InAndCircumcenterCCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const circleABox = document.getElementById("circleABox");
  const circleBBox = document.getElementById("circleBBox");
  const circleCBox = document.getElementById("circleCBox");
  const centerBox = document.getElementById("centerBox");
  const resetBtn = document.getElementById("resetBtn");

  const boxes = {
    names: namesBox, circleA: circleABox, circleB: circleBBox,
    circleC: circleCBox, centerLine: centerBox,
  };
  const origin = { x: 0, y: 0 };
  let state = Core.start();

  /** Write the line under the board. "done" is how a demo tells the record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Paint order: soft fills, optional circles, guide lines, outlines, dots,
  // labels, then the focusable handles.
  const fills = board.layer("fills");
  const circlesLayer = board.layer("circles");
  const guides = board.layer("guides");
  const edges = board.layer("edges");
  const dots = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const triFill = board.polygon([origin, origin, origin], "tri-fill", fills);
  const exFill = board.polygon([origin, origin, origin], "ex-fill", fills);

  const proof = {
    incircle: board.circle(origin, 1, "circle-in", circlesLayer),
    abc: board.circle(origin, 1, "circle-outer", circlesLayer),
    ex: board.circle(origin, 1, "circle-ex", circlesLayer),
    A: board.circle(origin, 1, "circle-cyc", circlesLayer),
    B: board.circle(origin, 1, "circle-cyc", circlesLayer),
    C: board.circle(origin, 1, "circle-cyc", circlesLayer),
  };

  const externalLines = Array.from({ length: 3 }, () => board.line(origin, origin, "external-bisector", guides));
  const ioLine = board.line(origin, origin, "center-line", guides);
  const klLine = board.line(origin, origin, "kl-line", guides);
  const deLine = board.line(origin, origin, "de-line", guides);

  const triangleEdges = Array.from({ length: 3 }, () => board.segment(origin, origin, "triangle-edge", edges));
  const exEdges = Array.from({ length: 3 }, () => board.segment(origin, origin, "ex-edge", edges));

  const marks = {};
  for (const [name, cls] of [
    ["I", "dot-center"], ["O", "dot-center"], ["Op", "dot-center"],
    ["Ia", "dot-ex"], ["Ib", "dot-ex"], ["Ic", "dot-ex"],
    ["K", "dot-bisect"], ["L", "dot-bisect"], ["M", "dot-bisect"],
    ["D", "dot-end"], ["E", "dot-end"],
  ]) marks[name] = board.point(origin, cls, 4.5, dots);

  const offsets = {
    A: [-16, 18], B: [9, 18], C: [-16, -11],
    I: [-17, -10], O: [8, -10], Op: [8, 18],
    Ia: [-22, -8], Ib: [-22, 18], Ic: [9, -8],
    K: [-16, -9], L: [-16, -9], M: [-16, -9],
    D: [-16, 16], E: [8, -9],
  };
  const names = Object.fromEntries(Object.keys(offsets).map((name) => [name,
    board.label(origin, name === "Op" ? "O'" : name.startsWith("I") && name.length === 2 ? `I_${name[1].toLowerCase()}` : name,
      "pt-label", offsets[name][0], offsets[name][1], labelsLayer)]));

  const clamp = (q, name) => Core.limit(state, name, q);
  const describe = (p, name) => `${name} at ${Math.round(p.x)}, ${Math.round(p.y)} in the drawing`;
  const onMove = (p, name) => {
    if (!apply({ type: "point", name, x: p.x, y: p.y })) handles[name].set(state[name]);
  };
  const handles = {
    A: board.handle("A", state.A, { r: 9, step: 4, shift: 16, layer: handlesLayer, clamp, describe, onMove }),
    B: board.handle("B", state.B, { r: 9, step: 4, shift: 16, layer: handlesLayer, clamp, describe, onMove }),
    C: board.handle("C", state.C, { r: 9, step: 4, shift: 16, layer: handlesLayer, clamp, describe, onMove }),
  };

  const visibleCircle = (circle, on) => {
    const show = on && Core.finite(circle.centre) && Number.isFinite(circle.radius) &&
      circle.radius < 1200 && Core.onBoard(circle.centre);
    return show;
  };

  function render() {
    const g = Core.construct(state);
    if (!g) {
      triFill.show(false); exFill.show(false);
      for (const c of Object.values(proof)) c.show(false);
      for (const line of [...externalLines, ioLine, klLine, deLine, ...triangleEdges, ...exEdges]) line.show(false);
      for (const dot of Object.values(marks)) dot.show(false);
      for (const label of Object.values(names)) label.show(false);
      say(Core.status(state), Core.result(state));
      if (window.Track) window.Track.state(state);
      return;
    }

    triFill.set([g.A, g.B, g.C]).show(true);
    exFill.set([g.Ia, g.Ib, g.Ic]).show(state.centerLine);

    proof.incircle.set(g.incircle.centre, g.incircle.radius).show(visibleCircle(g.incircle, state.centerLine));
    proof.abc.set(g.circumcircle.centre, g.circumcircle.radius).show(visibleCircle(g.circumcircle, state.centerLine));
    proof.ex.set(g.exCircle.centre, g.exCircle.radius).show(visibleCircle(g.exCircle, state.centerLine));
    proof.A.set(g.circleA.centre, g.circleA.radius).show(visibleCircle(g.circleA, state.circleA));
    proof.B.set(g.circleB.centre, g.circleB.radius).show(visibleCircle(g.circleB, state.circleB));
    proof.C.set(g.circleC.centre, g.circleC.radius).show(visibleCircle(g.circleC, state.circleC));

    [g.sa, g.sb, g.sc].forEach((line, i) => externalLines[i].set(line.a, line.b).show(true));
    ioLine.set(g.oo.a, g.oo.b).show(state.centerLine);
    klLine.set(g.kl.a, g.kl.b).show(true);
    deLine.set(g.de.a, g.de.b).show(true);

    [[g.A, g.B], [g.B, g.C], [g.C, g.A]].forEach(([p, q], i) => triangleEdges[i].set(p, q).show(true));
    [[g.Ia, g.Ib], [g.Ib, g.Ic], [g.Ic, g.Ia]].forEach(([p, q], i) =>
      exEdges[i].set(p, q).show(state.centerLine));

    for (const [name, dot] of Object.entries(marks)) dot.set(g[name]).show(Core.onBoard(g[name]));
    for (const [name, label] of Object.entries(names)) label.set(g[name]).show(state.names && Core.onBoard(g[name]));
    handles.A.set(g.A);
    handles.B.set(g.B);
    handles.C.set(g.C);

    for (const [name, box] of Object.entries(boxes)) box.checked = state[name];
    say(Core.status(state), Core.result(state));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      A: g.A, B: g.B, C: g.C, I: g.I, O: g.O, Op: g.Op,
      Ia: g.Ia, Ib: g.Ib, Ic: g.Ic, D: g.D, E: g.E, K: g.K, L: g.L, M: g.M,
      names: state.names, circleA: state.circleA, circleB: state.circleB,
      circleC: state.circleC, centerLine: state.centerLine,
    });
  }

  function apply(m) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    return true;
  }

  for (const [name, box] of Object.entries(boxes)) {
    box.addEventListener("change", () => {
      if (!apply({ type: name, value: box.checked })) box.checked = state[name];
    });
  }
  resetBtn.addEventListener("click", () => apply({ type: "reset" }));
  board.onTheme(() => render());

  render();
})();
