module.exports = {
  apps: [
    {
      name: "novel-ai-web",
      cwd: "/var/www/novel-ai-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
