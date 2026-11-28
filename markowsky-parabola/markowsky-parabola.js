"use strict";

/*
 * The page for Greg Markowsky's Problem for Parabola: drawing and input only.
 * All of the geometry, the scrollbar ranges and the two angle readings live in
 * markowsky-parabola-core.js.
 *
 * The SVG is the applet's 560 by 500 drawing. The parabola, axis and directrix
 * are drawn once; the construction (OB, the vertical through A, CD, AD, BD)
 * moves when a scrollbar changes. A and B are focusable dots: dragging one or
 * nudging it with the arrow keys changes that scrollbar and snaps the dot
 * back onto the curve. The three checkboxes are the applet's "names",
 * "statement" and "extra" (hint) boxes. Every object is made once and moved
 * with .set(), so a dot keeps keyboard focus across a redraw.
 */

(() => {
  const Core = MarkowskyParabolaCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const aSlider = document.getElementById("aSlider");
  const bSlider = document.getElementById("bSlider");
  const namesBox = document.getElementById("namesCheck");
  const statementBox = document.getElementById("statementCheck");
  const hintBox = document.getElementById("hintCheck");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /** Write the line under the picture. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: guides, construction, angles, hints, dots, labels, dots to drag. */
  const guides = board.layer("guides");
  const construction = board.layer("construction");
  const angles = board.layer("angles");
  const hints = board.layer("hints");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  /* The curve is fixed; DrawParabola sampled it every two pixels. */
  const curve = board.el("polyline", {}, "parabola-curve", guides);
  curve.setAttribute("points", Core.parabolaPoints()
    .map((p) => `${p.x},${p.y}`).join(" "));

  const axis = board.line({ x: Core.HALF, y: 0 }, { x: Core.HALF, y: Core.VIEW.height },
    "axis-line", guides);
  const directrix = board.line({ x: 0, y: Core.VIEW.height - Core.DH },
    { x: Core.VIEW.width, y: Core.VIEW.height - Core.DH }, "directrix", guides);

  const obLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "construct-line", construction);
  const aaLine = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "construct-line", construction);
  const cdLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "cd-line", construction);
  const adLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "construct-line", construction);
  const bdLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "construct-line", construction);

  const angleMarks = [
    board.angleArc({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 28, "angle-mark", angles),
    board.angleArc({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 38, "angle-mark", angles),
  ];
  const angleText = [
    board.label({ x: 0, y: 0 }, "", "angle-text", 0, 0, angles),
    board.label({ x: 0, y: 0 }, "", "angle-text", 0, 0, angles),
  ];

  const bbLine = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "hint-line", hints);
  const dkLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "hint-line", hints);
  const okLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "hint-line", hints);
  const tangentA = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "tangent-line", hints);
  const tangentB = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "tangent-line", hints);

  const auxNames = ["O", "C", "D", "K", "M", "A\u2032", "B\u2032"];
  const auxDots = {};
  const auxLabels = {};
  for (const name of auxNames) {
    auxDots[name] = board.point({ x: 0, y: 0 }, "aux-dot", 4, marks);
    auxLabels[name] = board.label({ x: 0, y: 0 }, name, "pt-label", 7, -7, labels);
  }

  const describe = (p, name) =>
    `${Math.round(p.x - Core.HALF)} from the axis, ${Math.round(p.y)} down in the drawing`;
  const clampToCurve = (q, name) => {
    const t = Core.moveVertex(state, name, q);
    return Core.curvePoint(name === "A" ? t.tA : t.tB);
  };
  const onMove = (p, name) => {
    state = Core.moveVertex(state, name, p);
    render();
  };
  const handles = {
    A: board.handle("A", Core.curvePoint(state.tA), {
      r: 9, step: 2, layer: tops, clamp: clampToCurve, onMove, describe,
      label: "Point A on the parabola. Drag it along the curve, or focus it and use the arrow keys",
    }),
    B: board.handle("B", Core.curvePoint(state.tB), {
      r: 9, step: 2, layer: tops, clamp: clampToCurve, onMove, describe,
      label: "Point B on the parabola. Drag it along the curve, or focus it and use the arrow keys",
    }),
  };

  function render() {
    const g = Core.geometry(state);
    const r = Core.readings(state);

    axis.set(g.O, g.Op);
    obLine.set(g.O, g.B);
    aaLine.set(g.A, g.Aprime);

    cdLine.show(g.active);
    adLine.show(g.active);
    bdLine.show(g.active);
    if (g.active) {
      cdLine.set(g.C, g.D);
      adLine.set(g.A, g.D);
      bdLine.set(g.B, g.D);
    }

    const showHint = g.active && state.options.hint;
    for (const line of [bbLine, dkLine, okLine, tangentA, tangentB]) line.show(showHint);
    if (showHint) {
      bbLine.set(g.B, g.Bprime);
      dkLine.set(g.D, g.K);
      okLine.set(g.O, g.K);
      tangentA.set(g.tangentA.p, g.tangentA.q);
      tangentB.set(g.tangentB.p, g.tangentB.q);
    }

    const showAngles = g.active && state.options.statement;
    for (let i = 0; i < angleMarks.length; i++) angleMarks[i].show(showAngles);
    for (let i = 0; i < angleText.length; i++) angleText[i].show(showAngles);
    if (showAngles) {
      angleMarks[0].set(g.D, g.A, g.C, 28);
      angleMarks[1].set(g.D, g.B, g.C, 40);
      angleText[0].set({ x: g.D.x + 34, y: g.D.y - 26 }, `${r.adc.toFixed(1)}\u00b0`);
      angleText[1].set({ x: g.D.x + 46, y: g.D.y + 30 }, `${r.bdc.toFixed(1)}\u00b0`);
    }

    const positions = {
      O: g.O, C: g.C, D: g.D, K: g.K, M: g.M, "A\u2032": g.Aprime, "B\u2032": g.Bprime,
    };
    for (const name of auxNames) {
      const p = positions[name];
      const visible = Boolean(p) && state.options.names &&
        (name !== "K" && name !== "M" || state.options.hint);
      auxDots[name].show(visible);
      auxLabels[name].show(visible);
      if (visible) {
        auxDots[name].set(p);
        auxLabels[name].set(p, name);
      }
    }

    /* The two moving dots keep their nodes, so focus survives every redraw. */
    handles.A.set(g.A);
    handles.B.set(g.B);
    aSlider.value = String(state.tA);
    bSlider.value = String(state.tB);
    namesBox.checked = state.options.names;
    statementBox.checked = state.options.statement;
    hintBox.checked = state.options.hint;

    say(Core.status(state));

    // The position, for the player's record and the tutor (board units).
    if (window.Track) window.Track.state(state);
  }

  aSlider.addEventListener("input", () => {
    state = Core.setOffset(state, "A", aSlider.value);
    render();
  });
  bSlider.addEventListener("input", () => {
    state = Core.setOffset(state, "B", bSlider.value);
    render();
  });
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  statementBox.addEventListener("change", () => {
    state = Core.setOption(state, "statement", statementBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start({
      names: namesBox.checked, statement: statementBox.checked, hint: hintBox.checked,
    });
    render();
  });

  board.onTheme(render);
  render();
})();
