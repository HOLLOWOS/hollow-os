#!/usr/bin/env bun
/**
 * hollow-generate.js
 * HollowOS post-install orchestrator
 *
 * Reads installer choices from Calamares global storage,
 * writes /etc/hollow.json, and applies the system state.
 *
 * Run by Calamares as a shellprocess module after package install.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";

// ── Read Calamares global storage ────────────────────────
// Calamares passes choices via environment variables
const choices = {
  username:    process.env.HOLLOW_USER        ?? "user",
  hostname:    process.env.HOLLOW_HOSTNAME    ?? "hollowos",
  locale:      process.env.HOLLOW_LOCALE      ?? "en_US.UTF-8",
  timezone:    process.env.HOLLOW_TIMEZONE    ?? "America/New_York",
  keyboard:    process.env.HOLLOW_KEYBOARD    ?? "us",
  desktop:     process.env.HOLLOW_DESKTOP     ?? "kde",
  shell:       process.env.HOLLOW_SHELL       ?? "fish",
  browser:     process.env.HOLLOW_BROWSER     ?? "firefox",
  theme:       process.env.HOLLOW_THEME       ?? "dark",
  unfree:      process.env.HOLLOW_UNFREE      ?? "false",
  flatpak:     process.env.HOLLOW_FLATPAK     ?? "false",
  drivers:     process.env.HOLLOW_DRIVERS     ?? "auto",
  driverPkgs:  process.env.HOLLOW_DRIVER_PKGS ?? "",
  autologin:   process.env.HOLLOW_AUTOLOGIN   ?? "false",
  ssh:         process.env.HOLLOW_SSH         ?? "false",
  zram:        process.env.HOLLOW_ZRAM        ?? "true",
};

// ── Desktop environment → display manager map ────────────
const dmMap = {
  kde:       "sddm",
  gnome:     "gdm",
  hyprland:  "ly",
  sway:      "ly",
};

// ── Desktop environment → services ──────────────────────
const deServices = {
  kde:       ["dbus", "elogind", "NetworkManager", "sddm", "pipewire", "wireplumber"],
  gnome:     ["dbus", "elogind", "NetworkManager", "gdm",  "pipewire", "wireplumber"],
  hyprland:  ["dbus", "elogind", "NetworkManager", "ly",   "pipewire", "wireplumber"],
  sway:      ["dbus", "elogind", "NetworkManager", "ly",   "pipewire", "wireplumber"],
};

// ── Build hollow.json ────────────────────────────────────
const hollow = {
  meta: {
    version:    "1",
    generated:  new Date().toISOString(),
    generator:  "hollow-generate@0.1.0",
  },

  system: {
    hostname:   choices.hostname,
    locale:     choices.locale,
    timezone:   choices.timezone,
    keyboard:   choices.keyboard,
    unfree:     choices.unfree === "true",
  },

  user: {
    name:       choices.username,
    shell:      choices.shell,
    autologin:  choices.autologin === "true",
  },

  desktop: {
    environment:    choices.desktop,
    displayManager: dmMap[choices.desktop] ?? "sddm",
    theme:          choices.theme,
  },

  packages: {
    browser:   choices.browser,
    flatpak:   choices.flatpak === "true",
    extra:     [],
  },

  hardware: {
    drivers:  choices.drivers,
    packages: choices.driverPkgs
      ? choices.driverPkgs.split(" ").filter(Boolean)
      : ["mesa", "vulkan-loader"],
    zram:     choices.zram === "true",
  },

  services: {
    enabled: [
      ...deServices[choices.desktop] ?? [],
      ...(choices.ssh   === "true" ? ["sshd"]          : []),
      ...(choices.zram  === "true" ? ["zramen"]         : []),
      ...(choices.flatpak === "true" ? ["flatpak-system-helper"] : []),
    ],
  },

  // Users can add more packages here after install
  // hollow apply will pick them up
  user_packages: [],
};

// ── Write /etc/hollow.json ───────────────────────────────
const rootMount = process.env.CALAMARES_ROOT ?? "/mnt";
const outputPath = `${rootMount}/etc/hollow.json`;

try {
  writeFileSync(outputPath, JSON.stringify(hollow, null, 2) + "\n");
  console.log(`[hollow] Written: ${outputPath}`);
} catch (err) {
  console.error(`[hollow] Failed to write hollow.json: ${err.message}`);
  process.exit(1);
}

// ── Enable runit services ────────────────────────────────
console.log("[hollow] Enabling runit services...");

for (const svc of hollow.services.enabled) {
  const svPath = `${rootMount}/etc/sv/${svc}`;
  const rlPath = `${rootMount}/etc/runit/runsvdir/default/${svc}`;

  if (existsSync(svPath)) {
    try {
      execSync(`ln -sf /etc/sv/${svc} ${rlPath}`);
      console.log(`[hollow]   enabled: ${svc}`);
    } catch {
      console.warn(`[hollow]   skipped: ${svc} (not found in /etc/sv)`);
    }
  } else {
    console.warn(`[hollow]   missing: ${svc}`);
  }
}

// ── Set user shell ───────────────────────────────────────
const shellBinMap = {
  fish: "/bin/fish",
  bash: "/bin/bash",
  zsh:  "/bin/zsh",
};

const shellBin = shellBinMap[choices.shell] ?? "/bin/bash";
try {
  execSync(`chroot ${rootMount} chsh -s ${shellBin} ${choices.username}`);
  console.log(`[hollow] Shell set to ${shellBin} for ${choices.username}`);
} catch (err) {
  console.warn(`[hollow] Could not set shell: ${err.message}`);
}

// ── Apply zram if enabled ────────────────────────────────
if (hollow.hardware.zram) {
  try {
    execSync(`chroot ${rootMount} xbps-install -Sy zramen`);
    console.log("[hollow] zram enabled");
  } catch {
    console.warn("[hollow] zramen install failed, skipping");
  }
}

// ── Install bun ──────────────────────────────────────────
console.log("[hollow] Installing bun...");
try {
  execSync(
    `chroot ${rootMount} sh -c "curl -fsSL https://bun.sh/install | bash -s -- --install-dir /usr/local/bin"`,
    { stdio: "pipe" }
  );
  console.log("[hollow] bun installed");
} catch {
  console.warn("[hollow] bun install failed — run manually: curl -fsSL https://bun.sh/install | bash");
}

// ── Set hostname ─────────────────────────────────────────
try {
  writeFileSync(`${rootMount}/etc/hostname`, hollow.system.hostname + "\n");
  console.log(`[hollow] Hostname: ${hollow.system.hostname}`);
} catch (err) {
  console.warn(`[hollow] Could not write hostname: ${err.message}`);
}

console.log("[hollow] Done. hollow.json is ready.");
console.log(`[hollow] Edit /etc/hollow.json and run 'hollow apply' to reconfigure your system.`);
