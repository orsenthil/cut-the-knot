"use strict";

/*
 * Browser UI for Simpson's paradox as slopes. Four labelled points can be
 * dragged (or moved with arrow keys when focused); each is joined to the
 * origin. The status says in words whether the starting surprise holds: both
 * B slopes steeper than their A slopes, but the combined B slope shallower.
 * The arithmetic is in simpson-paradox-core.js; the SVG uses CSS classes.
 */

(() => {
  const C = SimpsonParadoxCore;
  const svg = document.getElementById("diagram");
  const statusEl = document.getElementById("status");
  const verdictEl = document.getElementById("verdict");
  const circles = {};
  let state = C.start();
  let dragging = null;

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function element(name, attrs, className) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (className) node.setAttribute("class", className);
    return node;
  }

  function toViewBox(event) {
    const rect = svg.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (320 / rect.width),
      y: 200 - (event.clientY - rect.top) * (200 / rect.height),
    };
  }

  function move(key, x, y) {
    state = C.setPoint(state, key, x, y);
    render();
  }

  function draw() {
    svg.replaceChildren();
    svg.appendChild(element("line", { x1: 0, y1: 200, x2: 320, y2: 200 }, "axis"));
    svg.appendChild(element("line", { x1: 0, y1: 0, x2: 0, y2: 200 }, "axis"));
    const sl = C.slopes(state);
    for (const key of C.KEYS) {
      const p = state.points[key];
      svg.appendChild(element("line", {
        x1: 0, y1: 200, x2: p.x, y2: 200 - p.y,
      }, key.startsWith("a") ? "line-a" : "line-b"));
    }
    for (const key of C.KEYS) {
      const p = state.points[key];
      const circle = element("circle", {
        cx: p.x, cy: 200 - p.y, r: 7,
        tabindex: 0,
        role: "button",
        "aria-label": `Point ${key.toUpperCase()} at (${p.x}, ${p.y}), slope ${sl[key].toFixed(2)}. Drag it, or use arrow keys.`,
      }, `point-${key[0]}`);
      circle.dataset.key = key;
      circle.addEventListener("pointerdown", (event) => {
        dragging = key;
        event.preventDefault();
      });
      circle.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 10 : 1;
        const p = state.points[key];
        const moves = {
          ArrowRight: [p.x + step, p.y], ArrowLeft: [p.x - step, p.y],
          ArrowUp: [p.x, p.y + step], ArrowDown: [p.x, p.y - step],
        };
        if (moves[event.key]) {
          event.preventDefault();
          const [x, y] = moves[event.key];
          move(key, x, y);
          svg.querySelector(`[data-key="${key}"]`)?.focus();
        }
      });
      svg.appendChild(circle);
      circles[key] = circle;
      if (state.showNames) {
        const label = element("text", {
          x: p.x + 10, y: 200 - p.y - 10, "font-size": 14,
        }, `label-${key[0]}`);
        label.textContent = key.toUpperCase() + key[1];
        svg.appendChild(label);
      }
    }
  }

  function render() {
    const sl = C.slopes(state);
    draw();
    verdictEl.textContent =
      `A1 ${sl.a1.toFixed(2)}, A2 ${sl.a2.toFixed(2)}, together ${sl.a.toFixed(2)}. ` +
      `B1 ${sl.b1.toFixed(2)}, B2 ${sl.b2.toFixed(2)}, together ${sl.b.toFixed(2)}. ` +
      (C.paradox(state) ? "Both B slopes are steeper, yet together B is shallower."
        : "The combined slopes follow the individual comparisons here.");
    document.getElementById("namesBox").checked = state.showNames;
    say(state.message, C.result(state));

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      window.Track.state({
        points: Object.fromEntries(C.KEYS.map((key) =>
          [key, { x: state.points[key].x, y: state.points[key].y }])),
        showNames: state.showNames,
        slopes: sl,
        paradox: C.paradox(state),
      });
    }
  }

  svg.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const at = toViewBox(event);
    move(dragging, at.x, at.y);
  });
  svg.addEventListener("pointerup", () => { dragging = null; });
  svg.addEventListener("pointerleave", () => { dragging = null; });

  document.getElementById("namesBox").addEventListener("change", () => {
    state = C.toggleNames(state);
    render();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = C.reset(state);
    render();
  });

  render();
})();
