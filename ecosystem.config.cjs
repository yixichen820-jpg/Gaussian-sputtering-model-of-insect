module.exports = {
  apps: [
    {
      name: 'insect-splat-viewer',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      // Never place secrets in this file. Supply ADMIN_KEY through the server environment or a local .env file.
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
