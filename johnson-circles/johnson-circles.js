"use strict";

/*
 * The page for Johnson Circles: drawing and input only. The geometry and the
 * state live in johnson-circles-core.js.
 *
 * The stage holds one SVG. Oa, Ob and Oc are draggable, focusable handles
 * constrained to the dashed guide circle; every other point and circle comes
 * from the core. The five checkboxes are the applet panel's own "names",
 * "homothety", "anticomplementary", "altitudes" and "hint" options. This is an
 * illustration: there is no win or loss, so the status line reports the radius
 * invariant and an explored diagram ends as "done" for the player's record.
 * Shapes are created once and only moved with .set(), so keyboard focus on a
 * handle survives a redraw.
 */

(function () {
  const C = JohnsonCirclesCore;
  const statusEl = document.getElementById("status");
  const boxes = {
    names: document.getElementById("names"),
    homothety: document.getElementById("homothety"),
    anticomplementary: document.getElementById("anticomplementary"),
    altitudes: document.getElementById("altitudes"),
    hint: document.getElementById("hint"),
  };
  const newBtn = document.getElementById("newBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = C.start({});

  /** The line under the picture. "done" marks an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const board = Geom.board(document.getElementById("board"));
  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const triangles = board.layer("triangles");
  const overlays = board.layer("overlays");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const g0 = C.compute(state);
  const guide = board.circle(g0.guide.c, g0.guide.r, "guide-circle", guides);
  const circleA = board.circle(g0.circleA.c, g0.circleA.r, "circle-a", circles);
  const circleB = board.circle(g0.circleB.c, g0.circleB.r, "circle-b", circles);
  const circleC = board.circle(g0.circleC.c, g0.circleC.r, "circle-c", circles);
  const fourth = board.circle(g0.circle.c, g0.circle.r, "circle-fourth", circles);
  const antiCircle = board.circle(g0.antiCircle.c, g0.antiCircle.r, "circle-anti", circles);

  const abc = board.polygon(g0.triangle, "tri-abc", triangles);
  const antiTri = board.polygon(g0.anticomplementary, "tri-anti", triangles);
  const centreTri = board.polygon(g0.centres, "tri-centres", overlays);

  const altitudes = [0, 1, 2].map(() => board.segment(g0.A, g0.O, "altitude", overlays));
  const centreAltitudes = [0, 1, 2].map(() =>
    board.segment(g0.Oa, g0.Q, "centre-altitude", overlays));
  const homothetyLines = [0, 1, 2].map(() =>
    board.segment(g0.Oa, g0.A, "homothety-line", overlays));
  const eulerLine = board.segment(g0.O, g0.Q, "euler-line", overlays);
  const spokes = [0, 1, 2, 3, 4, 5].map(() => board.line(g0.Oa, g0.B, "spoke", overlays));

  const dotO = board.point(g0.O, "o-dot", 3.4, dots);
  const dotQ = board.point(g0.Q, "q-dot", 3.8, dots);
  const dotN = board.point(g0.N, "n-dot", 3.4, dots);
  const dotABC = ["A", "B", "C"].map(() => board.point(g0.A, "abc-dot", 3.4, dots));
  const dotAnti = ["Ap", "Bp", "Cp"].map(() => board.point(g0.Ap, "anti-dot", 3.6, dots));

  const labelOffset = {
    A: [7, -9], B: [7, 16], C: [-18, 16],
    Oa: [7, -9], Ob: [-23, -7], Oc: [8, -8],
    O: [-17, -10], Q: [8, -9], N: [-19, 16],
    Ap: [-22, -9], Bp: [8, -9], Cp: [7, 16],
  };
  const labelText = {
    Oa: "Oa", Ob: "Ob", Oc: "Oc", Ap: "A'", Bp: "B'", Cp: "C'",
  };
  const names = Object.keys(labelOffset);
  const pointLabels = {};
  for (const name of names) {
    pointLabels[name] = board.label(g0[name] || g0.O, labelText[name] || name,
      "point-label", labelOffset[name][0], labelOffset[name][1], labels);
  }

  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down in the drawing`;
  const clamp = (p) => C.projectToGuide(p);
  const onMove = (p, name) => {
    state = C.moveCenter(state, name, p);
    render();
  };
  const handles = Object.fromEntries(["Oa", "Ob", "Oc"].map((name) => [name,
    board.handle(name, state[name], {
      r: 10, step: 4, shift: 5, layer: tops, clamp, describe, onMove,
      label: `Centre ${name} of one circle. Drag it round the dotted circle, or focus it and use the arrow keys`,
    })]));

  function place(name, point, show) {
    pointLabels[name].show(Boolean(show));
    if (show && point) {
      pointLabels[name].set(point, labelText[name] || name,
        labelOffset[name][0], labelOffset[name][1]);
    }
  }

  function render() {
    const g = C.compute(state);
    const o = state.options;

    guide.set(g0.guide.c, g0.guide.r);
    for (const name of ["Oa", "Ob", "Oc"]) handles[name].set(state[name]);

    const things = [circleA, circleB, circleC, fourth, antiCircle, abc, antiTri,
      centreTri, eulerLine, dotO, dotQ, dotN, ...altitudes, ...centreAltitudes,
      ...homothetyLines, ...spokes, ...dotABC, ...dotAnti];
    for (const thing of things) thing.show(g.valid);
    for (const name of names) place(name, null, false);

    if (g.valid) {
      circleA.set(g.circleA.c, g.circleA.r);
      circleB.set(g.circleB.c, g.circleB.r);
      circleC.set(g.circleC.c, g.circleC.r);
      fourth.set(g.circle.c, g.circle.r);
      antiCircle.set(g.antiCircle.c, g.antiCircle.r);
      abc.set(g.triangle);
      antiTri.set(g.anticomplementary);
      centreTri.set(g.centres);

      for (const [i, pair] of g.altitudes.entries()) altitudes[i].set(pair[0], pair[1]);
      for (const [i, pair] of g.centreAltitudes.entries()) centreAltitudes[i].set(pair[0], pair[1]);
      for (const [i, pair] of [[g.Oa, g.A], [g.Ob, g.B], [g.Oc, g.C]].entries()) {
        homothetyLines[i].set(pair[0], pair[1]);
      }
      eulerLine.set(g.O, g.Q);
      for (const [i, pair] of g.spokes.entries()) spokes[i].set(pair[0], pair[1]);

      dotO.set(g.O);
      dotQ.set(g.Q);
      dotN.set(g.N);
      for (const [i, p] of g.triangle.entries()) dotABC[i].set(p);
      for (const [i, p] of g.anticomplementary.entries()) dotAnti[i].set(p);

      const base = ["A", "B", "C", "O", "Oa", "Ob", "Oc"];
      for (const name of base) place(name, g[name], o.names);
      for (const [name, key] of [["Ap", "Ap"], ["Bp", "Bp"], ["Cp", "Cp"]]) {
        place(name, g[key], o.names && o.anticomplementary);
      }
      place("Q", g.Q, o.names && o.homothety);
      place("N", g.N, o.names && o.homothety);

      antiCircle.show(o.anticomplementary);
      antiTri.show(o.anticomplementary);
      for (const d of dotAnti) d.show(o.anticomplementary);
      centreTri.show(o.homothety);
      for (const d of homothetyLines) d.show(o.homothety);
      eulerLine.show(o.homothety);
      dotQ.show(o.homothety);
      dotN.show(o.homothety);
      for (const d of centreAltitudes) d.show(o.altitudes);
      for (const d of altitudes) d.show(o.altitudes);
      for (const d of spokes) d.show(o.hint);
    }

    for (const k in boxes) boxes[k].checked = o[k];
    say(C.describe(g), C.result(state));

    // The position, for the player's record and the tutor (board units).
    if (window.Track) {
      window.Track.state({ Oa: state.Oa, Ob: state.Ob, Oc: state.Oc, options: state.options });
    }
  }

  for (const k in boxes) {
    boxes[k].addEventListener("change", () => {
      state = C.setOption(state, k, boxes[k].checked);
      render();
    });
  }

  newBtn.addEventListener("click", () => {
    state = C.randomStart();
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = C.reset(state);
    render();
  });

  board.onTheme(render);
  render();
})();
