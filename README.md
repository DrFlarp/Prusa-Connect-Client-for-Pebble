# Prusa Connect for Pebble

[![Platform](https://img.shields.io/badge/Platform-Pebble%20OS%204.x-FF5B00.svg)](https://rebble.io)
[![Framework](https://img.shields.io/badge/Runtime-Pebble%20Alloy%20%2F%20Moddable%20XS-blue.svg)](https://developer.repebble.com)
[![Hardware](https://img.shields.io/badge/Targets-Emery%20%7C%20Gabbro-brightgreen.svg)](https://developer.repebble.com)

A feature-rich Pebble smartwatch companion app for **Prusa Connect**. Monitor 3D prints in real-time, schedule wrist wake-up vibration alarms, synchronize completion times to your Pebble Timeline, and issue emergency stop commands directly from your wrist.

---

## ✨ Features

- **Live Print Monitoring**: View current print progress percentage, animated progress bar, job filename, and printer status.
- **Estimated Finish Time**: Dynamic completion time calculated and updated in real-time.
- **Wrist Wake-Up Alarms**: Schedule a system wake-up alarm for the exact completion time. The watch will automatically launch the app and trigger a vibration sequence when the print finishes.
- **Pebble Timeline Integration**: Automatically synchronizes a Timeline Pin with estimated completion time, reminder notifications, and one-click app launch actions.
- **Remote Emergency Stop**: Send an immediate `STOP_PRINT` command to your printer with an accidental-press safety confirmation screen.
- **Automated Authentication**: Direct OAuth login via your Prusa Account (Email & Password) with automated silent token refresh when credentials expire.
- **Intuitive Button Navigation**: Custom color cues, action bar icons, and native back-button handling that lets you exit cleanly or decline prompts.

---

## 🕹️ Controls & Navigation

### 1. Main Screen
| Button | Action |
| :--- | :--- |
| **Back** | Cleanly exits the app and returns to the watchface. |
| **Select** | Opens the **Emergency Stop** confirmation screen (only active during an ongoing print). |
| **Down** | Opens the **Wake-Up Reminder** confirmation screen (only active during an ongoing print). |
| **Up** | Triggers an immediate status refresh from Prusa Connect. |

### 2. Emergency Stop Confirmation Screen
| Button | Action |
| :--- | :--- |
| **Select** (Checkmark) | **Confirm**: Sends the `STOP_PRINT` command to the printer via Prusa Connect. |
| **Back / Down** (Cross) | **Cancel**: Declines the prompt and returns safely to the Main Screen. |

### 3. Reminder Confirmation Screen
| Button | Action |
| :--- | :--- |
| **Select** (Checkmark) | **Confirm**: Schedules a Pebble Wake-Up event and Timeline pin for the print finish time. |
| **Back / Down** (Cross) | **Cancel**: Declines and returns to the Main Screen. |

### 4. Finished Screen (Alarm Triggered)
| Button | Action |
| :--- | :--- |
| **Select / Back** | Acknowledges the completion alarm, stops the vibration sequence, and returns to the Main Screen. |

### 5. Setup Required Screen (Missing Keys / Not Configured)
| Button | Action |
| :--- | :--- |
| **Select / Up** | Triggers an immediate retry / check for credentials after configuring settings in the phone app. |
| **Back** | Cleanly exits the app and returns to the watchface. |

---

## 📱 Configuration

The app uses **Clay** to provide an integrated settings page in the Pebble mobile app (Pebble / Rebble mobile app on Android & iOS):

1. Open the Pebble mobile app on your phone.
2. Go to **Apps** > **Prusa Connect** > **Settings**.
3. Paste your **Prusa Refresh Token**.
4. Tap **Save & Connect**.

For step-by-step instructions on obtaining your token in 15 seconds, see the [Prusa Setup Guide](file:///home/sobol/Pebble-Apps/Prusa-Connect/PRUSA_SETUP_GUIDE.md).

The companion PebbleKit JS component will automatically exchange the refresh token for a live session, acquire printer telemetry, and continuously keep tokens refreshed in the background.

---

## 🏗️ Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────┐
   │                  Pebble Watch (Wrist)                   │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │             Pebble Alloy / Moddable XS            │  │
   │  │  - main.js (Event loop, AppMessage dispatcher)   │  │
   │  │  - screens.js (Main, Confirm, Reminder views)     │  │
   │  │  - theme.js & icons.js (Graphics rendering)       │  │
   │  │  - state.js (Reactive app state store)            │  │
   │  │  - prusa-api.js (Moddable <-> C bindings)         │  │
   │  └───────────────────────────────────────────────────┘  │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │             Pebble C / Firmware Core              │  │
   │  │  - WakeUp Service (pebble/wakeup)                 │  │
   │  │  - Vibration API (pebble/vibes)                   │  │
   │  │  - Window stack & Button event handlers           │  │
   │  └───────────────────────────────────────────────────┘  │
   └───────────────────────────▲─────────────────────────────┘
                               │ Pebble AppMessage Protocol
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │                  Phone Companion (PKJS)                 │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │  src/pkjs/index.js                                │  │
   │  │  - Prusa Connect OAuth token acquisition & refresh│  │
   │  │  - Printer telemetry polling & parsing            │  │
   │  │  - Remote STOP_PRINT command execution            │  │
   │  │  - Pebble Timeline Pin synchronization            │  │
   │  └───────────────────────────────────────────────────┘  │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │  src/pkjs/config.js (Clay Settings Page)          │  │
   │  └───────────────────────────────────────────────────┘  │
   └───────────────────────────▲─────────────────────────────┘
                               │ HTTPS REST API
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │                      Prusa Cloud                        │
   │  - account.prusa3d.com (OAuth 2.0 Token Authority)      │
   │  - connect.prusa3d.com (Printer Telemetry & Sync API)    │
   └─────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
├── package.json                   # App manifest, SDK metadata, message keys, resources
├── README.md                      # Project documentation
├── resources/
│   └── images/
│       └── menu_icon.png          # 25x25 launcher icon for Pebble OS
├── scripts/
│   ├── generate_menu_icon.py      # Pixel generator for the menu icon
│   └── patch-pebbleproxy.js       # PebbleProxy build helper
├── src/
│   ├── c/
│   │   └── mdbl.c                 # C glue code for Moddable runtime & Pebble SDK
│   ├── embeddedjs/
│   │   ├── icons.js               # Pixel-perfect 3D printer & action icons
│   │   ├── main.js                # App lifecycle, button clicks, wakeup handlers
│   │   ├── manifest.json          # Moddable XS module build manifest
│   │   ├── prusa-api.js           # Network message bridge
│   │   ├── screens.js             # UI screen renderers
│   │   ├── state.js               # Central state management
│   │   └── theme.js               # Design tokens, color palette, and layout specs
│   └── pkjs/
│       ├── config.js              # Clay configuration schema
│       └── index.js               # PebbleKit JS companion backend
└── wscript                        # Waf build script
```

---

## 🚀 Building & Installation

### Prerequisites
- [Pebble SDK](https://developer.repebble.com) (v4.33.1 or later)
- Node.js & npm
- Python 3

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Application
```bash
pebble build
```
This pre-compiles the embedded JavaScript via Moddable XS into `.xsa` bytecode modules, packs media resources, and builds binaries for the **emery** and **gabbro** platforms into `build/Prusa-Connect.pbw`.

### 3. Run in Emulator
```bash
pebble install --emulator emery
```

To view live runtime logs from both the watch and phone environments:
```bash
pebble logs --emulator emery
```

### 4. Install on Physical Watch
Ensure developer mode is enabled in the Pebble mobile app:
```bash
pebble install --phone <PHONE_IP_ADDRESS>
```

---

## 📄 License

MIT © MakeAwesomeHappen
