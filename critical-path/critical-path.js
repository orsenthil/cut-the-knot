"use strict";

/*
 * The page for Critical Path and Scheduling: drawing and input only; the rules
 * are in critical-path-core.js. Three steps in one column, in place of the
 * applet's three tabs:
 *   1. the project table (a row per task: name, duration, "comes after"),
 *      applied with the Apply button;
 *   2. the project digraph (SVG): Start, the tasks and End, laid out in columns
 *      by how long the longest chain before each is; nodes can be dragged (or
 *      moved with the arrow keys) and "Compute critical path" draws the longest
 *      chain in red;
 *   3. the schedule: the number of processors, a priority list, a timeline of
 *      one lane per processor; clicking the timeline (or the time box) shows
 *      what every task is doing at that moment.
 */

(function () {
  const Core = CriticalPathCore;
  const NS = "http://www.w3.org/2000/svg";
  const tableBody = document.getElementById("rows");
  const endRow = document.getElementById("endAfter");
  const problemsEl = document.getElementById("problems");
  const graphEl = document.getElementById("graph");
  const critBox = document.getElementById("critBox");
  const critText = document.getElementById("critText");
  const procsLess = document.getElementById("procsLess");
  const procsMore = document.getElementById("procsMore");
  const procsOut = document.getElementById("procsOut");
  const listIn = document.getElementById("listIn");
  const scheduleBtn = document.getElementById("scheduleBtn");
  const timelineEl = document.getElementById("timeline");
  const timeIn = document.getElementById("timeIn");
  const statesEl = document.getElementById("states");
  const statusEl = document.getElementById("status");
  const addBtn = document.getElementById("addBtn");
  const removeBtn = document.getElementById("removeBtn");
  const applyBtn = document.getElementById("applyBtn");
  const newBtn = document.getElementById("newBtn");
  const exampleBtn = document.getElementById("exampleBtn");

  let state = Core.start();
  let rows = state.tasks.map((t) => ({ name: t.name, duration: String(t.duration), after: t.after.join(",") })); // the editable text
  let selectedRow = -1;
  let sched = null; // the schedule made by the Schedule button
  let atTime = 0;
  let positions = {}; // node name -> {x, y} in 0..1, kept only by the page
  let layoutKey = "";

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const el = (name, attrs, text) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* ------------------------------------------------------------ the table */

  function renderTable() {
    tableBody.textContent = "";
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      if (i === selectedRow) tr.className = "selected";
      const mk = (field, label, type, width) => {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = type;
        input.value = r[field];
        input.setAttribute("aria-label", `${label}, task ${i + 1}`);
        if (field === "name") input.maxLength = 12;
        if (field === "duration") { input.min = "1"; input.step = "1"; input.inputMode = "numeric"; }
        input.className = "cell " + field;
        input.addEventListener("input", () => { r[field] = input.value; });
        input.addEventListener("focus", () => { selectedRow = i; markSelected(); });
        td.appendChild(input);
        return td;
      };
      tr.append(mk("name", "Task name", "text"), mk("duration", "Task duration", "number"), mk("after", "Comes after, task names separated by commas", "text"));
      tableBody.appendChild(tr);
    });
    const g = Core.graph(state.tasks, state.endAfter);
    endRow.textContent = state.tasks.length ? g.preds.get("End").join(", ") || "—" : "—";
  }

  function markSelected() {
    [...tableBody.children].forEach((tr, i) => tr.classList.toggle("selected", i === selectedRow));
  }

  function rowsToTasks() {
    return rows.map((r) => ({
      name: r.name.trim(),
      duration: /^\s*\d+\s*$/.test(r.duration) ? Number(r.duration) : NaN,
      after: r.after.split(/[ ,]+/).filter((s) => s.length),
    }));
  }

  function showProblems(list) {
    problemsEl.textContent = "";
    problemsEl.hidden = list.length === 0;
    list.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = (p.row >= 0 ? `Row ${p.row + 1}: ` : "") + p.text;
      problemsEl.appendChild(li);
    });
  }

  function apply() {
    const tasks = rowsToTasks();
    if (!tasks.length) { state = Core.move(state, { type: "new" }); sched = null; render(); say("The project is empty. Add some tasks."); return; }
    const problems = Core.check(tasks);
    showProblems(problems);
    if (problems.length) {
      if (problems[0].row >= 0) selectedRow = problems[0].row;
      renderTable();
      say("The table has a problem: " + problems[0].text);
      return;
    }
    state = Core.move(state, { type: "tasks", tasks });
    sched = null;
    atTime = 0;
    listIn.value = "";
    rows = state.tasks.map((t) => ({ name: t.name, duration: String(t.duration), after: t.after.join(",") }));
    render();
    say(`Project applied: ${state.tasks.length} tasks, critical path ${Core.criticalPath(state.tasks, state.endAfter).length} long.`);
  }

  addBtn.addEventListener("click", () => {
    rows.push({ name: "", duration: "1", after: "" });
    selectedRow = rows.length - 1;
    renderTable();
    const inputs = tableBody.querySelectorAll("tr:last-child input");
    if (inputs[0]) inputs[0].focus();
    say("A row was added. Fill it in and press Apply.");
  });
  removeBtn.addEventListener("click", () => {
    if (selectedRow < 0 || selectedRow >= rows.length) { say("Click a row first, then Remove task."); return; }
    rows.splice(selectedRow, 1);
    selectedRow = Math.min(selectedRow, rows.length - 1);
    renderTable();
    say("The row was removed. Press Apply to update the project.");
  });
  applyBtn.addEventListener("click", apply);
  newBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "new" });
    rows = [];
    selectedRow = -1;
    sched = null;
    listIn.value = "";
    showProblems([]);
    render();
    say("A new, empty project. Add tasks, then press Apply.");
  });
  exampleBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "example" });
    rows = state.tasks.map((t) => ({ name: t.name, duration: String(t.duration), after: t.after.join(",") }));
    selectedRow = -1;
    sched = null;
    atTime = 0;
    listIn.value = "";
    showProblems([]);
    render();
    say("The page's own project is back.");
  });

  /* ------------------------------------------------------------- the graph */

  /** Columns by how long the longest chain from Start to a node is (in steps), rows spread evenly. */
  function autoLayout() {
    const g = Core.graph(state.tasks, state.endAfter);
    const depth = new Map([["Start", 0]]);
    const d = (n) => {
      if (depth.has(n)) return depth.get(n);
      const v = 1 + Math.max(...g.preds.get(n).map(d));
      depth.set(n, v);
      return v;
    };
    d("End");
    const maxD = Math.max(...[...depth.values()]);
    state.tasks.forEach((t) => d(t.name));
    const cols = new Map();
    for (const [n, k] of depth) { if (!cols.has(k)) cols.set(k, []); cols.get(k).push(n); }
    const top = Math.max(...[...depth.values()], maxD);
    const pos = {};
    for (const [k, list] of cols) {
      list.forEach((n, i) => { pos[n] = { x: top ? 0.06 + (0.88 * (n === "End" ? top : k)) / top : 0.5, y: (i + 1) / (list.length + 1) }; });
    }
    pos.End.x = 0.94;
    return pos;
  }

  function ensureLayout() {
    const key = JSON.stringify([state.tasks, state.endAfter]);
    if (key !== layoutKey) { positions = autoLayout(); layoutKey = key; }
  }

  const W = 600, H = 300;

  function drawGraph() {
    ensureLayout();
    graphEl.textContent = "";
    const defs = el("defs", {});
    const mark = (id, cls) => {
      const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", class: cls }));
      defs.appendChild(m);
    };
    mark("arrow", "arrowhead"); mark("arrowcrit", "arrowhead crit");
    graphEl.appendChild(defs);
    const g = Core.graph(state.tasks, state.endAfter);
    const cp = state.showCritical && state.tasks.length ? Core.criticalPath(state.tasks, state.endAfter) : null;
    const onCrit = new Set();
    if (cp) for (let i = 1; i < cp.path.length; i++) onCrit.add(cp.path[i - 1] + ">" + cp.path[i]);
    const nodes = ["Start", ...state.tasks.map((t) => t.name), "End"];
    const R = 17;
    const px = (n) => positions[n].x * W, py = (n) => positions[n].y * H;
    const edgeLayer = el("g", {});
    graphEl.appendChild(edgeLayer);
    for (const n of nodes) {
      if (n === "Start") continue;
      for (const p of g.preds.get(n)) {
        const x1 = px(p), y1 = py(p), x2 = px(n), y2 = py(n);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
        const crit = onCrit.has(p + ">" + n);
        const line = el("line", { x1: x1 + ux * R, y1: y1 + uy * R, x2: x2 - ux * (R + 3), y2: y2 - uy * (R + 3), class: "edge" + (crit ? " crit" : ""), "marker-end": crit ? "url(#arrowcrit)" : "url(#arrow)" });
        edgeLayer.appendChild(line);
      }
    }
    for (const n of nodes) {
      const grp = el("g", { class: "node" + (n === "Start" || n === "End" ? " end" : "") + (cp && cp.path.includes(n) ? " crit" : ""), tabindex: 0, role: "button", "aria-label": nodeLabel(n), transform: `translate(${px(n)},${py(n)})`, "data-node": n });
      grp.appendChild(el("circle", { r: R }));
      const task = state.tasks.find((t) => t.name === n);
      if (task) {
        grp.appendChild(el("text", { y: -2, class: "nm" }, n));
        grp.appendChild(el("text", { y: 11, class: "du" }, String(task.duration)));
      } else {
        grp.appendChild(el("text", { y: 4, class: "se" }, n));
      }
      attachDrag(grp, n);
      graphEl.appendChild(grp);
    }
    critText.textContent = cp ? `Critical path: ${cp.path.filter((n) => n !== "Start" && n !== "End").join(" → ")}, total ${cp.length}. Nothing can finish the project sooner.` : state.tasks.length ? "Tick the box to show the critical path." : "";
  }

  function nodeLabel(n) {
    const task = state.tasks.find((t) => t.name === n);
    return task ? `Task ${n}, duration ${task.duration}, comes after ${task.after.join(" and ") || "Start"}. Drag or use the arrow keys to move it.` : `${n} node. Drag or use the arrow keys to move it.`;
  }

  function attachDrag(grp, n) {
    let drag = null;
    const toUnits = (e) => {
      const r = graphEl.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    const place = (x, y) => {
      positions[n] = { x: Math.max(0.04, Math.min(0.96, x / W)), y: Math.max(0.08, Math.min(0.92, y / H)) };
      drawGraph();
      const again = graphEl.querySelector(`[data-node="${n}"]`);
      if (again) again.focus();
    };
    grp.addEventListener("pointerdown", (e) => {
      drag = true;
      grp.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grp.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = toUnits(e);
      positions[n] = { x: Math.max(0.04, Math.min(0.96, p.x / W)), y: Math.max(0.08, Math.min(0.92, p.y / H)) };
      grp.setAttribute("transform", `translate(${positions[n].x * W},${positions[n].y * H})`);
    });
    const stop = () => { if (drag) { drag = null; drawGraph(); const again = graphEl.querySelector(`[data-node="${n}"]`); if (again) again.focus(); } };
    grp.addEventListener("pointerup", stop);
    grp.addEventListener("pointercancel", stop);
    grp.addEventListener("keydown", (e) => {
      const d = { arrowleft: [-12, 0], arrowright: [12, 0], arrowup: [0, -12], arrowdown: [0, 12] }[e.key.toLowerCase()];
      if (!d) return;
      e.preventDefault();
      place(positions[n].x * W + d[0], positions[n].y * H + d[1]);
    });
  }

  critBox.addEventListener("change", () => {
    state = Core.move(state, { type: "critical", value: critBox.checked });
    render();
    say(critBox.checked ? critText.textContent : "Critical path hidden.", Core.result(state));
  });

  /* ------------------------------------------------------------- the schedule */

  function renderSchedule() {
    procsOut.textContent = String(state.procs);
    procsLess.disabled = state.procs <= Core.MIN_PROCS;
    procsMore.disabled = state.procs >= Core.MAX_PROCS;
    timelineEl.textContent = "";
    statesEl.textContent = "";
    if (!sched) {
      timelineEl.setAttribute("viewBox", "0 0 400 40");
      timelineEl.appendChild(el("text", { x: 8, y: 24, class: "hintsvg" }, "Enter a priority list and press Schedule."));
      timelineEl.setAttribute("aria-label", "Timeline: no schedule yet");
      timeIn.disabled = true;
      return;
    }
    const np = sched.np, lane = 30, left = 34, unit = Math.max(8, Math.min(26, 520 / Math.max(10, sched.finish)));
    const w = left + (sched.finish + 1) * unit + 8, h = np * lane + 28;
    timelineEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
    timelineEl.setAttribute("aria-label", `Timeline of ${np} processors, finishing at time ${sched.finish}`);
    for (let p = 0; p < np; p++) {
      timelineEl.appendChild(el("text", { x: 4, y: p * lane + lane / 2 + 5, class: "lane" }, "P" + (p + 1)));
      timelineEl.appendChild(el("line", { x1: left, x2: left + sched.finish * unit, y1: (p + 1) * lane, y2: (p + 1) * lane, class: "laneline" }));
    }
    const step = Math.max(1, Math.ceil(30 / unit));
    for (let t = 0; t <= sched.finish; t += step) {
      timelineEl.appendChild(el("line", { x1: left + t * unit, x2: left + t * unit, y1: np * lane, y2: np * lane + 4, class: "tick" }));
      timelineEl.appendChild(el("text", { x: left + t * unit, y: np * lane + 18, class: "tickn" }, String(t)));
    }
    sched.processors.forEach((row, p) => row.forEach((t) => {
      const g = el("g", { class: "block" });
      g.appendChild(el("rect", { x: left + t.start * unit + 1, y: p * lane + 3, width: Math.max(2, (t.end - t.start) * unit - 2), height: lane - 6, rx: 4 }));
      g.appendChild(el("text", { x: left + ((t.start + t.end) / 2) * unit, y: p * lane + lane / 2 + 5, class: "bn" }, t.name));
      timelineEl.appendChild(g);
    }));
    timelineEl.appendChild(el("line", { x1: left + atTime * unit, x2: left + atTime * unit, y1: 0, y2: np * lane, class: "now" }));
    timelineEl.dataset.left = String(left);
    timelineEl.dataset.unit = String(unit);
    timelineEl.dataset.w = String(w);
    timeIn.disabled = false;
    timeIn.max = String(sched.finish);
    timeIn.value = String(atTime);
    // What every task is doing at that moment.
    Core.statesAt(state.tasks, sched, atTime).forEach((s) => {
      const li = document.createElement("li");
      li.className = "st " + s.state;
      li.textContent = `${s.name}: ${s.state}`;
      statesEl.appendChild(li);
    });
  }

  function makeSchedule() {
    const parsed = Core.parseList(listIn.value, state.tasks);
    state = Core.move(state, { type: "list", value: listIn.value });
    if (!state.tasks.length) { sched = null; renderSchedule(); say("There are no tasks to schedule."); return; }
    if (!parsed.ok) {
      sched = null;
      renderSchedule();
      say(`The priority list must name every task. Missing: ${parsed.missing.join(", ")}.`);
      return;
    }
    sched = Core.schedule(state.tasks, state.procs, parsed.list);
    atTime = 0;
    render();
    const cp = Core.criticalPath(state.tasks, state.endAfter).length;
    say(`Schedule made: the project finishes at time ${sched.finish} on ${state.procs} processors (the critical path is ${cp}${sched.finish === cp ? ", so no schedule could do better" : ""}).`, Core.result(state));
  }

  scheduleBtn.addEventListener("click", makeSchedule);
  listIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); makeSchedule(); } });
  procsLess.addEventListener("click", () => bump(-1));
  procsMore.addEventListener("click", () => bump(1));
  function bump(d) {
    const next = Core.move(state, { type: "procs", value: state.procs + d });
    if (!next) return;
    state = next;
    sched = null; // as in the applet, a change of processors clears the schedule
    render();
    say(`${state.procs} processors. Press Schedule to see the new timeline.`);
  }
  timelineEl.addEventListener("click", (e) => {
    if (!sched) return;
    const r = timelineEl.getBoundingClientRect();
    const w = Number(timelineEl.dataset.w), left = Number(timelineEl.dataset.left), unit = Number(timelineEl.dataset.unit);
    const x = ((e.clientX - r.left) / r.width) * w;
    setTime(Math.round((x - left) / unit));
  });
  timeIn.addEventListener("change", () => setTime(Math.trunc(Number(timeIn.value))));
  function setTime(t) {
    atTime = Math.max(0, Math.min(sched ? sched.finish : 0, Number.isFinite(t) ? t : 0));
    renderSchedule();
    say(`At time ${atTime}: ${Core.statesAt(state.tasks, sched, atTime).map((s) => `${s.name} ${s.state}`).join(", ")}.`);
  }

  /* ---------------------------------------------------------------- the page */

  function render() {
    renderTable();
    drawGraph();
    critBox.checked = state.showCritical;
    renderSchedule();
    if (window.Track) window.Track.state({ ...state, scheduled: !!sched, finish: sched ? sched.finish : null });
  }

  window.addEventListener("themechange", render);
  render();
})();
