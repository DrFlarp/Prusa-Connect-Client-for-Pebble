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
        "description": "Paste your Prusa Connect refresh token here. The app automatically refreshes tokens and stays connected continuously. See PRUSA_SETUP_GUIDE.md for instructions.",
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
