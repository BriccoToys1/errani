module.exports = {
  apps: [
    {
      name: 'errani-site',
      script: 'node_modules/.bin/next',
      // Явно ограничиваем bind, потому что одной переменной HOSTNAME
      // недостаточно для всех версий Next.js CLI.
      args: 'start --hostname 127.0.0.1',
      cwd: '/var/www/errani',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Привязываем Next.js только к localhost — порт 3000 не доступен извне.
        // Cloudflare → Nginx (443) → 127.0.0.1:3000
        HOSTNAME: '127.0.0.1',
        NODE_EXTRA_CA_CERTS: '/var/www/errani/config/russian-trusted-ca.pem',
      },
    },
  ],
};
