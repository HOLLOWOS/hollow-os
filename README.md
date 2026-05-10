# hollowos-installer

Calamares installer configuration for [HollowOS](https://github.com/hollowos/hollowos) — a declarative Linux experience built on Void.

## What this is

This repo contains the branding, module configs, and post-install scripts that drive the HollowOS installer. It does not contain Calamares itself — Calamares is pulled in as a Void package.

## Structure

```
hollowos-installer/
├── branding/
│   └── hollowos/
│       ├── branding.desc      # Colors, strings, logo paths
│       ├── show.qml           # Slideshow shown during install
│       └── logo.png           # HollowOS planet logo
├── modules/
│   ├── locale.conf            # Timezone / region
│   ├── keyboard.conf          # Keyboard layout
│   ├── users.conf             # User creation
│   └── packages.conf          # Package groups by DE / browser / drivers
├── scripts/
│   └── hollow-generate.js     # Bun script — writes /etc/hollow.json post-install
└── settings.conf              # Master module sequence
```

## How it works

1. User boots the HollowOS live ISO
2. Calamares launches and walks through the module sequence in `settings.conf`
3. After install, `hollow-generate.js` runs via Bun and writes `/etc/hollow.json`
4. `hollow.json` describes the entire system state — desktop, shell, packages, services
5. Users can edit `/etc/hollow.json` at any time and run `hollow apply` to reconfigure

## hollow.json example

```json
{
  "system": {
    "hostname": "mymachine",
    "locale": "en_US.UTF-8",
    "timezone": "America/New_York",
    "keyboard": "us",
    "unfree": false
  },
  "user": {
    "name": "alice",
    "shell": "fish",
    "autologin": false
  },
  "desktop": {
    "environment": "kde",
    "displayManager": "sddm",
    "theme": "dark"
  },
  "packages": {
    "browser": "firefox",
    "flatpak": true,
    "extra": []
  },
  "hardware": {
    "drivers": "auto",
    "zram": true
  },
  "services": {
    "enabled": ["dbus", "elogind", "NetworkManager", "sddm", "pipewire"]
  },
  "user_packages": []
}
```

## Installing Calamares on Void

```bash
sudo xbps-install -S calamares
```

Then copy this repo to `/etc/calamares/` and copy `branding/hollowos/` to `/usr/share/calamares/branding/hollowos/`.

## Requirements

- Void Linux base
- Calamares 3.3+
- Bun (for hollow-generate.js)

## License

GPL-2.0-or-later — same as Calamares itself.
