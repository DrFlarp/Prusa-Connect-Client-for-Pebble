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
        "messageKey": "ApiKey",
        "defaultValue": "",
        "label": "API Key / Bearer Token",
        "description": "Enter your Prusa Connect Bearer token from connect.prusa3d.com",
        "attributes": {
          "placeholder": "eyJhbGciOi...",
          "type": "text"
        }
      }
    ]
  },
  {
    "type": "submit",
    "defaultValue": "Save Settings"
  }
];
