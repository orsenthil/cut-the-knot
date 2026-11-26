"use strict";

/*
 * The page for Bender: drawing and input only; the geometry is in
 * bender-core.js. An SVG holds the stationary polygon in red, the small
 * spinning polygons filled with the applet's occluding green, and two
 * draggable handles: the centre of the big polygon and the marked corner that
 * turns it. Sliders and radio choices carry the applet's own option ranges;
 * Start/Stop reproduces the applet's animation thread.
 */

(function () {
  const Core = BenderCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const fixedSel = document.getElementById("fixedSel");
  const rotSel = document.getElementById("rotSel");
  const sideInput = document.getElementById("sideInput");
  const speedInput = document.getElementById("speedInput");
  const tintInput = document.getElementById("tintInput");
  const shiftInput = document.getElementById("shiftInput");
  const sideVal = document.getElementById("sideVal");
  const speedVal = document.getElementById("speedVal");
  const tintVal = document.getElementById("tintVal");
  const playBtn = document.getElementById("playBtn");
  const stepBtn = document.getElementById("stepBtn");
  const checkBtn = document.getElementById("checkBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();
  let checkMessage = null;
  let animating = false;
  let raf = 0;
  let last = 0;
  let carry = 0;

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const handlesLayer = board.layer("handles");

  /* Made once, then shown/hidden and updated in place: focus stays on a handle. */
  const guideCircle = board.circle(state.center, Core.radius(state), "guide", guides);
  const fixedSides = [];
  const vertices = [];
  const smalls = [];
  for (let i = 0; i < 6; i++) {
    fixedSides.push(board.segment(state.center, state.center, "fixed-side", shapes));
    vertices.push(board.point(state.center, "vertex-dot", 3.5, shapes));
    smalls.push(board.polygon([state.center], "small-poly", shapes));
  }

  /**
   * Shows a line under the picture. "done" is used when the player has
   * checked the symmetry; it is also how the record learns a play ended.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Java colour = tint * darkGreen + (1 - tint) * background, with f2i. */
  function occludingFill() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--stage").trim();
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
    const hex = m ? (m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]) : "ffffff";
    const bg = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const f = state.tint / 100;
    const green = [0, 100, 0]; // java.awt.Color.green.darker()
    const rgb = green.map((g, i) => Math.trunc(f * g + (1 - f) * bg[i]));
    return `rgb(${rgb.join(",")})`;
  }

  function render() {
    const pic = Core.picture(state);
    const n = state.fixed;

    guideCircle.set(pic.center, pic.radius);
    const fill = occludingFill();
    for (let k = 0; k < 6; k++) {
      const visible = k < n;
      fixedSides[k].show(visible);
      vertices[k].show(visible);
      smalls[k].show(visible);
      if (!visible) continue;
      const a = pic.drawnFixed[k], b = pic.drawnFixed[(k + 1) % n];
      fixedSides[k].set(a, b);
      vertices[k].set(a);
      smalls[k].set(pic.drawn[k]);
      smalls[k].node.style.fill = fill;
    }

    const first = pic.fixed[0];
    centerHandle.set(pic.center);
    turnHandle.set(first);

    sideVal.textContent = String(state.side);
    speedVal.textContent = `${Core.delay(state)} ms`;
    tintVal.textContent = `${state.tint}%`;

    if (checkMessage) {
      say(checkMessage.text, checkMessage.kind);
    } else if (animating) {
      say(`Frame ${state.frame + 1} of ${Core.FRAMES}. ${n} small shapes turning together.`, null);
    } else {
      say(`Drag the marked corner to turn the picture, or press Start to spin the ${n} small shapes.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const clampTurn = (p) => {
    const c = state.center, r = Core.radius(state);
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  };

  const centerHandle = board.handle("centre", state.center, {
    r: 8, step: 4, shift: 16, cls: "geom-handle centre-handle", layer: handlesLayer,
    label: "Centre of the stationary polygon. Drag, or focus and use the arrow keys, to move the whole picture.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p) => Core.withCenter(state, p).center,
    onMove: (p) => { state = Core.withCenter(state, p); checkMessage = null; render(); },
  });
  const turnHandle = board.handle("turn", Core.picture(state).fixed[0], {
    r: 8, step: 6, shift: 30, layer: handlesLayer,
    label: "Marked corner of the stationary polygon. Drag, or focus and use the arrow keys, to turn the picture.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: clampTurn,
    onMove: (p) => {
      const c = state.center;
      state = Core.withPhase(state, Math.atan2(p.y - c.y, p.x - c.x));
      checkMessage = null;
      render();
    },
  });

  function stop() {
    animating = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    carry = 0;
    playBtn.textContent = "Start";
    playBtn.setAttribute("aria-label", "Start the spinning polygons");
  }

  function tick(now) {
    if (!animating) return;
    if (!last) last = now;
    carry += now - last;
    last = now;
    const stepMs = Math.max(1, Core.delay(state));
    let changed = false;
    while (carry >= stepMs) {
      state = Core.advance(state);
      carry -= stepMs;
      changed = true;
    }
    if (changed) render();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    animating = true;
    checkMessage = null;
    last = 0;
    carry = 0;
    playBtn.textContent = "Stop";
    playBtn.setAttribute("aria-label", "Stop the spinning polygons");
    raf = requestAnimationFrame(tick);
    render();
  }

  function change(name, value) {
    state = Core.withOption(state, name, value);
    checkMessage = null;
    render();
  }

  function checkPattern() {
    const all = Core.claims(state);
    const pass = Object.values(all).every(Boolean);
    checkMessage = pass
      ? {
        text: `Checked: ${state.fixed} sides, ${state.fixed} matching small shapes, all turning together — the picture has ${state.fixed}-fold symmetry.`,
        kind: "done",
      }
      : { text: "The pattern did not check out. Press Reset picture and try again.", kind: null };
    render();
  }

  function reset() {
    stop();
    state = Core.start();
    checkMessage = null;
    render();
    centerHandle.node.focus();
  }

  fixedSel.addEventListener("change", (e) => change("fixed", Number(e.target.value)));
  rotSel.addEventListener("change", (e) => change("rot", Number(e.target.value)));
  sideInput.addEventListener("input", (e) => change("side", Number(e.target.value)));
  speedInput.addEventListener("input", (e) => change("speed", Number(e.target.value)));
  tintInput.addEventListener("input", (e) => change("tint", Number(e.target.value)));
  shiftInput.addEventListener("change", (e) => change("offCenter", e.target.checked));
  playBtn.addEventListener("click", () => (animating ? stop() : start()));
  stepBtn.addEventListener("click", () => {
    stop();
    state = Core.advance(state);
    checkMessage = null;
    render();
  });
  checkBtn.addEventListener("click", checkPattern);
  resetBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "BUTTON") return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") checkPattern();
  });

  board.onTheme(render);
  render();
})();
