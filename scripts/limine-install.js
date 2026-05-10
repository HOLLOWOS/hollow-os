#!/usr/bin/env bun
/**
 * limine-install.js
 * HollowOS Limine bootloader installer
 *
 * Runs as a Calamares shellprocess module after packages are installed.
 * Installs Limine to the EFI partition and writes limine.conf
 * with the correct root UUID filled in.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";

const ROOT      = process.env.CALAMARES_ROOT ?? "/mnt";
const VERSION   = process.env.HOLLOW_VERSION  ?? "2025.1";
const EFI_PART  = process.env.HOLLOW_EFI_PART ?? "";
const ROOT_PART = process.env.HOLLOW_ROOT_PART ?? "";

// ── Helpers ───────────────────────────────────────────────
const log  = (msg) => console.log(`[limine] ${msg}`);
const warn = (msg) => console.warn(`[limine] WARN: ${msg}`);
const fail = (msg) => { console.error(`[limine] FAIL: ${msg}`); process.exit(1); };

const run = (cmd, opts = {}) => {
  try {
    return execSync(cmd, { stdio: "pipe", ...opts }).toString().trim();
  } catch (err) {
    if (opts.optional) { warn(`Command failed (optional): ${cmd}`); return ""; }
    fail(`Command failed: ${cmd}\n${err.stderr?.toString()}`);
  }
};

// ── Get root partition UUID ───────────────────────────────
log("Detecting root partition UUID...");

let rootUUID = "";

if (ROOT_PART) {
  rootUUID = run(`blkid -s UUID -o value ${ROOT_PART}`);
} else {
  // Fallback: find the partition mounted at ROOT
  rootUUID = run(`findmnt -n -o UUID ${ROOT}`);
}

if (!rootUUID) fail("Could not determine root UUID — cannot write limine.conf");
log(`Root UUID: ${rootUUID}`);

// ── Detect EFI partition ──────────────────────────────────
log("Detecting EFI partition...");

let efiPart = EFI_PART;
if (!efiPart) {
  efiPart = run(`findmnt -n -o SOURCE ${ROOT}/boot/efi`, { optional: true })
         || run(`findmnt -n -o SOURCE ${ROOT}/efi`, { optional: true });
}

if (!efiPart) fail("Could not find EFI partition — is it mounted?");
log(`EFI partition: ${efiPart}`);

// ── Install Limine package into chroot ────────────────────
log("Installing Limine...");
run(`chroot ${ROOT} xbps-install -Sy limine`);

// ── Create EFI directory structure ────────────────────────
log("Setting up EFI directories...");

const efiDir = `${ROOT}/boot/efi/EFI/hollowos`;
mkdirSync(efiDir, { recursive: true });

// ── Copy Limine EFI binary ────────────────────────────────
log("Copying Limine EFI binary...");

const limineEFI = `${ROOT}/usr/share/limine/BOOTX64.EFI`;
if (!existsSync(limineEFI)) {
  fail(`Limine EFI binary not found at ${limineEFI}`);
}

run(`cp ${limineEFI} ${efiDir}/BOOTX64.EFI`);

// Also install to fallback path for maximum compatibility
const fallbackDir = `${ROOT}/boot/efi/EFI/BOOT`;
mkdirSync(fallbackDir, { recursive: true });
run(`cp ${limineEFI} ${fallbackDir}/BOOTX64.EFI`, { optional: true });

// ── Register with EFI firmware ────────────────────────────
log("Registering Limine with EFI firmware...");

const efiDisk = efiPart.replace(/[0-9]+$/, "");
const efiPartNum = efiPart.match(/[0-9]+$/)?.[0] ?? "1";

run(
  `efibootmgr --create --disk ${efiDisk} --part ${efiPartNum} ` +
  `--label "HollowOS" --loader "\\EFI\\hollowos\\BOOTX64.EFI"`,
  { optional: true }
);

// ── Write limine.conf ─────────────────────────────────────
log("Writing limine.conf...");

const templatePath = "/usr/share/calamares/branding/hollowos/limine.conf.template";
let template = "";

try {
  template = readFileSync(templatePath, "utf8");
} catch {
  fail(`Could not read limine.conf template at ${templatePath}`);
}

const limineConf = template
  .replaceAll("${ROOT_UUID}", rootUUID)
  .replaceAll("${VERSION}",   VERSION);

// Write to EFI partition
writeFileSync(`${efiDir}/limine.conf`, limineConf);

// Also write to /boot for reference and hollow apply regeneration
mkdirSync(`${ROOT}/boot/limine`, { recursive: true });
writeFileSync(`${ROOT}/boot/limine/limine.conf`, limineConf);

log("limine.conf written successfully");

// ── Copy kernel and initramfs ─────────────────────────────
log("Ensuring kernel and initramfs are in /boot...");

// void-mklive should handle this but we verify
const vmlinuz = `${ROOT}/boot/vmlinuz`;
const initramfs = `${ROOT}/boot/initramfs.img`;

if (!existsSync(vmlinuz))   warn("vmlinuz not found in /boot — boot may fail");
if (!existsSync(initramfs)) warn("initramfs.img not found in /boot — boot may fail");

// ── Done ──────────────────────────────────────────────────
log("Limine installation complete.");
log(`EFI binary  → ${efiDir}/BOOTX64.EFI`);
log(`Boot config → ${efiDir}/limine.conf`);
log(`Reference   → ${ROOT}/boot/limine/limine.conf`);
