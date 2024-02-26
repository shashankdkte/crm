module.exports = {
  apps: [
    {
      name: "backend",
      script: "npm",
      args: "run dev-start",
      watch: true,
      ignore_watch: ["node_modules"],
      autorestart: true,
      restart_delay: 3000,
    },
  ],
};
