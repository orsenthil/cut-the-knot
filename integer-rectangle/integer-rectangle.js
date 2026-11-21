"use strict";

/* Browser UI: a rectangle dragged over a chessboard, with live colour areas. */
(() => {
  const C = IntegerRectangleCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const xInput = document.getElementById("xInput");
  const yInput = document.getElementById("yInput");
  const wInput = document.getElementById("wInput");
  const hInput = document.getElementById("hInput");
  const splitCheck = document.getElementById("splitCheck");
  const randomBtn = document.getElementById("randomBtn");
  const resetBtn = document.getElementById("resetBtn");
  const centerBtn = document.getElementById("centerBtn");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;
  let drag = null;
  let startPoint = null;

  const el = (name, attrs) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const unit = () => svg.viewBox.baseVal.width / C.BOARD;

  function board() {
    const layer = el("g", { class: "board" });
    for (let i = 0; i < C.BOARD; i++) {
      for (let j = 0; j < C.BOARD; j++) {
        layer.appendChild(el("rect", {
          x: i * unit(), y: j * unit(), width: unit(), height: unit(),
          class: (i + j) % 2 === 0 ? "square light" : "square dark",
        }));
      }
    }
    svg.appendChild(layer);
  }

  function render() {
    svg.replaceChildren();
    board();
    const r = C.analyze(state);
    const U = unit();

    if (splitCheck.checked) {
      const colors = ["split-a", "split-b", "split-c"];
      r.pieces.forEach((p, i) => {
        svg.appendChild(el("rect", {
          x: p.x * U, y: p.y * U, width: p.w * U, height: p.h * U,
          class: "piece " + colors[i % colors.length],
        }));
      });
    }

    const rect = el("rect", {
      x: state.x * U, y: state.y * U, width: state.w * U, height: state.h * U,
      class: "region" + (r.balanced ? " balanced" : ""),
      tabindex: "0", role: "button",
      "aria-label": `Rectangle at ${state.x}, ${state.y}, width ${state.w}, height ${state.h}. Use arrow keys to move, shift and arrows to resize.`,
    });
    rect.addEventListener("pointerdown", (ev) => {
      drag = "move";
      startPoint = { x: ev.clientX, y: ev.clientY };
      rect.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    rect.addEventListener("keydown", (ev) => {
      const step = ev.shiftKey ? 0.25 : 0.5;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const delta = moves[ev.key];
      if (!delta) return;
      ev.preventDefault();
      state = ev.shiftKey
        ? C.set(state, ev.key === "ArrowLeft" ? "w" : ev.key === "ArrowRight" ? "w" : "h",
            (ev.key === "ArrowLeft" ? state.w - step : ev.key === "ArrowRight" ? state.w + step :
             ev.key === "ArrowUp" ? state.h - step : state.h + step))
        : C.move(state, delta[0], delta[1]);
      render();
      const again = svg.querySelector(".region");
      if (again) again.focus();
    });
    svg.appendChild(rect);

    const handle = el("circle", {
      cx: (state.x + state.w) * U, cy: (state.y + state.h) * U, r: 10,
      class: "resize", tabindex: "0", role: "button",
      "aria-label": "Drag to resize the rectangle",
    });
    handle.addEventListener("pointerdown", (ev) => {
      drag = "resize";
      startPoint = { x: ev.clientX, y: ev.clientY };
      handle.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    svg.appendChild(handle);

    xInput.value = String(state.x);
    yInput.value = String(state.y);
    wInput.value = String(state.w);
    hInput.value = String(state.h);
    readout.textContent = `Light ${r.light.toFixed(2)} · Dark ${r.dark.toFixed(2)} · Difference ${Math.abs(r.difference).toFixed(2)}`;
    status.textContent = r.balanced
      ? `Balanced! ${r.evenWidth ? "The width is even." : r.evenHeight ? "The height is even." : "The centre lies on a grid line."}`
      : `Not balanced: the two colours differ by ${Math.abs(r.difference).toFixed(2)}. Need an even side or a centre on a grid line.`;
    status.classList.remove("win", "lose", "done");
    status.classList.add(r.balanced ? "win" : "done");
    if (window.Track) window.Track.state({ x: state.x, y: state.y, w: state.w, h: state.h, light: r.light, dark: r.dark, balanced: r.balanced });
  }

  svg.addEventListener("pointermove", (ev) => {
    if (!drag || !startPoint) return;
    const box = svg.getBoundingClientRect();
    const scale = svg.viewBox.baseVal.width / box.width;
    const dx = (ev.clientX - startPoint.x) * scale / unit();
    const dy = (ev.clientY - startPoint.y) * scale / unit();
    if (drag === "move") state = C.move(state, dx, dy);
    else state = C.set(C.set(state, "w", state.w + dx), "h", state.h + dy);
    startPoint = { x: ev.clientX, y: ev.clientY };
    render();
  });
  const endDrag = () => { drag = null; startPoint = null; };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);

  const bind = (input, key) => input.addEventListener("input", () => {
    state = C.set(state, key, Number(input.value));
    render();
  });
  bind(xInput, "x");
  bind(yInput, "y");
  bind(wInput, "w");
  bind(hInput, "h");
  splitCheck.addEventListener("change", render);
  randomBtn.addEventListener("click", () => {
    const rnd = () => Math.round(Math.random() * 24) / 4;
    state = C.set(C.set(C.set(C.set(state, "x", rnd()), "y", rnd()), "w", 0.25 + rnd() * 3), "h", 0.25 + rnd() * 3);
    render();
  });
  resetBtn.addEventListener("click", () => { state = C.start(); render(); });
  centerBtn.addEventListener("click", () => {
    state = C.centerX(state);
    render();
  });

  state = C.start();
  render();
})();
