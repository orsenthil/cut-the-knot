"use strict";

/*
 * The page for Mc Worter 2: drawing and input only. The geometry is in
 * mcworter-2-core.js. An SVG shows the triangle ABC, the two similar
 * parallelograms on CA and BC, the red segment between their far corners
 * A_b and B_a, and its midpoint M. Dragging A, B or C recomputes the diagram;
 * the two sliders are the applet's coefficient and angle scrollbars.
 */

(function () {
  const Core = Mcworter2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const checkBtn = document.getElementById("checkBtn");
  const coefInput = document.getElementById("coef");
  const angleInput = document.getElementById("angle");
  const coefValue = document.getElementById("coefValue");
  const angleValue = document.getElementById("angleValue");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const round = (v) => Math.round(v * 10) / 10;

  let state = Core.start();
  let confirmed = false;

  const shapeLayer = board.layer("shapes");
  const lineLayer = board.layer("lines");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  /* Every element is made once; only its geometry changes on a redraw. */
  const triangle = board.polygon([state.A, state.B, state.C], "tri-guide", shapeLayer);
  const first = board.polygon([state.B, state.B, state.C, state.C], "flank-a", shapeLayer);
  const second = board.polygon([state.C, state.C, state.A, state.A], "flank-b", shapeLayer);
  const treasure = board.segment(state.A, state.B, "mid-line", lineLayer);
  const midDot = board.point(state.A, "mid-dot", 6, markLayer);

  const labels = [
    board.label(state.A, "A", "glabel", -18, 22, labelLayer),
    board.label(state.B, "B", "glabel", 8, 22, labelLayer),
    board.label(state.C, "C", "glabel", 8, -10, labelLayer),
    board.label(state.A, "M", "glabel mid-label", 8, -10, labelLayer),
    board.label(state.A, "A_b", "glabel flank-label", 8, -8, labelLayer),
    board.label(state.A, "A_c", "glabel flank-label", 8, -8, labelLayer),
    board.label(state.A, "B_a", "glabel flank-label", -30, -8, labelLayer),
    board.label(state.A, "B_c", "glabel flank-label", -30, -8, labelLayer),
  ];

  /**
   * Shows the line under the diagram. `kind` is "win", "lose", "done" or
   * nothing; those three classes are how the player's record sees that a
   * play has ended, so they are used here only for a finished illustration.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const f = Core.figure(state);
    const { K, degrees } = Core.settings(state);

    triangle.set([f.A, f.B, f.C]);
    first.set([f.B, f.Ab, f.Ac, f.C]);
    second.set([f.C, f.Bc, f.Ba, f.A]);
    treasure.set(f.Ab, f.Ba);
    midDot.set(f.M);

    const words = ["A", "B", "C", "M", "A_b", "A_c", "B_a", "B_c"];
    const spots = [f.A, f.B, f.C, f.M, f.Ab, f.Ac, f.Ba, f.Bc];
    for (let i = 0; i < labels.length; i++) {
      labels[i].set(spots[i], words[i]);
      labels[i].show(state.showNames);
    }

    coefInput.value = String(state.coef);
    angleInput.value = String(state.angle);
    coefValue.textContent = `K = ${K.toFixed(2)}`;
    angleValue.textContent = `${Math.round(degrees)}°`;
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    namesBtn.setAttribute("aria-pressed", String(state.showNames));

    if (confirmed) {
      say("Checked: M stayed put as C moved, and the two flanks keep the same shape and angles.", "done");
    } else if (K === 0) {
      say(`K = 0: the flanks collapse onto the triangle, but M is still at (${round(f.M.x)}, ${round(f.M.y)}).`);
    } else {
      say(`M is at (${round(f.M.x)}, ${round(f.M.y)}). Drag C or move the sliders: M does not follow.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, inside(p));
    confirmed = false;
    render();
  }

  const clampPoint = (p) => inside(p);
  function handle(name) {
    return board.handle(name, state[name], {
      r: 9, step: 4, shift: 16, layer: handleLayer, clamp: clampPoint,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => movePoint(name, p),
    });
  }
  const handles = { A: handle("A"), B: handle("B"), C: handle("C") };

  function toggleNames() {
    state = Core.withOption(state, "showNames", !state.showNames);
    confirmed = false;
    render();
  }

  function checkClaim() {
    const all = Core.claims(state);
    confirmed = Object.values(all).every(Boolean);
    render();
    if (!confirmed) {
      say("The angles need a nonzero scale: put the scale slider above its lowest value and check again.");
    }
  }

  function reset() {
    const keep = {
      coef: state.coef, angle: state.angle, showNames: state.showNames,
    };
    state = Core.start(keep);
    confirmed = false;
    render();
    handles.C.node.focus();
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", toggleNames);
  checkBtn.addEventListener("click", checkClaim);
  coefInput.addEventListener("input", () => {
    state = Core.withOption(state, "coef", coefInput.value);
    confirmed = false;
    render();
  });
  angleInput.addEventListener("input", () => {
    state = Core.withOption(state, "angle", angleInput.value);
    confirmed = false;
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target === coefInput || e.target === angleInput) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    if (key === "n") toggleNames();
    if (key === "c") checkClaim();
  });

  board.onTheme(render);
  render();
})();
