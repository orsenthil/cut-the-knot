"use strict";

/*
 * The page for Distance Between Strings: drawing and input only; the
 * distances are in string-distance-core.js. Two text boxes hold the strings;
 * "Do it!" adds a line with the distance to the list, as the applet's list
 * did. For the Levenshtein distance the page also shows the table d(i, j)
 * with one cheapest path through it, and the edits that path stands for.
 */

(function () {
  const Core = StringDistanceCore;
  const sIn = document.getElementById("sIn");
  const tIn = document.getElementById("tIn");
  const caseBox = document.getElementById("caseBox");
  const listEl = document.getElementById("list");
  const tableEl = document.getElementById("table");
  const statusEl = document.getElementById("status");

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  const method = () => document.querySelector('input[name="method"]:checked').value;

  function showTable(s, t) {
    tableEl.textContent = "";
    if (method() !== "levenshtein" || s.length > 20 || t.length > 20) return;
    const d = Core.table(s, t, caseBox.checked);
    // cells on the path
    const path = new Set(), al = Core.alignment(s, t, caseBox.checked);
    let i = 0, j = 0;
    path.add("0,0");
    for (const [k] of al) { if (k !== "insert") i++; if (k !== "delete") j++; path.add(`${i},${j}`); }
    const tb = document.createElement("table");
    const cap = document.createElement("p");
    cap.className = "cap";
    cap.textContent = "d(i, j): the edits needed to turn the first i letters of the first string into the first j of the second.";
    tableEl.appendChild(cap);
    const hr = tb.insertRow();
    hr.appendChild(document.createElement("th"));
    hr.appendChild(document.createElement("th"));
    for (const ch of t) { const th = document.createElement("th"); th.textContent = ch; th.scope = "col"; hr.appendChild(th); }
    d.forEach((row, r) => {
      const tr = tb.insertRow();
      const th = document.createElement("th"); th.scope = "row"; th.textContent = r ? s[r - 1] : ""; tr.appendChild(th);
      row.forEach((v, c) => { const td = tr.insertCell(); td.textContent = String(v); if (path.has(`${r},${c}`)) td.className = "path"; });
    });
    tableEl.appendChild(tb);
    const ed = Core.edits(s, t, caseBox.checked);
    const p = document.createElement("p");
    p.className = "edits";
    p.textContent = ed.length ? `One shortest way: ${ed.join("; ")}.` : "The strings are the same.";
    tableEl.appendChild(p);
  }

  function render() {
    listEl.textContent = "";
    for (const line of state.lines) { const li = document.createElement("li"); li.textContent = line; listEl.appendChild(li); }
    listEl.scrollTop = listEl.scrollHeight;
    if (window.Track) window.Track.state({ s: state.s, t: state.t, method: state.method, caseSensitive: state.caseSensitive, lines: state.lines.slice(-10) });
  }

  function doIt() {
    state = { ...state, method: method(), caseSensitive: caseBox.checked };
    const before = state.lines.length;
    state = Core.doIt(state, sIn.value, tIn.value);
    render();
    showTable(sIn.value, tIn.value);
    const added = state.lines.slice(before);
    say(added.join(" "));
  }

  document.getElementById("doBtn").addEventListener("click", doIt);
  [sIn, tIn].forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doIt(); } }));
  document.getElementById("clearBtn").addEventListener("click", () => { state = { ...state, lines: [] }; render(); tableEl.textContent = ""; say("Type two strings and press Do it!"); });

  render();
  say("Type two strings and press Do it!");
})();
