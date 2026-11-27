"use strict";

/*
 * Cyclic Incenters — drawing and input only.  The geometry is in
 * cyclic-incenters-core.js: four draggable points on a circle, the tangents
 * that make a circumscribed quadrilateral, and the four incenters around the
 * crossing of its diagonals.  Shapes are made once and only updated on a
 * redraw, so a handle keeps keyboard focus.  There is no win or loss: the
 * status says how far the fourth incenter is from the circle through the
 * first three, and the checkboxes reveal the applet's extra constructions.
 */

(function () {
  const Core = CyclicIncentersCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const back = board.layer("back");
  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const marks = board.layer("marks");
  const names = board.layer("names");
  const top = board.layer("handles");

  const mainCircle = board.circle(state.A, Core.RADIUS, "main-circle", back);
  const inscribed = board.polygon(Core.POINT_KEYS.map((k) => state[k]), "inscribed", back);
  const tangential = board.polygon(Core.POINT_KEYS.map((k) => state[k]), "tangential", back);
  const tangentLines = [0, 1, 2, 3].map(() => board.line(state.A, state.B, "tangent-line", guides));
  const tangentialDiags = [0, 1].map(() => board.line(state.A, state.B, "tangent-diagonal", guides));
  const inscribedDiags = [0, 1].map(() => board.line(state.A, state.B, "inscribed-diagonal", guides));
  const bisectors = [0, 1, 2, 3, 4, 5, 6, 7].map(() =>
    board.line(state.A, state.B, "bisector", guides));
  const centerLines = [0, 1].map(() => board.line(state.A, state.B, "center-line", guides));
  const homotheties = [0, 1, 2, 3, 4, 5].map(() =>
    board.line(state.A, state.B, "homothety", guides));
  const addOn = [0, 1, 2, 3, 4, 5, 6, 7].map(() =>
    board.line(state.A, state.B, "add-on", guides));
  const claimTangents = [0, 1, 2, 3].map(() =>
    board.line(state.A, state.B, "claim-tangent", guides));
  const segment = board.segment(state.A, state.B, "mid-segment", guides);

  const smallCircles = [0, 1, 2, 3].map(() => board.circle(state.A, 1, "small-circle", circles));
  const bigCircles = [0, 1, 2, 3].map(() => board.circle(state.A, 1, "big-circle", circles));
  const claimCircle = board.circle(state.A, 1, "claim-circle", circles);
  const circumCircles = [0, 1, 2, 3].map(() => board.circle(state.A, 1, "circum-circle", circles));
  const secondCircles = [0, 1, 2, 3].map(() => board.circle(state.A, 1, "second-circle", circles));
  const secondCircle = board.circle(state.A, 1, "second-claim-circle", circles);

  const incenterDots = [0, 1, 2, 3].map(() => board.point(state.A, "incenter-dot", 4, marks));
  const bigDots = [0, 1, 2, 3].map(() => board.point(state.A, "big-dot", 3.5, marks));
  const centerDot = board.point(state.A, "center-dot", 4, marks);
  const crossDot = board.point(state.A, "cross-dot", 4, marks);
  const labelKeys = ["A", "B", "C", "D", "X", "Y", "Z", "W", "P", "O", "A'", "B'", "C'", "D'"];
  const labels = {};
  for (const key of labelKeys) {
    labels[key] = board.label(state.A, key, "point-label", 7, -7, names);
  }

  const handleOptions = {
    step: 4, shift: 12, r: 13, layer: top,
    clamp: (p, name) => Core.snap(p, state[name]),
    label: "Point on the circle. Drag it, or focus it and use the arrow keys to move it.",
  };
  const handles = {};
  for (const key of Core.POINT_KEYS) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      label: `Point ${key} on the circle. Drag it, or focus it and use the arrow keys to move it.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    }));
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showAll(shapes, on) {
    for (const s of shapes) s.show(on);
  }

  function setLine(line, a, b) {
    if (a && b && Core.finite(a) && Core.finite(b)) line.set(a, b).show(true);
    else line.show(false);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of Core.POINT_KEYS) handles[key].set(state[key]);
    const o = state.options;

    if (!g) {
      for (const s of [mainCircle, inscribed, tangential, claimCircle, segment,
        centerDot, crossDot, secondCircle]) s.show(false);
      showAll([...tangentLines, ...tangentialDiags, ...inscribedDiags, ...bisectors,
        ...centerLines, ...homotheties, ...addOn, ...claimTangents], false);
      showAll([...smallCircles, ...bigCircles, ...circumCircles,
        ...secondCircles, ...incenterDots, ...bigDots], false);
      for (const key of labelKeys) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    mainCircle.show(true).set(g.main.c, g.main.r);
    inscribed.show(o.inscribedPolygon).set([g.A, g.B, g.C, g.D]);
    tangential.show(true).set(g.quad);
    g.tangents.forEach((line, i) => {
      if (o.tangents || o.diagonals || o.homotheties) setLine(tangentLines[i], line.a, line.b);
      else tangentLines[i].show(false);
    });

    setLine(tangentialDiags[0], g.quad[0], g.quad[2]);
    setLine(tangentialDiags[1], g.quad[1], g.quad[3]);
    showAll(tangentialDiags, o.diagonals);
    setLine(inscribedDiags[0], g.A, g.C);
    setLine(inscribedDiags[1], g.B, g.D);
    showAll(inscribedDiags, o.inscribedDiagonals || o.diagonals);

    const vertexPairs = [[g.big[1].c, g.quad[3]], [g.big[1].c, g.quad[1]],
      [g.big[0].c, g.quad[3]], [g.big[0].c, g.quad[2]],
      [g.big[2].c, g.quad[0]], [g.big[2].c, g.quad[2]],
      [g.big[3].c, g.quad[0]], [g.big[3].c, g.quad[3]]];
    bisectors.forEach((line, i) => {
      if (o.bisectors) setLine(line, vertexPairs[i][0], vertexPairs[i][1]);
      else line.show(false);
    });
    setLine(centerLines[0], g.big[0].c, g.big[1].c);
    setLine(centerLines[1], g.big[2].c, g.big[3].c);
    showAll(centerLines, o.centerLines);

    const homothetyPairs = [[g.quad[0], g.quad[2]], [g.quad[1], g.quad[3]],
      [g.big[0].c, g.big[1].c], [g.big[2].c, g.big[3].c],
      [g.X, g.Y], [g.Z, g.W]];
    homothetyPairs.forEach((pair, i) => {
      if (o.homotheties) setLine(homotheties[i], pair[0], pair[1]);
      else homotheties[i].show(false);
    });

    const addOnPairs = [[g.circum[0] && g.circum[0].c, g.W], [g.circum[0] && g.circum[0].c, g.X],
      [g.circum[1] && g.circum[1].c, g.X], [g.circum[1] && g.circum[1].c, g.Y],
      [g.circum[2] && g.circum[2].c, g.Y], [g.circum[2] && g.circum[2].c, g.Z],
      [g.circum[3] && g.circum[3].c, g.Z], [g.circum[3] && g.circum[3].c, g.W]];
    addOnPairs.forEach((pair, i) => {
      if (o.addOn) setLine(addOn[i], pair[0], pair[1]);
      else addOn[i].show(false);
    });

    const claimTangentLines = [g.X, g.Y, g.Z, g.W].map((p) => Core.tangent(g.claim, p));
    claimTangentLines.forEach((line, i) => {
      if (o.tangents) setLine(claimTangents[i], line.a, line.b);
      else claimTangents[i].show(false);
    });

    const mid1 = Core.midpoint(g.quad[0], g.quad[2]);
    const mid2 = Core.midpoint(g.quad[1], g.quad[3]);
    segment.show(o.segment).set(mid1, mid2);

    g.small.forEach((c, i) => smallCircles[i].show(o.smallCircles).set(c.c, c.r));
    g.big.forEach((c, i) => bigCircles[i].show(o.bigCircles).set(c.c, c.r));
    claimCircle.show(o.circle).set(g.claim.c, g.claim.r);
    g.circum.forEach((c, i) => {
      if (c) circumCircles[i].show(o.circumcircles).set(c.c, c.r);
      else circumCircles[i].show(false);
    });
    if (g.second && o.secondIteration) {
      g.second.circles.forEach((c, i) => secondCircles[i].show(true).set(c.c, c.r));
      secondCircle.show(true).set(g.second.circle.c, g.second.circle.r);
    } else {
      showAll(secondCircles, false);
      secondCircle.show(false);
    }

    g.small.forEach((c, i) => incenterDots[i].set(c.c).show(true));
    g.big.forEach((c, i) => bigDots[i].set(c.c).show(o.bigCircles || o.centerLines));
    centerDot.set(g.center || g.claim.c).show(o.point);
    crossDot.set(g.P).show(o.diagonals);

    labels.A.set(g.A).show(o.names);
    labels.B.set(g.B).show(o.names);
    labels.C.set(g.C).show(o.names);
    labels.D.set(g.D).show(o.names);
    ["X", "Y", "Z", "W"].forEach((key, i) => labels[key].set(g.small[i].c).show(o.names));
    labels.P.set(g.P).show(o.names && o.diagonals);
    labels.O.set(g.main.c).show(o.names && !o.diagonals);
    ["A'", "B'", "C'", "D'"].forEach((key) => labels[key].show(false));

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D,
        X: g.X, Y: g.Y, Z: g.Z, W: g.W,
        P: g.P, center: g.center, circle: g.claim,
        options: state.options, claims: g.claims, measures: g.measures,
      });
    }
  }

  for (const key of Core.OPTION_KEYS) {
    const box = document.getElementById("opt-" + key);
    if (!box) continue;
    box.checked = state.options[key];
    box.addEventListener("change", () => {
      state = Core.setOption(state, key, box.checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours come from CSS classes, so a theme flip needs no recompute;
  // redraw anyway to keep the shared Geom hook alive.
  board.onTheme(render);
  render();
})();
