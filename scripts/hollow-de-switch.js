#!/usr/bin/env bun
/**
 * hollow-de-switch.js
 * HollowOS DE switching engine
 *
 * Called by hollow apply when the desktop environment
 * in hollow.json differs from the currently installed one.
 *
 * Usage:
 *   bun hollow-de-switch.js <from> <to>
 *   e.g. bun hollow-de-switch.js kde gnome
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";

// ── ANSI ──────────────────────────────────────────────────
const c = {
  reset:  "\x1b[0m",   bold:   "\x1b[1m",
  indigo: "\x1b[38;2;63;84;158m",
  green:  "\x1b[32m",  yellow: "\x1b[33m",
  red:    "\x1b[31m",  gray:   "\x1b[90m",
  white:  "\x1b[97m",
};

const log = {
  raw:     (m) => process.stdout.write(m + "\n"),
  info:    (m) => log.raw(`${c.indigo}::${c.reset} ${m}`),
  ok:      (m) => log.raw(`${c.green}  ✓${c.reset} \x1b[2m${m}\x1b[0m`),
  warn:    (m) => log.raw(`${c.yellow}  ⚠${c.reset}  ${m}`),
  error:   (m) => log.raw(`${c.red}  ✗${c.reset} ${c.bold}${m}${c.reset}`),
  section: (m) => log.raw(`\n${c.bold}${c.white}${m}${c.reset}`),
  dim:     (m) => log.raw(`${c.gray}    ${m}${c.reset}`),
};

const run = (cmd, opts = {}) => {
  const r = spawnSync("sh", ["-c", cmd], { stdio: "pipe", encoding: "utf8" });
  if (r.status !== 0 && !opts.optional) throw new Error(r.stderr?.trim() || cmd);
  return r.stdout?.trim() ?? "";
};

const runVerbose = (cmd) => {
  log.dim(`$ ${cmd}`);
  const r = spawnSync("sh", ["-c", cmd], { stdio: ["inherit","inherit","inherit"] });
  if (r.status !== 0) throw new Error(`Command failed: ${cmd}`);
};

// ── DE definitions ────────────────────────────────────────
const DE = {
  kde: {
    packages:       ["kde5", "kde5-baseapps", "sddm", "dolphin", "konsole", "kate", "plasma-pa", "plasma-nm"],
    dm:             "sddm",
    session:        "plasma",
    wayland:        false,
    removeOnSwitch: ["kde5", "kde5-baseapps", "sddm", "dolphin", "konsole"],
  },
  gnome: {
    packages:       ["gnome", "gnome-apps", "gdm", "nautilus", "gnome-terminal"],
    dm:             "gdm",
    session:        "gnome",
    wayland:        true,
    removeOnSwitch: ["gnome", "gnome-apps", "gdm", "nautilus", "gnome-terminal"],
  },
  hyprland: {
    packages:       ["hyprland", "waybar", "wofi", "dunst", "kitty", "grim", "slurp", "wl-clipboard", "polkit-gnome", "ly"],
    dm:             "ly",
    session:        "hyprland",
    wayland:        true,
    removeOnSwitch: ["hyprland", "waybar", "wofi", "ly"],
  },
  sway: {
    packages:       ["sway", "waybar", "dmenu", "foot", "dunst", "swaylock", "swayidle", "wl-clipboard", "ly"],
    dm:             "ly",
    session:        "sway",
    wayland:        true,
    removeOnSwitch: ["sway", "waybar", "dmenu", "foot", "ly"],
  },
};

// ── Detect current DE from running services ───────────────
function detectCurrentDE() {
  const svDir = "/etc/runit/runsvdir/default";

  if (existsSync(`${svDir}/sddm`))   return "kde";
  if (existsSync(`${svDir}/gdm`))    return "gnome";
  if (existsSync(`${svDir}/ly`)) {
    // ly is shared between hyprland and sway — check packages
    const installed = run("xbps-query -l", { optional: true });
    if (installed.includes("hyprland")) return "hyprland";
    if (installed.includes("sway"))     return "sway";
    return "hyprland";
  }
  return null;
}

// ── Switch DE ─────────────────────────────────────────────
async function switchDE(from, to) {
  if (!DE[from]) throw new Error(`Unknown source DE: ${from}`);
  if (!DE[to])   throw new Error(`Unknown target DE: ${to}`);

  if (from === to) {
    log.info("Already on the requested DE — nothing to do.");
    return;
  }

  const fromDef = DE[from];
  const toDef   = DE[to];

  log.raw(`\n${c.indigo}${c.bold}  Switching DE: ${from.toUpperCase()} → ${to.toUpperCase()}${c.reset}\n`);

  // ── Step 1: Stop current display manager ─────────────
  log.section("Stopping current display manager");
  log.warn("Your display will go blank briefly — this is normal.");

  try {
    run(`sv down ${fromDef.dm}`, { optional: true });
    run(`rm -f /etc/runit/runsvdir/default/${fromDef.dm}`, { optional: true });
    log.ok(`${fromDef.dm} stopped`);
  } catch {
    log.warn(`Could not stop ${fromDef.dm} — continuing anyway`);
  }

  // ── Step 2: Install new DE packages ──────────────────
  log.section(`Installing ${to.toUpperCase()} packages`);
  try {
    runVerbose(`xbps-install -Sy ${toDef.packages.join(" ")}`);
    log.ok(`${to} packages installed`);
  } catch (err) {
    throw new Error(`Failed to install ${to} packages: ${err.message}`);
  }

  // ── Step 3: Enable new display manager ───────────────
  log.section(`Enabling ${toDef.dm}`);
  const svPath = `/etc/sv/${toDef.dm}`;
  const rlPath = `/etc/runit/runsvdir/default/${toDef.dm}`;

  if (existsSync(svPath)) {
    run(`ln -sf ${svPath} ${rlPath}`, { optional: true });
    log.ok(`${toDef.dm} enabled`);
  } else {
    log.warn(`${toDef.dm} service not found in /etc/sv — may need manual setup`);
  }

  // ── Step 4: Set default session ───────────────────────
  log.section("Setting default session");

  if (toDef.dm === "sddm") {
    // Write SDDM autologin session
    const sddmConf = `[Autologin]\nSession=${toDef.session}\n`;
    writeFileSync("/etc/sddm.conf.d/hollowos-session.conf", sddmConf);
    log.ok(`SDDM session set to ${toDef.session}`);

  } else if (toDef.dm === "gdm") {
    // GDM uses WaylandEnable flag
    const gdmConf = `[daemon]\nWaylandEnable=${toDef.wayland}\n`;
    writeFileSync("/etc/gdm/custom.conf", gdmConf);
    log.ok(`GDM configured (Wayland: ${toDef.wayland})`);

  } else if (toDef.dm === "ly") {
    // ly uses a config file for default session
    const lyConf = `/etc/ly/config.ini`;
    if (existsSync(lyConf)) {
      let conf = readFileSync(lyConf, "utf8");
      conf = conf.replace(/^default_session\s*=.*/m, `default_session = ${toDef.session}`);
      if (!conf.includes("default_session")) {
        conf += `\ndefault_session = ${toDef.session}\n`;
      }
      writeFileSync(lyConf, conf);
      log.ok(`ly session set to ${toDef.session}`);
    } else {
      log.warn("ly config not found — set session manually in /etc/ly/config.ini");
    }
  }

  // ── Step 5: Apply wallpaper for new DE ───────────────
  log.section("Applying wallpaper");
  const wallpaper = "/usr/share/hollowos/wallpaper.png";

  if (existsSync(wallpaper)) {
    if (to === "gnome") {
      run(`gsettings set org.gnome.desktop.background picture-uri "file://${wallpaper}"`, { optional: true });
      run(`gsettings set org.gnome.desktop.background picture-uri-dark "file://${wallpaper}"`, { optional: true });
      log.ok("GNOME wallpaper set");
    } else if (to === "kde") {
      // KDE wallpaper via plasma-apply-wallpaperimage if available
      run(`plasma-apply-wallpaperimage ${wallpaper}`, { optional: true });
      log.ok("KDE wallpaper set (or will apply on next login)");
    } else {
      // For tiling WMs, write a swaybg/hyprpaper config
      const swayBgConf = `output * bg ${wallpaper} fill\n`;
      writeFileSync("/etc/hollowos/wallpaper.conf", swayBgConf);
      log.ok("Wallpaper config written to /etc/hollowos/wallpaper.conf");
    }
  } else {
    log.warn("Wallpaper not found at /usr/share/hollowos/wallpaper.png");
  }

  // ── Step 6: Remove old DE packages (optional) ────────
  log.section(`Cleaning up ${from.toUpperCase()} packages`);
  log.info("Removing packages that are no longer needed...");

  // Only remove packages not shared with the new DE
  const toKeep  = new Set(toDef.packages);
  const toRemove = fromDef.removeOnSwitch.filter(p => !toKeep.has(p));

  if (toRemove.length > 0) {
    try {
      runVerbose(`xbps-remove -Ry ${toRemove.join(" ")}`);
      log.ok(`Removed: ${toRemove.join(", ")}`);
    } catch {
      log.warn("Some old packages could not be removed — you can clean them up manually");
      log.warn(`xbps-remove -Ry ${toRemove.join(" ")}`);
    }
  } else {
    log.ok("No exclusive packages to remove");
  }

  // ── Step 7: Start new display manager ────────────────
  log.section(`Starting ${toDef.dm}`);
  try {
    run(`sv up ${toDef.dm}`, { optional: true });
    log.ok(`${toDef.dm} started`);
  } catch {
    log.warn(`Could not start ${toDef.dm} immediately`);
    log.warn("It will start automatically on next boot");
  }

  // ── Done ──────────────────────────────────────────────
  log.raw(`\n${c.green}${c.bold}  ✓ Switched from ${from.toUpperCase()} to ${to.toUpperCase()}${c.reset}`);
  log.raw(`${c.gray}  Log out and back in to complete the switch.${c.reset}\n`);
}

// ── Entrypoint ────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (process.getuid?.() !== 0) {
    log.error("hollow-de-switch must be run as root");
    process.exit(1);
  }

  // Called with explicit from/to
  if (args[0] && args[1]) {
    await switchDE(args[0], args[1]);
    return;
  }

  // Called with just --to, auto-detect current
  if (args[0] === "--to" && args[1]) {
    const current = detectCurrentDE();
    if (!current) {
      log.error("Could not detect current DE — pass both <from> and <to>");
      process.exit(1);
    }
    await switchDE(current, args[1]);
    return;
  }

  log.raw("Usage: hollow-de-switch <from> <to>");
  log.raw("       hollow-de-switch --to <de>");
  log.raw("Valid DEs: kde, gnome, hyprland, sway");
}

main().catch(err => {
  log.error(`Fatal: ${err.message}`);
  process.exit(1);
});

export { switchDE, detectCurrentDE, DE };
