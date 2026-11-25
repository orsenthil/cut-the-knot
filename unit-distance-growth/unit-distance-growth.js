"use strict";

/*
 * The page for How Fast Do Unit Distances Grow?: drawing and input only. The
 * chart is log10(n) across and log10(pairs) up. The purple line is the best
 * grid for k = 2 up to the slider; the dashed curve is the proved ceiling;
 * the thin lines are slope guides from the first point.
 */

(function () {
  const Core = UnitGrowthCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const kEl = document.getElementById("k");
  const kOut = document.getElementById("kOut");
  const W = canvas.width, H = canvas.height, L = 92, R = 16, T = 18, B = 46;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const TABLE = Core.table(Core.MAX_K);
  const XMAX = Math.log10(Core.MAX_K * Core.MAX_K), YMAX = Math.log10(Core.ceiling(Core.MAX_K * Core.MAX_K));
  const fx = (n) => L + (Math.log10(n) / XMAX) * (W - L - R);
  const fy = (v) => T + (1 - Math.log10(v) / YMAX) * (H - T - B);
  const GUIDE_COLOURS = ["--muted", "--bad", "--good"];

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function draw(k) {
    ctx.clearRect(0, 0, W, H);
    ctx.font = "20px system-ui, sans-serif"; ctx.fillStyle = css("--muted"); ctx.strokeStyle = css("--border-strong"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
    ctx.textAlign = "right";
    for (const v of [10, 100, 1000, 10000]) if (Math.log10(v) <= YMAX) ctx.fillText(v.toLocaleString("en"), L - 8, fy(v) + 7);
    ctx.textAlign = "center";
    for (const v of [10, 100, 1000]) ctx.fillText(v.toLocaleString("en"), fx(v), H - 22);
    ctx.fillText("points n", (L + W - R) / 2, H - 2);
    // slope guides, from the first data point
    const p0 = TABLE[0];
    Core.SLOPES.forEach((g, i) => {
      ctx.strokeStyle = css(GUIDE_COLOURS[i]); ctx.lineWidth = i === 2 ? 3 : 1.5; ctx.setLineDash(i === 2 ? [3, 5] : []); ctx.beginPath();
      ctx.moveTo(fx(p0.n), fy(p0.count));
      const nEnd = Core.MAX_K * Core.MAX_K;
      ctx.lineTo(fx(nEnd), fy(p0.count * Math.pow(nEnd / p0.n, g.s))); ctx.stroke(); ctx.setLineDash([]);
    });
    // the proved ceiling
    ctx.setLineDash([8, 6]); ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; ctx.beginPath();
    for (let e = 0; e <= 40; e++) { const n = Math.pow(10, (XMAX * e) / 40); e ? ctx.lineTo(fx(Math.max(n, 4)), fy(Core.ceiling(Math.max(n, 4)))) : ctx.moveTo(fx(4), fy(Core.ceiling(4))); }
    ctx.stroke(); ctx.setLineDash([]);
    // the best grid
    ctx.strokeStyle = css("--accent"); ctx.lineWidth = 4; ctx.beginPath();
    TABLE.filter((r) => r.k <= k).forEach((r, i) => (i ? ctx.lineTo(fx(r.n), fy(r.count)) : ctx.moveTo(fx(r.n), fy(r.count))));
    ctx.stroke();
    const cur = TABLE[k - 2];
    ctx.fillStyle = css("--accent"); ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx(cur.n), fy(cur.count), 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  }

  function update() {
    const k = Core.clampK(kEl.value), r = TABLE[k - 2];
    kOut.textContent = k;
    readout.textContent = `${k} × ${k} grid = ${r.n.toLocaleString("en")} points, best spacing 1/√${r.c2}: ${r.count.toLocaleString("en")} unit pairs\n` +
      `pairs per point ${(r.count / r.n).toFixed(2)} · exponent log(pairs)/log(n) = ${Core.exponent(r.count, r.n).toFixed(3)}\n` +
      `proved ceiling for ${r.n.toLocaleString("en")} points: ${Math.floor(Core.ceiling(r.n)).toLocaleString("en")}\n` +
      Core.SLOPES.map((g, i) => `${["grey", "red", "green"][i]} line: ${g.name}`).join(" · ");
    draw(k);
    if (k === Core.MAX_K) say("The grid exponent is still near 1.25. The new construction's exponent (at least 1.014) only shows for huge n.", "done");
    else say("", null);
    if (typeof Track !== "undefined" && Track.state) Track.state({ k, n: r.n, c2: r.c2, count: r.count });
  }

  kEl.addEventListener("input", update);
  document.getElementById("resetBtn").addEventListener("click", () => { kEl.value = 16; update(); });
  window.addEventListener("themechange", update);
  update();
})();
