"use strict";

/*
 * Mazes — the page.
 *
 * MazesCore owns the grid, Prim, Kruskal and DFS. This file draws the maze on
 * a canvas and drives the four applet tabs: grid size, shape editing, create,
 * and solve.
 */

(function () {
  const H = MazesCore;

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const nxInput = document.getElementById("nxInput");
  const nyInput = document.getElementById("nyInput");
  const tabBtns = [...document.querySelectorAll("[data-tab]")];
  const panels = {
    grid: document.getElementById("panel-grid"),
    shape: document.getElementById("panel-shape"),
    create: document.getElementById("panel-create"),
    solve: document.getElementById("panel-solve"),
  };

  let maze = null;
  let tab = "grid";
  let shapeMode = "remove"; // start | end | remove | add
  let usePrim = true;
  let showGraph = false;
  let genState = null; // prim/kruskal in progress
  let solveState = null;
  let treeEdges = [];
  let timer = null;
  let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function fillSelect(sel, lo, hi, def) {
    sel.innerHTML = "";
    for (let n = lo; n <= hi; n++) {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = String(n);
      if (n === def) o.selected = true;
      sel.appendChild(o);
    }
  }

  function stopTimer() {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function setStatus(msg, cls) {
    statusEl.textContent = msg || "";
    statusEl.className = cls || "";
  }

  function clearGeneration() {
    stopTimer();
    genState = null;
    solveState = null;
    treeEdges = [];
  }

  function resetMaze() {
    clearGeneration();
    const nx = Number(nxInput.value);
    const ny = Number(nyInput.value);
    maze = H.reset(nx, ny);
    setStatus("");
    draw();
  }

  function setTab(name) {
    tab = name;
    tabBtns.forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.keys(panels).forEach((k) => {
      panels[k].hidden = k !== name;
    });
    // Leaving create/solve clears a running animation but keeps a finished tree.
    stopTimer();
    draw();
  }

  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const pad = 8;
    const cw = (canvas.width - 2 * pad) / maze.nx;
    const ch = (canvas.height - 2 * pad) / maze.ny;
    const cx = Math.floor((x - pad) / cw);
    const cy = Math.floor((y - pad) / ch);
    if (cx < 0 || cy < 0 || cx >= maze.nx || cy >= maze.ny) return null;
    return maze.nodes[cy * maze.nx + cx];
  }

  function onCanvasClick(ev) {
    if (tab !== "shape") return;
    const node = cellAt(ev.clientX, ev.clientY);
    if (!node) return;
    if (shapeMode === "start") {
      H.setStart(maze, node);
      setStatus("Start set.");
    } else if (shapeMode === "end") {
      H.setEnd(maze, node);
      setStatus("End set.");
    } else if (shapeMode === "remove") {
      if (node === maze.start || node === maze.end) {
        setStatus("Choose a different cell — start and end stay.");
        return;
      }
      if (!H.isActive(maze, node)) return;
      H.removeNode(maze, node);
      document.getElementById("backBtn").disabled = false;
      document.getElementById("addMode").disabled = false;
      setStatus("Cell removed.");
    } else if (shapeMode === "add") {
      if (H.isActive(maze, node)) return;
      H.restoreNode(maze, node);
      if (!maze.removed.length) {
        document.getElementById("backBtn").disabled = true;
        document.getElementById("addMode").disabled = true;
        if (shapeMode === "add") {
          shapeMode = "remove";
          document.getElementById("removeMode").checked = true;
        }
      }
      setStatus("Cell restored.");
    }
    clearGeneration();
    draw();
  }

  function ensureGen() {
    if (genState && !genState.done) return true;
    if (!maze.start || !maze.end) {
      setStatus("Set a start and an end first.", "lose");
      return false;
    }
    genState = usePrim ? H.primStart(maze) : H.kruskalStart(maze);
    treeEdges = genState.treeEdges;
    solveState = null;
    return true;
  }

  function stepCreate() {
    if (!ensureGen()) return;
    const step = usePrim ? H.primStep : H.kruskalStep;
    const moved = usePrim ? step(genState, maze) : step(genState);
    treeEdges = genState.treeEdges;
    if (!moved || genState.done) {
      stopTimer();
      setStatus(
        (usePrim ? "Prim" : "Kruskal") +
          " finished — " +
          treeEdges.length +
          " passages.",
        "win",
      );
    } else {
      setStatus(
        (usePrim ? "Prim" : "Kruskal") +
          ": " +
          genState.treeEdges.length +
          " edges…",
      );
    }
    draw();
  }

  function runCreate(ms) {
    stopTimer();
    if (!ensureGen()) return;
    if (reduced || ms <= 0) {
      if (usePrim) {
        while (H.primStep(genState, maze)) { /* fast */ }
      } else {
        while (H.kruskalStep(genState)) { /* fast */ }
      }
      treeEdges = genState.treeEdges;
      setStatus(
        (usePrim ? "Prim" : "Kruskal") +
          " finished — " +
          treeEdges.length +
          " passages.",
        "win",
      );
      draw();
      return;
    }
    timer = setInterval(stepCreate, ms);
  }

  function ensureSolve() {
    if (!treeEdges.length) {
      setStatus("Create a maze first.", "lose");
      return false;
    }
    if (!solveState || solveState.done) {
      solveState = H.dfsStart(maze, treeEdges);
    }
    return true;
  }

  function stepSolve() {
    if (!ensureSolve()) return;
    const moved = H.dfsStep(solveState, maze);
    if (!moved || solveState.done) {
      stopTimer();
      if (solveState.current === maze.end) {
        setStatus("Path found.", "win");
      } else {
        setStatus("Search finished.", "lose");
      }
    } else {
      setStatus("Searching…");
    }
    draw();
  }

  function runSolve(ms) {
    stopTimer();
    if (!ensureSolve()) return;
    if (reduced || ms <= 0) {
      while (H.dfsStep(solveState, maze)) { /* fast */ }
      if (solveState.current === maze.end) setStatus("Path found.", "win");
      else setStatus("Search finished.", "lose");
      draw();
      return;
    }
    timer = setInterval(stepSolve, ms);
  }

  function draw() {
    const ink = css("--ink") || "#222";
    const stage = css("--stage") || "#f4f4f0";
    const accent = css("--accent") || "#5b4fcf";
    const good = css("--good") || "#2f7d4a";
    const bad = css("--bad") || "#b33";
    const muted = css("--muted") || "#888";
    const border = css("--border-strong") || "#999";

    const w = canvas.clientWidth || 360;
    const h = Math.max(220, Math.round(w * (maze.ny / maze.nx)));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, w, h);

    const pad = 8;
    const cw = (w - 2 * pad) / maze.nx;
    const ch = (h - 2 * pad) / maze.ny;
    const treeSet = new Set(treeEdges);
    const finished = genState && genState.done && treeEdges.length;

    function cellOrigin(node) {
      return { x: pad + node.x * cw, y: pad + node.y * ch };
    }

    // Rooms
    for (const node of maze.nodes) {
      if (!H.isActive(maze, node)) continue;
      const o = cellOrigin(node);
      ctx.fillStyle = stage;
      ctx.fillRect(o.x + 1, o.y + 1, cw - 2, ch - 2);
    }

    // Walls: between active neighbours with no tree passage (or always, before create)
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.5, Math.min(cw, ch) * 0.12);
    ctx.lineCap = "square";

    function wall(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    for (const node of maze.nodes) {
      if (!H.isActive(maze, node)) continue;
      const o = cellOrigin(node);
      // East wall
      if (node.x + 1 < maze.nx) {
        const east = maze.nodes[node.id + 1];
        if (H.isActive(maze, east)) {
          const open = finished && H.isTreeEdge(treeEdges, node, east);
          if (!open) wall(o.x + cw, o.y, o.x + cw, o.y + ch);
        }
      }
      // South wall
      if (node.y + 1 < maze.ny) {
        const south = maze.nodes[node.id + maze.nx];
        if (H.isActive(maze, south)) {
          const open = finished && H.isTreeEdge(treeEdges, node, south);
          if (!open) wall(o.x, o.y + ch, o.x + cw, o.y + ch);
        }
      }
    }

    // Outer border
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(2, Math.min(cw, ch) * 0.14);
    ctx.strokeRect(pad, pad, maze.nx * cw, maze.ny * ch);

    // Removed cells as muted blocks
    for (const node of maze.removed) {
      const o = cellOrigin(node);
      ctx.fillStyle = muted;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(o.x, o.y, cw, ch);
      ctx.globalAlpha = 1;
    }

    // Graph overlay: all edges or tree edges
    if (showGraph || (genState && !genState.done)) {
      const edges = showGraph ? maze.edges.filter((e) => !e.removed) : treeEdges;
      for (const e of edges) {
        if (!H.isActive(maze, e.a) || !H.isActive(maze, e.b)) continue;
        const inTree = treeSet.has(e);
        const oa = cellOrigin(e.a);
        const ob = cellOrigin(e.b);
        ctx.strokeStyle = inTree ? accent : border;
        ctx.globalAlpha = inTree ? 0.9 : 0.35;
        ctx.lineWidth = inTree ? 2.5 : 1;
        ctx.beginPath();
        ctx.moveTo(oa.x + cw / 2, oa.y + ch / 2);
        ctx.lineTo(ob.x + cw / 2, ob.y + ch / 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // DFS trail
    if (solveState) {
      for (const e of treeEdges) {
        if (!e.traversed) continue;
        const oa = cellOrigin(e.a);
        const ob = cellOrigin(e.b);
        ctx.strokeStyle = e.traversed >= 2 ? muted : good;
        ctx.globalAlpha = e.traversed >= 2 ? 0.35 : 0.85;
        ctx.lineWidth = Math.max(2, Math.min(cw, ch) * 0.2);
        ctx.beginPath();
        ctx.moveTo(oa.x + cw / 2, oa.y + ch / 2);
        ctx.lineTo(ob.x + cw / 2, ob.y + ch / 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (solveState.current) {
        const o = cellOrigin(solveState.current);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(o.x + cw / 2, o.y + ch / 2, Math.min(cw, ch) * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Start / end markers
    function mark(node, color, label) {
      if (!node) return;
      const o = cellOrigin(node);
      const r = Math.min(cw, ch) * 0.28;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(o.x + cw / 2, o.y + ch / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "600 " + Math.max(9, r) + "px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, o.x + cw / 2, o.y + ch / 2 + 0.5);
    }
    mark(maze.start, "#2c5fc0", "S");
    mark(maze.end, "#c0362c", "E");
  }

  // ---- wire controls ----
  fillSelect(nxInput, H.MIN, H.MAX, H.DEFAULT_NX);
  fillSelect(nyInput, H.MIN, H.MAX, H.DEFAULT_NY);

  tabBtns.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

  document.getElementById("resetBtn").addEventListener("click", resetMaze);
  nxInput.addEventListener("change", resetMaze);
  nyInput.addEventListener("change", resetMaze);

  document.querySelectorAll("input[name=shapeMode]").forEach((el) => {
    el.addEventListener("change", () => {
      if (el.checked) shapeMode = el.value;
    });
  });
  document.getElementById("backBtn").addEventListener("click", () => {
    H.restoreLast(maze);
    if (!maze.removed.length) {
      document.getElementById("backBtn").disabled = true;
      document.getElementById("addMode").disabled = true;
    }
    clearGeneration();
    draw();
  });

  document.querySelectorAll("input[name=algo]").forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      usePrim = el.value === "prim";
      clearGeneration();
      setStatus("");
      draw();
    });
  });

  document.getElementById("createBtn").addEventListener("click", () => runCreate(0));
  document.getElementById("createSlowBtn").addEventListener("click", () => runCreate(80));
  document.getElementById("createStepBtn").addEventListener("click", () => {
    stopTimer();
    stepCreate();
  });

  document.getElementById("solveBtn").addEventListener("click", () => {
    solveState = null;
    runSolve(0);
  });
  document.getElementById("solveSlowBtn").addEventListener("click", () => {
    solveState = null;
    runSolve(60);
  });
  document.getElementById("solveStepBtn").addEventListener("click", () => {
    stopTimer();
    stepSolve();
  });
  document.getElementById("showGraph").addEventListener("change", (e) => {
    showGraph = e.target.checked;
    draw();
  });

  canvas.addEventListener("click", onCanvasClick);
  window.addEventListener("themechange", draw);
  window.addEventListener("resize", draw);

  resetMaze();
  setTab("create");
})();
