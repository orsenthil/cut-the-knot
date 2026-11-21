"use strict";

/* Browser UI: a task digraph, its critical path and a processor schedule. */
(() => {
  const C = CriticalPathSchedulingCore;
  const svg = document.getElementById("board");
  const gantt = document.getElementById("gantt");
  const status = document.getElementById("status");
  const presetSel = document.getElementById("presetSel");
  const procSel = document.getElementById("procSel");
  const priorityEl = document.getElementById("priority");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;

  const el = (name, attrs) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  function positions(graph) {
    const order = C.topological(graph);
    const level = { Start: 0 };
    for (const id of order) {
      const ps = C.preds(graph, id);
      level[id] = ps.length ? Math.max(...ps.map((p) => (level[p] ?? 0) + 1)) : 0;
    }
    const byLevel = {};
    const pos = {};
    for (const id of order) {
      const l = level[id];
      (byLevel[l] ||= []).push(id);
      const index = byLevel[l].length - 1;
      pos[id] = { x: 45 + l * 105, y: 45 + index * 62 };
    }
    return { pos, width: 90 + Math.max(...Object.values(level)) * 105, height: 60 + Math.max(...Object.values(byLevel).map((a) => a.length)) * 62 };
  }

  function render() {
    svg.replaceChildren();
    const r = C.analyze(state);
    const { pos, width, height } = positions(state);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const onPath = new Set(r.critical.path);

    state.edges.forEach(([from, to]) => {
      const a = pos[from]; const b = pos[to];
      const line = el("line", {
        x1: a.x, y1: a.y, x2: b.x - 18, y2: b.y,
        class: "edge" + (onPath.has(from) && onPath.has(to) ? " critical" : ""),
        "marker-end": "url(#arrow)",
      });
      svg.appendChild(line);
    });
    const defs = el("defs", {});
    const marker = el("marker", { id: "arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" });
    marker.appendChild(el("path", { d: "M0,0 L10,5 L0,10 z", class: "arrowhead" }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    state.tasks.forEach((task) => {
      const p = pos[task.id];
      const special = task.id === "Start" || task.id === "End";
      const g = el("g", { class: "node" + (onPath.has(task.id) ? " critical" : "") + (special ? " special" : "") });
      g.setAttribute("aria-label", `${task.id}, ${special ? "special" : `duration ${task.duration}`}${onPath.has(task.id) ? ", on the critical path" : ""}`);
      g.appendChild(el("circle", { cx: p.x, cy: p.y, r: 17 }));
      const label = el("text", { x: p.x, y: p.y + 4 });
      label.textContent = task.id;
      g.appendChild(label);
      if (!special) {
        const dur = el("text", { x: p.x, y: p.y + 28, class: "duration" });
        dur.textContent = `d=${task.duration}`;
        g.appendChild(dur);
      }
      svg.appendChild(g);
    });

    priorityEl.replaceChildren();
    state.priority.forEach((id, i) => {
      const row = document.createElement("div");
      row.className = "priority-row";
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "▲";
      up.setAttribute("aria-label", `Move ${id} earlier in the priority list`);
      up.disabled = i === 0;
      up.addEventListener("click", () => { state = C.reorderPriority(state, i, -1); render(); });
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "▼";
      down.setAttribute("aria-label", `Move ${id} later in the priority list`);
      down.disabled = i === state.priority.length - 1;
      down.addEventListener("click", () => { state = C.reorderPriority(state, i, 1); render(); });
      const label = document.createElement("span");
      label.textContent = `${i + 1}. ${id}`;
      row.append(up, label, down);
      priorityEl.appendChild(row);
    });

    gantt.replaceChildren();
    const scale = 100 / Math.max(1, r.schedule.makespan, r.critical.length);
    for (let p = 0; p < state.processors; p++) {
      const row = document.createElement("div");
      row.className = "gantt-row";
      const label = document.createElement("span");
      label.className = "gantt-label";
      label.textContent = `P${p + 1}`;
      row.appendChild(label);
      const track = document.createElement("span");
      track.className = "gantt-track";
      r.schedule.assignments.filter((a) => a.processor === p).forEach((a) => {
        const bar = document.createElement("span");
        bar.className = "gantt-bar" + (r.critical.path.includes(a.task) ? " critical" : "");
        bar.style.left = `${a.start * scale}%`;
        bar.style.width = `${Math.max(2, (a.finish - a.start) * scale)}%`;
        bar.textContent = a.task;
        bar.title = `${a.task}: ${a.start}–${a.finish}`;
        track.appendChild(bar);
      });
      row.appendChild(track);
      gantt.appendChild(row);
    }

    presetSel.value = state.preset;
    procSel.value = String(state.processors);
    status.textContent = `Critical path ${r.critical.path.join(" → ")} takes ${r.critical.length}. The ${state.processors}-processor schedule finishes in ${r.schedule.makespan}.`;
    status.className = r.schedule.makespan === r.critical.length ? "win" : "done";
    if (window.Track) window.Track.state({
      preset: state.preset, processors: state.processors, priority: state.priority.slice(),
      criticalLength: r.critical.length, criticalPath: r.critical.path.slice(), makespan: r.schedule.makespan,
    });
  }

  presetSel.addEventListener("change", () => { state = C.setPreset(state, presetSel.value); render(); });
  procSel.addEventListener("change", () => { state = C.setProcessors(state, Number(procSel.value)); render(); });

  for (const name of Object.keys(C.PRESETS)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name === "merge" ? "Merge tasks" : name === "parallel" ? "Parallel tasks" : "Two branches";
    presetSel.appendChild(option);
  }
  state = C.start();
  render();
})();
