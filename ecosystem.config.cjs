module.exports = {
  apps: [{
    name: "osadef-api-asesores",
    script: "dist/index.js",
    cwd: "/home/osadef-api-asesores",
    env: {
      NODE_ENV: "production"
    },
    error_file: "/home/osadef-api-asesores/logs/error.log",
    out_file: "/home/osadef-api-asesores/logs/output.log",
    merge_logs: true,
    autorestart: true,
    max_restarts: 10
  }]
};
