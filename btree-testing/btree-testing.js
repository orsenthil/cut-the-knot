"use strict";

/*
 * The page for the Factor Tree tool. All of the factoring rules live in
 * btree-testing-core.js; this file only draws the tree on a canvas and takes
 * input. The play area is a tree: each filled number sits above the two boxes
 * it was split into, the current empty box is highlighted, and typing a factor
 * there fills the box and its sibling exactly as the applet did.
 *
 * Focus stays on the board after a factor is accepted, so a player can keep
 * going with arrow keys, digits and Enter alone. The status line spells out
 * every split and the final prime factorization in words.
 */
(function () {
  const Core = BTreeTestingCore;
  const canvas = document.getElementById("treeCanvas");
  const ctx = canvas.getContext("2d");
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const boxLabel = document.getElementById("boxLabel");
  const factorInput = document.getElementById("factorInput");
  const countSelect = document.getElementById("countSelect");
  const newBtn = document.getElementById("newBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const checkBtn = document.getElementById("checkBtn");

  let state = null; // the plain position, or null before the first New problem
  let selPath = ""; // path of the empty box being filled, e.g. "LR"
  let entry = ""; // digits typed for that box
  let layout = [];
  let cssW = 320;
  let cssH = 140;

  // Read the theme's colours at draw time so a theme flip repaints the board.
  let t = {};
  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    t = {
      stage: get("--stage", "#f3f5f8"),
      ink: get("--ink", "#1f2430"),
      muted: get("--muted", "#5d6472"),
      accent: get("--accent", "#5b4ee8"),
      accentSoft: get("--accent-soft", "rgba(91,78,232,0.10)"),
      boardA: get("--board-a", "#e9edf3"),
      boardB: get("--board-b", "#d5dce7"),
      good: get("--good", "#15803d"),
      highlight: get("--highlight", "rgba(255,214,10,0.35)"),
    };
  }
  refreshTokens();

  /**
   * Shows a line under the board. "done" is also how the player's record
   * learns that this demo has been explored, so use it only when the tree is
   * completely factored.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const LEVEL_H = 56;
  const TOP = 26;
  const BOTTOM = 22;

  /** Lay the tree out: leaves are spread evenly, parents sit over their pair. */
  function computeLayout(root) {
    const leafX = {};
    let maxDepth = 0;
    (function visit(node, path, depth) {
      maxDepth = Math.max(maxDepth, depth);
      if (!node.done || (!node.left && !node.right)) {
        leafX[path] = 0;
        return;
      }
      visit(node.left, path + "L", depth + 1);
      visit(node.right, path + "R", depth + 1);
    })(root, "", 0);

    const paths = Object.keys(leafX);
    const gap = cssW / Math.max(1, paths.length);
    paths.forEach((p, i) => { leafX[p] = gap * (i + 0.5); });

    const nodes = [];
    (function place(node, path, depth) {
      let x;
      if (!node.done || (!node.left && !node.right)) {
        x = leafX[path];
      } else {
        const l = place(node.left, path + "L", depth + 1);
        const r = place(node.right, path + "R", depth + 1);
        x = (l.x + r.x) / 2;
      }
      const item = { path: path, x: x, y: TOP + depth * LEVEL_H, node: node };
      nodes.push(item);
      return item;
    })(root, "", 0);

    cssH = TOP + (maxDepth + 1) * LEVEL_H + BOTTOM;
    return nodes;
  }

  function nodeWidth() {
    const leaves = layout.filter((it) => !it.node.done || (!it.node.left && !it.node.right));
    const gap = leaves.length > 1
      ? Math.min.apply(null, leaves.slice(1).map((it, i) => it.x - leaves[i].x))
      : cssW;
    return Math.max(34, Math.min(72, Math.round(gap - 8)));
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function sizeCanvas(height) {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(240, Math.round(rect.width || 320));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    // Measure first, lay the tree out to get its height, then size the canvas
    // so the deepest branch is never clipped.
    const widthRect = canvas.getBoundingClientRect();
    cssW = Math.max(240, Math.round(widthRect.width || 320));
    layout = state ? computeLayout(state.root) : [];
    const height = state ? cssH : 130;
    sizeCanvas(height);
    ctx.clearRect(0, 0, cssW, height);

    if (!state) {
      ctx.fillStyle = t.ink;
      ctx.font = "0.95rem " + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Please press the 'New problem' button below", cssW / 2, 65);
      return;
    }

    const w = nodeWidth();
    const h = 34;
    const byPath = {};
    layout.forEach((it) => { byPath[it.path] = it; });

    // Connect each number to the two boxes it was split into.
    ctx.strokeStyle = t.muted;
    ctx.lineWidth = 1.4;
    for (const it of layout) {
      const n = it.node;
      if (!n.done) continue;
      for (const childPath of [it.path + "L", it.path + "R"]) {
        const child = byPath[childPath];
        if (!child) continue;
        ctx.beginPath();
        ctx.moveTo(it.x, it.y + h / 2);
        ctx.lineTo(child.x, child.y - h / 2);
        ctx.stroke();
      }
    }

    // Draw the boxes. An empty box waiting for input is marked with a "?".
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const it of layout) {
      const n = it.node;
      const selected = !n.done && it.path === selPath;
      const x = it.x - w / 2;
      const y = it.y - h / 2;
      roundRect(x, y, w, h, 9);
      ctx.fillStyle = selected ? t.accentSoft : (n.done ? t.boardA : t.boardB);
      ctx.fill();
      ctx.strokeStyle = selected ? t.accent : t.ink;
      ctx.lineWidth = selected ? 2.5 : 1.4;
      ctx.stroke();

      let label;
      if (!n.done) label = it.path === selPath && entry ? entry : "?";
      else label = String(n.value);
      ctx.fillStyle = !n.done ? t.muted : (!n.left && !n.right ? t.good : t.ink);
      ctx.font = "600 " + Math.max(14, Math.round(w * 0.38)) + "px " + getComputedStyle(document.body).fontFamily;
      ctx.fillText(label, it.x, it.y + 1);
    }
  }

  function selectFirstEmpty() {
    const empties = state ? Core.emptyPaths(state.root) : [];
    if (empties.indexOf(selPath) === -1) selPath = empties.length ? empties[0] : "";
    if (!selPath) entry = "";
    if (boxLabel) {
      boxLabel.textContent = state
        ? (selPath ? "Empty box: " + selPath + " — type a factor, then press Enter." : "No empty boxes left.")
        : "";
    }
    if (factorInput) factorInput.value = entry;
  }

  function render() {
    selectFirstEmpty();
    draw();
    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state(state || { n: null, count: null, root: null });
    }
  }

  function submit() {
    if (!state) {
      say("Please press the 'New problem' button below.");
      return;
    }
    if (entry === "") {
      say("Type a factor for the highlighted box first.");
      return;
    }
    const out = Core.enterFactor(state, selPath, entry);
    if (!out.ok) {
      say(out.message);
      entry = "";
      render();
      return;
    }
    state = out.position;
    entry = "";
    render();
    if (Core.isComplete(state.root)) say(out.message, "done");
    else say(out.message);
    // Keep the keyboard on the board, as the applet did after each entry.
    canvas.focus();
  }

  function newProblem() {
    const chosen = countSelect.value;
    state = Core.start({ count: chosen === "random" ? "random" : Number(chosen) });
    selPath = "";
    entry = "";
    repeatBtn.disabled = false;
    say("New problem: factor " + state.n + ". Choose an empty box, type one factor and press Enter.");
    render();
    canvas.focus();
  }

  function repeatProblem() {
    if (!state) return;
    state = Core.repeat(state);
    selPath = "";
    entry = "";
    say("Same number, " + state.n + ", with empty boxes again. Try a different factor tree.");
    render();
    canvas.focus();
  }

  // Real buttons and a real text field, each labelled for screen readers.
  newBtn.addEventListener("click", newProblem);
  repeatBtn.addEventListener("click", repeatProblem);
  checkBtn.addEventListener("click", submit);
  countSelect.addEventListener("change", newProblem);
  factorInput.addEventListener("input", () => {
    entry = factorInput.value.replace(/[^0-9]/g, "");
    factorInput.value = entry;
    render();
  });
  factorInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  });

  // Clicking a box selects it, like clicking a text field in the applet.
  canvas.addEventListener("click", (e) => {
    if (!state) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (e.clientX - rect.left) * (canvas.width / rect.width) / dpr;
    const y = (e.clientY - rect.top) * (canvas.height / rect.height) / dpr;
    const w = nodeWidth();
    for (const it of layout) {
      if (!it.node.done && Math.abs(x - it.x) <= w / 2 && Math.abs(y - it.y) <= 17) {
        selPath = it.path;
        entry = "";
        render();
        factorInput.focus();
        return;
      }
    }
  });

  // Keyboard-only play: arrows pick a box, digits type, Backspace erases,
  // Enter submits. Focus deliberately stays on the board after each reply.
  canvas.addEventListener("keydown", (e) => {
    if (!state) return;
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      entry += e.key;
      render();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      entry = entry.slice(0, -1);
      render();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      entry = "";
      render();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) !== -1) {
      const empties = Core.emptyPaths(state.root);
      if (!empties.length) return;
      e.preventDefault();
      const dir = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      const at = Math.max(0, empties.indexOf(selPath));
      selPath = empties[(at + dir + empties.length) % empties.length];
      entry = "";
      render();
    }
  });

  window.addEventListener("themechange", () => {
    refreshTokens();
    draw();
  });
  window.addEventListener("resize", () => { draw(); });

  repeatBtn.disabled = true;
  say("Please press the 'New problem' button below");
  render();
})();
