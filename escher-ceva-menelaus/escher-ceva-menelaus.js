"use strict";

/*
 * The page for Escher Ceva Menelaus: drawing and input only. The theorem and
 * the six ratios live in escher-ceva-menelaus-core.js.
 *
 * The SVG shows a triangle with three rows of equally spaced ticks. Two dots
 * on each side can be dragged to a tick (or moved with the arrow keys); they
 * are B1/C1 on A2A3, B2/C2 on A3A1 and B3/C3 on A1A2. The three lines joining
 * C1 to B2, C2 to B3 and C3 to B1 are drawn in the accent colour. When the
 * page's formula gives 1 the lines meet and their crossing is marked, just as
 * the applet's "Finished" eye does. The three number boxes are the applet's
 * spinners (2..30 divisions per side).
 */

(function () {
  const Core = EscherCevaMenelausCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;
  const inputs = {
    AB: document.getElementById("divAB"),
    BC: document.getElementById("divBC"),
    CA: document.getElementById("divCA"),
  };
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  const gridLayer = board.layer("grid");
  const sidesLayer = board.layer("sides");
  const linesLayer = board.layer("lines");
  const marksLayer = board.layer("marks");
  const textLayer = board.layer("text");
  const handlesLayer = board.layer("handles");

  const sides = [
    board.segment(state.corners.A1, state.corners.A2, "tri-side", sidesLayer),
    board.segment(state.corners.A2, state.corners.A3, "tri-side", sidesLayer),
    board.segment(state.corners.A3, state.corners.A1, "tri-side", sidesLayer),
  ];
  const cevians = [
    board.line(state.corners.A3, state.corners.A1, "cevian", linesLayer),
    board.line(state.corners.A3, state.corners.A1, "cevian", linesLayer),
    board.line(state.corners.A3, state.corners.A1, "cevian", linesLayer),
  ];
  const centerDot = board.point(state.corners.A1, "center-dot", 6, marksLayer);
  const centerLabel = board.label(state.corners.A1, "P", "pt-label center-label", 9, -9, textLayer);

  const cornerLabels = {};
  for (const name of ["A1", "A2", "A3"]) {
    const off = { A1: [-8, -14], A2: [-22, 19], A3: [10, 17] }[name];
    cornerLabels[name] = board.label(state.corners[name], "A" + name[1], "pt-label vertex-label",
      off[0], off[1], textLayer);
  }
  const markLabels = {};
  for (const m of Core.MARKS) {
    const up = m[0] === "B";
    markLabels[m] = board.label(state.corners.A1, m[0] + m[1],
      "pt-label mark-label " + (up ? "b-label" : "c-label"), 9, up ? -11 : 18, textLayer);
  }

  /**
   * The line under the picture. "done" tells the player's record that this
   * illustration has been explored; there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function drawTicks() {
    board.clear(gridLayer);
    for (const side of ["AB", "BC", "CA"]) {
      const [a, b] = Core.ENDS_OF[side].map((k) => state.corners[k]);
      const n = state.grid[side];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        board.el("circle", {
          cx: a.x + (b.x - a.x) * t, cy: a.y + (b.y - a.y) * t, r: 1.6,
        }, "grid-tick", gridLayer);
      }
    }
  }

  function render() {
    const ev = Core.evaluate(state);
    const p = Core.points(state);

    drawTicks();
    sides[0].set(p.A1, p.A2);
    sides[1].set(p.A2, p.A3);
    sides[2].set(p.A3, p.A1);
    cevians[0].set(p.C1, p.B2);
    cevians[1].set(p.C2, p.B3);
    cevians[2].set(p.C3, p.B1);

    const center = ev.crossings.center;
    const showCenter = ev.finished && center && Number.isFinite(center.x + center.y);
    centerDot.show(Boolean(showCenter));
    centerLabel.show(Boolean(showCenter));
    if (showCenter) {
      centerDot.set(center);
      centerLabel.set(center);
    }

    for (const name of ["A1", "A2", "A3"]) {
      cornerLabels[name].set(p[name]);
      handles[name].set(p[name]);
    }
    for (const m of Core.MARKS) {
      markLabels[m].set(p[m]);
      handles[m].set(p[m]);
      handles[m].node.setAttribute("aria-label",
        (m[0] === "B" ? "B" : "C") + m[1] + " on side " +
        { BC: "A2 A3", CA: "A3 A1", AB: "A1 A2" }[Core.SIDE_OF[m]] +
        ", at division " + state.marks[m] + ". Drag to a tick or use the arrow keys.");
    }

    for (const k of Object.keys(inputs)) {
      if (Number(inputs[k].value) !== state.divisions[k]) inputs[k].value = String(state.divisions[k]);
    }
    if (ev.finished && ev.concurrent) {
      say("The three lines meet at one point. The formula gives " + Core.format(ev.formula, 3) + ".", "done");
    } else if (ev.finished) {
      say("The formula gives 1, but the drawn lines do not meet at a finite point.", null);
    } else {
      say("The three lines miss one another: the formula gives " +
        Core.format(ev.formula, 3) + ", not 1.", null);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /** Project a moved mark onto the infinite line of its side, as RestrictToLine does. */
  function onSide(p, name) {
    const [a, b] = Core.ENDS_OF[Core.SIDE_OF[name]].map((k) => state.corners[k]);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return p;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });

  const handles = {};
  for (const name of ["A1", "A2", "A3"]) {
    handles[name] = board.handle(name, state.corners[name], {
      r: 8, step: 4, shift: 12, layer: handlesLayer, cls: "geom-handle corner-handle",
      clamp: inside,
      label: "Corner " + name.replace("1", " one").replace("2", " two").replace("3", " three") +
        ". Drag it, or focus it and use the arrow keys.",
      describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
      onMove: (p) => { state = Core.moveCorner(state, name, p); render(); },
    });
  }
  for (const m of Core.MARKS) {
    handles[m] = board.handle(m, Core.pointOnSide(state, m), {
      r: 7, step: 4, shift: 12, layer: handlesLayer,
      cls: "geom-handle mark-handle " + (m[0] === "B" ? "b-handle" : "c-handle"),
      clamp: (p, name) => onSide(p, name),
      label: (m[0] === "B" ? "B" : "C") + m[1] + " on a side. Drag to a division tick or use the arrow keys.",
      describe: (p, name) => "division " + Core.dragMark(state, name, p).marks[name] +
        " of " + state.grid[Core.SIDE_OF[name]],
      onMove: (p, name) => { state = Core.dragMark(state, name, p); render(); },
    });
  }

  function reset() {
    state = Core.start();
    render();
    handles.A1.node.focus();
  }

  function changeDivision(side, value) {
    const panel = { ...state.divisions, [side]: value };
    state = Core.setDivisions(state, panel);
    render();
  }

  resetBtn.addEventListener("click", reset);
  for (const side of Object.keys(inputs)) {
    inputs[side].addEventListener("input", () => changeDivision(side, inputs[side].value));
  }
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
    if (e.key.toLowerCase() === "r") { e.preventDefault(); reset(); }
  });

  board.onTheme(render);
  render();
})();
