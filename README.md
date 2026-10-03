# Prusa Connect for Pebble

A Pebble smartwatch app to monitor and control your 3D prints through Prusa Connect.

It connects your Pebble to your Prusa Connect account, showing print progress, status, and finish times on your wrist. You can pause, resume, or stop jobs, receive a vibration alert when a print finishes, and sync print completion times to your Pebble Timeline.

---

## Features

- **Live Print Monitoring:** Displays printer name, active file, percentage progress bar, current state (Printing, Paused, Stopped, Finished, Idle), and estimated completion time.
- **Remote Print Controls:** Pause, resume, or abort an active print directly from your watch, each protected with a confirmation screen.
- **Wake-Up Alarm:** Schedules a Pebble WakeUp alarm that wakes the watch and vibrates when your print finishes, even if the app was closed.
- **Timeline Integration:** Pushes a pin to your Pebble Timeline for the estimated completion time. It automatically cleans up stale pins if a print is stopped, cancelled, or finished.
- **Direct Communication:** Your phone connects directly to Prusa Connect (`connect.prusa3d.com` and `account.prusa3d.com`) using your personal refresh token. No third-party servers or middleware proxies are used.

---

## Supported Devices

- **Watches:** Pebble Time 2 (`emery`), Pebble Time Round 2 (`gabbro`), and other color Pebble models.
- **Printers:** Any printer connected to Prusa Connect (Original Prusa MK4/MK4S, XL, MINI/MINI+, MK3/MK3S+ via PrusaLink/Connect).

---

## Watch Controls

### Main Screen
| Button | State | Action |
| :--- | :--- | :--- |
| **Up** | Printing / Paused | Opens the **Emergency Stop** confirmation screen |
| **Up** | Idle / Stopped | Requests an immediate telemetry refresh |
| **Select (Center)** | Printing | Opens the **Pause Print** confirmation screen |
| **Select (Center)** | Paused | Opens the **Resume Print** confirmation screen |
| **Select (Center)** | Idle / Stopped | Requests an immediate telemetry refresh |
| **Down** | Printing / Paused / Stopped | Opens the **Wake-Up Reminder** screen |
| **Back** | Any | Exits the app and returns to the watchface |

### Confirmation Screens
- **Stop Print (`Up` button from Main):** Press **Up** to confirm abort (`STOP_PRINT`), or **Down / Back** to cancel.
- **Pause Print (`Select` button while Printing):** Press **Up** to confirm pause (`PAUSE_PRINT`), or **Down / Back** to cancel.
- **Resume Print (`Select` button while Paused):** Press **Up** to confirm resume (`RESUME_PRINT`), or **Down / Back** to cancel.
- **Wake-Up Reminder (`Down` button):** Press **Up** to enable or disable the completion alarm, or **Down / Back** to return. When active, an alarm clock icon turns green and `(Set)` appears beside the estimated finish time.

---

## Setup

1. Open [connect.prusa3d.com](https://connect.prusa3d.com) in your web browser and log in.
2. Open your browser console (`F12` > **Console**) and run:
   ```javascript
   copy(localStorage.getItem('auth.refresh_token'))
   ```
   This copies your Prusa Refresh Token to your clipboard.
3. Open the **Pebble** (or Rebble) app on your phone.
4. Go to **Apps** > **Prusa Connect** > **Settings**.
5. Paste your token and tap **Save & Connect**.

---

## How Communication Works (Unofficial API)

This app connects directly to the private API endpoints that power the Prusa Connect web interface (`account.prusa3d.com` and `connect.prusa3d.com`). All network requests originate directly from your phone through PebbleKit JS; there are no intermediary servers or proxies.

Authentication uses OAuth2 token refresh:
1. The app takes your browser refresh token and exchanges it with Prusa's account server for a temporary bearer token.
2. Every time a token is refreshed, Prusa issues a new rotated refresh token, which the app saves locally in PebbleKit JS storage.
3. Telemetry and printer commands (`STOP_PRINT`, `PAUSE_PRINT`, `RESUME_PRINT`) are sent as HTTPS requests to the Prusa Connect printer API.

**Important Note:** Prusa has not published an official third-party API for Prusa Connect. Because this app relies on reverse-engineered web endpoints, any changes Prusa makes to their authentication schemes, API endpoints, or data formats can cause the integration to break without notice.

---

## Modifying & Building

This project combines **Pebble Alloy (Moddable XS JavaScript)** running on the watch with **PebbleKit JS** running on your phone.

### Project Layout

```
Prusa-Connect/
├── package.json               # App metadata, platforms, and messageKeys
├── scripts/
│   ├── patch-pebbleproxy.js   # Fixes leading slash bug in @moddable/pebbleproxy
│   └── generate_menu_icon.py  # Generates 28x28 app menu icon
├── src/
│   ├── embeddedjs/            # Code executed on the Pebble watch (Moddable XS)
│   │   ├── main.js            # App lifecycle, screen router, button listeners
│   │   ├── screens.js         # Screen rendering (Main, Stop, Pause, Reminder, etc.)
│   │   ├── icons.js           # Vector and pixel graphics (printer, icons, cues)
│   │   ├── theme.js           # Color palette, font sizes, text truncation
│   │   ├── state.js           # Reactive telemetry and UI state store
│   │   └── prusa-api.js       # AppMessage bridge between watch and phone
│   └── pkjs/                  # Code executed on the phone (PebbleKit JS)
│       ├── index.js           # Telemetry polling loop and AppMessage dispatcher
│       ├── prusa-api.js       # REST calls to connect.prusa3d.com/app/printers
│       ├── prusa-auth.js      # OAuth2 token exchange with account.prusa3d.com
│       ├── timeline.js        # Pebble Timeline pin creation, updates, and cleanup
│       ├── config.js          # Clay configuration screen schema
│       └── pkce.js            # PKCE cryptographic helper
```

> **Note on `@moddable/pebbleproxy`:** A postinstall script (`scripts/patch-pebbleproxy.js`) automatically patches a path-handling bug in the `@moddable/pebbleproxy` dependency whenever dependencies install. It strips redundant leading slashes on request paths to prevent malformed API URLs.

### Build Requirements

- Pebble SDK (with Rebble configuration)
- Node.js (v16+)

### Build Commands

Build the `.pbw` package:
```bash
pebble build
```

Install to an emulator:
```bash
pebble install --emulator emery
```

Install to a physical watch via phone proxy:
```bash
pebble install --cloudpebble
```
Or over local IP:
```bash
pebble install --phone <PHONE_IP_ADDRESS>
```

### Key Areas to Customize

- **Poll Interval:** Modify `POLL_INTERVAL_MS` in `src/pkjs/index.js` (default: 30 seconds).
- **Colors and Fonts:** Edit `src/embeddedjs/theme.js` to change the palette or typography.
- **Screen Layouts:** Modify functions in `src/embeddedjs/screens.js`.
- **Command Payloads:** Inspect and adjust printer command JSON payloads in `src/pkjs/prusa-api.js`.

---

## AI Notice

Most of this application was vibe-coded using AI, alongside manual research, reverse-engineering of the Prusa Connect endpoints, and hardware testing.

---

## Contributing

Pull requests, bug reports, and suggestions are very welcome! If you notice something that can be improved, want to support additional features, or have refinements for different Pebble models, feel free to open an issue or submit a PR.

---

## License

MIT License. See project files for details.
