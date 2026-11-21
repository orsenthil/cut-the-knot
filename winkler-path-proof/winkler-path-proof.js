"use strict";

/* Browser UI: decorated H/V tiling with a highlighted green or red path. */
(() => {
  const C = WinklerPathProofCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const presetSel = document.getElementById("presetSel");
  const decorateCheck = document.getElementById("decorateCheck");
  const bordersCheck = document.getElementById("bordersCheck");
  const kindBtn = document.getElementById("kindBtn");
  const resetBtn = document.getElementById("resetBtn");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;
  let selected = 0;

  const el = (name, attrs) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const X = (x) => 25 + x * 100;
  const Y = (y) => 225 - y * 100;

  function render() {
    svg.replaceChildren();
    const r = C.analyze(state);
    selected = Math.max(0, Math.min(selected, state.tiles.length - 1));

    state.tiles.forEach((t, i) => {
      const rect = el("rect", {
        x: X(t.x), y: Y(t.y + t.h), width: t.w * 100, height: t.h * 100,
        class: `tile ${t.kind === "H" ? "htile" : "vtile"}${i === selected ? " selected" : ""}` +
          (bordersCheck.checked ? " bordered" : ""),
        tabindex: "0", role: "button",
        "aria-label": `Tile ${i + 1}: ${t.kind === "H" ? "green, integer width" : "red, integer height"}`,
      });
      rect.addEventListener("click", () => { selected = i; render(); });
      rect.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selected = i; render(); }
      });
      svg.appendChild(rect);
    });

    if (state.decorated) {
      r.strips.forEach((s) => svg.appendChild(el("rect", {
        x: X(s.x), y: Y(s.y + s.h), width: s.w * 100, height: s.h * 100,
        class: "strip " + (s.color === "H" ? "htile" : "vtile"),
      })));
    }

    const path = r.verdict.green || r.verdict.red;
    if (path && path.length > 1) {
      const pts = path.map((i) => {
        const t = state.tiles[i];
        return `${X(t.x + t.w / 2)},${Y(t.y + t.h / 2)}`;
      });
      svg.appendChild(el("polyline", { points: pts.join(" "), class: "path " + r.verdict.kind }));
    }

    const amb = state.ambient;
    svg.appendChild(el("rect", {
      x: X(amb.x), y: Y(amb.y + amb.h), width: amb.w * 100, height: amb.h * 100,
      class: "ambient",
    }));

    const t = state.tiles[selected];
    kindBtn.textContent = `Colour: ${t.kind === "H" ? "green (H)" : "red (V)"} — click to swap`;
    readout.textContent = r.tiling.valid
      ? `Path: ${r.verdict.kind === "green" ? `green, left to right (widths ${r.greenSum} = ${amb.w})` : r.verdict.kind === "red" ? `red, bottom to top (heights ${r.redSum} = ${amb.h})` : r.verdict.kind}`
      : "These rectangles do not tile the ambient rectangle.";
    status.textContent = !r.tiling.valid
      ? "Fix the tiling before using the proof."
      : r.verdict.kind === "green"
        ? "A green path crosses from left to right. Its tiles have integer widths that add to the big width — so the width is an integer."
        : r.verdict.kind === "red"
          ? "A red path crosses from bottom to top. Its tiles have integer heights that add to the big height — so the height is an integer."
          : "No spanning path was found.";
    status.className = r.tiling.valid && r.verdict.kind !== "none" ? "done" : "lose";
    if (window.Track) window.Track.state({
      preset: presetSel.value,
      ambient: { ...amb },
      tiles: state.tiles.map((tile) => ({ ...tile })),
      selected,
      decorated: state.decorated,
      pathKind: r.verdict.kind,
      valid: r.tiling.valid,
    });
  }

  presetSel.addEventListener("change", () => {
    state = C.PRESETS[presetSel.value]();
    selected = 0;
    decorateCheck.checked = state.decorated;
    render();
  });
  decorateCheck.addEventListener("change", () => { state = { ...state, decorated: decorateCheck.checked }; render(); });
  bordersCheck.addEventListener("change", render);
  kindBtn.addEventListener("click", () => { state = C.toggleKind(state, selected); render(); });
  resetBtn.addEventListener("click", () => {
    state = C.start();
    selected = 0;
    decorateCheck.checked = true;
    render();
  });

  for (const [name, label] of [
    ["winkler", "Winkler's tiling"], ["greenStrip", "Green strip"], ["fourSquares", "Four squares"],
  ]) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = label;
    presetSel.appendChild(option);
  }
  state = C.start();
  render();
})();
