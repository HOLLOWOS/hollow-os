#!/usr/bin/env bun
/**
 * hollow-detect.js
 * HollowOS hardware detection engine
 *
 * Runs lspci and lsusb, identifies GPU, Wi-Fi, Bluetooth,
 * audio, and input devices, then maps them to xbps packages.
 *
 * Output (stdout): JSON object with detected hardware and recommended packages
 *
 * Usage:
 *   bun hollow-detect.js
 *   bun hollow-detect.js --json        (same, explicit)
 *   bun hollow-detect.js --packages    (just the package list)
 */

import { execSync } from "child_process";

// ── Helpers ───────────────────────────────────────────────
const run = (cmd) => {
  try {
    return execSync(cmd, { stdio: "pipe", encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const pciData = run("lspci -nn");
const usbData = run("lsusb");
const cpuData = run("cat /proc/cpuinfo");
const dmidata = run("dmidecode -t system 2>/dev/null");

// ── PCI ID database ───────────────────────────────────────
// Format: { match: regex or string to test against lspci output, packages: [...] }

const GPU_RULES = [
  // NVIDIA — proprietary
  {
    name:     "NVIDIA (proprietary)",
    match:    /VGA.*NVIDIA|3D.*NVIDIA/i,
    packages: ["nvidia", "nvidia-libs", "nvidia-libs-32bit"],
    driver:   "nvidia",
  },
  // NVIDIA — nouveau fallback (older cards)
  {
    name:     "NVIDIA (nouveau)",
    match:    /VGA.*NV[0-9]/i,
    packages: ["xf86-video-nouveau", "mesa"],
    driver:   "nouveau",
  },
  // AMD / ATI — amdgpu (GCN 1.2+ i.e. Rx 200 series onwards)
  {
    name:     "AMD (amdgpu)",
    match:    /VGA.*AMD|VGA.*ATI|VGA.*Radeon/i,
    packages: ["mesa", "vulkan-radeon", "xf86-video-amdgpu", "libva-mesa-driver"],
    driver:   "amdgpu",
  },
  // Intel integrated
  {
    name:     "Intel (i915)",
    match:    /VGA.*Intel/i,
    packages: ["mesa", "vulkan-intel", "xf86-video-intel", "intel-media-driver"],
    driver:   "i915",
  },
  // VMware / VirtualBox (for testing in VMs)
  {
    name:     "VMware SVGA",
    match:    /VGA.*VMware/i,
    packages: ["mesa", "xf86-video-vmware"],
    driver:   "vmware",
  },
  {
    name:     "VirtualBox VGA",
    match:    /VGA.*VirtualBox/i,
    packages: ["mesa", "xf86-video-vesa", "virtualbox-ose-guest"],
    driver:   "vboxvideo",
  },
];

const WIFI_RULES = [
  // Intel Wi-Fi (iwlwifi — very common on laptops)
  {
    name:     "Intel Wi-Fi",
    match:    /Network.*Intel.*Wi-Fi|Wireless.*Intel/i,
    packages: ["linux-firmware-intel"],
    driver:   "iwlwifi",
  },
  // Broadcom (notoriously needs proprietary firmware)
  {
    name:     "Broadcom Wi-Fi",
    match:    /Network.*Broadcom|Wireless.*Broadcom|BCM43/i,
    packages: ["broadcom-wl-dkms", "linux-headers"],
    driver:   "broadcom-wl",
    note:     "Broadcom requires proprietary firmware. Enable unfree packages.",
  },
  // Realtek (common on cheap laptops)
  {
    name:     "Realtek Wi-Fi",
    match:    /Network.*Realtek|Wireless.*Realtek|RTL8/i,
    packages: ["linux-firmware-network"],
    driver:   "rtl8xxxu",
  },
  // MediaTek
  {
    name:     "MediaTek Wi-Fi",
    match:    /Network.*MediaTek|Wireless.*MediaTek|MT7/i,
    packages: ["linux-firmware-network"],
    driver:   "mt76",
  },
  // Qualcomm / Atheros
  {
    name:     "Qualcomm/Atheros Wi-Fi",
    match:    /Network.*Qualcomm|Wireless.*Atheros|QCA/i,
    packages: ["linux-firmware-network"],
    driver:   "ath10k",
  },
];

const BLUETOOTH_RULES = [
  {
    name:     "Bluetooth",
    match:    /Bluetooth/i,
    packages: ["bluez", "bluez-alsa"],
    driver:   "btusb",
  },
];

const AUDIO_RULES = [
  // AMD audio (usually bundled with GPU)
  {
    name:     "AMD HD Audio",
    match:    /Audio.*AMD|HD Audio.*AMD/i,
    packages: ["alsa-utils", "pipewire", "wireplumber"],
    driver:   "snd_hda_intel",
  },
  // Intel HD Audio
  {
    name:     "Intel HD Audio",
    match:    /Audio.*Intel|HD Audio.*Intel/i,
    packages: ["alsa-utils", "pipewire", "wireplumber", "sof-firmware"],
    driver:   "snd_hda_intel",
  },
  // NVIDIA HD Audio
  {
    name:     "NVIDIA HD Audio",
    match:    /Audio.*NVIDIA/i,
    packages: ["alsa-utils", "pipewire", "wireplumber"],
    driver:   "snd_hda_intel",
  },
];

const TOUCHPAD_RULES = [
  {
    name:     "Synaptics Touchpad",
    match:    /Synaptics/i,
    packages: ["xf86-input-synaptics"],
    driver:   "synaptics",
  },
  {
    name:     "ELAN Touchpad",
    match:    /ELAN/i,
    packages: ["xf86-input-libinput"],
    driver:   "libinput",
  },
];

// ── CPU vendor detection ──────────────────────────────────
const CPU_RULES = [
  {
    name:     "Intel CPU",
    match:    /vendor_id\s*:\s*GenuineIntel/i,
    packages: ["intel-ucode"],
    driver:   "intel",
  },
  {
    name:     "AMD CPU",
    match:    /vendor_id\s*:\s*AuthenticAMD/i,
    packages: ["amd-ucode"],
    driver:   "amd",
  },
];

// ── Detection engine ──────────────────────────────────────
function detect(rules, data) {
  for (const rule of rules) {
    const regex = rule.match instanceof RegExp
      ? rule.match
      : new RegExp(rule.match, "i");

    if (regex.test(data)) {
      return rule;
    }
  }
  return null;
}

function detectAll(rules, data) {
  return rules.filter(rule => {
    const regex = rule.match instanceof RegExp
      ? rule.match
      : new RegExp(rule.match, "i");
    return regex.test(data);
  });
}

// ── Run detection ─────────────────────────────────────────
const detected = {
  gpu:       detect(GPU_RULES,       pciData),
  wifi:      detect(WIFI_RULES,      pciData + "\n" + usbData),
  bluetooth: detect(BLUETOOTH_RULES, pciData + "\n" + usbData),
  audio:     detectAll(AUDIO_RULES,  pciData),
  touchpad:  detect(TOUCHPAD_RULES,  usbData),
  cpu:       detect(CPU_RULES,       cpuData),
};

// ── Build package list ────────────────────────────────────
const allPackages = new Set();

for (const [, result] of Object.entries(detected)) {
  if (!result) continue;
  const items = Array.isArray(result) ? result : [result];
  items.forEach(r => r?.packages?.forEach(p => allPackages.add(p)));
}

// Always include base
["mesa", "vulkan-loader", "alsa-utils", "pipewire", "wireplumber"]
  .forEach(p => allPackages.add(p));

// ── Build result object ───────────────────────────────────
const result = {
  hardware: {
    gpu: detected.gpu
      ? { name: detected.gpu.name, driver: detected.gpu.driver }
      : { name: "Unknown / Generic", driver: "vesa" },

    wifi: detected.wifi
      ? { name: detected.wifi.name, driver: detected.wifi.driver, note: detected.wifi.note ?? null }
      : { name: "Not detected", driver: null },

    bluetooth: detected.bluetooth
      ? { name: detected.bluetooth.name, driver: detected.bluetooth.driver }
      : { name: "Not detected", driver: null },

    audio: detected.audio.length > 0
      ? detected.audio.map(a => ({ name: a.name, driver: a.driver }))
      : [{ name: "Not detected", driver: null }],

    cpu: detected.cpu
      ? { name: detected.cpu.name, driver: detected.cpu.driver }
      : { name: "Unknown CPU", driver: null },

    touchpad: detected.touchpad
      ? { name: detected.touchpad.name, driver: detected.touchpad.driver }
      : null,
  },

  packages: [...allPackages],

  warnings: [
    detected.wifi?.note,
  ].filter(Boolean),
};

// ── Output ────────────────────────────────────────────────
const mode = process.argv[2];

if (mode === "--packages") {
  console.log(result.packages.join("\n"));
} else {
  console.log(JSON.stringify(result, null, 2));
}
