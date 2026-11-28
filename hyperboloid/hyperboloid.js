"use strict";

/*
 * The page for One Sheet Hyperboloid: drawing and input only. All the rules,
 * the applet's ranges and the surface formula live in hyperboloid-core.js.
 *
 * The board shows the two circular bases and the straight generators between
 * them in a fixed slant view. The lower ring stays put; the Base Shift control
 * (a slider and a draggable dot on the track) moves which point of the upper
 * ring each generator ends at. Nothing is won or lost: this is an illustration.
 */

(() => {
  const Core = HyperboloidCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const shiftRange = document.getElementById("shiftRange");
  const linesRange = document.getElementById("linesRange");
  const shiftOut = document.getElementById("shiftOut");
  const linesOut = document.getElementById("linesOut");
  const frameBox = document.getElementById("frameBox");
  const solidBox = document.getElementById("solidBox");

  let state = Core.start({});

  /** The status line. An illustration has no ending, so kind is never used. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* A fixed slant view of the applet's (x, y, z) coordinates: y is up, and
     depth nudges a point down so the two round bases read as ellipses. */
  const CX = 320, CY = 165, SCALE = 170;
  const AZIMUTH = 0.62;
  const cosA = Math.cos(AZIMUTH), sinA = Math.sin(AZIMUTH);
  const project = (p) => ({
    x: CX + SCALE * (p[0] * cosA - p[2] * sinA),
    y: CY - SCALE * 0.85 * p[1] + SCALE * 0.30 * (p[0] * sinA + p[2] * cosA),
  });
  const pathOf = (pts) => pts.map((p, i) =>
    (i ? " L " : "M ") + p.x.toFixed(2) + " " + p.y.toFixed(2)).join("") + " Z";

  /* The shift track sits below the picture. One arrow-key step is one step
     of the applet's Base Shift spinner. */
  const TRACK = { x0: 40, x1: 250, y: 328 };
  const trackX = (m) => TRACK.x0 + ((TRACK.x1 - TRACK.x0) * m) / Core.MAX_SHIFT;
  const shiftFromX = (x) => Core.clamp(Math.round(
    ((Core.clamp(x, TRACK.x0, TRACK.x1) - TRACK.x0) * Core.MAX_SHIFT) / (TRACK.x1 - TRACK.x0)),
  Core.MIN_SHIFT, Core.MAX_SHIFT);
  const trackPoint = (m) => ({ x: trackX(m), y: TRACK.y });

  /* Paint order: guides, translucent faces, outlines, one highlighted
     generator, labels, then the focusable dot. */
  const guides = board.layer("guides");
  const faces = board.layer("faces");
  const frames = board.layer("frames");
  const accents = board.layer("accents");
  const texts = board.layer("labels");
  const handles = board.layer("handles");

  const axis = board.segment(project([0, Core.L / 2, 0]), project([0, -Core.L / 2, 0]), "axis", guides);
  const bottomRing = board.el("path", null, "base-ring", guides);
  const topRing = board.el("path", null, "base-ring", guides);
  const track = board.segment(trackPoint(0), trackPoint(Core.MAX_SHIFT), "shift-track", guides);
  for (const m of [0, 25, 50, 75, 100]) {
    const p = trackPoint(m);
    board.segment({ x: p.x, y: p.y - 5 }, { x: p.x, y: p.y + 5 }, "shift-tick", guides);
  }

  /* Every object is made once and only moved or re-classed on a redraw. */
  const MAX_LINES = Core.MAX_LINES;
  const fillPool = [], framePool = [];
  for (let i = 0; i < MAX_LINES; i++) {
    fillPool.push(board.polygon([], "quad-fill", faces));
    framePool.push(board.polygon([], "quad-frame", frames));
  }
  const highlighted = board.segment(project([0, 0, 0]), project([0, 0, 0]), "generator", accents);
  const labelTop = board.label({ x: 0, y: 0 }, "top base", "small-label", 6, -10, texts);
  const labelBottom = board.label({ x: 0, y: 0 }, "bottom base", "small-label", 6, 14, texts);
  const labelTrack = board.label({ x: TRACK.x0, y: TRACK.y - 12 }, "Base Shift", "small-label", 0, 0, texts);
  const labelZero = board.label(trackPoint(0), "0", "small-label", -2, 18, texts);
  const labelMax = board.label(trackPoint(Core.MAX_SHIFT), "100 steps", "small-label", -28, 18, texts);

  const shiftHandle = board.handle("shift", trackPoint(state.shift), {
    r: 11, step: (TRACK.x1 - TRACK.x0) / Core.MAX_SHIFT, shift: 10.5,
    layer: handles,
    label: "Base rotation. Drag along the track, or focus this dot and use the arrow keys. " +
      "Each step turns the top base by one generator.",
    describe: (p) => `now ${shiftFromX(p.x)} steps, ${((360 * shiftFromX(p.x)) / state.lines).toFixed(0)} degrees`,
    clamp: (q) => trackPoint(shiftFromX(q.x)),
    onMove: (p) => {
      state = Core.withOption(state, "shift", shiftFromX(p.x));
      render();
    },
  });

  function render() {
    const geo = Core.geometry(state);
    const n = state.lines;
    const mode = Core.rendering(state);
    const description = Core.describe(state);
    const pts = geo.points.map(project);

    bottomRing.setAttribute("d", pathOf(pts.slice(0, n)));
    topRing.setAttribute("d", pathOf(pts.slice(n, 2 * n)));
    axis.set(project([0, Core.L / 2, 0]), project([0, -Core.L / 2, 0]));

    let first = null;
    for (let i = 0; i < n; i++) {
      const quad = geo.quads[i].map((k) => pts[k]);
      const fill = fillPool[i], outline = framePool[i];
      fill.set(quad).show(mode.solid);
      outline.set(quad).show(mode.frame);
      fill.node.setAttribute("class", "quad-fill");
      outline.node.setAttribute("class", "quad-frame");
      if (first === null) first = quad;
    }
    for (let i = n; i < MAX_LINES; i++) {
      fillPool[i].show(false);
      framePool[i].show(false);
    }

    /* The closing edge of quad 0 joins bottom point 0 to top point M: that
       is exactly one of the hinged generators the page calls out. */
    highlighted.set(first[0], first[3]).show(n > 0);
    labelTop.set(pts[n], "top base", 6, -10);
    labelBottom.set(pts[0], "bottom base", 6, 16);

    shiftHandle.set(trackPoint(state.shift));
    if (shiftRange.value !== String(state.shift)) shiftRange.value = String(state.shift);
    if (linesRange.value !== String(n)) linesRange.value = String(n);
    shiftOut.textContent = `${state.shift} steps, ${((360 * (state.shift % n)) / n).toFixed(1)}\u00b0`;
    linesOut.textContent = String(n);
    solidBox.checked = state.solid;
    frameBox.checked = mode.frame;
    frameBox.disabled = !state.solid;

    say(`${description.title}. ${description.text}`, null);
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  shiftRange.addEventListener("input", () => {
    state = Core.withOption(state, "shift", Number(shiftRange.value));
    render();
  });
  linesRange.addEventListener("input", () => {
    state = Core.withOption(state, "lines", Number(linesRange.value));
    render();
  });
  solidBox.addEventListener("change", () => {
    state = Core.withOption(state, "solid", solidBox.checked);
    render();
  });
  frameBox.addEventListener("change", () => {
    state = Core.withOption(state, "frame", frameBox.checked);
    render();
  });
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      if (preset === "cylinder") state = Core.withOption(state, "shift", 0);
      else if (preset === "hyperboloid") {
        state = Core.withOption(state, "shift", Math.max(1, Math.round(state.lines / 4)));
      } else if (preset === "waist") {
        state = Core.withOption(state, "shift", Math.round(state.lines / 2));
      } else if (preset === "reset") {
        state = Core.start({ solid: state.solid, frame: state.frame });
      }
      render();
    });
  });

  board.onTheme(render);
  render();
})();
