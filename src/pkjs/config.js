module.exports = [
  {
    "type": "heading",
    "defaultValue": "Prusa Connect Account"
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Login Credentials"
      },
      {
        "type": "input",
        "messageKey": "Email",
        "defaultValue": "",
        "label": "Prusa Account Email",
        "attributes": {
          "placeholder": "user@example.com",
          "type": "email"
        }
      },
      {
        "type": "input",
        "messageKey": "Password",
        "defaultValue": "",
        "label": "Prusa Account Password",
        "description": "Used to automatically authenticate and refresh tokens with Prusa Connect.",
        "attributes": {
          "placeholder": "Password",
          "type": "password"
        }
      }
    ]
  },
  {
    "type": "submit",
    "defaultValue": "Log In & Save"
  }
];
