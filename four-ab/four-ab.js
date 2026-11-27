"use strict";

/*
 * The page for Four AB: drawing and input only; the arithmetic is in
 * four-ab-core.js. The SVG shows the two axes, the circle about P, the four
 * quadrant pieces tinted in alternating colours, and the optional lines
 * x = 2a and y = 2b. P is a focusable handle, so a pointer or the arrow keys
 * move the circle; the slider and the check box mirror the applet's controls.
 */

(function () {
  const Core = FourAbCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const radiusSlider = document.getElementById("radiusSlider");
  const radiusOut = document.getElementById("radiusOut");
  const extraChk = document.getElementById("extraChk");
  const board = Geom.board(document.getElementById("board"));
  const view = board.viewBox;
  const O = { x: view.x + view.width / 2, y: view.y + view.height / 2 };

  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const outlines = board.layer("outlines");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  const start = Core.initial(view.width, view.height);
  const screen = (p) => ({ x: O.x + p.a, y: O.y - p.b });

  // Four circles, one per quadrant, clipped to that quadrant by the <defs>
  // rectangles in the page. Each is redrawn in place so focus is kept.
  const quads = [1, 2, 3, 4].map((n) => {
    const shape = board.circle(screen(start), start.radius, "quad quad-" + n, fills);
    shape.node.setAttribute("clip-path", "url(#quad-" + n + ")");
    return shape;
  });
  const outline = board.circle(screen(start), start.radius, "circle-outline", outlines);
  const xAxis = board.line({ x: view.x, y: O.y }, { x: view.x + view.width, y: O.y }, "axis", guides);
  const yAxis = board.line({ x: O.x, y: view.y }, { x: O.x, y: view.y + view.height }, "axis", guides);
  const extraV = board.line({ x: O.x, y: view.y }, { x: O.x, y: view.y + view.height }, "extra", guides);
  const extraH = board.line({ x: view.x, y: O.y }, { x: view.x + view.width, y: O.y }, "extra", guides);

  board.label({ x: view.x + view.width - 14, y: O.y - 9 }, "x", "axis-label", 0, 0, labels);
  board.label({ x: O.x + 9, y: view.y + 24 }, "y", "axis-label", 0, 0, labels);
  const quadLabels = [
    board.label({ x: O.x + 26, y: O.y - 22 }, "S1", "area-label", 0, 0, labels),
    board.label({ x: O.x - 58, y: O.y - 22 }, "S2", "area-label", 0, 0, labels),
    board.label({ x: O.x - 58, y: O.y + 32 }, "S3", "area-label", 0, 0, labels),
    board.label({ x: O.x + 26, y: O.y + 32 }, "S4", "area-label", 0, 0, labels),
  ];
  const pLabel = board.label(screen(start), "P", "point-label", 9, -8, labels);

  let state = start;

  const pHandle = board.handle("P", screen(start), {
    r: 10,
    step: 6,
    shift: 30,
    layer: handles,
    label: "Circle centre P. Drag it, or focus it and use the arrow keys to move the circle.",
    clamp: (q) => ({
      x: Geom.clamp(q.x, view.x, view.x + view.width),
      y: Geom.clamp(q.y, view.y, view.y + view.height),
    }),
    onMove: (q) => {
      state = Core.withCenter(state, q.x - O.x, O.y - q.y);
      render();
    },
  });

  /**
   * Shows a line under the game. `kind` is "win", "lose" or "done" and is how
   * a game page tells the player's record a play ended. This is a picture
   * with no win or loss, so it reports the measurements and passes no kind.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => v.toFixed(1);

  function render() {
    const centre = screen(state);
    for (const q of quads) q.set(centre, state.radius);
    outline.set(centre, state.radius);

    const lines = Core.extraLines(state);
    extraV.set({ x: O.x + lines.x, y: view.y }, { x: O.x + lines.x, y: view.y + view.height });
    extraH.set({ x: view.x, y: O.y - lines.y }, { x: view.x + view.width, y: O.y - lines.y });
    extraV.show(state.showExtra);
    extraH.show(state.showExtra);

    pLabel.set(centre, "P", 9, -8);
    pHandle.set(centre);
    radiusOut.textContent = String(state.slider);

    const s = Core.quadrantAreas(state.a, state.b, state.radius);
    const sum = s[0] - s[1] + s[2] - s[3];
    const root = Math.hypot(state.a, state.b);
    const covered = state.radius >= root;
    say("a = " + fmt(state.a) + ", b = " + fmt(state.b) + ", radius = " + fmt(state.radius) +
      ". S1 = " + fmt(s[0]) + ", S2 = " + fmt(s[1]) + ", S3 = " + fmt(s[2]) +
      ", S4 = " + fmt(s[3]) + ". Alternating sum = " + fmt(sum) + ", while 4ab = " +
      fmt(4 * state.a * state.b) + ". " +
      (covered
        ? "The circle covers the whole rectangle, so the sum is exactly 4ab."
        : "The radius is below sqrt(a²+b²) = " + fmt(root) +
          ", so the puzzle's condition fails and the sum need not be 4ab."));

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  radiusSlider.addEventListener("input", () => {
    state = Core.withSlider(state, radiusSlider.value);
    render();
  });
  extraChk.addEventListener("change", () => {
    state = Core.withExtra(state, extraChk.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.initial(view.width, view.height);
    radiusSlider.value = String(state.slider);
    extraChk.checked = state.showExtra;
    render();
  });
  board.onTheme(() => render());

  render();
})();
