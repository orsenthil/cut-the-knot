"use strict";

/*
 * The page for Gothic Arc: drawing and input only. The construction and the
 * tangent-circle chain are in gothic-arc-core.js. The board shows the base A-B,
 * the two Gothic arcs and the arbelos semicircles, then the chain of circles;
 * dragging A or B changes the size of the construction, and the checkboxes
 * reproduce the applet's "names" and "Gothic arc / arbelos" radio choice.
 */

(function () {
  const Core = GothicArcCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const namesChk = document.getElementById("namesChk");
  const gothicRadio = document.getElementById("gothicRadio");
  const arbelosRadio = document.getElementById("arbelosRadio");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const arcsLayer = board.layer("arcs");
  const circlesLayer = board.layer("circles");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});

  /** The shared status line. This is a picture with no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const base = board.segment(state.a, state.b, "base-line", guides);
  const bigArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "big-arc", arcsLayer);
  const leftArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "small-arc", arcsLayer);
  const rightArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "small-arc", arcsLayer);
  const gothicOuterA = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "gothic-arc-outer", arcsLayer);
  const gothicOuterB = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "gothic-arc-outer", arcsLayer);
  const gothicInner = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "gothic-arc-inner", arcsLayer);
  const guideLines = [
    board.segment(state.c, state.c, "guide-line", guides),
    board.segment(state.c, state.c, "guide-line", guides),
    board.segment(state.c, state.c, "guide-line", guides),
    board.segment(state.c, state.c, "guide-line", guides),
  ];
  const chainShapes = Array.from({ length: Core.NUM }, () =>
    board.circle({ x: 0, y: 0 }, 1, "chain-circle", circlesLayer));
  const dots = ["top", "d", "k", "p"].map(() => board.point({ x: 0, y: 0 }, "named-dot", 3, labelsLayer));
  const names = ["A", "B", "O", "C", "K", "P", "D"].map((n) => ({
    name: n, shape: board.label({ x: 0, y: 0 }, n, "point-label", 0, 0, labelsLayer),
  }));

  /** A and B stay on the baseline and at least 120 units apart. */
  function clampEnd(q, which) {
    const other = which === "A" ? state.b : state.a;
    const lo = other.x + (which === "A" ? -480 : 120);
    const hi = other.x + (which === "A" ? -120 : 480);
    return {
      x: Geom.clamp(q.x, Math.max(10, lo), Math.min(490, hi)),
      y: state.a.y,
    };
  }

  const aHandle = board.handle("A", state.a, {
    r: 9, step: 4, shift: 20, layer: handlesLayer,
    label: "Point A, the left end of the base. Drag it, or focus it and use the left and right arrow keys.",
    clamp: (q, name) => clampEnd(q, name),
    onMove: (q) => {
      state = Core.withEndpoints(state, q, state.b);
      render();
    },
  });
  const bHandle = board.handle("B", state.b, {
    r: 9, step: 4, shift: 20, layer: handlesLayer,
    label: "Point B, the right end of the base. Drag it, or focus it and use the left and right arrow keys.",
    clamp: (q, name) => clampEnd(q, name),
    onMove: (q) => {
      state = Core.withEndpoints(state, state.a, q);
      render();
    },
  });

  function labelAt(shape, p, text, dx, dy, visible) {
    shape.set(p, visible ? text : "", dx, dy);
    shape.show(visible);
  }

  function render() {
    const g = state;
    const drawn = Core.chain(g);
    const R = g.rightBig.radius;
    const upper = (c, r) => [c, r, Math.PI, 2 * Math.PI];
    const withNames = g.showNames;
    const withGothic = g.showGothic;

    base.set(g.a, g.b);
    bigArc.set(...upper(g.rightBig.center, R));
    leftArc.set(...upper(g.leftCircle.center, g.leftCircle.radius));
    rightArc.set(...upper(g.rightCircle.center, g.rightCircle.radius));
    gothicOuterA.set(...upper(g.a, R));
    gothicOuterB.set(...upper(g.b, R));
    gothicInner.set(...upper(g.c, g.b.x - g.c.x));
    bigArc.show(!withGothic);
    leftArc.show(!withGothic);
    rightArc.show(!withGothic);
    gothicOuterA.show(withGothic);
    gothicOuterB.show(withGothic);
    gothicInner.show(withGothic);

    guideLines[0].set(g.c, drawn[0] ? drawn[0].center : g.c);
    guideLines[1].set(g.c, g.top || g.c);
    guideLines[2].set(drawn[1] ? drawn[1].center : g.d, g.d);
    guideLines[3].set(drawn[1] ? drawn[1].center : g.d, drawn[0] ? drawn[0].center : g.c);
    guideLines.forEach((line) => line.show(withNames && withGothic));

    for (let i = 0; i < chainShapes.length; i++) {
      const c = drawn[i];
      chainShapes[i].show(!!c);
      if (c) {
        chainShapes[i].set(c.center, c.radius);
        chainShapes[i].node.setAttribute("class", i === 0 ? "chain-circle first" :
          i === 1 ? "chain-circle second" : "chain-circle");
      }
    }

    const pick = (i, fallback) => (drawn[i] ? drawn[i].center : fallback);
    const dotPoints = [g.top || g.c, g.d, pick(0, g.c), pick(1, g.d)];
    dots.forEach((dot, i) => {
      dot.set(dotPoints[i]);
      dot.show(withNames && withGothic);
    });
    const labelPoints = {
      A: { p: g.a, dx: -8, dy: 16 }, B: { p: g.b, dx: 4, dy: 16 },
      O: { p: g.c, dx: -5, dy: 16 }, C: { p: g.top || g.c, dx: 5, dy: 18 },
      K: { p: pick(0, g.c), dx: 6, dy: -5 }, P: { p: pick(1, g.d), dx: 6, dy: -5 },
      D: { p: g.d, dx: -5, dy: 16 },
    };
    for (const item of names) {
      const l = labelPoints[item.name];
      const visible = withNames && (withGothic || item.name === "A" || item.name === "B" || item.name === "O");
      labelAt(item.shape, l.p, item.name, l.dx, l.dy, visible);
    }

    aHandle.set(g.a);
    bHandle.set(g.b);
    namesChk.checked = withNames;
    gothicRadio.checked = withGothic;
    arbelosRadio.checked = !withGothic;

    const first = drawn[0], second = drawn[1];
    const summary = first && second
      ? `Circle K has radius ${first.radius.toFixed(1)} and circle P ${second.radius.toFixed(1)}.`
      : "This base is too short for the whole chain.";
    say(`${withGothic ? "Gothic arc" : "Arbelos"} view. ${summary} Drag A or B, or press Reset.`);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  namesChk.addEventListener("change", () => {
    state = Core.withOptions(state, { showNames: namesChk.checked });
    render();
  });
  gothicRadio.addEventListener("change", () => {
    if (gothicRadio.checked) {
      state = Core.withOptions(state, { showGothic: true });
      render();
    }
  });
  arbelosRadio.addEventListener("change", () => {
    if (arbelosRadio.checked) {
      state = Core.withOptions(state, { showGothic: false });
      render();
    }
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(() => render());
  render();
})();
