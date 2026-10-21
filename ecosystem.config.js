const path = require('path');
const fs = require('fs');

// Ensure production secrets from /var/www/errani/.env are visible to the
// Next.js process. Relying only on Next auto-loading has failed silently
// when PM2 reloads without a full shell environment.
function loadEnvFile(filePath) {
  const out = {};
  try {
    if (!fs.existsSync(filePath)) return out;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of text.split(/\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    // ignore
  }
  return out;
}

const appDir = '/var/www/errani';
const fileEnv = {
  ...loadEnvFile(path.join(appDir, '.env')),
  ...loadEnvFile(path.join(appDir, '.env.production')),
};

module.exports = {
  apps: [
    {
      name: 'errani-site',
      script: 'node_modules/.bin/next',
      // Явно ограничиваем bind, потому что одной переменной HOSTNAME
      // недостаточно для всех версий Next.js CLI.
      args: 'start --hostname 127.0.0.1',
      cwd: appDir,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        ...fileEnv,
        NODE_ENV: 'production',
        PORT: 3000,
        // Привязываем Next.js только к localhost — порт 3000 не доступен извне.
        // Cloudflare → Nginx (443) → 127.0.0.1:3000
        HOSTNAME: '127.0.0.1',
        NODE_EXTRA_CA_CERTS: path.join(appDir, 'config/russian-trusted-ca.pem'),
      },
    },
  ],
};
