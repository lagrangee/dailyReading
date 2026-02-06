module.exports = {
    apps: [
        {
            name: "daily-reading-dev",
            script: "npm",
            args: "run dev",
            cwd: "./",
            watch: false,
            env: {
                NODE_ENV: "development",
                PORT: 3000
            },
            // Retry strategy
            exp_backoff_restart_delay: 100,
            max_restarts: 10,
        },
        {
            name: "daily-reading-prod",
            script: "npm",
            args: "run start",
            cwd: "./",
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: 3000
            },
            exp_backoff_restart_delay: 100,
        }
    ]
};
