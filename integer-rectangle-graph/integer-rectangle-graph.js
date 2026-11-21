"use strict";

/* Browser UI: a tile tiling, its corner graph, and both proofs. */
(() => {
  const C = IntegerRectangleGraphCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const presetSel = document.getElementById("presetSel");
  const graphCheck = document.getElementById("graphCheck");
  const cornersCheck = document.getElementById("cornersCheck");
  const trailCheck = document.getElementById("trailCheck");
  const editor = document.getElementById("editor");
  const tileX = document.getElementById("tileX");
  const tileY = document.getElementById("tileY");
  const tileW = document.getElementById("tileW");
  const tileH = document.getElementById("tileH");
  const kindBtn = document.getElementById("kindBtn");
  const removeBtn = document.getElementById("removeBtn");
  const addBtn = document.getElementById("addBtn");
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
    const step = state.step;

    state.tiles.forEach((t, i) => {
      const k = C.kind(t, step);
      const rect = el("rect", {
        x: X(t.x), y: Y(t.y + t.h), width: t.w * 100, height: t.h * 100,
        class: "tile " + (k === "H" ? "htile" : "vtile") + (i === selected ? " selected" : ""),
        tabindex: "0", role: "button",
        "aria-label": `Tile ${i + 1}: ${k === "H" ? "special width" : "special height"}, ${t.w} by ${t.h}`,
      });
      rect.addEventListener("click", () => { selected = i; render(); });
      rect.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selected = i; render(); }
      });
      svg.appendChild(rect);
      const label = el("text", { x: X(t.x + t.w / 2), y: Y(t.y + t.h / 2) + 5, class: "tile-label" });
      label.textContent = k;
      svg.appendChild(label);
    });

    if (graphCheck.checked) {
      r.graph.edges.forEach((edge) => {
        const a = r.graph.nodes.get(edge.from);
        const b = r.graph.nodes.get(edge.to);
        svg.appendChild(el("line", {
          x1: X(a.x), y1: Y(a.y), x2: X(b.x), y2: Y(b.y), class: "graph-edge",
        }));
      });
    }

    if (trailCheck.checked && r.tiling.valid) {
      const pts = r.trail.path.map((k) => r.graph.nodes.get(k)).filter(Boolean);
      svg.appendChild(el("polyline", {
        points: pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(" "), class: "trail",
      }));
    }

    if (cornersCheck.checked) {
      for (const [key, p] of r.graph.nodes) {
        svg.appendChild(el("circle", {
          cx: X(p.x), cy: Y(p.y), r: 5,
          class: "corner" + (C.specialPoint(p, step) ? " special" : ""),
        }));
      }
    }

    const amb = state.ambient;
    svg.appendChild(el("rect", {
      x: X(amb.x), y: Y(amb.y + amb.h), width: amb.w * 100, height: amb.h * 100,
      class: "ambient",
    }));

    const t = state.tiles[selected];
    if (t) {
      tileX.value = String(t.x);
      tileY.value = String(t.y);
      tileW.value = String(t.w);
      tileH.value = String(t.h);
      kindBtn.textContent = `Kind: ${C.kind(t, step)} (click to swap)`;
      editor.hidden = false;
      removeBtn.disabled = state.tiles.length <= 1;
    } else editor.hidden = true;

    const c = r.counting;
    readout.textContent = `Special corners: S = ${c.S} = ${c.S1} + 2×${c.S2} + 4×${c.S4} · S₁ is ${c.S1 % 2 === 0 ? "even" : "odd"}`;
    if (!r.tiling.valid) {
      status.textContent = "These rectangles no longer tile the ambient rectangle. Fix the gap or overlap to use the proofs.";
      status.className = "lose";
    } else {
      status.textContent = `The graph path ends at another corner of the big rectangle, which is special. So at least one side of the big rectangle is special — ${r.ambientSpecial ? "confirmed" : "not confirmed"}.`;
      status.className = "done";
    }
    if (window.Track) window.Track.state({
      preset: presetSel.value,
      step: step,
      tiles: state.tiles.map((tile) => ({ ...tile })),
      selected,
      specialS: c.S,
      valid: r.tiling.valid,
    });
  }

  const bindTile = (input, key) => input.addEventListener("input", () => {
    state = C.resize(state, selected, key, Number(input.value));
    render();
  });
  bindTile(tileX, "x");
  bindTile(tileY, "y");
  bindTile(tileW, "w");
  bindTile(tileH, "h");
  kindBtn.addEventListener("click", () => { state = C.toggleKind(state, selected); render(); });
  removeBtn.addEventListener("click", () => {
    state = { ...state, tiles: state.tiles.filter((_, i) => i !== selected) };
    selected = Math.max(0, selected - 1);
    render();
  });
  addBtn.addEventListener("click", () => {
    state = { ...state, tiles: state.tiles.concat([{ x: 0, y: 0, w: 0.5, h: 0.5, kind: "H" }]) };
    selected = state.tiles.length - 1;
    render();
  });
  presetSel.addEventListener("change", () => {
    state = C.PRESETS[presetSel.value]();
    selected = 0;
    render();
  });
  [graphCheck, cornersCheck, trailCheck].forEach((box) => box.addEventListener("change", render));

  for (const name of Object.keys(C.PRESETS)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name === "winkler" ? "Winkler's tiling" : name === "squares" ? "Squares and strips" : "Halves instead of integers";
    presetSel.appendChild(option);
  }
  state = C.start();
  render();
})();
