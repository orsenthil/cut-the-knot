"use strict";

/* Browser UI: Robinson's split, extend, remove and close-gap operations. */
(() => {
  const C = RobinsonInductionCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const splitBtn = document.getElementById("splitBtn");
  const extendBtn = document.getElementById("extendBtn");
  const removeBtn = document.getElementById("removeBtn");
  const closeBtn = document.getElementById("closeBtn");
  const inductBtn = document.getElementById("inductBtn");
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
        class: `tile ${t.kind === "H" ? "htile" : "vtile"}` +
          (i === selected ? " selected" : "") + (state.path.includes(i) ? " onpath" : ""),
        tabindex: "0", role: "button",
        "aria-label": `Tile ${i + 1}, ${t.kind === "H" ? "integer width" : "integer height"}, ${t.w} by ${t.h}`,
      });
      rect.addEventListener("click", () => { selected = i; render(); });
      rect.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selected = i; render(); }
      });
      svg.appendChild(rect);
      const label = el("text", { x: X(t.x + t.w / 2), y: Y(t.y + t.h / 2) + 5, class: "tile-label" });
      label.textContent = t.kind;
      svg.appendChild(label);
    });

    const amb = state.ambient;
    svg.appendChild(el("rect", {
      x: X(amb.x), y: Y(amb.y + amb.h), width: amb.w * 100, height: amb.h * 100, class: "ambient",
    }));

    readout.textContent = `${amb.w} by ${amb.h} · ${r.hCount} H-tiles · ${r.vCount} V-tiles · ${C.isInt(amb.w) || C.isInt(amb.h) ? "ambient has an integer side" : "ambient sides are not integers"}`;
    status.textContent = state.message + (r.tiling.valid ? "" : "  (This is no longer a tiling.)");
    status.className = r.tiling.valid ? "done" : "lose";
    removeBtn.disabled = state.path.length === 0;
    closeBtn.disabled = !state.gap;
    extendBtn.disabled = state.tiles.length === 0;
    inductBtn.disabled = r.hCount === 0;
    if (window.Track) window.Track.state({
      ambient: { ...amb }, tiles: state.tiles.map((t) => ({ ...t })),
      selected, hCount: r.hCount, vCount: r.vCount, valid: r.tiling.valid,
    });
  }

  splitBtn.addEventListener("click", () => { state = C.split(state); selected = 0; render(); });
  extendBtn.addEventListener("click", () => { state = C.extend(state, selected); render(); });
  removeBtn.addEventListener("click", () => { state = C.removePath(state); render(); });
  closeBtn.addEventListener("click", () => { state = C.closeGap(state); render(); });
  inductBtn.addEventListener("click", () => { state = C.induct(state).state; selected = 0; render(); });
  resetBtn.addEventListener("click", () => { state = C.start(); selected = 0; render(); });

  state = C.start();
  render();
})();
