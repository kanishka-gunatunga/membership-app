const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  const env = { NODE_ENV: "production" };
  if (!fs.existsSync(filePath)) return env;

  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

module.exports = {
  apps: [
    {
      name: "memberpro",
      script: "node_modules/@react-router/serve/bin.js",
      args: "./build/server/index.js",
      interpreter: "node",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 15,
      min_uptime: 5000,
      env: loadEnvFile(path.join(__dirname, ".env")),
    },
  ],
};
