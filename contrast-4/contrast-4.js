"use strict";

/*
 * The page for Contrast 4: drawing and input only. The geometry, the five
 * scrollbar ranges and the "one shade on all six patches" rule are in
 * contrast-4-core.js. The stage is a 400 by 400 SVG, the applet's own size;
 * the first layer holds the six bands, the second the six identical patches,
 * and the last a focusable handle that steps through the patches.
 */

(function () {
  const Core = Contrast4Core;
  const svg = document.getElementById("board");
  const board = Geom.board(svg);
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const inputs = Array.from(document.querySelectorAll("input[data-option]"));
  const stepBtns = Array.from(document.querySelectorAll("button[data-step]"));

  let state = Core.start({});

  /** The line under the picture. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers in paint order; shapes are made once and updated in place. */
  const bandLayer = board.layer("bands");
  const patchLayer = board.layer("patches");
  const markLayer = board.layer("marks");
  const handleLayer = board.layer("handles");
  board.el("rect", { x: 0.5, y: 0.5, width: 399, height: 399 }, "frame", markLayer);

  const corners = (r) => [
    { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
  ];
  const bands = Core.BANDS;
  const bandShapes = Array.from({ length: bands }, () => board.polygon([], "band", bandLayer));
  const patchShapes = Array.from({ length: bands }, () => board.polygon([], "patch", patchLayer));
  const focusShape = board.polygon([], "patch-focus", markLayer);
  const upperLabel = board.label({ x: 8, y: 120 }, "high", "row-label", 0, 0, markLayer);
  const lowerLabel = board.label({ x: 8, y: 240 }, "low", "row-label", 0, 0, markLayer);

  /** The handle snaps to the nearest patch centre, so a drag selects a patch. */
  const nearestCenter = (p) => {
    const next = Core.select(state, p);
    return Core.patchCenter(next, next.selected);
  };
  const patchHandle = board.handle("patch", Core.patchCenter(state, state.selected), {
    r: 10, layer: handleLayer, cls: "patch-handle",
    label: "Selected grey patch. Drag it onto another patch, or focus it and use the arrow keys to step through the six patches.",
    describe: () => {
      const g = Core.geometry(state);
      const i = state.selected;
      const p = g.patches[i];
      const band = g.bands[p.band].dark ? "dark" : "light";
      return `patch ${i + 1} of 6, ${p.row} on a ${band} band, fill ${Core.colors(state).patch}`;
    },
    clamp: nearestCenter,
    onMove: (p) => { state = Core.select(state, p); render(); },
  });

  /* Arrow keys on the handle step one patch at a time in either direction. */
  svg.addEventListener("keydown", (event) => {
    if (document.activeElement !== patchHandle.node) return;
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    event.stopPropagation(); // keep Geom's generic one-unit step from moving it twice
    const delta = forward ? 1 : -1;
    state = { ...state, selected: (state.selected + delta + bands) % bands };
    render();
    patchHandle.node.focus();
  }, true);

  function render() {
    const g = Core.geometry(state);
    const col = Core.colors(state);
    svg.style.setProperty("--dark-band", col.dark);
    svg.style.setProperty("--light-band", col.light);
    svg.style.setProperty("--patch-grey", col.patch);

    g.bands.forEach((b, i) => {
      bandShapes[i].set(corners(b));
      bandShapes[i].node.setAttribute("class", b.dark ? "band band-dark" : "band band-light");
    });
    g.patches.forEach((p, i) => {
      patchShapes[i].set(corners(p));
      patchShapes[i].node.setAttribute("class", i === state.selected ? "patch patch-selected" : "patch");
    });

    const p = g.patches[state.selected];
    focusShape.set(corners({
      x: p.x - 3, y: p.y - 3, w: p.w + 6, h: p.h + 6,
    }));
    upperLabel.set({ x: 8, y: g.upperY + 5 }, "high");
    lowerLabel.set({ x: 8, y: g.lowerY + 5 }, "low");
    patchHandle.set(Core.patchCenter(state, state.selected));

    const band = g.bands[p.band].dark ? "dark" : "light";
    say(`${Core.describe(state)} Selected patch ${state.selected + 1}: ${p.row} on a ${band} band.`);

    inputs.forEach((input) => {
      const key = input.dataset.option;
      input.value = String(state[key]);
      const [lo, hi] = Core.LIMITS[key];
      input.setAttribute("aria-valuetext", `${state[key]} out of ${lo} to ${hi}`);
      const out = document.getElementById(`out-${key}`);
      if (out) out.textContent = key === "gray" || key === "min" || key === "max"
        ? `${state[key]} (${col[key === "gray" ? "patch" : key === "min" ? "dark" : "light"]})`
        : String(state[key]);
    });

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      state = Core.setOption(state, input.dataset.option, input.value);
      render();
    });
  });
  stepBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const [key, amount] = btn.dataset.step.split(":");
      state = Core.setOption(state, key, state[key] + Number(amount));
      render();
    });
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
  });

  board.onTheme(render);
  render();
})();
