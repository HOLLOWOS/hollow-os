#!/usr/bin/env bun
/**
 * hollow - HollowOS system orchestrator
 *
 * Usage:
 *   hollow apply              Apply /etc/hollow.json to the running system
 *   hollow apply --dry-run    Show what would change without applying
 *   hollow apply --file <f>   Apply a specific hollow.json file
 *   hollow diff               Show diff between current state and hollow.json
 *   hollow rollback           Roll back to the last good snapshot
 *   hollow rollback --list    List all available snapshots
 *   hollow snapshot           Manually create a snapshot
 *   hollow status             Show current system state vs hollow.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { execSync, spawnSync } from "child_process";
import { join } from "path";

// ── Constants ─────────────────────────────────────────────
const HOLLOW_JSON     = "/etc/hollow.json";
const HOLLOW_STATE    = "/var/lib/hollow/state.json";
const HOLLOW_SNAPDIR  = "/var/lib/hollow/snapshots";
const HOLLOW_LOG      = "/var/log/hollow.log";
const VERSION         = "0.1.0";

// ── ANSI colors ───────────────────────────────────────────
const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  blue:   "\x1b[34m",
  indigo: "\x1b[38;2;63;84;158m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  gray:   "\x1b[90m",
  white:  "\x1b[97m",
};

// ── Logger ────────────────────────────────────────────────
const timestamp = () => new Date().toISOString();

const log = {
  raw:     (msg) => process.stdout.write(msg + "\n"),
  info:    (msg) => { const l = `${c.indigo}::${c.reset} ${msg}`; log.raw(l); appendLog(`[info] ${msg}`); },
  step:    (msg) => { const l = `${c.indigo}  →${c.reset} ${msg}`; log.raw(l); appendLog(`[step] ${msg}`); },
  ok:      (msg) => { const l = `${c.green}  ✓${c.reset} ${c.dim}${msg}${c.reset}`; log.raw(l); appendLog(`[ok]   ${msg}`); },
  warn:    (msg) => { const l = `${c.yellow}  ⚠${c.reset}  ${msg}`; log.raw(l); appendLog(`[warn] ${msg}`); },
  error:   (msg) => { const l = `${c.red}  ✗${c.reset} ${c.bold}${msg}${c.reset}`; log.raw(l); appendLog(`[err]  ${msg}`); },
  section: (msg) => { log.raw(`\n${c.bold}${c.white}${msg}${c.reset}`); appendLog(`\n=== ${msg} ===`); },
  dim:     (msg) => { log.raw(`${c.gray}    ${msg}${c.reset}`); },
  banner:  ()    => {
    log.raw(`\n${c.indigo}${c.bold}  hollow${c.reset}${c.dim} v${VERSION} — HollowOS orchestrator${c.reset}`);
    log.raw(`${c.gray}  ─────────────────────────────────────${c.reset}\n`);
  },
};

function appendLog(msg) {
  try {
    const line = `[${timestamp()}] ${msg}\n`;
    const fs = require("fs");
    fs.appendFileSync(HOLLOW_LOG, line);
  } catch {}
}

// ── Shell helpers ─────────────────────────────────────────
function run(cmd, opts = {}) {
  const result = spawnSync("sh", ["-c", cmd], {
    stdio: opts.silent ? "pipe" : ["inherit", "pipe", "pipe"],
    encoding: "utf8",
  });

  if (result.status !== 0 && !opts.optional) {
    const err = result.stderr?.trim() || result.stdout?.trim() || "unknown error";
    throw new Error(`Command failed: ${cmd}\n${err}`);
  }

  return result.stdout?.trim() ?? "";
}

function runVerbose(cmd) {
  log.dim(`$ ${cmd}`);
  const result = spawnSync("sh", ["-c", cmd], {
    stdio: ["inherit", "inherit", "inherit"],
  });
  if (result.status !== 0) throw new Error(`Command failed: ${cmd}`);
}

// ── hollow.json parser & validator ───────────────────────
function loadHollowJson(path = HOLLOW_JSON) {
  if (!existsSync(path)) {
    throw new Error(`hollow.json not found at ${path}\nRun the installer or create one manually.`);
  }

  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(`Cannot read ${path}: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `hollow.json has a syntax error:\n  ${err.message}\n` +
      `Fix the file and run hollow apply again.`
    );
  }

  return validate(parsed);
}

function validate(config) {
  const required = ["system", "user", "desktop", "packages", "services"];
  const missing = required.filter(k => !(k in config));

  if (missing.length > 0) {
    throw new Error(
      `hollow.json is missing required sections: ${missing.join(", ")}\n` +
      `See /usr/share/hollow/hollow.json.example for reference.`
    );
  }

  // Validate desktop environment
  const validDEs = ["kde", "gnome", "hyprland", "sway"];
  if (!validDEs.includes(config.desktop?.environment)) {
    throw new Error(
      `Invalid desktop environment: "${config.desktop?.environment}"\n` +
      `Valid options: ${validDEs.join(", ")}`
    );
  }

  // Validate shell
  const validShells = ["fish", "bash", "zsh"];
  if (!validShells.includes(config.user?.shell)) {
    throw new Error(
      `Invalid shell: "${config.user?.shell}"\n` +
      `Valid options: ${validShells.join(", ")}`
    );
  }

  return config;
}

// ── State management ──────────────────────────────────────
function loadState() {
  if (!existsSync(HOLLOW_STATE)) return null;
  try {
    return JSON.parse(readFileSync(HOLLOW_STATE, "utf8"));
  } catch {
    return null;
  }
}

function saveState(config) {
  mkdirSync("/var/lib/hollow", { recursive: true });
  writeFileSync(HOLLOW_STATE, JSON.stringify({
    ...config,
    _applied: timestamp(),
  }, null, 2));
}

// ── Snapshot system ───────────────────────────────────────
function createSnapshot(label = "auto") {
  mkdirSync(HOLLOW_SNAPDIR, { recursive: true });

  const ts = Date.now();
  const snapPath = join(HOLLOW_SNAPDIR, `${ts}-${label}.json`);

  // Snapshot = current hollow.json + live system state
  const snap = {
    meta: {
      timestamp: timestamp(),
      label,
      hollow_version: VERSION,
    },
    hollow_json: existsSync(HOLLOW_JSON)
      ? JSON.parse(readFileSync(HOLLOW_JSON, "utf8"))
      : null,
    system: captureSystemState(),
  };

  writeFileSync(snapPath, JSON.stringify(snap, null, 2));
  log.ok(`Snapshot saved: ${snapPath}`);
  return snapPath;
}

function captureSystemState() {
  const installedRaw = run("xbps-query -l", { silent: true });
  const installed = installedRaw
    .split("\n")
    .filter(Boolean)
    .map(line => line.split(/\s+/)[1]?.replace(/-[^-]+-\d+$/, "") ?? "")
    .filter(Boolean);

  const enabledRaw = run("ls /etc/runit/runsvdir/default/", { silent: true, optional: true });
  const enabled = enabledRaw.split("\n").filter(Boolean);

  const currentShell = run(`getent passwd $(whoami) | cut -d: -f7`, { silent: true, optional: true });

  return { installed, enabled, shell: currentShell };
}

function listSnapshots() {
  if (!existsSync(HOLLOW_SNAPDIR)) return [];
  return readdirSync(HOLLOW_SNAPDIR)
    .filter(f => f.endsWith(".json"))
    .sort()
    .reverse()
    .map(f => {
      try {
        const snap = JSON.parse(readFileSync(join(HOLLOW_SNAPDIR, f), "utf8"));
        return { file: f, ...snap.meta };
      } catch {
        return { file: f, label: "unknown", timestamp: "unknown" };
      }
    });
}

function rollback(snapFile) {
  const snapPath = snapFile
    ? join(HOLLOW_SNAPDIR, snapFile)
    : join(HOLLOW_SNAPDIR, listSnapshots()[0]?.file ?? "");

  if (!snapPath || !existsSync(snapPath)) {
    throw new Error("No snapshot found to roll back to.");
  }

  const snap = JSON.parse(readFileSync(snapPath, "utf8"));

  log.info(`Rolling back to: ${snap.meta.label} (${snap.meta.timestamp})`);

  if (!snap.hollow_json) throw new Error("Snapshot has no hollow.json data.");

  // Write the old hollow.json back
  writeFileSync(HOLLOW_JSON, JSON.stringify(snap.hollow_json, null, 2));
  log.ok("hollow.json restored from snapshot");

  // Re-apply
  return applyConfig(snap.hollow_json, { isRollback: true });
}

// ── Diff engine ───────────────────────────────────────────
function diffState(current, desired) {
  const changes = [];

  // Packages to install
  const toInstall = [
    desired.packages?.browser,
    ...(desired.user_packages ?? []),
    ...(desired.packages?.extra ?? []),
  ].filter(Boolean).filter(pkg => !current?.installed?.includes(pkg));

  if (toInstall.length > 0) {
    changes.push({ type: "packages:install", items: toInstall });
  }

  // Services to enable
  const toEnable = (desired.services?.enabled ?? [])
    .filter(svc => !current?.enabled?.includes(svc));

  if (toEnable.length > 0) {
    changes.push({ type: "services:enable", items: toEnable });
  }

  // Services to disable
  const toDisable = (current?.enabled ?? [])
    .filter(svc => !(desired.services?.enabled ?? []).includes(svc));

  if (toDisable.length > 0) {
    changes.push({ type: "services:disable", items: toDisable });
  }

  // Shell change
  const shellBinMap = { fish: "/bin/fish", bash: "/bin/bash", zsh: "/bin/zsh" };
  const desiredShell = shellBinMap[desired.user?.shell];
  if (desiredShell && current?.shell !== desiredShell) {
    changes.push({ type: "shell:change", from: current?.shell, to: desiredShell });
  }

  // Hostname change
  const currentHostname = run("hostname", { silent: true, optional: true });
  if (desired.system?.hostname && currentHostname !== desired.system.hostname) {
    changes.push({ type: "hostname:change", from: currentHostname, to: desired.system.hostname });
  }

  return changes;
}

// ── Apply engine ──────────────────────────────────────────
async function applyConfig(config, opts = {}) {
  const { dryRun = false, isRollback = false } = opts;

  log.section(isRollback ? "Rolling back system state" : "Applying hollow.json");

  // ── Snapshot before applying ──────────────────────────
  if (!dryRun && !isRollback) {
    log.section("Creating snapshot");
    createSnapshot("pre-apply");
  }

  // ── Capture current state ─────────────────────────────
  log.section("Reading current system state");
  const current = captureSystemState();
  log.ok(`${current.installed.length} packages installed`);
  log.ok(`${current.enabled.length} services enabled`);

  // ── Diff ──────────────────────────────────────────────
  const changes = diffState(current, config);

  if (changes.length === 0) {
    log.raw(`\n${c.green}${c.bold}  System is already in sync with hollow.json${c.reset}\n`);
    return;
  }

  log.section("Planned changes");
  for (const change of changes) {
    switch (change.type) {
      case "packages:install":
        log.info(`Install ${change.items.length} package(s):`);
        change.items.forEach(p => log.dim(`+ ${p}`));
        break;
      case "services:enable":
        log.info(`Enable ${change.items.length} service(s):`);
        change.items.forEach(s => log.dim(`+ ${s}`));
        break;
      case "services:disable":
        log.info(`Disable ${change.items.length} service(s):`);
        change.items.forEach(s => log.dim(`- ${s}`));
        break;
      case "shell:change":
        log.info(`Change shell: ${change.from} → ${change.to}`);
        break;
      case "hostname:change":
        log.info(`Change hostname: ${change.from} → ${change.to}`);
        break;
    }
  }

  if (dryRun) {
    log.raw(`\n${c.yellow}  Dry run — no changes applied.${c.reset}\n`);
    return;
  }

  // ── Apply changes ─────────────────────────────────────
  log.section("Applying changes");

  try {
    for (const change of changes) {
      switch (change.type) {

        case "packages:install":
          log.step(`Installing packages: ${change.items.join(", ")}`);
          runVerbose(`xbps-install -Sy ${change.items.join(" ")}`);
          log.ok("Packages installed");
          break;

        case "services:enable":
          for (const svc of change.items) {
            log.step(`Enabling service: ${svc}`);
            const svPath = `/etc/sv/${svc}`;
            const rlPath = `/etc/runit/runsvdir/default/${svc}`;
            if (existsSync(svPath)) {
              run(`ln -sf ${svPath} ${rlPath}`, { optional: true });
              run(`sv up ${svc}`, { optional: true });
              log.ok(`${svc} enabled`);
            } else {
              log.warn(`Service not found: ${svc} — skipping`);
            }
          }
          break;

        case "services:disable":
          for (const svc of change.items) {
            log.step(`Disabling service: ${svc}`);
            run(`rm -f /etc/runit/runsvdir/default/${svc}`, { optional: true });
            run(`sv down ${svc}`, { optional: true });
            log.ok(`${svc} disabled`);
          }
          break;

        case "shell:change":
          log.step(`Setting shell to ${change.to}`);
          runVerbose(`chsh -s ${change.to} ${config.user.name}`);
          log.ok(`Shell changed to ${change.to}`);
          break;

        case "hostname:change":
          log.step(`Setting hostname to ${change.to}`);
          run(`echo "${change.to}" > /etc/hostname`);
          run(`hostname ${change.to}`);
          log.ok(`Hostname changed to ${change.to}`);
          break;
      }
    }

    // ── Save new state ──────────────────────────────────
    saveState(config);

    log.raw(`\n${c.green}${c.bold}  ✓ hollow.json applied successfully${c.reset}\n`);

  } catch (err) {
    // ── Auto-rollback on failure ────────────────────────
    log.error(`Apply failed: ${err.message}`);
    log.raw(`\n${c.yellow}  Auto-rolling back to last good state...${c.reset}`);

    const snaps = listSnapshots();
    if (snaps.length > 0) {
      try {
        await rollback(snaps[0].file);
        log.ok("Rollback complete — system restored");
      } catch (rbErr) {
        log.error(`Rollback also failed: ${rbErr.message}`);
        log.error("Your system may be in a partial state. Check /var/log/hollow.log");
      }
    } else {
      log.warn("No snapshot to roll back to — system may be in a partial state");
    }

    process.exit(1);
  }
}

// ── CLI entrypoint ────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  log.banner();

  // Must be root
  if (process.getuid?.() !== 0) {
    log.error("hollow must be run as root. Try: sudo hollow " + (command ?? "apply"));
    process.exit(1);
  }

  switch (command) {

    // ── hollow apply ───────────────────────────────────
    case "apply":
    case undefined: {
      const dryRun  = args.includes("--dry-run");
      const file    = args.includes("--file") ? args[args.indexOf("--file") + 1] : HOLLOW_JSON;

      log.info(`Reading ${file}`);
      const config = loadHollowJson(file);
      log.ok("hollow.json is valid");

      await applyConfig(config, { dryRun });
      break;
    }

    // ── hollow diff ────────────────────────────────────
    case "diff": {
      log.info("Comparing system state to hollow.json...\n");
      const config  = loadHollowJson();
      const current = captureSystemState();
      const changes = diffState(current, config);

      if (changes.length === 0) {
        log.raw(`${c.green}  System is in sync with hollow.json${c.reset}\n`);
      } else {
        log.raw(`${c.yellow}  ${changes.length} change(s) pending:${c.reset}\n`);
        for (const change of changes) {
          switch (change.type) {
            case "packages:install":
              change.items.forEach(p => log.raw(`  ${c.green}+${c.reset} ${p}`));
              break;
            case "services:enable":
              change.items.forEach(s => log.raw(`  ${c.green}+ svc:${c.reset} ${s}`));
              break;
            case "services:disable":
              change.items.forEach(s => log.raw(`  ${c.red}- svc:${c.reset} ${s}`));
              break;
            case "shell:change":
              log.raw(`  ${c.blue}~ shell:${c.reset} ${change.from} → ${change.to}`);
              break;
            case "hostname:change":
              log.raw(`  ${c.blue}~ hostname:${c.reset} ${change.from} → ${change.to}`);
              break;
          }
        }
        log.raw("");
      }
      break;
    }

    // ── hollow status ──────────────────────────────────
    case "status": {
      const config  = loadHollowJson();
      const current = captureSystemState();
      const changes = diffState(current, config);
      const state   = loadState();

      log.raw(`${c.bold}  System${c.reset}`);
      log.raw(`    hostname   ${run("hostname", { silent: true })}`);
      log.raw(`    shell      ${current.shell}`);
      log.raw(`    desktop    ${config.desktop?.environment}`);
      log.raw(`    packages   ${current.installed.length} installed`);
      log.raw(`    services   ${current.enabled.length} enabled`);
      log.raw(`    last apply ${state?._applied ?? "never"}`);
      log.raw(`    pending    ${changes.length} change(s)`);
      log.raw("");
      break;
    }

    // ── hollow snapshot ────────────────────────────────
    case "snapshot": {
      const label = args[1] ?? "manual";
      log.info(`Creating snapshot: ${label}`);
      createSnapshot(label);
      break;
    }

    // ── hollow rollback ────────────────────────────────
    case "rollback": {
      if (args.includes("--list")) {
        const snaps = listSnapshots();
        if (snaps.length === 0) {
          log.raw("  No snapshots found.\n");
        } else {
          log.raw(`${c.bold}  Available snapshots:${c.reset}\n`);
          snaps.forEach((s, i) => {
            const tag = i === 0 ? `${c.green} (latest)${c.reset}` : "";
            log.raw(`    ${c.dim}${s.file}${c.reset}${tag}`);
            log.raw(`      ${c.gray}${s.timestamp} — ${s.label}${c.reset}`);
          });
          log.raw("");
        }
        break;
      }

      const snapFile = args[1] ?? null;
      log.info("Starting rollback...");
      await rollback(snapFile);
      break;
    }

    // ── hollow help ────────────────────────────────────
    default: {
      log.raw(`${c.bold}  Usage:${c.reset}`);
      log.raw(`    hollow apply              Apply /etc/hollow.json`);
      log.raw(`    hollow apply --dry-run    Preview changes without applying`);
      log.raw(`    hollow apply --file <f>   Apply a specific hollow.json`);
      log.raw(`    hollow diff               Show pending changes`);
      log.raw(`    hollow status             Show current system state`);
      log.raw(`    hollow snapshot [label]   Create a named snapshot`);
      log.raw(`    hollow rollback           Roll back to last snapshot`);
      log.raw(`    hollow rollback --list    List all snapshots`);
      log.raw("");
      break;
    }
  }
}

main().catch(err => {
  console.error(`\n${c.red}  Fatal: ${err.message}${c.reset}\n`);
  process.exit(1);
});
