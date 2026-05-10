/* HollowOS Calamares - Hardware Detection Page
   Runs hollow-detect.js, shows detected hardware,
   and writes driver packages to Calamares global storage */

import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import io.calamares.ui 1.0
import io.calamares.core 1.0

Page {
    id: hwPage

    anchors.fill: parent
    background: Rectangle { color: "#111116" }

    // ── State ─────────────────────────────────────────────
    property bool scanning:  true
    property bool done:      false
    property bool hasWarn:   false
    property var  hardware:  ({})
    property var  packages:  []
    property var  warnings:  []
    property int  scanStep:  0

    readonly property var scanSteps: [
        "Reading PCI devices...",
        "Reading USB devices...",
        "Detecting GPU...",
        "Detecting Wi-Fi adapter...",
        "Detecting audio hardware...",
        "Detecting CPU microcode...",
        "Mapping driver packages...",
        "Done.",
    ]

    // ── Run detection on load ─────────────────────────────
    Component.onCompleted: {
        scanStepTimer.start()
        detectionTimer.start()
    }

    // ── Fake step progress for UX feel ────────────────────
    Timer {
        id: scanStepTimer
        interval: 380
        repeat: true
        running: hwPage.scanning
        onTriggered: {
            if (hwPage.scanStep < hwPage.scanSteps.length - 1) {
                hwPage.scanStep++
            }
        }
    }

    // ── Run the actual detection ───────────────────────────
    Timer {
        id: detectionTimer
        interval: 100
        repeat: false
        onTriggered: {
            var result = Calamares.utils.runCommand(
                "bun /usr/lib/calamares/modules/hollow-detect.js --json",
                ""
            )

            try {
                var parsed = JSON.parse(result)
                hwPage.hardware = parsed.hardware
                hwPage.packages = parsed.packages
                hwPage.warnings = parsed.warnings ?? []
                hwPage.hasWarn  = hwPage.warnings.length > 0

                // Write packages to global storage for packages module
                Calamares.globalStorage.insert(
                    "detectedDriverPackages",
                    hwPage.packages.join(" ")
                )

                // Flag Broadcom so installer can warn about unfree
                var needsUnfree = hwPage.packages.includes("broadcom-wl-dkms")
                Calamares.globalStorage.insert("driverNeedsUnfree", needsUnfree)

            } catch (e) {
                // Detection failed — fall back to base packages
                hwPage.hardware = { gpu: { name: "Unknown", driver: "vesa" } }
                hwPage.packages = ["mesa", "vulkan-loader", "alsa-utils", "pipewire"]
                hwPage.warnings = ["Hardware detection failed — base drivers will be installed."]
                hwPage.hasWarn  = true
            }

            hwPage.scanStep = hwPage.scanSteps.length - 1
            hwPage.scanning = false
            hwPage.done     = true
            scanStepTimer.stop()
        }
    }

    // ── Background glow ───────────────────────────────────
    Rectangle {
        width: 360; height: 360; radius: 180
        x: parent.width - 120; y: -120
        color: "transparent"
        Rectangle {
            anchors.fill: parent; radius: parent.radius
            color: "#3F549E"; opacity: hwPage.done ? 0.05 : 0.03
            Behavior on opacity { NumberAnimation { duration: 800 } }
        }
    }

    // ── Main layout ───────────────────────────────────────
    ColumnLayout {
        anchors { fill: parent; margins: 40; topMargin: 32 }
        spacing: 0

        // ── Header ────────────────────────────────────────
        ColumnLayout {
            spacing: 6
            Layout.bottomMargin: 28

            RowLayout {
                spacing: 10
                Rectangle { width: 18; height: 1; color: "#3F549E" }
                Text {
                    text: "HARDWARE DETECTION"
                    color: "#3F549E"
                    font.pixelSize: 10
                    font.letterSpacing: 2
                    font.family: "monospace"
                }
            }

            Text {
                text: hwPage.done ? "Your hardware." : "Scanning your hardware."
                color: "#f0eee8"
                font.pixelSize: 26
                font.weight: Font.Light
                letterSpacing: -0.5
                Behavior on text { }
            }

            Text {
                text: hwPage.done
                    ? "Drivers have been selected automatically. You can override below."
                    : "This only takes a moment."
                color: "#555358"
                font.pixelSize: 12
                font.weight: Font.Light
            }
        }

        // ── Scanning state ────────────────────────────────
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: hwPage.scanning

            ColumnLayout {
                anchors.centerIn: parent
                spacing: 20

                // Orbit animation
                Item {
                    width: 64; height: 64
                    Layout.alignment: Qt.AlignHCenter

                    Image {
                        anchors.centerIn: parent
                        source: "logo.png"
                        width: 36; height: 36
                        opacity: 0.5
                    }

                    Rectangle {
                        anchors.centerIn: parent
                        width: 60; height: 60; radius: 30
                        color: "transparent"
                        border.color: "#3F549E"; border.width: 1.5
                        opacity: 0.5

                        RotationAnimation on rotation {
                            from: 0; to: 360
                            duration: 1800
                            loops: Animation.Infinite
                            running: hwPage.scanning
                        }
                    }
                }

                // Step text
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: hwPage.scanSteps[hwPage.scanStep]
                    color: "#3F549E"
                    font.pixelSize: 12
                    font.family: "monospace"

                    Behavior on text {
                        SequentialAnimation {
                            NumberAnimation { target: parent; property: "opacity"; from: 1; to: 0; duration: 80 }
                            NumberAnimation { target: parent; property: "opacity"; from: 0; to: 1; duration: 120 }
                        }
                    }
                }

                // Step counter
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: (hwPage.scanStep + 1) + " / " + hwPage.scanSteps.length
                    color: "#333138"
                    font.pixelSize: 11
                    font.family: "monospace"
                }
            }
        }

        // ── Results state ─────────────────────────────────
        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 10
            visible: hwPage.done
            opacity: hwPage.done ? 1 : 0

            Behavior on opacity {
                NumberAnimation { duration: 400 }
            }

            // Hardware cards
            GridLayout {
                columns: 2
                rowSpacing: 10
                columnSpacing: 10
                Layout.fillWidth: true

                Repeater {
                    model: [
                        {
                            label: "GPU",
                            icon:  "▪",
                            value: hwPage.hardware.gpu?.name ?? "Unknown",
                            sub:   hwPage.hardware.gpu?.driver ?? "vesa",
                        },
                        {
                            label: "Wi-Fi",
                            icon:  "▪",
                            value: hwPage.hardware.wifi?.name ?? "Not detected",
                            sub:   hwPage.hardware.wifi?.driver ?? "—",
                        },
                        {
                            label: "CPU",
                            icon:  "▪",
                            value: hwPage.hardware.cpu?.name ?? "Unknown",
                            sub:   hwPage.hardware.cpu?.driver ?? "—",
                        },
                        {
                            label: "Bluetooth",
                            icon:  "▪",
                            value: hwPage.hardware.bluetooth?.name ?? "Not detected",
                            sub:   hwPage.hardware.bluetooth?.driver ?? "—",
                        },
                    ]

                    delegate: Rectangle {
                        Layout.fillWidth: true
                        height: 64
                        radius: 8
                        color: "#0d0d11"
                        border.color: "#1e1e28"
                        border.width: 0.5

                        ColumnLayout {
                            anchors {
                                left: parent.left
                                right: parent.right
                                verticalCenter: parent.verticalCenter
                                leftMargin: 16
                                rightMargin: 16
                            }
                            spacing: 4

                            RowLayout {
                                spacing: 6
                                Text {
                                    text: modelData.label
                                    color: "#3F549E"
                                    font.pixelSize: 10
                                    font.letterSpacing: 1
                                    font.family: "monospace"
                                }
                                Rectangle {
                                    Layout.fillWidth: true
                                    height: 0.5
                                    color: "#1e1e28"
                                }
                            }

                            Text {
                                text: modelData.value
                                color: "#c8c6c0"
                                font.pixelSize: 12
                                font.weight: Font.Medium
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }

                            Text {
                                text: "driver: " + modelData.sub
                                color: "#444248"
                                font.pixelSize: 10
                                font.family: "monospace"
                            }
                        }
                    }
                }
            }

            // Package list
            Rectangle {
                Layout.fillWidth: true
                height: pkgCol.height + 24
                radius: 8
                color: "#0d0d11"
                border.color: "#1e1e28"
                border.width: 0.5

                ColumnLayout {
                    id: pkgCol
                    anchors {
                        left: parent.left; right: parent.right
                        top: parent.top; margins: 14
                    }
                    spacing: 8

                    Text {
                        text: "PACKAGES TO INSTALL"
                        color: "#3F549E"
                        font.pixelSize: 10
                        font.letterSpacing: 1.5
                        font.family: "monospace"
                    }

                    Text {
                        text: hwPage.packages.join("  ·  ")
                        color: "#555358"
                        font.pixelSize: 11
                        font.family: "monospace"
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                        lineHeight: 1.6
                    }
                }
            }

            // Warning box (Broadcom etc)
            Rectangle {
                Layout.fillWidth: true
                height: warnCol.height + 20
                radius: 8
                color: "#1a1200"
                border.color: "#3a2800"
                border.width: 0.5
                visible: hwPage.hasWarn

                ColumnLayout {
                    id: warnCol
                    anchors {
                        left: parent.left; right: parent.right
                        top: parent.top; margins: 14
                    }
                    spacing: 6

                    Text {
                        text: "⚠  Note"
                        color: "#c8a020"
                        font.pixelSize: 11
                        font.weight: Font.Medium
                    }

                    Repeater {
                        model: hwPage.warnings
                        Text {
                            text: modelData
                            color: "#887840"
                            font.pixelSize: 11
                            wrapMode: Text.WordWrap
                            Layout.fillWidth: true
                            lineHeight: 1.6
                        }
                    }
                }
            }
        }
    }
}
