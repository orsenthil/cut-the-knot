"use strict";

/*
 * The page for Barlotti: drawing and input only; the mathematics is in
 * barlotti-core.js. An SVG holds the dashed regular N-gon, its affine image,
 * the regular N-gons erected on its sides and the polygon of their centres.
 * Two handles turn the dashed polygon; four sliders hold the affine matrix and
 * a number box holds N, exactly as in the applet's control panel.
 */

(function () {
  const Core = BarlottiCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const resetBtn = document.getElementById("resetBtn");
  const checkBtn = document.getElementById("checkBtn");
  const toggleBtn = document.getElementById("toggleBtn");
  const paramIds = ["a11", "a12", "a21", "a22"];
  const paramKeys = ["a", "b", "c", "d"];
  const params = paramIds.map((id) => document.getElementById(id));

  let state = Core.start();
  let checked = false;
  let showErected = true;

  const shapes = board.layer("shapes");
  const dots = board.layer("dots");
  const handleLayer = board.layer("handles");

  const basePoly = board.polygon([], "base-poly", shapes);
  const affinePoly = board.polygon([], "affine-poly", shapes);
  const centerPoly = board.polygon([], "centers-poly", shapes);
  const erected = [];
  const centerDots = [];
  for (let i = 0; i < Core.LIMITS.n[1]; i++) {
    erected.push(board.polygon([], "erected-poly", shapes));
    centerDots.push(board.point(state.center, "center-dot", 3.2, dots));
  }
  const centerMark = board.point(state.center, "origin-dot", 3, dots);

  function syncControls() {
    nInput.value = String(state.n);
    paramKeys.forEach((key, i) => { params[i].value = String(Math.round(state[key] * 100)); });
    const fmt = (name) => {
      const v = state[name];
      return (v >= 0 ? "+" : "") + v.toFixed(2);
    };
    document.getElementById("a11Val").textContent = fmt("a");
    document.getElementById("a12Val").textContent = fmt("b");
    document.getElementById("a21Val").textContent = fmt("c");
    document.getElementById("a22Val").textContent = fmt("d");
  }

  /** Shows a line under the picture; "done" marks an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  function render() {
    const q = Core.regularPolygon(state);
    const p = Core.affinePolygon(state);
    const c = Core.centers(state, false);
    const n = state.n;

    basePoly.set(q);
    affinePoly.set(p);
    centerPoly.set(c);
    for (let i = 0; i < erected.length; i++) {
      const on = i < n && showErected;
      erected[i].show(on);
      if (on) erected[i].set(Core.erectedPolygon(state, i));
    }
    for (let i = 0; i < centerDots.length; i++) {
      centerDots[i].show(i < n);
      if (i < n) centerDots[i].set(c[i]);
    }
    centerMark.set(state.center);

    const opposite = q[Math.floor(n / 2)];
    h0.set(q[0]);
    h1.set(opposite);

    const radius = Core.centerRadius(state);
    const all = Core.claims(state);
    if (checked && Object.values(all).every(Boolean)) {
      say(`${n} regular ${n}-gons on the sides: their centres make a regular ${n}-gon of radius ${fmt(radius)}.`, "done");
    } else {
      say(`N = ${n}. The ${n} dashed corners are stretched into the thick polygon; ` +
          `the coloured centres sit ${fmt(radius)} from the middle. Drag a dot or move a slider.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /** A drag changes the angle of the dashed polygon, never its regularity. */
  function onCircle(point) {
    const dx = point.x - state.center.x, dy = point.y - state.center.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: state.center.x + (state.radius * dx) / len,
      y: state.center.y + (state.radius * dy) / len,
    };
  }

  const handleLabel = (name) =>
    `${name}. Drag it, or focus it and use the arrow keys to turn the dashed polygon`;
  const h0 = board.handle("regular-0", state.center, {
    r: 8, step: 3, shift: 12, layer: handleLayer, clamp: onCircle,
    label: handleLabel("First corner of the dashed polygon"),
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => { state = Core.withVertex(state, 0, p); checked = false; render(); },
  });
  const h1 = board.handle("regular-half", state.center, {
    r: 8, step: 3, shift: 12, layer: handleLayer, clamp: onCircle,
    label: handleLabel("Opposite corner of the dashed polygon"),
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => {
      state = Core.withVertex(state, Math.floor(state.n / 2), p);
      checked = false;
      render();
    },
  });

  function change(name, value) {
    state = Core.withOption(state, name, value);
    checked = false;
    render();
  }

  nInput.addEventListener("input", () => {
    const raw = parseInt(nInput.value, 10);
    if (!Number.isFinite(raw)) return; // a half-typed number is not a change
    change("n", raw);
  });
  params.forEach((input, i) => {
    input.addEventListener("input", () => {
      const raw = parseInt(input.value, 10);
      if (!Number.isFinite(raw)) return;
      change(paramKeys[i], raw / 100);
    });
  });

  function newGame() {
    state = Core.start();
    checked = false;
    showErected = true;
    toggleBtn.setAttribute("aria-pressed", "true");
    toggleBtn.textContent = "Hide built shapes";
    toggleBtn.setAttribute("aria-label", "Hide the regular polygons built on the sides");
    syncControls();
    render();
  }

  resetBtn.addEventListener("click", newGame);
  toggleBtn.addEventListener("click", () => {
    showErected = !showErected;
    toggleBtn.setAttribute("aria-pressed", String(showErected));
    toggleBtn.textContent = showErected ? "Hide built shapes" : "Show built shapes";
    toggleBtn.setAttribute("aria-label", showErected
      ? "Hide the regular polygons built on the sides"
      : "Show the regular polygons built on the sides");
    render();
  });
  checkBtn.addEventListener("click", () => {
    const all = Core.claims(state);
    checked = Object.values(all).every(Boolean);
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "c" || e.key === "C") checkBtn.click();
  });

  board.onTheme(render);
  syncControls();
  render();
})();
