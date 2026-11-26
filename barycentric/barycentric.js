"use strict";

/*
 * The page for Barycentric: drawing and input only. The arithmetic lives in
 * barycentric-core.js, a faithful port of BarycentricCanvas.Compute().
 *
 * The SVG holds a triangle with four draggable dots (A, B, C and P). The lines
 * through P to each corner run on to the opposite side; the little dots where
 * they land are A', B' and C'. Three switches show names, the coordinates of
 * P, and the numbers on the split sides, just like the applet's checkboxes;
 * the three mode buttons choose which numbers the sides show.
 */

(function () {
  const Core = BarycentricCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;

  const buttons = {
    reset: document.getElementById("newBtn"),
    names: document.getElementById("namesBtn"),
    bary: document.getElementById("baryBtn"),
    ceva: document.getElementById("cevaBtn"),
    inherited: document.getElementById("modeInherited"),
    add: document.getElementById("modeAdd"),
    routh: document.getElementById("modeRouth"),
    down: document.getElementById("digitsDown"),
    up: document.getElementById("digitsUp"),
    check: document.getElementById("checkBtn"),
  };
  const digitsValue = document.getElementById("digitsValue");

  let state = Core.start();
  let opts = Core.options({});
  let checked = false;

  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });

  const sidesLayer = board.layer("sides");
  const cevianLayer = board.layer("cevians");
  const marksLayer = board.layer("marks");
  const textLayer = board.layer("text");
  const handleLayer = board.layer("handles");

  /* Each element is made once; redraws only change its attributes and text. */
  const sides = [
    board.segment(state.A, state.B, "tri-side", sidesLayer),
    board.segment(state.B, state.C, "tri-side", sidesLayer),
    board.segment(state.C, state.A, "tri-side", sidesLayer),
  ];
  const cevians = [
    board.line(state.A, state.B, "cevian", cevianLayer),
    board.line(state.B, state.C, "cevian", cevianLayer),
    board.line(state.C, state.A, "cevian", cevianLayer),
  ];
  const feet = [
    board.point(state.A, "foot-dot", 4.5, marksLayer),
    board.point(state.B, "foot-dot", 4.5, marksLayer),
    board.point(state.C, "foot-dot", 4.5, marksLayer),
  ];
  const cornerLabels = [
    board.label(state.A, "A", "glabel", -18, 21, textLayer),
    board.label(state.B, "B", "glabel", 6, 21, textLayer),
    board.label(state.C, "C", "glabel", -4, -12, textLayer),
    board.label(state.P, "P", "glabel p-label", 12, -10, textLayer),
  ];
  const footLabels = [
    board.label(state.A, "A'", "glabel foot-label", 5, -9, textLayer),
    board.label(state.B, "B'", "glabel foot-label", 5, -9, textLayer),
    board.label(state.C, "C'", "glabel foot-label", 5, -9, textLayer),
  ];
  const baryLabel = board.label(state.P, "", "bary-label", 14, 22, textLayer);
  const ratioLabels = [];
  for (let i = 0; i < 6; i++) {
    ratioLabels.push(board.label(state.A, "", "ratio-label", 0, 0, textLayer));
  }

  /**
   * The line under the picture. "done" is for a checked illustration: the
   * tracker reads it as finished, and no one has won or lost.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function updateButtons() {
    buttons.names.setAttribute("aria-pressed", String(opts.showNames));
    buttons.bary.setAttribute("aria-pressed", String(opts.showBary));
    buttons.ceva.setAttribute("aria-pressed", String(opts.showCeva));
    buttons.inherited.setAttribute("aria-pressed", String(opts.mode === "inherited"));
    buttons.add.setAttribute("aria-pressed", String(opts.mode === "addTo1"));
    buttons.routh.setAttribute("aria-pressed", String(opts.mode === "routh"));
    digitsValue.textContent = String(opts.digits);
    // The applet disables the ratio options until "side partitions" is on.
    for (const b of [buttons.inherited, buttons.add, buttons.routh, buttons.down, buttons.up]) {
      b.disabled = !opts.showCeva;
    }
  }

  function render() {
    const calc = Core.compute(state);
    const shown = Core.display(state, calc, opts);
    const { aa, bb, cc } = calc.coords;
    const valid = Number.isFinite(aa + bb + cc) && calc.feet.Ap && calc.feet.Bp && calc.feet.Cp;

    sides[0].set(state.A, state.B);
    sides[1].set(state.B, state.C);
    sides[2].set(state.C, state.A);

    const footList = [calc.feet.Ap, calc.feet.Bp, calc.feet.Cp];
    const vertexList = [state.A, state.B, state.C];
    for (let i = 0; i < 3; i++) {
      const usable = Boolean(footList[i] && Number.isFinite(footList[i].x + footList[i].y));
      cevians[i].show(usable);
      feet[i].show(usable);
      footLabels[i].show(usable && shown.showNames);
      if (usable) {
        cevians[i].set(vertexList[i], footList[i]);
        feet[i].set(footList[i]);
        footLabels[i].set(footList[i]);
      }
      cornerLabels[i].show(shown.showNames);
      cornerLabels[i].set(vertexList[i]);
    }
    cornerLabels[3].show(shown.showNames);
    cornerLabels[3].set(state.P);

    // Keep the coordinate text inside the board even when P is near an edge.
    const bx = Geom.clamp(state.P.x + 14, view.x + 4, view.x + view.width - 150);
    const by = Geom.clamp(state.P.y + 22, view.y + 18, view.y + view.height - 6);
    baryLabel.show(Boolean(shown.baryText));
    if (shown.baryText) {
      baryLabel.node.textContent = shown.baryText;
      baryLabel.set({ x: bx - 14, y: by - 22 });
    }

    // The two numbers for a side sit just off its midpoint, one on each side
    // of the line. The endpoints and values come from the core's mode table.
    for (let i = 0; i < 6; i++) ratioLabels[i].show(false);
    if (shown.labels) {
      shown.labels.forEach((side, si) => {
        const start = state[side.start], end = state[side.end];
        const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
        const nx = -(end.y - start.y) / length * 11;
        const ny = (end.x - start.x) / length * 11;
        const first = Geom.midpoint(start, side.foot);
        const second = Geom.midpoint(side.foot, end);
        for (let k = 0; k < 2; k++) {
          const label = ratioLabels[si * 2 + k];
          const at = k === 0 ? first : second;
          const sign = k === 0 ? 1 : -1;
          label.show(true);
          label.node.textContent = Core.format(side.values[k], opts.digits);
          label.set({
            x: Geom.clamp(at.x + nx * sign, view.x + 12, view.x + view.width - 40),
            y: Geom.clamp(at.y + ny * sign, view.y + 12, view.y + view.height - 6),
          });
        }
      });
    }

    if (!valid) {
      say("Move P away from a corner so all three lines reach the far sides.", null);
    } else if (checked) {
      say("The three lines meet at P, and the side numbers match P's three weights.", "done");
    } else {
      say(`P = (${Core.format(aa, opts.digits)}, ${Core.format(bb, opts.digits)}, ` +
        `${Core.format(cc, opts.digits)}). The three weights add to 1.`, null);
    }
    if (window.Track) window.Track.state({
      A: state.A, B: state.B, C: state.C, P: state.P,
      options: { ...opts }, coords: { aa, bb, cc },
    });
    updateButtons();
  }

  function move(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const handleOpts = (name, cls) => ({
    r: 9, step: 3, shift: 12, layer: handleLayer, cls,
    clamp: inside,
    label: name === "P"
      ? "Point P. Drag it, or focus it and use the arrow keys to move it."
      : `Corner ${name}. Drag it, or focus it and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move(name, p),
  });

  const hA = board.handle("A", state.A, handleOpts("A", "geom-handle"));
  const hB = board.handle("B", state.B, handleOpts("B", "geom-handle"));
  const hC = board.handle("C", state.C, handleOpts("C", "geom-handle"));
  const hP = board.handle("P", state.P, handleOpts("P", "geom-handle p-handle"));

  function reset() {
    state = Core.start();
    checked = false;
    render();
    hA.node.focus();
  }
  function toggle(which) {
    opts = Core.options({ ...opts, [which]: !opts[which] });
    render();
  }
  function setMode(mode) {
    opts = Core.options({ ...opts, mode });
    render();
  }
  function digits(delta) {
    opts = Core.options({ ...opts, digits: opts.digits + delta });
    render();
  }
  function checkClaims() {
    const calc = Core.compute(state);
    if (!Core.claims(state, calc).weightedAverage) {
      say("Move P away from a corner, then check again.", null);
      return;
    }
    checked = true;
    render();
  }

  buttons.reset.addEventListener("click", reset);
  buttons.names.addEventListener("click", () => toggle("showNames"));
  buttons.bary.addEventListener("click", () => toggle("showBary"));
  buttons.ceva.addEventListener("click", () => toggle("showCeva"));
  buttons.inherited.addEventListener("click", () => setMode("inherited"));
  buttons.add.addEventListener("click", () => setMode("addTo1"));
  buttons.routh.addEventListener("click", () => setMode("routh"));
  buttons.down.addEventListener("click", () => digits(-1));
  buttons.up.addEventListener("click", () => digits(1));
  buttons.check.addEventListener("click", checkClaims);

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement && e.key !== "Escape") return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "c") checkClaims();
    else if (k === "n") toggle("showNames");
    else if (k === "b") toggle("showBary");
    else if (k === "s") toggle("showCeva");
    else if (k === "1") setMode("inherited");
    else if (k === "2") setMode("addTo1");
    else if (k === "3") setMode("routh");
    else return;
    e.preventDefault();
  });

  board.onTheme(render);
  render();
})();
