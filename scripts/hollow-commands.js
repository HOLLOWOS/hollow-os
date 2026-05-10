#!/usr/bin/env bun
/**
 * hollow-commands.js
 * HollowOS CLI — add, remove, upgrade commands
 *
 * These extend the hollow CLI. Run via:
 *   hollow add <package>
 *   hollow remove <package>
 *   hollow upgrade
 *   hollow upgrade --dry-run
 *
 * This file is called directly by the hollow wrapper script
 * when the subcommand is add, remove, or upgrade.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { execSync, spawnSync } from "child_process";
import { join } from "path";

// ── Constants ─────────────────────────────────────────────
const HOLLOW_JSON    = "/etc/hollow.json";
const HOLLOW_STATE   = "/var/lib/hollow/state.json";
const HOLLOW_SNAPDIR = "/var/lib/hollow/snapshots";
const HOLLOW_LOG     = "/var/log/hollow.log";

// ── ANSI colors ───────────────────────────────────────────
const c = {
  reset:  "\x1b[0m",  bold:   "\x1b[1m",
  indigo: "\x1b[38;2;63;84;158m",
  green:  "\x1b[32m", yellow: "\x1b[33m",
  red:    "\x1b[31m", gray:   "\x1b[90m",
  white:  "\x1b[97m",
};

// ── Logger ────────────────────────────────────────────────
const appendLog = (msg) => {
  try { require("fs").appendFileSync(HOLLOW_LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
};

const log = {
  raw:     (m) => process.stdout.write(m + "\n"),
  info:    (m) => { log.raw(`${c.indigo}::${c.reset} ${m}`);           appendLog(`[info] ${m}`); },
  step:    (m) => { log.raw(`${c.indigo}  →${c.reset} ${m}`);          appendLog(`[step] ${m}`); },
  ok:      (m) => { log.raw(`${c.green}  ✓${c.reset} \x1b[2m${m}\x1b[0m`); appendLog(`[ok]   ${m}`); },
  warn:    (m) => { log.raw(`${c.yellow}  ⚠${c.reset}  ${m}`);         appendLog(`[warn] ${m}`); },
  error:   (m) => { log.raw(`${c.red}  ✗${c.reset} ${c.bold}${m}${c.reset}`); appendLog(`[err]  ${m}`); },
  section: (m) => { log.raw(`\n${c.bold}${c.white}${m}${c.reset}`);    appendLog(`\n=== ${m} ===`); },
  dim:     (m) => { log.raw(`${c.gray}    ${m}${c.reset}`); },
  banner:  ()  => {
    log.raw(`\n${c.indigo}${c.bold}  hollow${c.reset}\x1b[2m v0.1.0 — HollowOS orchestrator${c.reset}`);
    log.raw(`${c.gray}  ─────────────────────────────────────${c.reset}\n`);
  },
};

// ── Helpers ───────────────────────────────────────────────
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

// ── hollow.json helpers ───────────────────────────────────
function load() {
  if (!existsSync(HOLLOW_JSON)) throw new Error(`hollow.json not found at ${HOLLOW_JSON}`);
  return JSON.parse(readFileSync(HOLLOW_JSON, "utf8"));
}

function save(config) {
  writeFileSync(HOLLOW_JSON, JSON.stringify(config, null, 2) + "\n");
}

function saveState(config) {
  mkdirSync("/var/lib/hollow", { recursive: true });
  writeFileSync(HOLLOW_STATE, JSON.stringify({ ...config, _applied: new Date().toISOString() }, null, 2));
}

// ── Snapshot ──────────────────────────────────────────────
function snapshot(label = "auto") {
  mkdirSync(HOLLOW_SNAPDIR, { recursive: true });
  const snapPath = join(HOLLOW_SNAPDIR, `${Date.now()}-${label}.json`);
  writeFileSync(snapPath, JSON.stringify({
    meta: { timestamp: new Date().toISOString(), label },
    hollow_json: existsSync(HOLLOW_JSON) ? JSON.parse(readFileSync(HOLLOW_JSON, "utf8")) : null,
  }, null, 2));
  log.ok(`Snapshot saved: ${snapPath}`);
  return snapPath;
}

// ── hollow add ────────────────────────────────────────────
async function cmdAdd(pkg) {
  if (!pkg) { log.error("Usage: hollow add <package>"); process.exit(1); }

  log.info(`Adding ${pkg} to hollow.json...`);
  const config = load();

  if (config.user_packages.includes(pkg)) {
    log.warn(`${pkg} is already in user_packages`);
  } else {
    config.user_packages.push(pkg);
    save(config);
    log.ok(`Added ${pkg} to user_packages`);
  }

  log.section("Creating snapshot");
  snapshot(`pre-add-${pkg}`);

  log.section(`Installing ${pkg}`);
  try {
    runVerbose(`xbps-install -Sy ${pkg}`);
    log.ok(`${pkg} installed`);
  } catch (err) {
    log.error(`Install failed: ${err.message}`);
    // Remove from hollow.json since install failed
    config.user_packages = config.user_packages.filter(p => p !== pkg);
    save(config);
    log.warn(`Reverted hollow.json — ${pkg} was not added`);
    process.exit(1);
  }

  saveState(config);
  log.raw(`\n${c.green}${c.bold}  ✓ ${pkg} added successfully${c.reset}\n`);
}

// ── hollow remove ─────────────────────────────────────────
async function cmdRemove(pkg) {
  if (!pkg) { log.error("Usage: hollow remove <package>"); process.exit(1); }

  log.info(`Removing ${pkg} from hollow.json...`);
  const config = load();

  const inUserPkgs = config.user_packages.includes(pkg);
  const inExtra    = config.packages?.extra?.includes(pkg);

  if (!inUserPkgs && !inExtra) {
    log.warn(`${pkg} not found in user_packages or packages.extra`);
    log.warn(`If it's a base system package, use: xbps-remove -R ${pkg}`);
    log.warn("Removing base packages may break your system — be careful.");
    process.exit(1);
  }

  if (inUserPkgs) config.user_packages       = config.user_packages.filter(p => p !== pkg);
  if (inExtra)    config.packages.extra       = config.packages.extra.filter(p => p !== pkg);

  save(config);
  log.ok(`Removed ${pkg} from hollow.json`);

  log.section("Creating snapshot before removal");
  snapshot(`pre-remove-${pkg}`);

  log.section(`Uninstalling ${pkg}`);
  try {
    runVerbose(`xbps-remove -Ry ${pkg}`);
    log.ok(`${pkg} uninstalled`);
  } catch (err) {
    log.error(`Uninstall failed: ${err.message}`);
    log.warn("hollow.json was updated but the package may still be installed");
    log.warn("Run: xbps-remove -R " + pkg);
    process.exit(1);
  }

  saveState(config);
  log.raw(`\n${c.green}${c.bold}  ✓ ${pkg} removed successfully${c.reset}\n`);
}

// ── hollow upgrade ────────────────────────────────────────
async function cmdUpgrade(dryRun = false) {

  if (dryRun) {
    log.section("Available upgrades (dry run)");
    try {
      runVerbose("xbps-install -Sun");
    } catch {
      log.info("System is up to date.");
    }
    log.raw(`\n${c.yellow}  Dry run — nothing installed.${c.reset}\n`);
    return;
  }

  log.section("Creating pre-upgrade snapshot");
  snapshot("pre-upgrade");

  log.section("Syncing repositories");
  try {
    runVerbose("xbps-install -S");
    log.ok("Repositories synced");
  } catch (err) {
    log.error(`Repo sync failed: ${err.message}`);
    process.exit(1);
  }

  log.section("Upgrading packages");
  try {
    runVerbose("xbps-install -yu");
    log.ok("All packages upgraded");
  } catch (err) {
    log.error(`Upgrade failed: ${err.message}`);
    log.warn("Rolling back — re-run: hollow rollback");
    process.exit(1);
  }

  // Re-sync hollow.json state after upgrade
  log.section("Syncing hollow.json state");
  const config = load();
  saveState(config);
  log.ok("hollow.json state synced");

  log.raw(`\n${c.green}${c.bold}  ✓ System upgraded successfully${c.reset}\n`);
  log.raw(`${c.gray}  Run 'hollow apply' if you made changes to hollow.json${c.reset}\n`);
}

// ── Entrypoint ────────────────────────────────────────────
async function main() {
  const args    = process.argv.slice(2);
  const command = args[0];

  log.banner();

  if (process.getuid?.() !== 0) {
    log.error(`hollow must be run as root. Try: sudo hollow ${command ?? ""}`);
    process.exit(1);
  }

  switch (command) {
    case "add":
      await cmdAdd(args[1]);
      break;
    case "remove":
      await cmdRemove(args[1]);
      break;
    case "upgrade":
      await cmdUpgrade(args.includes("--dry-run"));
      break;
    default:
      log.raw(`${c.bold}  Commands in this module:${c.reset}`);
      log.raw(`    hollow add <package>      Add a package and install it`);
      log.raw(`    hollow remove <package>   Remove a package and uninstall it`);
      log.raw(`    hollow upgrade            Upgrade all packages`);
      log.raw(`    hollow upgrade --dry-run  Preview available upgrades`);
      log.raw("");
  }
}

main().catch(err => {
  console.error(`\n${c.red}  Fatal: ${err.message}${c.reset}\n`);
  process.exit(1);
});
