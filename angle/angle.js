"use strict";

/*
 * The page for Angle: drawing and input only. The classification rules live
 * in angle-core.js. The stage holds a circle with a fixed vertex O; the two
 * handles are the two rays. The Java applet let you drag OA and type the
 * angle; here OB can be dragged too, which measures the turn with the core.
 */

(function () {
  const Core = AngleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const degreeInput = document.getElementById("degreeInput");
  const signedBox = document.getElementById("signedBox");
  const newBtn = document.getElementById("newBtn");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");

  let state = Core.start({});

  /** The line under the game. An illustration has no win or loss to report. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers are created in paint order: guides, rays, marks, text, handles. */
  const guides = board.layer("guides");
  const rays = board.layer("rays");
  const marks = board.layer("marks");
  const text = board.layer("text");
  const tops = board.layer("handles");

  const circle = board.circle(state.center, state.radius, "angle-circle", guides);
  const rayA = board.line(state.center, state.A, "ray", rays);
  const rayB = board.line(state.center, state.B, "ray", rays);
  const arcNode = board.el("path", null, "angle-arc", marks);
  const rightMark = board.rightAngle(state.center, state.A, state.B, 15, "right-mark", marks);
  const vertex = board.point(state.center, "vertex", 4, tops);
  const nameA = board.label(state.A, "A", "pt-label", 12, -10, text);
  const nameB = board.label(state.B, "B", "pt-label", 12, -10, text);
  const nameO = board.label(state.center, "O", "pt-label", -18, 20, text);
  const reading = board.label(state.center, "", "angle-value", 0, 4, text);

  const clampToCircle = (p, name, handle) => Core.onCircle(state.center, state.radius, p) || handle.point;
  const aHandle = board.handle("A", state.A, {
    r: 12, step: 4, cls: "geom-handle", layer: tops,
    label: "Point A, first ray. Drag it, or focus it and use the arrow keys to turn the ray.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: (p) => clampToCircle(p, "A", aHandle),
    onMove: (p) => { state = Core.moveA(state, p); render(); },
  });
  const bHandle = board.handle("B", state.B, {
    r: 12, step: 4, cls: "geom-handle", layer: tops,
    label: "Point B, second ray. Drag it, or focus it and use the arrow keys to set the angle.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: (p) => clampToCircle(p, "B", bHandle),
    onMove: (p) => { state = Core.moveB(state, p); render(); },
  });

  /** Traces the turn itself, so reflex and full angles are drawn in full. */
  function arcPath(start, value) {
    const steps = Math.max(1, Math.ceil(Math.abs(Core.degrees(value)) / 4));
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const p = Core.pointOnRay(state.center, state.radius * 0.42, start + (value * i) / steps);
      d += (i ? " L " : "M ") + p.x.toFixed(2) + " " + p.y.toFixed(2);
    }
    return d;
  }

  function render() {
    const start = Core.startRadians(state.center, state.A);
    const value = Core.radians(state.degrees);
    circle.set(state.center, state.radius);
    rayA.set(state.center, state.A);
    rayB.set(state.center, state.B);
    arcNode.setAttribute("d", arcPath(start, value));
    arcNode.style.display = state.degrees === 0 ? "none" : "";
    const word = Core.classify(state.degrees);
    rightMark.show(word === "right");
    if (word === "right") rightMark.set(state.center, state.A, state.B, 15);
    vertex.set(state.center, 4);
    aHandle.set(state.A);
    bHandle.set(state.B);
    nameA.set(state.A, "A");
    nameB.set(state.B, "B");
    nameO.set(state.center, "O");
    reading.set(Core.pointOnRay(state.center, state.radius * 0.66, start + value / 2),
      `${state.degrees}\u00b0`);

    degreeInput.value = String(state.degrees);
    signedBox.checked = state.signed;
    say(Core.label(state).text);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function reset() {
    state = Core.start({ signed: state.signed });
    render();
  }

  newBtn.addEventListener("click", reset);
  minusBtn.addEventListener("click", () => { state = Core.setDegrees(state, state.degrees - 1); render(); });
  plusBtn.addEventListener("click", () => { state = Core.setDegrees(state, state.degrees + 1); render(); });
  degreeInput.addEventListener("change", () => {
    const value = Number(degreeInput.value);
    if (Number.isFinite(value)) state = Core.setDegrees(state, value);
    render();
  });
  signedBox.addEventListener("change", () => {
    if (signedBox.checked !== state.signed) state = Core.toggleSigned(state);
    render();
  });
  document.querySelectorAll("[data-angle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state = Core.setDegrees(state, Number(btn.dataset.angle));
      render();
    });
  });

  board.onTheme(render);
  render();
})();
