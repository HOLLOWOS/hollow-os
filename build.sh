#!/bin/bash
# HollowOS ISO build script
# Requires: void-mklive (https://github.com/void-linux/void-mklive)
#
# Usage:
#   chmod +x build.sh
#   sudo ./build.sh
#
# Output: hollowos-2025.1-x86_64.iso

set -euo pipefail

# ── Config ───────────────────────────────────────────────
ARCH="x86_64"
VERSION="2025.1"
ISO_NAME="hollowos-${VERSION}-${ARCH}.iso"
MKLIVE_DIR="./void-mklive"
OVERLAY_DIR="./overlay"
WORK_DIR="/tmp/hollowos-build"

# ── Colors for output ────────────────────────────────────
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${BLUE}[hollow]${NC} $1"; }
ok()   { echo -e "${GREEN}[hollow]${NC} $1"; }
fail() { echo -e "${RED}[hollow]${NC} $1"; exit 1; }

# ── Check dependencies ───────────────────────────────────
log "Checking dependencies..."
command -v xbps-install &>/dev/null || fail "xbps-install not found — run this on Void Linux"
[ -d "$MKLIVE_DIR" ] || fail "void-mklive not found. Run: git clone https://github.com/void-linux/void-mklive"

# ── Package list ─────────────────────────────────────────
# Everything needed in the live environment
PACKAGES=(
  # Base
  base-system
  curl
  git
  unzip
  NetworkManager
  dbus
  elogind
  polkit
  pipewire
  wireplumber
  alsa-utils
  xdg-user-dirs
  mesa
  vulkan-loader

  # GNOME live desktop
  gnome
  gnome-apps
  gdm

  # Fonts
  noto-fonts-ttf
  noto-fonts-emoji
  liberation-fonts-ttf

  # Calamares build dependencies (Qt6/KF6)
  cmake
  extra-cmake-modules
  qt6-devel
  qt6-declarative-devel
  qt6-svg-devel
  qt6-tools-devel
  qt6-wayland-devel
  kf6-kcoreaddons-devel
  kf6-ki18n-devel
  kf6-kconfig-devel
  kf6-kwidgetsaddons-devel
  kf6-kservice-devel
  kf6-kpackage-devel
  kf6-kcrash-devel
  kpmcore-devel
  boost-devel
  yaml-cpp-devel
  libatasmart-devel
  python3
  python3-devel
  gettext
  gcc
  make
  git

  # Bootloader
  limine
  efibootmgr

  # Useful live tools
  gparted
  nano
  vim
  firefox
)

# ── Build Calamares from source ──────────────────────────
log "Building Calamares from source..."

CALAMARES_VERSION="calamares"
CALAMARES_DIR="/tmp/calamares-build"

if [ ! -d "$CALAMARES_DIR" ]; then
  git clone --depth=1 --branch ${CALAMARES_VERSION} \
    https://github.com/calamares/calamares.git "$CALAMARES_DIR" \
    || fail "Failed to clone Calamares"
fi

mkdir -p "$CALAMARES_DIR/build"
cd "$CALAMARES_DIR/build"

cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX=/usr \
  -DCMAKE_PREFIX_PATH=/usr/lib/cmake \
  -DWITH_QT6=ON \
  -DWITH_PYTHON=ON \
  -DWITH_QML=ON \
  -DSKIP_MODULES="partition partitionq" \
  || fail "Calamares cmake failed"

make -j$(nproc) || fail "Calamares build failed"
make DESTDIR="$WORK_DIR/overlay" install || fail "Calamares install failed"

cd -
ok "Calamares built and installed"

# ── Prepare overlay ──────────────────────────────────────
log "Preparing overlay..."
mkdir -p "$WORK_DIR/overlay"
cp -r "$OVERLAY_DIR/." "$WORK_DIR/overlay/"

# Copy Calamares configs
mkdir -p "$WORK_DIR/overlay/etc/calamares/modules"
cp settings.conf "$WORK_DIR/overlay/etc/calamares/"
cp modules/*.conf "$WORK_DIR/overlay/etc/calamares/modules/"

# Copy Calamares branding
mkdir -p "$WORK_DIR/overlay/usr/share/calamares/branding"
cp -r branding/hollowos "$WORK_DIR/overlay/usr/share/calamares/branding/"

# Copy hollow-generate script
mkdir -p "$WORK_DIR/overlay/usr/lib/calamares/modules"
cp scripts/hollow-generate.js "$WORK_DIR/overlay/usr/lib/calamares/modules/"
cp scripts/hollow-detect.js  "$WORK_DIR/overlay/usr/lib/calamares/modules/"

# Enable runit services in live environment
mkdir -p "$WORK_DIR/overlay/etc/runit/runsvdir/default"
for svc in gdm dbus NetworkManager elogind pipewire; do
  ln -sf "/etc/sv/$svc" "$WORK_DIR/overlay/etc/runit/runsvdir/default/$svc"
done

# Create liveuser home structure
mkdir -p "$WORK_DIR/overlay/home/liveuser/.config/autostart"
cp overlay/home/liveuser/.config/autostart/calamares.desktop \
   "$WORK_DIR/overlay/home/liveuser/.config/autostart/"

ok "Overlay ready"

# ── Build ISO ────────────────────────────────────────────
log "Building ISO — this will take a while..."

cd "$MKLIVE_DIR"

sudo ./mklive.sh \
  -a "$ARCH" \
  -o "../$ISO_NAME" \
  -p "${PACKAGES[*]}" \
  -I "$WORK_DIR/overlay" \
  -s "$(cat /etc/xbps.d/00-repository-main.conf 2>/dev/null || echo 'https://repo-default.voidlinux.org/current')" \
  -- \
  -r "liveuser:liveuser:liveuser:/home/liveuser:/bin/bash:wheel,video,audio,network,storage"

cd ..

# ── Done ─────────────────────────────────────────────────
if [ -f "$ISO_NAME" ]; then
  ok "ISO built successfully: $ISO_NAME"
  ok "Size: $(du -sh $ISO_NAME | cut -f1)"
  log "Test with: qemu-system-x86_64 -m 4G -cdrom $ISO_NAME -boot d"
else
  fail "ISO build failed — check output above"
fi
