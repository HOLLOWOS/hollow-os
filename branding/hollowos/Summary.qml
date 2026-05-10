/* HollowOS Calamares - Summary Page
   Shows the user a preview of their hollow.json
   before the install begins. Last chance to go back. */

import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import io.calamares.ui 1.0
import io.calamares.core 1.0

Page {
    id: summaryPage

    anchors.fill: parent
    background: Rectangle { color: "#111116" }

    // ── Pull choices from global storage ──────────────────
    property string gs_desktop:   Calamares.globalStorage.value("desktopEnvironment") ?? "kde"
    property string gs_browser:   Calamares.globalStorage.value("browser")            ?? "firefox"
    property string gs_shell:     Calamares.globalStorage.value("shell")              ?? "fish"
    property bool   gs_flatpak:   Calamares.globalStorage.value("flatpak")            ?? true
    property bool   gs_unfree:    Calamares.globalStorage.value("unfree")             ?? false
    property bool   gs_ssh:       Calamares.globalStorage.value("ssh")                ?? false
    property bool   gs_zram:      Calamares.globalStorage.value("zram")               ?? true
    property bool   gs_autologin: Calamares.globalStorage.value("autologin")          ?? false
    property string gs_locale:    Calamares.globalStorage.value("locale")             ?? "en_US.UTF-8"
    property string gs_keyboard:  Calamares.globalStorage.value("keyboard")           ?? "us"
    property string gs_timezone:  Calamares.globalStorage.value("timezone")           ?? "UTC"
    property string gs_hostname:  Calamares.globalStorage.value("hostname")           ?? "hollowos"
    property string gs_username:  Calamares.globalStorage.value("username")           ?? "user"
    property string gs_gpu:       Calamares.globalStorage.value("detectedDriverPackages") ?? "mesa vulkan-loader"

    // ── DM map ────────────────────────────────────────────
    function dmFor(de) {
        return ({ kde: "sddm", gnome: "gdm", hyprland: "ly", sway: "ly" })[de] ?? "sddm"
    }

    // ── Build hollow.json preview string ─────────────────
    function buildJson() {
        var services = ["dbus", "elogind", "NetworkManager", dmFor(gs_desktop), "pipewire", "wireplumber"]
        if (gs_ssh)    services.push("sshd")
        if (gs_zram)   services.push("zramen")

        var obj = {
            meta: { version: "1", generator: "hollow-generate@0.1.0" },
            system: {
                hostname: gs_hostname,
                locale:   gs_locale,
                timezone: gs_timezone,
                keyboard: gs_keyboard,
                unfree:   gs_unfree,
            },
            user: {
                name:      gs_username,
                shell:     gs_shell,
                autologin: gs_autologin,
            },
            desktop: {
                environment:   gs_desktop,
                displayManager: dmFor(gs_desktop),
                theme:         "dark",
            },
            packages: {
                browser: gs_browser,
                flatpak: gs_flatpak,
                extra:   [],
            },
            hardware: {
                drivers:  "auto",
                packages: gs_gpu.split(" ").filter(Boolean),
                zram:     gs_zram,
            },
            services: { enabled: services },
            user_packages: [],
        }

        return JSON.stringify(obj, null, 2)
    }

    // ── Background glow ───────────────────────────────────
    Rectangle {
        width: 360; height: 360; radius: 180
        x: parent.width - 120; y: -120
        color: "transparent"
        Rectangle {
            anchors.fill: parent; radius: parent.radius
            color: "#3F549E"; opacity: 0.05
        }
    }

    // ── Layout ────────────────────────────────────────────
    ColumnLayout {
        anchors { fill: parent; margins: 40; topMargin: 32 }
        spacing: 0

        // ── Header ────────────────────────────────────────
        ColumnLayout {
            spacing: 6
            Layout.bottomMargin: 24

            RowLayout {
                spacing: 10
                Rectangle { width: 18; height: 1; color: "#3F549E" }
                Text {
                    text: "SUMMARY"
                    color: "#3F549E"
                    font.pixelSize: 10
                    font.letterSpacing: 2
                    font.family: "monospace"
                }
            }

            Text {
                text: "Your hollow.json is ready."
                color: "#f0eee8"
                font.pixelSize: 26
                font.weight: Font.Light
                letterSpacing: -0.5
            }

            Text {
                text: "This file will be written to /etc/hollow.json after install. Review it below."
                color: "#555358"
                font.pixelSize: 12
            }
        }

        // ── Two column layout ─────────────────────────────
        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 16

            // ── Left: summary cards ───────────────────────
            ColumnLayout {
                Layout.preferredWidth: 200
                Layout.fillHeight: true
                spacing: 8

                // Summary card component
                Repeater {
                    model: [
                        { label: "Desktop",  value: summaryPage.gs_desktop.toUpperCase() },
                        { label: "Shell",    value: summaryPage.gs_shell },
                        { label: "Browser",  value: summaryPage.gs_browser },
                        { label: "Locale",   value: summaryPage.gs_locale },
                        { label: "Hostname", value: summaryPage.gs_hostname },
                        { label: "Flatpak",  value: summaryPage.gs_flatpak  ? "enabled" : "disabled" },
                        { label: "SSH",      value: summaryPage.gs_ssh      ? "enabled" : "disabled" },
                        { label: "zram",     value: summaryPage.gs_zram     ? "enabled" : "disabled" },
                        { label: "Unfree",   value: summaryPage.gs_unfree   ? "allowed" : "blocked" },
                        { label: "Login",    value: summaryPage.gs_autologin ? "auto"   : "manual" },
                    ]

                    delegate: Rectangle {
                        Layout.fillWidth: true
                        height: 40
                        radius: 6
                        color: "#0d0d11"
                        border.color: "#1e1e28"
                        border.width: 0.5

                        RowLayout {
                            anchors {
                                fill: parent
                                leftMargin: 12; rightMargin: 12
                            }

                            Text {
                                text: modelData.label
                                color: "#444248"
                                font.pixelSize: 11
                                font.family: "monospace"
                                Layout.preferredWidth: 64
                            }

                            Text {
                                text: modelData.value
                                color: "#c8c6c0"
                                font.pixelSize: 11
                                font.weight: Font.Medium
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                        }
                    }
                }

                Item { Layout.fillHeight: true }
            }

            // ── Right: hollow.json preview ────────────────
            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                radius: 8
                color: "#0d0d11"
                border.color: "#1e1e28"
                border.width: 0.5
                clip: true

                ColumnLayout {
                    anchors.fill: parent
                    spacing: 0

                    // Title bar
                    Rectangle {
                        Layout.fillWidth: true
                        height: 34
                        color: "#0a0a0e"
                        radius: 8

                        // Square off bottom corners
                        Rectangle {
                            anchors { left: parent.left; right: parent.right; bottom: parent.bottom }
                            height: 8
                            color: parent.color
                        }

                        RowLayout {
                            anchors { fill: parent; leftMargin: 14; rightMargin: 14 }

                            Text {
                                text: "/etc/hollow.json"
                                color: "#3F549E"
                                font.pixelSize: 11
                                font.family: "monospace"
                            }

                            Item { Layout.fillWidth: true }

                            // Dot indicators
                            Row {
                                spacing: 5
                                Repeater {
                                    model: 3
                                    Rectangle {
                                        width: 7; height: 7; radius: 4
                                        color: ["#ff5f57","#febc2e","#28c840"][index]
                                        opacity: 0.6
                                    }
                                }
                            }
                        }
                    }

                    // JSON content
                    ScrollView {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        contentWidth: availableWidth

                        Text {
                            id: jsonText
                            width: parent.width
                            padding: 16
                            text: summaryPage.buildJson()
                            color: "#888580"
                            font.pixelSize: 11
                            font.family: "monospace"
                            wrapMode: Text.WrapAnywhere
                            lineHeight: 1.7

                            // Syntax-highlight key parts
                            // QML doesn't have native syntax highlighting
                            // so we use a readable monospace style instead
                        }
                    }
                }
            }
        }

        // ── Warning bar ───────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            Layout.topMargin: 14
            height: 38
            radius: 7
            color: "#0d1020"
            border.color: "#1e2440"
            border.width: 0.5

            RowLayout {
                anchors { fill: parent; leftMargin: 14; rightMargin: 14 }
                spacing: 10

                Rectangle {
                    width: 6; height: 6; radius: 3
                    color: "#3F549E"
                    opacity: 0.8
                }

                Text {
                    text: "Clicking Install Now will begin writing to your disk. This cannot be undone."
                    color: "#444268"
                    font.pixelSize: 11
                    Layout.fillWidth: true
                }

                Text {
                    text: "Go back to make changes →"
                    color: "#3F549E"
                    font.pixelSize: 11
                    opacity: 0.7
                }
            }
        }
    }
}
