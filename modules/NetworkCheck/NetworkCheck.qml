/* HollowOS Calamares - Network Check Page
   Shows a friendly message if the user is offline.
   Polls every 3 seconds and auto-advances when connected. */

import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import io.calamares.ui 1.0
import io.calamares.core 1.0

Page {
    id: networkPage

    anchors.fill: parent
    background: Rectangle { color: "#111116" }

    // ── State ─────────────────────────────────────────────
    property bool isConnected: false
    property bool isChecking: true
    property int  dotCount: 0

    // ── Block "Next" until connected ──────────────────────
    Connections {
        target: Calamares.navigation
        function onNextClicked() {
            if (!isConnected) {
                Calamares.navigation.back()
            }
        }
    }

    // ── Poll network every 3 seconds ──────────────────────
    Timer {
        id: pollTimer
        interval: 3000
        running: true
        repeat: true
        onTriggered: checkNetwork()
    }

    // ── Animated dots timer ───────────────────────────────
    Timer {
        id: dotTimer
        interval: 500
        running: !isConnected
        repeat: true
        onTriggered: dotCount = (dotCount + 1) % 4
    }

    // ── Check network via Calamares network module ────────
    function checkNetwork() {
        isChecking = true
        var result = Calamares.network.hasInternet()
        isChecking = false

        if (result && !isConnected) {
            isConnected = true
            pollTimer.stop()
            dotTimer.stop()
            connectedAnim.start()

            // Auto-advance after 1.5s so user sees the success state
            advanceTimer.start()
        } else if (!result) {
            isConnected = false
        }
    }

    Timer {
        id: advanceTimer
        interval: 1500
        repeat: false
        onTriggered: Calamares.navigation.next()
    }

    // ── Run check immediately on load ─────────────────────
    Component.onCompleted: checkNetwork()

    // ── Animations ────────────────────────────────────────
    SequentialAnimation {
        id: connectedAnim
        NumberAnimation {
            target: statusCard
            property: "scale"
            from: 1.0; to: 1.03
            duration: 120
            easing.type: Easing.OutQuad
        }
        NumberAnimation {
            target: statusCard
            property: "scale"
            from: 1.03; to: 1.0
            duration: 120
            easing.type: Easing.InQuad
        }
    }

    // ── Background glow ───────────────────────────────────
    Rectangle {
        id: bgGlow
        width: 500; height: 500
        radius: 250
        x: parent.width - 200
        y: -150
        color: "transparent"

        Rectangle {
            anchors.fill: parent
            radius: parent.radius
            color: networkPage.isConnected ? "#3F549E" : "#3F549E"
            opacity: networkPage.isConnected ? 0.06 : 0.04
            Behavior on opacity { NumberAnimation { duration: 800 } }
        }
    }

    // ── Main layout ───────────────────────────────────────
    ColumnLayout {
        anchors.centerIn: parent
        spacing: 0
        width: Math.min(parent.width - 80, 480)

        // Planet icon
        Item {
            Layout.alignment: Qt.AlignHCenter
            width: 80; height: 80
            Layout.bottomMargin: 28

            Image {
                id: planetIcon
                anchors.centerIn: parent
                source: "logo.png"
                width: 56; height: 56
                opacity: networkPage.isConnected ? 1.0 : 0.35

                Behavior on opacity {
                    NumberAnimation { duration: 600; easing.type: Easing.OutQuad }
                }

                RotationAnimation on rotation {
                    running: !networkPage.isConnected
                    from: 0; to: 360
                    duration: 8000
                    loops: Animation.Infinite
                }
            }

            // Orbit ring — animates while checking
            Rectangle {
                id: orbitRing
                anchors.centerIn: parent
                width: 72; height: 72
                radius: 36
                color: "transparent"
                border.color: "#3F549E"
                border.width: 1.5
                opacity: networkPage.isConnected ? 0 : 0.4

                Behavior on opacity {
                    NumberAnimation { duration: 400 }
                }

                RotationAnimation on rotation {
                    running: !networkPage.isConnected
                    from: 0; to: 360
                    duration: 2000
                    loops: Animation.Infinite
                }
            }

            // Connected checkmark ring
            Rectangle {
                anchors.centerIn: parent
                width: 72; height: 72
                radius: 36
                color: "transparent"
                border.color: "#3F549E"
                border.width: 1.5
                opacity: networkPage.isConnected ? 0.6 : 0

                Behavior on opacity {
                    NumberAnimation { duration: 500 }
                }
            }
        }

        // ── Status card ───────────────────────────────────
        Rectangle {
            id: statusCard
            Layout.fillWidth: true
            Layout.bottomMargin: 24
            height: cardContent.height + 40
            radius: 10
            color: "#0d0d11"
            border.color: networkPage.isConnected
                ? "#3F549E"
                : "#1e1e24"
            border.width: networkPage.isConnected ? 1 : 0.5

            Behavior on border.color {
                ColorAnimation { duration: 600 }
            }

            ColumnLayout {
                id: cardContent
                anchors {
                    left: parent.left
                    right: parent.right
                    top: parent.top
                    margins: 24
                }
                spacing: 10

                // Status row
                RowLayout {
                    spacing: 10

                    // Status dot
                    Rectangle {
                        width: 8; height: 8
                        radius: 4
                        color: networkPage.isConnected ? "#4ade80" : "#f87171"

                        Behavior on color {
                            ColorAnimation { duration: 400 }
                        }

                        SequentialAnimation on opacity {
                            running: !networkPage.isConnected
                            loops: Animation.Infinite
                            NumberAnimation { from: 1; to: 0.3; duration: 700 }
                            NumberAnimation { from: 0.3; to: 1; duration: 700 }
                        }
                    }

                    Text {
                        text: networkPage.isConnected
                            ? "Connected"
                            : "No internet connection"
                        color: networkPage.isConnected ? "#4ade80" : "#f87171"
                        font.pixelSize: 13
                        font.weight: Font.Medium

                        Behavior on color {
                            ColorAnimation { duration: 400 }
                        }
                    }

                    Item { Layout.fillWidth: true }

                    // Checking indicator
                    Text {
                        visible: !networkPage.isConnected
                        text: "checking" + ".".repeat(networkPage.dotCount)
                        color: "#444248"
                        font.pixelSize: 11
                        font.family: "monospace"
                    }
                }

                // Divider
                Rectangle {
                    Layout.fillWidth: true
                    height: 0.5
                    color: "#1e1e24"
                }

                // Message
                Text {
                    Layout.fillWidth: true
                    text: networkPage.isConnected
                        ? "You're all set. HollowOS will download packages and drivers during installation."
                        : "HollowOS needs an internet connection to download packages, drivers, and your chosen desktop environment."
                    color: "#666468"
                    font.pixelSize: 13
                    wrapMode: Text.WordWrap
                    lineHeight: 1.65

                    Behavior on text {
                        SequentialAnimation {
                            NumberAnimation { target: cardContent; property: "opacity"; from: 1; to: 0; duration: 150 }
                            NumberAnimation { target: cardContent; property: "opacity"; from: 0; to: 1; duration: 150 }
                        }
                    }
                }
            }
        }

        // ── Wi-Fi button (hidden when connected) ──────────
        Rectangle {
            Layout.fillWidth: true
            Layout.bottomMargin: 12
            height: 44
            radius: 8
            color: wifiHover.containsMouse ? "#1a1a22" : "#151519"
            border.color: "#2a2a34"
            border.width: 0.5
            visible: !networkPage.isConnected
            opacity: networkPage.isConnected ? 0 : 1

            Behavior on opacity { NumberAnimation { duration: 300 } }

            RowLayout {
                anchors.centerIn: parent
                spacing: 8

                Text {
                    text: "⌘"
                    color: "#3F549E"
                    font.pixelSize: 16
                }

                Text {
                    text: "Connect to Wi-Fi"
                    color: "#aaa8a4"
                    font.pixelSize: 13
                    font.weight: Font.Medium
                }
            }

            HoverHandler { id: wifiHover }

            TapHandler {
                onTapped: {
                    // Opens GNOME network settings
                    Calamares.utils.runCommand("gnome-control-center wifi", "")
                }
            }
        }

        // ── Ethernet hint ─────────────────────────────────
        RowLayout {
            visible: !networkPage.isConnected
            Layout.alignment: Qt.AlignHCenter
            spacing: 6
            opacity: 0.5

            Rectangle {
                width: 28; height: 0.5
                color: "#444248"
            }

            Text {
                text: "or plug in an ethernet cable"
                color: "#444248"
                font.pixelSize: 11
            }

            Rectangle {
                width: 28; height: 0.5
                color: "#444248"
            }
        }
    }
}
