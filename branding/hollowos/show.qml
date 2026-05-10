/* HollowOS Calamares Slideshow
   Shown during the install process */

import QtQuick 2.15
import QtQuick.Controls 2.15
import io.calamares.ui 1.0

Presentation {
    id: presentation

    anchors.fill: parent
    backgroundColor: "#111116"

    // Auto-advance slides every 5 seconds
    Timer {
        id: advanceTimer
        interval: 5000
        running: true
        repeat: true
        onTriggered: presentation.goToNextSlide()
    }

    // ── Slide 1: Welcome ─────────────────────────────────
    Slide {
        anchors.fill: parent

        Rectangle {
            anchors.fill: parent
            color: "#111116"

            Column {
                anchors.centerIn: parent
                spacing: 20

                Image {
                    source: "logo.png"
                    width: 72
                    height: 72
                    anchors.horizontalCenter: parent.horizontalCenter
                    opacity: 0.9
                }

                Text {
                    text: "Installing HollowOS"
                    color: "#f0eee8"
                    font.pixelSize: 28
                    font.weight: Font.Light
                    anchors.horizontalCenter: parent.horizontalCenter
                }

                Text {
                    text: "Sit back while we set everything up."
                    color: "#666468"
                    font.pixelSize: 14
                    anchors.horizontalCenter: parent.horizontalCenter
                }
            }
        }
    }

    // ── Slide 2: hollow.json ─────────────────────────────
    Slide {
        anchors.fill: parent

        Rectangle {
            anchors.fill: parent
            color: "#111116"

            Column {
                anchors.centerIn: parent
                spacing: 16
                width: 460

                Text {
                    text: "Your system, one file."
                    color: "#f0eee8"
                    font.pixelSize: 26
                    font.weight: Font.Light
                    anchors.horizontalCenter: parent.horizontalCenter
                }

                Text {
                    text: "Everything you chose during setup is written to /etc/hollow.json — packages, services, desktop, shell. Edit it anytime to change your system."
                    color: "#666468"
                    font.pixelSize: 13
                    wrapMode: Text.WordWrap
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    lineHeight: 1.6
                }

                Rectangle {
                    width: parent.width
                    height: codeText.height + 28
                    color: "#0d0d11"
                    radius: 8
                    border.color: "#1e1e24"
                    border.width: 1

                    Text {
                        id: codeText
                        anchors { left: parent.left; right: parent.right; top: parent.top; margins: 14 }
                        text: '{\n  "desktop": "kde",\n  "shell": "fish",\n  "packages": ["firefox", "git"],\n  "services": ["sshd", "NetworkManager"]\n}'
                        color: "#3F549E"
                        font.family: "monospace"
                        font.pixelSize: 12
                        lineHeight: 1.7
                    }
                }
            }
        }
    }

    // ── Slide 3: Rollback ────────────────────────────────
    Slide {
        anchors.fill: parent

        Rectangle {
            anchors.fill: parent
            color: "#111116"

            Column {
                anchors.centerIn: parent
                spacing: 16
                width: 440

                Text {
                    text: "Break things safely."
                    color: "#f0eee8"
                    font.pixelSize: 26
                    font.weight: Font.Light
                    anchors.horizontalCenter: parent.horizontalCenter
                }

                Text {
                    text: "Every system change creates a snapshot. If something goes wrong, roll back instantly with a single command."
                    color: "#666468"
                    font.pixelSize: 13
                    wrapMode: Text.WordWrap
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    lineHeight: 1.6
                }

                Text {
                    text: "hollow rollback"
                    color: "#3F549E"
                    font.family: "monospace"
                    font.pixelSize: 16
                    anchors.horizontalCenter: parent.horizontalCenter
                }
            }
        }
    }

    // ── Slide 4: Drivers ─────────────────────────────────
    Slide {
        anchors.fill: parent

        Rectangle {
            anchors.fill: parent
            color: "#111116"

            Column {
                anchors.centerIn: parent
                spacing: 16
                width: 440

                Text {
                    text: "Drivers, handled."
                    color: "#f0eee8"
                    font.pixelSize: 26
                    font.weight: Font.Light
                    anchors.horizontalCenter: parent.horizontalCenter
                }

                Text {
                    text: "HollowOS detects your GPU, Wi-Fi, and audio hardware automatically. The right drivers are already installed — no searching required."
                    color: "#666468"
                    font.pixelSize: 13
                    wrapMode: Text.WordWrap
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    lineHeight: 1.6
                }
            }
        }
    }

    // Dot indicators
    Row {
        anchors {
            bottom: parent.bottom
            horizontalCenter: parent.horizontalCenter
            bottomMargin: 20
        }
        spacing: 8

        Repeater {
            model: presentation.slideCount
            Rectangle {
                width: index === presentation.currentSlide ? 20 : 6
                height: 6
                radius: 3
                color: index === presentation.currentSlide ? "#3F549E" : "#333138"
                Behavior on width { NumberAnimation { duration: 200 } }
            }
        }
    }
}
