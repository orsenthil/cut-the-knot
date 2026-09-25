"use strict";

/*
 * Shared chrome for every coolmaths page. Load it in <head> (after games.js)
 * so the saved theme applies before the page paints. It then adds the header
 * (logo, "All games", theme toggle), the footer, and, on a game page
 * (<body data-game="slug">), that game's concept tags under the title.
 *
 * Pages that draw with colours from CSS (like a canvas) can listen for the
 * "themechange" event on window and redraw.
 */

(function () {
  const ROOT = new URL("../", document.currentScript.src).href;
  const KEY = "coolmaths-theme";
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function storedTheme() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  function currentTheme() {
    return document.documentElement.dataset.theme || (media.matches ? "dark" : "light");
  }

  applyTheme(storedTheme());

  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {
      // private windows may block storage; the toggle still works for this page
    }
    window.dispatchEvent(new Event("themechange"));
  }

  media.addEventListener("change", () => {
    if (!document.documentElement.dataset.theme) window.dispatchEvent(new Event("themechange"));
  });

  function el(tag, attrs, html) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  const SUN =
    '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON =
    '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>';

  function tagLabel(slug) {
    const tags = (window.COOLMATHS && window.COOLMATHS.tags) || {};
    return tags[slug] || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function tagLink(slug) {
    const a = el("a", { class: "tag", href: ROOT + "index.html#" + slug });
    a.textContent = tagLabel(slug);
    return a;
  }

  function buildHeader() {
    const header = el("header", { class: "site-header" });
    header.innerHTML =
      `<a class="brand" href="${ROOT}index.html" aria-label="coolmaths home">` +
      `<img class="logo-light" src="${ROOT}assets/logo-light-sm.webp" alt="coolmaths">` +
      `<img class="logo-dark" src="${ROOT}assets/logo-dark-sm.webp" alt="coolmaths">` +
      `</a>` +
      `<nav><a href="${ROOT}index.html">All games</a></nav>`;
    const toggle = el("button", { class: "theme-toggle", type: "button", "aria-label": "Switch light or dark theme" }, SUN + MOON);
    toggle.addEventListener("click", toggleTheme);
    header.querySelector("nav").appendChild(toggle);
    document.body.prepend(header);
  }

  function buildFooter() {
    const footer = el("footer", { class: "site-footer" });
    footer.innerHTML =
      "Puzzles from <a href=\"https://www.cut-the-knot.org/\" target=\"_blank\" rel=\"noopener\">cut-the-knot.org</a> " +
      "by Alexander Bogomolny, rebuilt for the modern web.<br>" +
      "coolmaths logo by Harini Vardhan.";
    document.body.appendChild(footer);
  }

  function addGameTags() {
    const slug = document.body.dataset.game;
    const games = (window.COOLMATHS && window.COOLMATHS.games) || [];
    const game = games.find((g) => g.slug === slug);
    const h1 = document.querySelector("h1");
    if (!game || !h1) return;
    const row = el("div", { class: "tags game-tags", "aria-label": "Concepts" });
    game.tags.forEach((t) => row.appendChild(tagLink(t)));
    h1.after(row);
  }

  window.COOLMATHS_SITE = { root: ROOT, tagLabel, tagLink, currentTheme };

  document.addEventListener("DOMContentLoaded", () => {
    buildHeader();
    addGameTags();
    buildFooter();
  });
})();
