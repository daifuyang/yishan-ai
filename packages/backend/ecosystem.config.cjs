module.exports = {
  apps: [{
    name: 'yishan-ai',
    script: './dist/server.js',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 4800,
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    merge_logs: true,
    kill_timeout: 5000,
    listen_timeout: 10000,
  }],
};