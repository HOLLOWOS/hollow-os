/* HollowOS Calamares - Desktop Environment Picker
   Lets the user choose between KDE, GNOME, Hyprland, and Sway.
   Writes choice to Calamares global storage for hollow-generate.js */

import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import io.calamares.ui 1.0
import io.calamares.core 1.0

Page {
    id: dePickerPage

    anchors.fill: parent
    background: Rectangle { color: "#111116" }

    // ── State ─────────────────────────────────────────────
    property string selectedDE: "kde"
    property string selectedDescription: desktops[0].description
    property string selectedPackages: desktops[0].packages

    // ── DE definitions ────────────────────────────────────
    property var desktops: [
        {
            id:          "kde",
            name:        "KDE Plasma",
            tag:         "Recommended",
            description: "A feature-rich, highly customizable desktop. Looks great out of the box and has an answer for everything. The most Windows-like experience on Linux.",
            packages:    "kde5  kde5-baseapps  sddm  dolphin  konsole",
            accent:      "#3F549E",
        },
        {
            id:          "gnome",
            name:        "GNOME",
            tag:         "Minimal",
            description: "Clean, distraction-free, and opinionated. Gets out of your way and lets you focus. Touch and HiDPI friendly. The most Mac-like experience on Linux.",
            packages:    "gnome  gnome-apps  gdm  nautilus  gnome-terminal",
            accent:      "#3F549E",
        },
        {
            id:          "hyprland",
            name:        "Hyprland",
            tag:         "Power User",
            description: "A dynamic tiling compositor for Wayland with fluid animations. Infinitely configurable. Built for people who want their desktop to work exactly the way they think.",
            packages:    "hyprland  waybar  wofi  dunst  kitty  grim  slurp",
            accent:      "#3F549E",
        },
        {
            id:          "sway",
            name:        "Sway",
            tag:         "Keyboard First",
            description: "A tiling window manager that follows the i3 layout model on Wayland. Stable, minimal, and scriptable. If you know i3, you already know Sway.",
            packages:    "sway  waybar  dmenu  foot  dunst  swaylock  swayidle",
            accent:      "#3F549E",
        },
    ]

    // ── Mutual exclusion button group ─────────────────────
    ButtonGroup { id: deGroup }

    // ── Write to Calamares global storage on change ───────
    onSelectedDEChanged: {
        Calamares.globalStorage.insert("desktopEnvironment", selectedDE)
    }

    Component.onCompleted: {
        Calamares.globalStorage.insert("desktopEnvironment", selectedDE)
    }

    // ── Background glow ───────────────────────────────────
    Rectangle {
        width: 400; height: 400
        radius: 200
        x: parent.width - 150; y: -150
        color: "transparent"
        Rectangle {
            anchors.fill: parent
            radius: parent.radius
            color: "#3F549E"
            opacity: 0.05
        }
    }

    // ── Main layout ───────────────────────────────────────
    ColumnLayout {
        anchors {
            fill: parent
            margins: 40
            topMargin: 32
        }
        spacing: 0

        // ── Header ────────────────────────────────────────
        ColumnLayout {
            spacing: 6
            Layout.bottomMargin: 28

            RowLayout {
                spacing: 10

                Rectangle {
                    width: 18; height: 1
                    color: "#3F549E"
                    anchors.verticalCenter: parent.verticalCenter
                }

                Text {
                    text: "DESKTOP ENVIRONMENT"
                    color: "#3F549E"
                    font.pixelSize: 10
                    font.letterSpacing: 2
                    font.family: "monospace"
                }
            }

            Text {
                text: "Choose your workspace."
                color: "#f0eee8"
                font.pixelSize: 26
                font.weight: Font.Light
                letterSpacing: -0.5
            }

            Text {
                text: "You can switch later by editing /etc/hollow.json and running hollow apply."
                color: "#555358"
                font.pixelSize: 12
                font.weight: Font.Light
            }
        }

        // ── DE grid ───────────────────────────────────────
        GridLayout {
            id: deGrid
            columns: 2
            rowSpacing: 12
            columnSpacing: 12
            Layout.fillWidth: true
            Layout.bottomMargin: 20

            Repeater {
                model: dePickerPage.desktops

                delegate: Button {
                    id: deBtn
                    Layout.fillWidth: true
                    Layout.preferredHeight: 90
                    checkable: true
                    checked: dePickerPage.selectedDE === modelData.id
                    ButtonGroup.group: deGroup

                    onClicked: {
                        dePickerPage.selectedDE = modelData.id
                        dePickerPage.selectedDescription = modelData.description
                        dePickerPage.selectedPackages = modelData.packages
                    }

                    // Hover state
                    HoverHandler { id: hover }

                    background: Rectangle {
                        radius: 10
                        color: deBtn.checked
                            ? "#0d0d11"
                            : hover.hovered ? "#161620" : "#0d0d11"

                        // Outer glow when selected
                        Rectangle {
                            anchors.fill: parent
                            radius: parent.radius
                            color: "transparent"
                            border.color: deBtn.checked ? "#3F549E" : "#1e1e28"
                            border.width: deBtn.checked ? 1.5 : 0.5

                            Behavior on border.color {
                                ColorAnimation { duration: 200 }
                            }
                            Behavior on border.width {
                                NumberAnimation { duration: 200 }
                            }
                        }

                        // Selected glow fill
                        Rectangle {
                            anchors.fill: parent
                            radius: parent.radius
                            color: "#3F549E"
                            opacity: deBtn.checked ? 0.06 : 0

                            Behavior on opacity {
                                NumberAnimation { duration: 250 }
                            }
                        }

                        // Left accent bar
                        Rectangle {
                            width: 3
                            height: parent.height * 0.5
                            radius: 2
                            anchors {
                                left: parent.left
                                leftMargin: 0
                                verticalCenter: parent.verticalCenter
                            }
                            color: "#3F549E"
                            opacity: deBtn.checked ? 1 : 0

                            Behavior on opacity {
                                NumberAnimation { duration: 200 }
                            }
                        }
                    }

                    contentItem: RowLayout {
                        anchors {
                            fill: parent
                            leftMargin: 20
                            rightMargin: 16
                        }
                        spacing: 14

                        // DE icon placeholder (letter-based)
                        Rectangle {
                            width: 40; height: 40
                            radius: 8
                            color: deBtn.checked ? "#3F549E" : "#1a1a24"

                            Behavior on color {
                                ColorAnimation { duration: 200 }
                            }

                            Text {
                                anchors.centerIn: parent
                                text: modelData.name.charAt(0)
                                color: deBtn.checked ? "#ffffff" : "#555358"
                                font.pixelSize: 17
                                font.weight: Font.SemiBold

                                Behavior on color {
                                    ColorAnimation { duration: 200 }
                                }
                            }
                        }

                        // DE name + tag
                        ColumnLayout {
                            spacing: 4
                            Layout.fillWidth: true

                            RowLayout {
                                spacing: 8

                                Text {
                                    text: modelData.name
                                    color: deBtn.checked ? "#f0eee8" : "#888580"
                                    font.pixelSize: 14
                                    font.weight: Font.Medium

                                    Behavior on color {
                                        ColorAnimation { duration: 200 }
                                    }
                                }

                                // Tag pill
                                Rectangle {
                                    height: 16
                                    width: tagLabel.width + 10
                                    radius: 4
                                    color: deBtn.checked ? "#1e2840" : "#181820"
                                    border.color: deBtn.checked ? "#3F549E" : "#252530"
                                    border.width: 0.5

                                    Text {
                                        id: tagLabel
                                        anchors.centerIn: parent
                                        text: modelData.tag
                                        color: deBtn.checked ? "#6b82c4" : "#444248"
                                        font.pixelSize: 9
                                        font.letterSpacing: 0.5
                                    }
                                }
                            }

                            // Package preview
                            Text {
                                text: modelData.packages
                                color: deBtn.checked ? "#3F549E" : "#333138"
                                font.pixelSize: 10
                                font.family: "monospace"
                                elide: Text.ElideRight
                                Layout.fillWidth: true

                                Behavior on color {
                                    ColorAnimation { duration: 200 }
                                }
                            }
                        }

                        // Selected checkmark
                        Rectangle {
                            width: 18; height: 18
                            radius: 9
                            color: "#3F549E"
                            opacity: deBtn.checked ? 1 : 0

                            Behavior on opacity {
                                NumberAnimation { duration: 200 }
                            }

                            Text {
                                anchors.centerIn: parent
                                text: "✓"
                                color: "#ffffff"
                                font.pixelSize: 10
                                font.weight: Font.Bold
                            }
                        }
                    }
                }
            }
        }

        // ── Description panel ─────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: descText.height + 28
            radius: 8
            color: "#0d0d11"
            border.color: "#1e1e28"
            border.width: 0.5

            RowLayout {
                anchors {
                    fill: parent
                    margins: 16
                }
                spacing: 12

                // Info icon
                Rectangle {
                    width: 6; height: 6
                    radius: 3
                    color: "#3F549E"
                    anchors.top: parent.top
                    anchors.topMargin: 4
                }

                Text {
                    id: descText
                    Layout.fillWidth: true
                    text: dePickerPage.selectedDescription
                    color: "#666468"
                    font.pixelSize: 12
                    wrapMode: Text.WordWrap
                    lineHeight: 1.65

                    Behavior on text {
                        SequentialAnimation {
                            NumberAnimation {
                                target: descText
                                property: "opacity"
                                from: 1; to: 0
                                duration: 100
                            }
                            NumberAnimation {
                                target: descText
                                property: "opacity"
                                from: 0; to: 1
                                duration: 150
                            }
                        }
                    }
                }
            }
        }
    }
}
