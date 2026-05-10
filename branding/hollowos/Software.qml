/* HollowOS Calamares - Software & Preferences Page
   Browser, shell, flatpak, unfree, SSH, zram, autologin
   Writes all choices to Calamares global storage */

import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import io.calamares.ui 1.0
import io.calamares.core 1.0

Page {
    id: softwarePage

    anchors.fill: parent
    background: Rectangle { color: "#111116" }

    // ── State ─────────────────────────────────────────────
    property string selectedBrowser: "firefox"
    property string selectedShell:   "fish"
    property bool   flatpakEnabled:  true
    property bool   unfreeEnabled:   false
    property bool   sshEnabled:      false
    property bool   zramEnabled:     true
    property bool   autologinEnabled:false

    // ── Write everything to global storage on any change ──
    function sync() {
        Calamares.globalStorage.insert("browser",   selectedBrowser)
        Calamares.globalStorage.insert("shell",     selectedShell)
        Calamares.globalStorage.insert("flatpak",   flatpakEnabled)
        Calamares.globalStorage.insert("unfree",    unfreeEnabled)
        Calamares.globalStorage.insert("ssh",       sshEnabled)
        Calamares.globalStorage.insert("zram",      zramEnabled)
        Calamares.globalStorage.insert("autologin", autologinEnabled)
    }

    Component.onCompleted: sync()

    // ── Button groups ─────────────────────────────────────
    ButtonGroup { id: browserGroup }
    ButtonGroup { id: shellGroup }

    // ── Background glow ───────────────────────────────────
    Rectangle {
        width: 360; height: 360; radius: 180
        x: parent.width - 120; y: -120
        color: "transparent"
        Rectangle {
            anchors.fill: parent; radius: parent.radius
            color: "#3F549E"; opacity: 0.04
        }
    }

    // ── Scrollable main layout ────────────────────────────
    ScrollView {
        anchors.fill: parent
        contentWidth: parent.width
        clip: true

        ColumnLayout {
            width: softwarePage.width
            spacing: 0

            // padding
            Item { height: 32 }

            // ── Header ────────────────────────────────────
            ColumnLayout {
                Layout.leftMargin: 40
                Layout.rightMargin: 40
                spacing: 6
                Layout.bottomMargin: 28

                RowLayout {
                    spacing: 10
                    Rectangle { width: 18; height: 1; color: "#3F549E" }
                    Text {
                        text: "SOFTWARE & PREFERENCES"
                        color: "#3F549E"
                        font.pixelSize: 10
                        font.letterSpacing: 2
                        font.family: "monospace"
                    }
                }

                Text {
                    text: "Set up your system."
                    color: "#f0eee8"
                    font.pixelSize: 26
                    font.weight: Font.Light
                    letterSpacing: -0.5
                }

                Text {
                    text: "All of these can be changed later in /etc/hollow.json"
                    color: "#555358"
                    font.pixelSize: 12
                }
            }

            // ── Browser ───────────────────────────────────
            SectionLabel { text: "Browser" }

            RowLayout {
                Layout.leftMargin: 40
                Layout.rightMargin: 40
                Layout.bottomMargin: 16
                spacing: 10

                Repeater {
                    model: [
                        { id: "firefox",    name: "Firefox",    desc: "Fast & open source" },
                        { id: "librewolf",  name: "Librewolf",  desc: "Privacy focused fork" },
                        { id: "zen",        name: "Zen",        desc: "Beautiful & minimal" },
                    ]

                    delegate: OptionChip {
                        label:    modelData.name
                        sublabel: modelData.desc
                        checked:  softwarePage.selectedBrowser === modelData.id
                        group:    browserGroup
                        onChosen: {
                            softwarePage.selectedBrowser = modelData.id
                            softwarePage.sync()
                        }
                    }
                }
            }

            // ── Shell ─────────────────────────────────────
            SectionLabel { text: "Shell" }

            RowLayout {
                Layout.leftMargin: 40
                Layout.rightMargin: 40
                Layout.bottomMargin: 16
                spacing: 10

                Repeater {
                    model: [
                        { id: "fish", name: "Fish",  desc: "Friendly & smart" },
                        { id: "zsh",  name: "Zsh",   desc: "Powerful & popular" },
                        { id: "bash", name: "Bash",  desc: "Classic & universal" },
                    ]

                    delegate: OptionChip {
                        label:    modelData.name
                        sublabel: modelData.desc
                        checked:  softwarePage.selectedShell === modelData.id
                        group:    shellGroup
                        onChosen: {
                            softwarePage.selectedShell = modelData.id
                            softwarePage.sync()
                        }
                    }
                }
            }

            // ── Toggles ───────────────────────────────────
            SectionLabel { text: "Options" }

            ColumnLayout {
                Layout.leftMargin: 40
                Layout.rightMargin: 40
                Layout.bottomMargin: 32
                spacing: 8

                ToggleRow {
                    title:    "Flatpak"
                    subtitle: "Enable Flatpak for sandboxed third-party apps"
                    checked:  softwarePage.flatpakEnabled
                    onToggled: {
                        softwarePage.flatpakEnabled = !softwarePage.flatpakEnabled
                        softwarePage.sync()
                    }
                }

                ToggleRow {
                    title:    "Allow unfree packages"
                    subtitle: "Required for NVIDIA drivers, Steam, and some firmware"
                    checked:  softwarePage.unfreeEnabled
                    onToggled: {
                        softwarePage.unfreeEnabled = !softwarePage.unfreeEnabled
                        softwarePage.sync()
                    }
                }

                ToggleRow {
                    title:    "Enable SSH"
                    subtitle: "Start the SSH server on boot for remote access"
                    checked:  softwarePage.sshEnabled
                    onToggled: {
                        softwarePage.sshEnabled = !softwarePage.sshEnabled
                        softwarePage.sync()
                    }
                }

                ToggleRow {
                    title:    "Enable zram"
                    subtitle: "Compressed RAM swap — recommended for systems with less than 8GB"
                    checked:  softwarePage.zramEnabled
                    onToggled: {
                        softwarePage.zramEnabled = !softwarePage.zramEnabled
                        softwarePage.sync()
                    }
                }

                ToggleRow {
                    title:    "Auto-login"
                    subtitle: "Skip the login screen and boot straight to desktop"
                    checked:  softwarePage.autologinEnabled
                    onToggled: {
                        softwarePage.autologinEnabled = !softwarePage.autologinEnabled
                        softwarePage.sync()
                    }
                }
            }

            // bottom padding
            Item { height: 32 }
        }
    }

    // ── Reusable components ───────────────────────────────

    component SectionLabel: Text {
        Layout.leftMargin: 40
        Layout.bottomMargin: 10
        text: ""
        color: "#3F549E"
        font.pixelSize: 10
        font.letterSpacing: 1.5
        font.family: "monospace"
    }

    component OptionChip: Button {
        id: chip
        required property string label
        required property string sublabel
        required property bool   checked
        required property var    group
        signal chosen()

        Layout.fillWidth: true
        height: 60
        checkable: true
        ButtonGroup.group: chip.group
        checked: chip.checked

        onClicked: chip.chosen()

        HoverHandler { id: chipHover }

        background: Rectangle {
            radius: 8
            color: chip.checked ? "#0d0d11" : chipHover.hovered ? "#161620" : "#0d0d11"
            border.color: chip.checked ? "#3F549E" : "#1e1e28"
            border.width: chip.checked ? 1.5 : 0.5

            Rectangle {
                anchors.fill: parent
                radius: parent.radius
                color: "#3F549E"
                opacity: chip.checked ? 0.06 : 0
                Behavior on opacity { NumberAnimation { duration: 200 } }
            }

            Behavior on border.color { ColorAnimation { duration: 200 } }
        }

        contentItem: ColumnLayout {
            anchors { fill: parent; leftMargin: 16; rightMargin: 16 }
            spacing: 3

            Text {
                text: chip.label
                color: chip.checked ? "#f0eee8" : "#888580"
                font.pixelSize: 13
                font.weight: Font.Medium
                Behavior on color { ColorAnimation { duration: 200 } }
            }
            Text {
                text: chip.sublabel
                color: chip.checked ? "#555380" : "#333138"
                font.pixelSize: 10
                Behavior on color { ColorAnimation { duration: 200 } }
            }
        }
    }

    component ToggleRow: Rectangle {
        id: toggleRow
        required property string title
        required property string subtitle
        required property bool   checked
        signal toggled()

        Layout.fillWidth: true
        height: 58
        radius: 8
        color: "#0d0d11"
        border.color: toggleRow.checked ? "#3F549E" : "#1e1e28"
        border.width: toggleRow.checked ? 1 : 0.5

        Behavior on border.color { ColorAnimation { duration: 200 } }

        Rectangle {
            anchors.fill: parent
            radius: parent.radius
            color: "#3F549E"
            opacity: toggleRow.checked ? 0.04 : 0
            Behavior on opacity { NumberAnimation { duration: 200 } }
        }

        RowLayout {
            anchors { fill: parent; leftMargin: 18; rightMargin: 18 }
            spacing: 16

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 4

                Text {
                    text: toggleRow.title
                    color: toggleRow.checked ? "#f0eee8" : "#888580"
                    font.pixelSize: 13
                    font.weight: Font.Medium
                    Behavior on color { ColorAnimation { duration: 200 } }
                }
                Text {
                    text: toggleRow.subtitle
                    color: "#444248"
                    font.pixelSize: 11
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
            }

            // Toggle switch
            Rectangle {
                width: 40; height: 22
                radius: 11
                color: toggleRow.checked ? "#3F549E" : "#1e1e28"
                Behavior on color { ColorAnimation { duration: 200 } }

                Rectangle {
                    width: 16; height: 16
                    radius: 8
                    color: "#ffffff"
                    anchors.verticalCenter: parent.verticalCenter
                    x: toggleRow.checked ? parent.width - width - 3 : 3
                    Behavior on x { NumberAnimation { duration: 200; easing.type: Easing.OutQuad } }
                }
            }
        }

        TapHandler { onTapped: toggleRow.toggled() }
    }
}
