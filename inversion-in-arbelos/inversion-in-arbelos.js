"use strict";

/*
 * The page for Inversion in an Arbelos: drawing and input only; all geometry is
 * in inversion-in-arbelos-core.js. Four focusable dots on the axis set the
 * inversion (O and R) and the two parallel lines (A and B). The board shows the
 * two tangent circles, the stack of equal circles between the lines, and the
 * inverted chain of circles in the gap. Shapes are made once and updated in
 * place, so dragging or using the arrow keys never loses keyboard focus.
 */

(function () {
  const Core = InversionInArbelosCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const nInput = document.getElementById("nInput");
  const hintChk = document.getElementById("hintChk");
  const board = Geom.board(document.getElementById("board"));

  const fills = board.layer("fills");
  const stripLayer = board.layer("strip");
  const chainLayer = board.layer("chain");
  const outlines = board.layer("outlines");
  const guides = board.layer("guides");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = Core.start({});

  /** A filled upper semicircle closed along its diameter. */
  function semiPath(node, c, r) {
    node.setAttribute("d",
      `M ${c.x - r} ${c.y} A ${r} ${r} 0 0 1 ${c.x + r} ${c.y} Z`);
  }
  function semiShape(cls, layer) {
    const node = board.el("path", null, cls, layer);
    return {
      set: (c, r) => { semiPath(node, c, r); return node; },
      show: (on) => { node.style.display = on ? "" : "none"; return node; },
    };
  }

  const outerFill = semiShape("arbelos-outer", fills);
  const innerFill = semiShape("arbelos-inner", fills);
  const outerArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "outline", outlines);
  const innerArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "outline-inner", outlines);
  const axis = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "axis", guides);
  const invCircle = board.circle({ x: 0, y: 0 }, 1, "inv-circle", guides);
  const stripA = board.line({ x: 0, y: 0 }, { x: 0, y: 1 }, "strip-line", stripLayer);
  const stripB = board.line({ x: 0, y: 0 }, { x: 0, y: 1 }, "strip-line", stripLayer);
  const stripDots = [];
  const stripEdges = [];
  const chain = [];
  const centreLines = [];
  const tangents = [];
  const labels4 = {
    O: board.label(state.O, "O", "point-label", -12, -10, labels),
    R: board.label(state.R, "R", "point-label", -4, -10, labels),
    A: board.label(state.A, "A", "point-label", -4, 18, labels),
    B: board.label(state.B, "B", "point-label", -4, 18, labels),
  };

  for (let i = 0; i < Core.N_MAX; i++) {
    stripDots.push(board.circle({ x: 0, y: 0 }, 1, "strip-circle", stripLayer));
    stripEdges.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 1 }, "strip-edge", stripLayer));
    chain.push(board.circle({ x: 0, y: 0 }, 1, "chain-even", chainLayer));
    centreLines.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 1 }, "centre-line", guides));
    tangents.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 1 }, "tangent-line", guides));
  }

  const handleOpts = (name, text) => ({
    r: 7, step: 4, shift: 20, layer: handles,
    label: text,
    clamp: (q) => Core.clampPoint(state, name, q),
    onMove: (p) => { state = Core.setPoint(state, name, p); render(); },
  });
  const oHandle = board.handle("O", state.O, handleOpts("O",
    "Point O, the centre of inversion. Drag it, or focus it and press the arrow keys."));
  const rHandle = board.handle("R", state.R, handleOpts("R",
    "Point R, which sets the inversion radius OR. Drag it, or focus it and press the arrow keys."));
  const aHandle = board.handle("A", state.A, handleOpts("A",
    "Point A, where the first parallel line crosses the axis. Drag it, or focus it and press the arrow keys."));
  const bHandle = board.handle("B", state.B, handleOpts("B",
    "Point B, where the second parallel line crosses the axis. Drag it, or focus it and press the arrow keys."));

  /**
   * The shared status line. A demo has no win or loss, so `kind` is never
   * passed: the record sees a finished visit once the diagram is explored.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => v.toFixed(1);

  /** The upper tangent from O to a circle, as the applet's DrawTangent picks it. */
  function tangentPoint(O, c, r) {
    const d = Math.hypot(c.x - O.x, c.y - O.y);
    const len = Math.sqrt(Math.max(0, d * d - r * r));
    const points = Geom.circleIntersection(O, len, c, r);
    if (!points.length) return { x: O.x, y: O.y };
    if (points.length === 1) return points[0];
    return points[0].y <= points[1].y ? points[0] : points[1];
  }

  function render() {
    const g = Core.geometry(state);
    const y = Core.AXIS_Y;

    outerFill.set(g.outer.center, g.outer.radius);
    innerFill.set(g.inner.center, g.inner.radius);
    outerArc.set(g.outer.center, g.outer.radius, Math.PI, 2 * Math.PI);
    innerArc.set(g.inner.center, g.inner.radius, Math.PI, 2 * Math.PI);
    axis.set({ x: 18, y: y }, { x: Core.VIEW.width - 14, y: y });
    invCircle.set(g.inversion.center, g.inversion.radius);
    invCircle.show(g.inversion.radius < 170);

    stripA.set({ x: g.A.x, y: 30 }, { x: g.A.x, y: Core.VIEW.height - 10 });
    stripB.set({ x: g.B.x, y: 30 }, { x: g.B.x, y: Core.VIEW.height - 10 });
    for (let i = 0; i < Core.N_MAX; i++) {
      const shown = i < g.N;
      const s = {
        x: g.strip.center.x,
        y: y - i * g.strip.step,
        r: g.strip.radius,
      };
      const e0 = { x: g.A.x, y: s.y }, e1 = { x: g.B.x, y: s.y };
      stripDots[i].set(s, s.r).show(shown && i > 0);
      stripEdges[i].set(e0, e1).show(shown && i > 0);
      const c = g.chain[i];
      chain[i].node.setAttribute("class", i % 2 ? "chain-odd" : "chain-even");
      if (shown) chain[i].set(c.center, c.radius);
      chain[i].show(shown);
      const guideOn = shown && g.hints && i > 0;
      if (guideOn) {
        centreLines[i].set(g.O, c.center);
        tangents[i].set(g.O, tangentPoint(g.O, c.center, c.radius));
      }
      centreLines[i].show(guideOn);
      tangents[i].show(guideOn);
    }

    labels4.O.set(g.O, "O", -14, -10);
    labels4.R.set(g.R, "R", -4, -10);
    labels4.A.set(g.A, "A", -4, 18);
    labels4.B.set(g.B, "B", -4, 18);
    oHandle.set(g.O);
    rHandle.set(g.R);
    aHandle.set(g.A);
    bHandle.set(g.B);

    const one = g.chain[Math.min(1, g.N - 1)];
    say(g.N + (g.N === 1 ? " circle" : " circles") +
      ". Circle " + one.n + " has radius " + fmt(one.radius) + " and height " + fmt(one.height) +
      ": height = 2 × " + one.n + " × radius. k = " + fmt(g.k) + ", big radius = " + fmt(g.Rbig) +
      ". Guide lines are " + (g.hints ? "on" : "off") + ".");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function setN(n) {
    state = Core.setN(state, n);
    nInput.value = String(state.N);
    hintChk.disabled = state.N <= 1;
    render();
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    nInput.value = String(state.N);
    hintChk.checked = false;
    hintChk.disabled = true;
    render();
  });
  lessBtn.addEventListener("click", () => setN(state.N - 1));
  moreBtn.addEventListener("click", () => setN(state.N + 1));
  nInput.addEventListener("change", () => setN(Number(nInput.value)));
  hintChk.addEventListener("change", () => {
    state = Core.setHints(state, hintChk.checked);
    hintChk.checked = state.hints;
    render();
  });
  board.onTheme(() => render());

  setN(state.N);
})();
