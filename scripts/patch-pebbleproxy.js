const fs = require('fs');
const path = require('path');

const proxyPath = path.join(__dirname, '..', 'node_modules', '@moddable', 'pebbleproxy', 'proxy.js');
if (fs.existsSync(proxyPath)) {
  let content = fs.readFileSync(proxyPath, 'utf8');
  if (!content.includes('startsWith("/")')) {
    content = content.replace(
      'if ("/" === path)\n\t\t\t\trequest.path = "";\n\t\t\telse\n\t\t\t\trequest.path = path || "";',
      'if ("/" === path)\n\t\t\t\trequest.path = "";\n\t\t\telse if (path && path.startsWith("/"))\n\t\t\t\trequest.path = path.slice(1);\n\t\t\telse\n\t\t\t\trequest.path = path || "";'
    );
    fs.writeFileSync(proxyPath, content, 'utf8');
  }
}
