# Prusa Connect for Pebble — Setup Guide

This guide explains how to connect your Pebble watch to **Prusa Connect** using your personal **Refresh Token**.

---

## 🔒 Privacy & Security

* **Zero Third-Party Servers:** Your watch and phone communicate directly with official Prusa servers (`account.prusa3d.com` and `connect.prusa3d.com`) over HTTPS.
* **No Password Required:** You never need to enter your Prusa account password into the Pebble app.
* **Automatic Renewal:** Prusa uses OAuth2 *Refresh Token Rotation*. Every time the Pebble companion refreshes your session, Prusa returns a fresh token, keeping the connection alive automatically.

---

## 📋 Step 1: Get Your Prusa Refresh Token

You can retrieve your token from your browser in under 30 seconds using either method below.

### Method A: Browser Console (Quickest — 10 seconds)

1. Open your browser on your computer and log in to [connect.prusa3d.com](https://connect.prusa3d.com/).
2. Open Developer Tools:
   * **Chrome / Edge / Brave:** Press `F12` (or `Ctrl + Shift + I` / `Cmd + Option + I`).
   * **Firefox:** Press `F12` (or `Ctrl + Shift + K`).
   * **Safari:** Press `Cmd + Option + C` (enable *Show Develop menu* in Safari Preferences if needed).
3. Click the **Console** tab.
4. Paste the following command and press **Enter**:
   ```javascript
   copy(localStorage.getItem('auth.refresh_token'))
   ```
   *(This immediately copies your Refresh Token to your clipboard!)*

   *If you want to view it directly in the console, run:*
   ```javascript
   localStorage.getItem('auth.refresh_token')
   ```

---

### Method B: Browser Network Tab (Universal)

If the console method doesn't copy it:

1. Open and log in to [connect.prusa3d.com/app/](https://connect.prusa3d.com/app/).
2. Press `F12` and click the **Network** tab.
3. In the filter box, type: `token`
4. Refresh the page (`F5` or `Ctrl + R`).
5. Click on the request to `token` (URL: `https://account.prusa3d.com/o/token/`).
6. Click on the **Response** tab.
7. Copy the entire string value inside `"refresh_token": "..."` (it starts with `eyJhbGci...`).

---

## 📱 Step 2: Configure the Pebble App

1. On your phone, open the **Pebble** (or Rebble) companion app.
2. Go to the **Apps** (Watchapps) tab.
3. Find **Prusa Connect** and tap the **⚙️ Settings** icon.
4. Paste your token into the **Prusa Refresh Token** field.
5. Tap **Save & Connect**.

---

## ⌚ Step 3: Verification

1. As soon as you tap **Save & Connect**, your phone will authenticate with Prusa Connect.
2. Your Pebble watch screen will instantly update from **"Setup Required"** to your active printer status:
   * **Printer Name** (e.g., `Original Prusa MK4S`)
   * **Job Name / File**
   * **Progress Bar & Percentage**
   * **Estimated Completion Time**
3. If a print is active, a timeline pin with a 5-minute pre-completion reminder will be scheduled on your watch.
