module.exports = {
    apps: [{
        name: "sf3pwm-game-server",
        script: "./server.js",
        env: {
            NODE_ENV: "production",
            PORT: 3000,
            LARAVEL_API_URL: "http://127.0.0.1/api"
        }
    }]
}
