"use strict";

/*
 * The page for Orthocenter and Three Equal Circles: drawing and input only.
 * The geometry is in equal-circles-orthocenter-core.js.
 *
 * The SVG holds three draggable corners. Every other point and circle is
 * rebuilt from them by the core. The four checkboxes are the applet's own
 * "names", "premise", "statement" and "hint" boxes; nothing is won or lost,
 * so the status line reports the radius and diameter invariant instead.
 * Every shape is created once and only moved with .set(), so a handle keeps
 * keyboard focus when the picture is redrawn.
 */

(function () {
  const C = EqualCirclesOrthocenterCore;
  const statusEl = document.getElementById("status");
  const boxes = {
    showNames: document.getElementById("names"),
    showPremise: document.getElementById("premise"),
    showStatement: document.getElementById("statement"),
    showHint: document.getElementById("hint"),
  };
  const newBtn = document.getElementById("newBtn");

  let state = C.start({});

  /** The line under the picture. An explored illustration ends as "done". */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const board = Geom.board(document.getElementById("board"));
  const circles = board.layer("circles");
  const triangle = board.layer("triangle");
  const premise = board.layer("premise");
  const statement = board.layer("statement");
  const hint = board.layer("hint");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const g0 = C.compute(state);
  const circleA = board.circle(g0.circleA.c, g0.circleA.r, "circle-a", circles);
  const circleB = board.circle(g0.circleB.c, g0.circleB.r, "circle-b", circles);
  const circleC = board.circle(g0.circleC.c, g0.circleC.r, "circle-c", circles);
  const tri = board.polygon(g0.triangle, "tri-abc", triangle);

  const altitudes = [0, 1, 2].map(() => board.segment(g0.A, g0.H, "altitude", premise));
  const sideLines = [0, 1, 2].map(() => board.line(g0.A, g0.B, "side-line", premise));
  const diameters = [0, 1, 2].map(() => board.segment(g0.H, g0.Oa, "diameter", statement));
  const outer = board.polygon(g0.outer, "outer-tri", hint);
  const circumcircle = board.circle(g0.circle.c, g0.circle.r, "circumcircle", hint);
  const rightAngleSpecs = [
    [g0.A, g0.H, g0.Ob], [g0.A, g0.H, g0.Oc],
    [g0.B, g0.H, g0.Oc], [g0.B, g0.H, g0.Oa],
    [g0.C, g0.H, g0.Oa], [g0.C, g0.H, g0.Ob],
  ];
  const rightAngles = rightAngleSpecs
    .map(([v, p, q]) => board.rightAngle(v, p, q, 10, "right-angle", hint));

  const dotH = board.point(g0.H, "h-dot", 4.5, dots);
  const dotOuter = [g0.Oa, g0.Ob, g0.Oc].map((p) => board.point(p, "outer-dot", 4, dots));
  const dotCentres = [g0.circleA.c, g0.circleB.c, g0.circleC.c]
    .map((p) => board.point(p, "centre-dot", 3.2, dots));

  const labelOffset = {
    A: [-5, -12], B: [-17, 18], C: [8, 18], H: [8, -8],
    Oa: [-17, 18], Ob: [8, -8], Oc: [-20, -8],
  };
  const pointLabels = {};
  for (const name of Object.keys(labelOffset)) {
    pointLabels[name] = board.label(g0[name] || g0.A, name === "Oa" ? "A′" :
      name === "Ob" ? "B′" : name === "Oc" ? "C′" : name,
    "point-label", labelOffset[name][0], labelOffset[name][1], labels);
  }

  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down in the drawing`;
  const clamp = (p) => C.clampPoint(p);
  const onMove = (p, name) => {
    state = C.moveVertex(state, name, p);
    render();
  };
  const handles = Object.fromEntries(["A", "B", "C"].map((name) => [name,
    board.handle(name, state[name], {
      r: 10, step: 5, shift: 5, layer: tops, clamp, describe, onMove,
      label: `Point ${name} of triangle ABC. Drag it, or focus it and use the arrow keys to move it.`,
    })]));

  function render() {
    const g = C.compute(state);
    const ok = g.valid;

    circleA.show(ok).set(g.circleA.c, g.circleA.r);
    circleB.show(ok).set(g.circleB.c, g.circleB.r);
    circleC.show(ok).set(g.circleC.c, g.circleC.r);
    tri.show(ok).set(g.triangle);

    const alts = ok ? [[g.A, g.Ha, g.H], [g.B, g.Hb, g.H], [g.C, g.Hc, g.H]] : [];
    const sides = ok ? [[g.Ha, g.B, g.C], [g.Hb, g.C, g.A], [g.Hc, g.A, g.B]] : [];
    const lines = ok ? [[g.H, g.Oa], [g.H, g.Ob], [g.H, g.Oc]] : [];
    for (let i = 0; i < 3; i++) {
      altitudes[i].show(ok && state.showPremise).set(alts[i][0] || g.A, alts[i][2] || g.A);
      sideLines[i].show(ok && state.showPremise).set(sides[i][1] || g.A, sides[i][2] || g.A);
      diameters[i].show(ok && state.showStatement).set(lines[i][0] || g.A, lines[i][1] || g.A);
      dotOuter[i].show(ok && (state.showHint || state.showStatement)).set(g.Oa || g.A);
      dotCentres[i].show(ok && state.showStatement).set(g.A);
    }
    if (ok) {
      for (let i = 0; i < 3; i++) {
        altitudes[i].set(alts[i][0], alts[i][2]);
        sideLines[i].set(sides[i][1], sides[i][2]);
        diameters[i].set(lines[i][0], lines[i][1]);
        dotOuter[i].set([g.Oa, g.Ob, g.Oc][i]);
        dotCentres[i].set([g.circleA.c, g.circleB.c, g.circleC.c][i]);
      }
    }
    dotH.show(ok).set(g.H || g.A);
    outer.show(ok && state.showHint).set(g.outer || [g.A, g.B, g.C]);
    circumcircle.show(ok && state.showHint).set(
      g.circle ? g.circle.c : g.A, g.circle ? g.circle.r : 1);
    const marks = ok && state.showHint && state.showPremise;
    const markSpecs = ok ? [
      [g.A, g.H, g.Ob], [g.A, g.H, g.Oc],
      [g.B, g.H, g.Oc], [g.B, g.H, g.Oa],
      [g.C, g.H, g.Oa], [g.C, g.H, g.Ob],
    ] : rightAngleSpecs;
    for (let i = 0; i < rightAngles.length; i++) {
      const [v, p, q] = markSpecs[i];
      rightAngles[i].show(marks).set(v, p, q, 10);
    }

    const named = ok && state.showNames;
    for (const name of Object.keys(pointLabels)) {
      const p = ok ? (name === "Oa" ? g.Oa : name === "Ob" ? g.Ob :
        name === "Oc" ? g.Oc : g[name]) : null;
      const outerName = ["Oa", "Ob", "Oc"].includes(name);
      pointLabels[name].show(Boolean(p) && named && (!outerName || state.showHint || state.showStatement));
      if (p) pointLabels[name].set(p);
    }
    for (const name of ["A", "B", "C"]) handles[name].set(state[name]);

    for (const k of C.OPTION_KEYS) boxes[k].checked = state[k];
    say(C.describe(g), state.explored ? "done" : null);

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C,
        H: g.H, Oa: g.Oa, Ob: g.Ob, Oc: g.Oc,
        centre: g.circle.c, radius: g.circle.r,
        options: {
          showNames: state.showNames, showPremise: state.showPremise,
          showStatement: state.showStatement, showHint: state.showHint,
        },
      });
    }
  }

  for (const key of C.OPTION_KEYS) {
    boxes[key].addEventListener("change", () => {
      state = C.setOption(state, key, boxes[key].checked);
      render();
    });
  }
  newBtn.addEventListener("click", () => {
    state = C.randomStart();
    render();
  });

  board.onTheme(render);
  render();
})();
