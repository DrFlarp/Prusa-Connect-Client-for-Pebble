module.exports = [
  {
    "type": "heading",
    "defaultValue": "Prusa Connect Settings"
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Authentication"
      },
      {
        "type": "input",
        "messageKey": "RefreshToken",
        "defaultValue": "",
        "label": "Prusa Refresh Token",
        "description": "Paste your Prusa Connect refresh token here. The app automatically refreshes tokens and stays connected continuously. See the online guide at https://rp1-mvac.github.io/Prusa-Connect/ for instructions.",
        "attributes": {
          "placeholder": "eyJhbGciOiJSUzI1NiIs...",
          "type": "text"
        }
      }
    ]
  },
  {
    "type": "submit",
    "defaultValue": "Save & Connect"
  }
];
