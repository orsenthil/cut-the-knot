"use strict";

/*
 * The page for Light House: drawing and input only. The geometry and the
 * Lighthouse Theorem calculation live in light-house-core.js. The SVG holds
 * three focusable lighthouse points; the two fans of beams and their crossing
 * polygons are rebuilt from the core on every change. There is no win or loss
 * here - the original is a demonstration, not a game.
 */

(function () {
  const Core = LightHouseCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const rate1Input = document.getElementById("rate1Input");
  const rate2Input = document.getElementById("rate2Input");
  const beamsChk = document.getElementById("beamsChk");
  const polyChk = document.getElementById("polyChk");
  const fillChk = document.getElementById("fillChk");
  const extendChk = document.getElementById("extendChk");
  const asyChk = document.getElementById("asyChk");
  const goBtn = document.getElementById("goBtn");
  const stepBtn = document.getElementById("stepBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});
  let timer = null;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Paint order: guides, beam lines, polygons, curves, then the three points. */
  const guides = board.layer("guides");
  const raysLayer = board.layer("rays");
  const shapes = board.layer("shapes");
  const handlesLayer = board.layer("handles");

  /**
   * Shows a line under the picture. `kind` is "win", "lose" or "done" when a
   * play ends; this is a demo, so it is never one of those.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const clampPoint = (p) => ({
    x: Geom.clamp(p.x, 12, 628),
    y: Geom.clamp(p.y, 12, 448),
  });

  function handle(name, key, label, cls) {
    return board.handle(name, state[key], {
      r: 9, step: 5, shift: 20, cls: "geom-handle " + cls, layer: handlesLayer,
      label: label,
      describe: (p) => `${name} at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      clamp: clampPoint,
      onMove: (p) => {
        state = Object.assign({}, state, { [key]: p });
        render();
      },
    });
  }

  const p1Handle = handle("P1", "P1",
    "First lighthouse. Drag it, or focus it and use the arrow keys.", "lighthouse-a");
  const p2Handle = handle("P2", "P2",
    "Second lighthouse. Drag it, or focus it and use the arrow keys.", "lighthouse-b");
  const pHandle = handle("P", "P",
    "Aim point. Drag it, or focus it and use the arrow keys; both fans aim here to start.", "aim-point");

  function beamEndpoint(fixed, angle) {
    return { x: fixed.x + Core.RAY_LENGTH * Math.cos(angle), y: fixed.y - Core.RAY_LENGTH * Math.sin(angle) };
  }

  function drawBeams(rows) {
    board.clear(raysLayer);
    if (!beamsChk.checked) return;
    for (const row of rows) {
      for (const cfg of row) {
        const a = cfg.l1.angle + state.step * cfg.l1.increment;
        const b = cfg.l2.angle + state.step * cfg.l2.increment;
        const tail1 = beamEndpoint(cfg.l1.fixed, a + Math.PI);
        const tail2 = beamEndpoint(cfg.l2.fixed, b + Math.PI);
        board.line(tail1, beamEndpoint(cfg.l1.fixed, a), "ray ray-a", raysLayer);
        board.line(tail2, beamEndpoint(cfg.l2.fixed, b), "ray ray-b", raysLayer);
      }
    }
  }

  function drawPolygons() {
    board.clear(shapes);
    if (!polyChk.checked) return;
    for (let i = 0; i < state.N; i++) {
      const points = Core.ordered(Core.polygon(state, i, state.step));
      const cls = "poly poly-" + (i % Core.COLORS.length) + (fillChk.checked ? " filled" : "");
      board.el("polyline", { points: points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") },
        cls, shapes);
      if (extendChk.checked) {
        // Extend the sides across the whole picture, as the applet's checkbox does.
        for (let j = 0; j < points.length; j++) {
          const p = points[j], q = points[(j + 1) % points.length];
          const dx = q.x - p.x, dy = q.y - p.y;
          board.line({ x: p.x - 8 * dx, y: p.y - 8 * dy },
            { x: q.x + 8 * dx, y: q.y + 8 * dy }, "extended", shapes);
        }
      }
    }
  }

  function render() {
    board.clear(guides);
    board.segment(state.P1, state.P2, "baseline", guides);
    board.segment(state.P1, state.P, "aim-line", guides);
    board.segment(state.P2, state.P, "aim-line", guides);

    drawBeams(Core.configurations(state));
    drawPolygons();

    p1Handle.set(state.P1);
    p2Handle.set(state.P2);
    pHandle.set(state.P);

    nInput.value = String(state.N);
    rate1Input.value = String(state.rate1);
    rate2Input.value = String(state.rate2);
    document.getElementById("nValue").textContent = String(state.N);
    document.getElementById("rate1Value").textContent = String(state.rate1);
    document.getElementById("rate2Value").textContent = String(state.rate2);
    beamsChk.checked = state.showBeams;
    polyChk.checked = state.showPolygons;
    fillChk.checked = state.fill;
    extendChk.checked = state.extend;
    asyChk.checked = state.removeAsymptotes;
    fillChk.disabled = !state.showPolygons;
    extendChk.disabled = !state.showPolygons || state.N <= 1;
    asyChk.disabled = !state.removeAsymptotesAllowed;
    goBtn.textContent = timer ? "Stop" : "Go";
    goBtn.setAttribute("aria-pressed", String(Boolean(timer)));

    const line = Core.describe(state);
    say(state.showPolygons ? line : line.replace(/; the crossings are .*/, "; beam lines only."));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /** Change one option, as the applet's number fields and checkboxes do. */
  function change(patch) {
    const flags = {
      showBeams: state.showBeams, showPolygons: state.showPolygons,
      fill: state.fill, extend: state.extend,
      removeAsymptotes: state.removeAsymptotes,
      removeAsymptotesAllowed: state.removeAsymptotesAllowed,
    };
    state = Object.assign(Core.setOptions(state, patch), flags);
    render();
  }

  function toggle(key, checked) {
    state = Object.assign({}, state, { [key]: checked });
    if (key === "showPolygons") {
      state.removeAsymptotesAllowed = checked && state.rate1 !== state.rate2;
      if (!checked) state.removeAsymptotes = false;
    }
    render();
  }

  function tick() {
    state = Object.assign({}, state, { step: state.step + 1 });
    render();
  }

  function stop() {
    if (timer !== null) { clearInterval(timer); timer = null; }
    render();
  }

  goBtn.addEventListener("click", () => {
    if (timer !== null) stop();
    else {
      timer = setInterval(tick, reduceMotion ? 400 : 90);
      render();
    }
  });
  stepBtn.addEventListener("click", () => { stop(); tick(); });
  resetBtn.addEventListener("click", () => {
    stop();
    state = Core.start({
      N: Number(nInput.value), rate1: Number(rate1Input.value), rate2: Number(rate2Input.value),
    });
    state = Object.assign(state, {
      showBeams: true, showPolygons: true, fill: false, extend: false,
      removeAsymptotes: false, removeAsymptotesAllowed: state.rate1 !== state.rate2,
    });
    render();
  });
  nInput.addEventListener("input", () => change({ N: Number(nInput.value) }));
  rate1Input.addEventListener("input", () => change({ rate1: Number(rate1Input.value) }));
  rate2Input.addEventListener("input", () => change({ rate2: Number(rate2Input.value) }));
  beamsChk.addEventListener("change", () => toggle("showBeams", beamsChk.checked));
  polyChk.addEventListener("change", () => toggle("showPolygons", polyChk.checked));
  fillChk.addEventListener("change", () => toggle("fill", fillChk.checked));
  extendChk.addEventListener("change", () => toggle("extend", extendChk.checked));
  asyChk.addEventListener("change", () => toggle("removeAsymptotes", asyChk.checked));

  board.onTheme(render);
  state = Object.assign(state, {
    showBeams: true, showPolygons: true, fill: false, extend: false,
    removeAsymptotes: false, removeAsymptotesAllowed: state.rate1 !== state.rate2,
  });
  render();
})();
