"use strict";

/*
 * Reads the applet inventory out of classes.zip without unpacking it into the
 * repo. Only classes.zip is checked in (see CLAUDE.md), so every tool that needs
 * to know what applets exist goes through here.
 *
 * What counts as an applet: a .jar or .zip under classes/. Some applets ship
 * both (RFWH.jar and RFWH.zip hold the same classes, the .jar adds signed
 * META-INF and Images/), so they are grouped under one name and the .jar wins as
 * the canonical archive. A handful live one level down (classes/FourByFour/,
 * classes/ThreeD/) and are picked up too.
 *
 * The loose classes/*.class files are shared helper classes (CTK*, Doub*,
 * banner*, mouseTracker, ...) rather than applets, so they are dropped.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ARCHIVE_RE = /^classes\/(?:[^/]+\/)?[^/]+\.(?:jar|zip)$/;

/** Every applet archive path inside classes.zip, e.g. "classes/RFWH.jar". */
export function listArchivePaths(repo) {
  const out = execFileSync("unzip", ["-Z1", join(repo, "classes.zip")], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => ARCHIVE_RE.test(s) && !s.startsWith("classes/Images/"));
}

/** Applet name from an archive path: "classes/ThreeD/Gears.zip" -> "Gears". */
export function appletName(path) {
  return path.split("/").pop().replace(/\.(jar|zip)$/, "");
}

/** Sorted unique applet names. */
export function listAppletNames(repo) {
  return [...new Set(listArchivePaths(repo).map(appletName))].sort((a, b) =>
    a.localeCompare(b, "en"),
  );
}

/**
 * Full inventory: one record per applet name, with the class names and image
 * files found inside its archives.
 *
 * classes.zip is extracted to a temp dir once and every nested archive is listed
 * in a single shell pass, because spawning unzip ~1300 times is the slow part.
 */
export function readInventory(repo) {
  const paths = listArchivePaths(repo);
  const tmp = mkdtempSync(join(tmpdir(), "ctk-manifest-"));
  try {
    execFileSync("unzip", ["-qq", "-o", join(repo, "classes.zip"), "-d", tmp], {
      maxBuffer: 64 * 1024 * 1024,
    });
    // The script goes in a file rather than `bash -c`: ~1300 unzip invocations
    // overflow the argv limit (E2BIG).
    const script = paths
      .map((p) => {
        const f = join(tmp, p).replace(/'/g, "'\\''");
        return `printf '@@@ %s\\n' '${p.replace(/'/g, "'\\''")}'; unzip -Z1 '${f}' 2>/dev/null || true`;
      })
      .join("\n");
    const scriptPath = join(tmp, "list-all.sh");
    writeFileSync(scriptPath, script);
    const listing = execFileSync("bash", [scriptPath], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });

    const byName = new Map();
    let cur = null;
    for (const line of listing.split("\n")) {
      if (line.startsWith("@@@ ")) {
        const path = line.slice(4).trim();
        const name = appletName(path);
        if (!byName.has(name)) {
          byName.set(name, { name, archives: [], classes: new Set(), images: new Set() });
        }
        cur = byName.get(name);
        cur.archives.push(path);
        continue;
      }
      const entry = line.trim();
      if (!cur || !entry) continue;
      const base = entry.split("/").pop();
      if (base.endsWith(".class")) {
        cur.classes.add(base.slice(0, -6).split("$")[0]);
      } else if (/\.(gif|jpg|jpeg|png)$/i.test(base)) {
        cur.images.add(base);
      }
    }

    return [...byName.values()]
      .map((r) => ({
        name: r.name,
        // The .jar is the canonical archive when an applet ships both: it is the
        // signed, runnable one and carries the Images/ the applet draws with.
        archive: r.archives.find((p) => p.endsWith(".jar")) ?? r.archives[0],
        archives: r.archives.sort(),
        classes: [...r.classes].sort((a, b) => a.localeCompare(b, "en")),
        images: [...r.images].sort((a, b) => a.localeCompare(b, "en")),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
