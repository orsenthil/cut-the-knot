"use strict";

/*
 * The page for BOL1: drawing and input only; the geometry is in bol-1-core.js.
 *
 * The SVG holds the two touching circles, their parallel diameters CD and EF,
 * the rays from the tangency point A to every marked point, and four draggable
 * dots: A, the two centres O1/O2, and C on the small circle. Moving A, O1 or
 * O2 rebuilds the circles and puts C back on the new one; moving C swaps both
 * diameters together. The Show names, Show hint and Check the claim buttons
 * reproduce the applet's two checkboxes and add a way to mark the illustration
 * explored for the player's record.
 */

(function () {
  const Core = Bol1Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });

  let state = Core.start();
  let showNames = true; // the applet's second copy was embedded with ShowNames=1
  let showHint = false;
  let checked = false;

  const circlesLayer = board.layer("circles");
  const linesLayer = board.layer("lines");
  const marksLayer = board.layer("marks");
  const hintLayer = board.layer("hint");
  const handlesLayer = board.layer("handles");

  const circle1 = board.circle(state.O1, 1, "bol-circle", circlesLayer);
  const circle2 = board.circle(state.O2, 1, "bol-circle", circlesLayer);
  const diameterCD = board.segment(state.C, state.C, "diameter", linesLayer);
  const diameterEF = board.segment(state.C, state.C, "diameter", linesLayer);
  const rays = ["C", "D", "E", "F", "O1", "O2"].map(() =>
    board.segment(state.A, state.A, "ray", linesLayer));

  const markedDots = {
    D: board.point(state.A, "marked-dot", 4, marksLayer),
    E: board.point(state.A, "marked-dot", 4, marksLayer),
    F: board.point(state.A, "marked-dot", 4, marksLayer),
  };
  const labels = {
    A: board.label(state.A, "A", "glabel", -18, -10, marksLayer),
    O1: board.label(state.O1, "O₁", "glabel center-label", 10, -8, marksLayer),
    O2: board.label(state.O2, "O₂", "glabel center-label", 10, -8, marksLayer),
    C: board.label(state.C, "C", "glabel", -18, 24, marksLayer),
    D: board.label(state.A, "D", "glabel", 10, -8, marksLayer),
    E: board.label(state.A, "E", "glabel", 10, -8, marksLayer),
    F: board.label(state.A, "F", "glabel", 10, -8, marksLayer),
    H: board.label(state.A, "H", "glabel", 10, -8, hintLayer),
  };
  const hintLines = ["o1h", "o2d", "o2a", "hf", "o1o2", "dh"].map(() =>
    board.segment(state.A, state.A, "hint-line", hintLayer));

  /**
   * Shows a line under the picture. "done" lets the player's record see that
   * the illustration has been explored; there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function drawHint(dm, H) {
    const on = showHint && Boolean(dm && H);
    hintLines.forEach((line) => line.show(on));
    labels.H.show(on);
    if (!on) return;
    const pairs = [
      [state.O1, H], [state.O2, dm.D], [state.O2, state.A],
      [H, dm.F], [state.O1, state.O2], [dm.D, H],
    ];
    pairs.forEach(([p, q], i) => hintLines[i].set(p, q));
    labels.H.set(H);
  }

  function render() {
    const { r1, r2 } = Core.radii(state);
    const dm = Core.diameters(state);
    circle1.set(state.O1, r1);
    circle2.set(state.O2, r2);

    const visible = Boolean(dm);
    diameterCD.show(visible);
    diameterEF.show(visible);
    rays.forEach((ray) => ray.show(visible));
    Object.values(markedDots).forEach((dot) => dot.show(visible));
    if (visible) {
      diameterCD.set(dm.C, dm.D);
      diameterEF.set(dm.E, dm.F);
      const ends = [dm.C, dm.D, dm.E, dm.F, state.O1, state.O2];
      ends.forEach((p, i) => rays[i].set(state.A, p));
      markedDots.D.set(dm.D);
      markedDots.E.set(dm.E);
      markedDots.F.set(dm.F);
    }
    drawHint(dm, visible ? Core.hint(state, dm) : null);

    labels.A.set(state.A);
    labels.O1.set(state.O1);
    labels.O2.set(state.O2);
    labels.C.set(state.C);
    if (visible) {
      labels.D.set(dm.D);
      labels.E.set(dm.E);
      labels.F.set(dm.F);
    }
    Object.entries(labels).forEach(([name, label]) => label.show(showNames &&
      (name !== "D" && name !== "E" && name !== "F" || visible)));

    // Keep the handles on the points after a reprojection.
    hA.set(state.A);
    hO1.set(state.O1);
    hO2.set(state.O2);
    hC.set(state.C);

    const kind = Core.touchKind(state);
    if (checked && kind === "in") {
      say("A, D and F lie on one straight line, just as Archimedes said.", "done");
    } else if (checked) {
      say("First put O2 on the line through A and O1 so the circles touch at A.", null);
    } else if (!visible) {
      say("Move the centres apart again: one circle has shrunk to a point.", null);
    } else {
      say("Drag A, O1, O2 or C. Press Check the claim when the two circles touch at A.", null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const clampCircle = (p) => Core.onCircle(state.O2, Core.radii(state).r2, p);
  const hA = board.handle("A", state.A, {
    r: 12, step: 4, shift: 16, layer: handlesLayer, clamp: inside,
    label: "Point A, where the circles touch. Drag, or focus and use the arrow keys",
    describe: (p) => `position ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("A", p),
  });
  const hO1 = board.handle("O1", state.O1, {
    r: 12, step: 4, shift: 16, layer: handlesLayer, clamp: inside,
    label: "Centre O1 of the large circle. Drag, or focus and use the arrow keys",
    describe: (p) => `position ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("O1", p),
  });
  const hO2 = board.handle("O2", state.O2, {
    r: 12, step: 4, shift: 16, layer: handlesLayer, clamp: inside,
    label: "Centre O2 of the small circle. Drag, or focus and use the arrow keys",
    describe: (p) => `position ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("O2", p),
  });
  const hC = board.handle("C", state.C, {
    r: 12, step: 4, shift: 16, layer: handlesLayer, clamp: clampCircle,
    label: "Point C on the small circle. Drag around the circle, or use the arrow keys",
    describe: (p) => `position ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("C", p),
  });

  function reset() {
    state = Core.start();
    checked = false;
    render();
    hA.node.focus();
  }

  function checkClaim() {
    checked = true;
    render();
  }

  function toggle(button, get, set) {
    set(!get());
    button.setAttribute("aria-pressed", String(get()));
    render();
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkClaim);
  namesBtn.addEventListener("click", () =>
    toggle(namesBtn, () => showNames, (v) => {
      showNames = v;
      namesBtn.textContent = v ? "Hide names" : "Show names";
    }));
  hintBtn.addEventListener("click", () =>
    toggle(hintBtn, () => showHint, (v) => {
      showHint = v;
      hintBtn.textContent = v ? "Hide hint" : "Show hint";
    }));
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    if (key === "n") namesBtn.click();
    if (key === "h") hintBtn.click();
    if (key === "c") checkClaim();
  });

  board.onTheme(render);
  render();
})();
