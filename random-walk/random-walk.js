"use strict";

/*
 * Browser UI for the Random Walk demo. Choose where the walk starts (a) and
 * ends (b) and how many steps it takes (n), then send one or ten walkers. Each
 * walker moves one step right and one step up or down at a time, steering to
 * its goal near the end, as in the applet. The SVG is styled with CSS classes,
 * so theme changes need no redraw. The walk arithmetic is in random-walk-core.js.
 */

(() => {
  const C = RandomWalkCore;
  const svg = document.getElementById("diagram");
  const statusEl = document.getElementById("status");
  const walksEl = document.getElementById("walkList");
  const point = (y, x) => ({ x, y: -y });
  const palette = ["#7b6cf6", "#22a05a", "#d2901f", "#c2567a", "#2a8fb5", "#8a6bbf"];
  let state = C.start();

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function element(name, attrs, className, style) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (className) node.setAttribute("class", className);
    if (style) node.setAttribute("style", style);
    return node;
  }

  function draw() {
    const steps = C.steps(state);
    const all = state.walks.flat();
    const ys = [state.a, state.b, 0, ...all];
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const span = Math.max(hi - lo, 4);
    const pad = span * 0.18;
    svg.setAttribute("viewBox", [-1, -(hi + pad), steps + 2, span + 2 * pad].join(" "));
    svg.replaceChildren();

    // A faint grid makes the up/down steps visible.
    svg.appendChild(element("line", { x1: -1, y1: 0, x2: steps + 1, y2: 0 }, "axis"));
    for (let x = 0; x <= steps; x++) {
      svg.appendChild(element("line", {
        x1: x, y1: -(hi + pad), x2: x, y2: -(lo - pad),
      }, "grid-line"));
    }

    const start = point(state.a, 0);
    const end = point(state.b, steps);
    svg.appendChild(element("circle", { cx: start.x, cy: start.y, r: span * 0.06 }, "start-dot"));
    svg.appendChild(element("circle", { cx: end.x, cy: end.y, r: span * 0.06 }, "end-dot"));
    if (state.showNames) {
      const a = element("text", { x: start.x - span * 0.1, y: start.y - span * 0.09, "font-size": span * 0.1 }, "point-label");
      a.textContent = "A";
      const b = element("text", { x: end.x + span * 0.06, y: end.y - span * 0.09, "font-size": span * 0.1 }, "point-label");
      b.textContent = "B";
      svg.append(a, b);
    }

    state.walks.forEach((path, i) => {
      const pts = path.map((y, x) => {
        const p = point(y, x);
        return `${p.x},${p.y}`;
      }).join(" ");
      svg.appendChild(element("polyline", {
        points: pts,
        "stroke-width": span * 0.025,
      }, "walk", `stroke:${palette[i % palette.length]}`));
    });
  }

  function render() {
    for (const key of ["a", "b", "n"]) {
      document.getElementById(`slider-${key}`).value = String(state[key]);
      document.getElementById(`value-${key}`).textContent = String(state[key]);
    }
    document.getElementById("namesBox").checked = state.showNames;
    draw();
    walksEl.textContent = state.walks.length
      ? `${state.walks.length} ${state.walks.length === 1 ? "walk" : "walks"} shown. ` +
        `${C.countWalks(state)} ways to go from A to B in ${C.steps(state)} steps.`
      : "No walks yet.";
    say(state.message, C.result(state));

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      window.Track.state({
        a: state.a, b: state.b, n: state.n,
        showNames: state.showNames,
        steps: C.steps(state),
        walks: state.walks.map((w) => w.slice()),
        explored: state.explored,
      });
    }
  }

  function change(key, value) {
    state = C.setParam(state, key, Number(value));
    render();
  }

  for (const key of ["a", "b", "n"]) {
    document.getElementById(`slider-${key}`).addEventListener("input", (event) => {
      change(key, event.target.value);
    });
  }
  document.getElementById("namesBox").addEventListener("change", () => {
    state = C.toggleNames(state);
    render();
  });
  document.getElementById("oneBtn").addEventListener("click", () => {
    state = C.addWalks(state, 1);
    render();
  });
  document.getElementById("tenBtn").addEventListener("click", () => {
    state = C.addWalks(state, 10);
    render();
  });

  render();
})();
