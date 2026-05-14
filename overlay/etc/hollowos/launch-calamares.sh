#!/bin/bash
# HollowOS - Calamares launcher
# Runs at live session start to launch the installer

# Make sure library cache is up to date
sudo ldconfig

# Wait for desktop to fully settle
sleep 5

# Launch calamares
exec sudo -E calamares
