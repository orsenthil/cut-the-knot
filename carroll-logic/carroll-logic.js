"use strict";

/*
 * Lewis Carroll's Game of Logic - the page.
 *
 * The diagrams' rules live in carroll-logic-core.js; this file draws them.
 * The applet dragged counters from a two-counter palette onto its bilateral
 * diagrams; here you pick red or grey and tap a box or a line. Every change
 * rebuilds the trilateral diagram from the two premises and reads the
 * conclusion off it, as the applet's Received() and GetNW()... did, and the
 * three bilateral diagrams list what they say in words, using the names you
 * give x, y and m. The applet's twelve trilateral diagrams, for chaining a
 * long sorites, are reduced to one: one syllogism at a time.
 */

(() => {
  const L = CarrollLogicCore;
  const { EMPTY, RED, GREY } = L;
  const SVG = "http://www.w3.org/2000/svg";

  const svgA = document.getElementById("premA");
  const svgB = document.getElementById("premB");
  const svgT = document.getElementById("tri");
  const svgC = document.getElementById("concl");
  const nameX = document.getElementById("nameX");
  const nameY = document.getElementById("nameY");
  const nameM = document.getElementById("nameM");
  const statusEl = document.getElementById("status");

  let premA = L.blank(8);
  let premB = L.blank(8);

  const el = (name, attrs) => {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const chipPicked = () => Number(document.querySelector('input[name="chip"]:checked').value);
  const names = () => ({ x: nameX.value.trim() || "x", y: nameY.value.trim() || "y", m: nameM.value.trim() || "m" });
  const say = (text, cls) => { statusEl.textContent = text; statusEl.className = cls || ""; };

  // Bilateral geometry: the square 40..180, cells 0 TL, 1 TR, 2 BR, 3 BL.
  const S = 40;
  const D = 70;
  const CELL_CENTRE = [[S + D / 2, S + D / 2], [S + 1.5 * D, S + D / 2], [S + 1.5 * D, S + 1.5 * D], [S + D / 2, S + 1.5 * D]];
  // Lines 4 left (0|3), 5 top (0|1), 6 right (1|2), 7 bottom (3|2): a chip sits at the line's middle.
  const LINE_CENTRE = { 4: [S + D / 2, S + D], 5: [S + D, S + D / 2], 6: [S + 1.5 * D, S + D], 7: [S + D, S + 1.5 * D] };

  /** A caption; row captions run up the left side so long names fit. Long names are shortened. */
  function label(svg, x, y, text, vertical = false) {
    const t = text.length > 11 ? text.slice(0, 10) + "…" : text;
    const e = el("text", { x, y, class: "label" });
    if (vertical) e.setAttribute("transform", `rotate(-90 ${x} ${y})`);
    e.textContent = t;
    svg.appendChild(e);
  }

  function drawChip(svg, [x, y], v, r = 12) {
    if (v === RED) svg.appendChild(el("circle", { cx: x, cy: y, r, class: "chip red" }));
    if (v === GREY) svg.appendChild(el("circle", { cx: x, cy: y, r, class: "chip grey" }));
  }

  function bilateral(svg, pos, rowName, colName, editable) {
    svg.replaceChildren();
    svg.appendChild(el("rect", { x: S, y: S, width: 2 * D, height: 2 * D, rx: 4, class: "frame" }));
    svg.appendChild(el("line", { x1: S + D, y1: S, x2: S + D, y2: S + 2 * D, class: "mid" }));
    svg.appendChild(el("line", { x1: S, y1: S + D, x2: S + 2 * D, y2: S + D, class: "mid" }));
    label(svg, S + D / 2, S - 14, colName);
    label(svg, S + 1.5 * D, S - 14, "non-" + colName);
    label(svg, S - 14, S + D / 2, rowName, true);
    label(svg, S - 14, S + 1.5 * D, "non-" + rowName, true);
    for (let c = 0; c < 4; c++) drawChip(svg, CELL_CENTRE[c], pos[c]);
    for (const p of [4, 5, 6, 7]) drawChip(svg, LINE_CENTRE[p], pos[p], 10);
    if (!editable) return;
    const place = (p, [x, y], w, h, label) => {
      if (pos[p] !== EMPTY) return;
      const hit = el("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, class: "hit", tabindex: "0", role: "button", "aria-label": label });
      const ghost = el("circle", { cx: x, cy: y, r: p < 4 ? 12 : 10, class: "ghost " + (chipPicked() === RED ? "red" : "grey") });
      const go = () => {
        const res = L.biPlace(pos, p, chipPicked());
        say(res.note, "");
        render();
      };
      hit.addEventListener("click", go);
      hit.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      svg.appendChild(hit);
      svg.appendChild(ghost);
    };
    const words = [[rowName, colName], [rowName, "non-" + colName], ["non-" + rowName, "non-" + colName], ["non-" + rowName, colName]];
    for (let c = 0; c < 4; c++) place(c, CELL_CENTRE[c], D - 28, D - 28, `Box ${words[c][0]} and ${words[c][1]}`);
    const lineLabel = { 4: `Line between ${rowName} and non-${rowName}, under ${colName}`, 5: `Line between ${colName} and non-${colName}, beside ${rowName}`,
      6: `Line between ${rowName} and non-${rowName}, under non-${colName}`, 7: `Line between ${colName} and non-${colName}, beside non-${rowName}` };
    for (const p of [4, 5, 6, 7]) {
      const vertical = p === 5 || p === 7;
      place(p, LINE_CENTRE[p], vertical ? 22 : D - 28, vertical ? D - 28 : 22, lineLabel[p]);
    }
  }

  // Trilateral geometry: quadrants NW x y, NE x y', SE x' y', SW x' y; inner square = m.
  const T0 = 20;
  const T = 160;
  const I0 = 60;
  const IS = 80;
  const TRI_POS = {
    0: [T0 + 20, T0 + 20], 2: [T0 + T - 20, T0 + 20], 4: [T0 + T - 20, T0 + T - 20], 6: [T0 + 20, T0 + T - 20],
    8: [I0 + 20, I0 + 20], 10: [I0 + IS - 20, I0 + 20], 12: [I0 + IS - 20, I0 + IS - 20], 14: [I0 + 20, I0 + IS - 20],
    1: [T0 + T / 2, T0 + 20], 3: [T0 + T - 20, T0 + T / 2], 5: [T0 + T / 2, T0 + T - 20], 7: [T0 + 20, T0 + T / 2],
    9: [I0 + IS / 2, I0 + 20], 11: [I0 + IS - 20, I0 + IS / 2], 13: [I0 + IS / 2, I0 + IS - 20], 15: [I0 + 20, I0 + IS / 2],
  };

  function trilateral(tri, n) {
    svgT.replaceChildren();
    svgT.appendChild(el("rect", { x: T0, y: T0, width: T, height: T, rx: 4, class: "frame" }));
    svgT.appendChild(el("rect", { x: I0, y: I0, width: IS, height: IS, class: "inner" }));
    svgT.appendChild(el("line", { x1: T0 + T / 2, y1: T0, x2: T0 + T / 2, y2: T0 + T, class: "mid" }));
    svgT.appendChild(el("line", { x1: T0, y1: T0 + T / 2, x2: T0 + T, y2: T0 + T / 2, class: "mid" }));
    label(svgT, T0 + T / 4, T0 - 10, n.y);
    label(svgT, T0 + 0.75 * T, T0 - 10, "non-" + n.y);
    label(svgT, T0 - 10, T0 + T / 4, n.x, true);
    label(svgT, T0 - 10, T0 + 0.75 * T, "non-" + n.x, true);
    // The inner square's name sits on its top edge, clear of the counters inside.
    const tag = el("text", { x: T0 + T / 2, y: I0 - 7, class: "label" });
    tag.textContent = "inner: " + (n.m.length > 12 ? n.m.slice(0, 11) + "…" : n.m);
    svgT.appendChild(tag);
    for (const [p, xy] of Object.entries(TRI_POS)) drawChip(svgT, xy, tri[p], Number(p) % 2 ? 8 : 10);
    svgT.setAttribute("aria-label", `Trilateral diagram: rows ${n.x} and non-${n.x}, columns ${n.y} and non-${n.y}, inner square ${n.m}`);
  }

  function list(id, items) {
    const ul = document.getElementById(id);
    ul.textContent = "";
    for (const t of items) {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    }
  }

  function render() {
    const n = names();
    document.getElementById("titleA").textContent = `First fact: ${n.x} and ${n.m}`;
    document.getElementById("titleB").textContent = `Second fact: ${n.y} and ${n.m}`;
    document.getElementById("titleC").textContent = `So we know: ${n.x} and ${n.y}`;
    bilateral(svgA, premA, n.x, n.m, true);
    bilateral(svgB, premB, n.y, n.m, true);
    svgA.setAttribute("aria-label", `First fact, about ${n.x} and ${n.m}`);
    svgB.setAttribute("aria-label", `Second fact, about ${n.y} and ${n.m}`);
    list("saysA", L.sentences(premA.slice(0, 4), n.x, n.m));
    list("saysB", L.sentences(premB.slice(0, 4), n.y, n.m));
    const ok = L.consistent(premA, premB);
    const tri = L.trilateral(premA, premB);
    trilateral(tri, n);
    const concl = ok ? L.conclusion(tri) : [EMPTY, EMPTY, EMPTY, EMPTY];
    bilateral(svgC, [...concl, 0, 0, 0, 0], n.x, n.y, false);
    const facts = L.sentences(concl, n.x, n.y);
    list("saysC", ok ? (facts.length ? facts : ["Nothing follows yet."]) : []);
    if (!ok) say("These two facts contradict each other: no world fits both.", "lose");
  }

  function clearA() { premA = L.blank(8); say("", ""); render(); }
  function clearB() { premB = L.blank(8); say("", ""); render(); }

  document.getElementById("clearA").addEventListener("click", clearA);
  document.getElementById("clearB").addEventListener("click", clearB);
  document.getElementById("resetBtn").addEventListener("click", () => {
    premA = L.blank(8);
    premB = L.blank(8);
    nameX.value = "x";
    nameY.value = "y";
    nameM.value = "m";
    say("", "");
    render();
  });
  document.getElementById("sampleBtn").addEventListener("click", () => {
    // Carroll: No professors are ignorant; all ignorant people are vain.
    nameX.value = "professors";
    nameY.value = "vain";
    nameM.value = "ignorant";
    premA = L.blank(8);
    premB = L.blank(8);
    L.biPlace(premA, 0, GREY); // no professors are ignorant
    L.biPlace(premB, 0, RED); // some ignorant are vain ...
    L.biPlace(premB, 3, GREY); // ... and no ignorant are non-vain: all ignorant are vain
    say("", "");
    render();
  });
  for (const input of [nameX, nameY, nameM]) input.addEventListener("input", render);
  for (const r of document.querySelectorAll('input[name="chip"]')) r.addEventListener("change", render);

  render();
})();
