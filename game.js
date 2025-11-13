// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1000;
canvas.height = 500;

// Game constants
const GRAVITY = 0.7;
const GROUND_LEVEL = canvas.height - 100;

// Player class
class Fighter {
    constructor(x, y, color, controls) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 100;
        this.color = color;
        this.velocityY = 0;
        this.velocityX = 0;
        this.speed = 5;
        this.jumpPower = 15;
        this.isJumping = false;
        this.health = 100;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.controls = controls;
        this.facingRight = controls.left === 'ArrowLeft' ? false : true;
    }

    draw() {
        // Draw body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw head
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y - 15, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 - 7, this.y - 18, 3, 0, Math.PI * 2);
        ctx.arc(this.x + this.width / 2 + 7, this.y - 18, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw attack indicator
        if (this.isAttacking) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            const attackX = this.facingRight ? this.x + this.width : this.x - 40;
            ctx.fillRect(attackX, this.y + 20, 40, 30);
        }
    }

    update() {
        // Apply gravity
        if (this.y + this.height < GROUND_LEVEL) {
            this.velocityY += GRAVITY;
            this.isJumping = true;
        } else {
            this.y = GROUND_LEVEL - this.height;
            this.velocityY = 0;
            this.isJumping = false;
        }

        // Update position
        this.y += this.velocityY;
        this.x += this.velocityX;

        // Keep player in bounds
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }
        if (this.attackCooldown === 0) {
            this.isAttacking = false;
        }

        // Friction
        this.velocityX *= 0.8;
    }

    jump() {
        if (!this.isJumping) {
            this.velocityY = -this.jumpPower;
        }
    }

    moveLeft() {
        this.velocityX = -this.speed;
        this.facingRight = false;
    }

    moveRight() {
        this.velocityX = this.speed;
        this.facingRight = true;
    }

    attack() {
        if (this.attackCooldown === 0) {
            this.isAttacking = true;
            this.attackCooldown = 30; // 30 frames cooldown
        }
    }

    getAttackBox() {
        if (!this.isAttacking) return null;
        
        return {
            x: this.facingRight ? this.x + this.width : this.x - 40,
            y: this.y + 20,
            width: 40,
            height: 30
        };
    }

    checkHit(otherPlayer) {
        const attackBox = this.getAttackBox();
        if (!attackBox) return false;

        // Check collision with other player
        return attackBox.x < otherPlayer.x + otherPlayer.width &&
               attackBox.x + attackBox.width > otherPlayer.x &&
               attackBox.y < otherPlayer.y + otherPlayer.height &&
               attackBox.y + attackBox.height > otherPlayer.y;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
    }
}

// Initialize players
const player1 = new Fighter(100, GROUND_LEVEL - 100, '#0066cc', {
    up: 'w',
    left: 'a',
    right: 'd',
    attack: ' '
});

const player2 = new Fighter(850, GROUND_LEVEL - 100, '#cc0000', {
    up: 'ArrowUp',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    attack: 'Enter'
});

// Keyboard state
const keys = {};

// Event listeners
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    // Player 1 controls
    if (e.key === player1.controls.up) {
        player1.jump();
    }
    if (e.key === player1.controls.attack) {
        player1.attack();
    }
    
    // Player 2 controls
    if (e.key === player2.controls.up) {
        player2.jump();
    }
    if (e.key === player2.controls.attack) {
        player2.attack();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Game state
let gameRunning = true;
let gameTime = 60;
let lastHitTime1 = 0;
let lastHitTime2 = 0;

// Update health bars
function updateHealthBars() {
    document.getElementById('player1-health').style.width = player1.health + '%';
    document.getElementById('player2-health').style.width = player2.health + '%';
}

// Update timer
function updateTimer() {
    document.getElementById('timer').textContent = Math.ceil(gameTime);
}

// Check game over
function checkGameOver() {
    let winner = null;
    
    if (player1.health <= 0) {
        winner = 'Jugador 2';
    } else if (player2.health <= 0) {
        winner = 'Jugador 1';
    } else if (gameTime <= 0) {
        if (player1.health > player2.health) {
            winner = 'Jugador 1';
        } else if (player2.health > player1.health) {
            winner = 'Jugador 2';
        } else {
            winner = 'Empate';
        }
    }
    
    if (winner) {
        gameRunning = false;
        const resultText = winner === 'Empate' ? '¡EMPATE!' : `¡${winner} GANA!`;
        document.getElementById('result-text').textContent = resultText;
    }
}

// Draw background
function drawBackground() {
    // Sky (already in canvas background)
    
    // Ground
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(0, GROUND_LEVEL, canvas.width, canvas.height - GROUND_LEVEL);
    
    // Grass
    ctx.fillStyle = '#228b22';
    ctx.fillRect(0, GROUND_LEVEL, canvas.width, 10);
    
    // Simple clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(150, 80, 30, 0, Math.PI * 2);
    ctx.arc(180, 80, 40, 0, Math.PI * 2);
    ctx.arc(210, 80, 30, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(700, 120, 35, 0, Math.PI * 2);
    ctx.arc(735, 120, 45, 0, Math.PI * 2);
    ctx.arc(775, 120, 35, 0, Math.PI * 2);
    ctx.fill();
}

// Game loop
let lastTime = Date.now();
function gameLoop() {
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    drawBackground();
    
    if (gameRunning) {
        // Update game time
        gameTime -= deltaTime;
        updateTimer();
        
        // Handle continuous movement
        if (keys[player1.controls.left]) {
            player1.moveLeft();
        }
        if (keys[player1.controls.right]) {
            player1.moveRight();
        }
        
        if (keys[player2.controls.left]) {
            player2.moveLeft();
        }
        if (keys[player2.controls.right]) {
            player2.moveRight();
        }
        
        // Update players
        player1.update();
        player2.update();
        
        // Check attacks
        if (player1.checkHit(player2) && currentTime - lastHitTime1 > 500) {
            player2.takeDamage(10);
            lastHitTime1 = currentTime;
        }
        
        if (player2.checkHit(player1) && currentTime - lastHitTime2 > 500) {
            player1.takeDamage(10);
            lastHitTime2 = currentTime;
        }
        
        // Update UI
        updateHealthBars();
        
        // Check game over
        checkGameOver();
    }
    
    // Draw players
    player1.draw();
    player2.draw();
    
    requestAnimationFrame(gameLoop);
}

// Start game
updateHealthBars();
updateTimer();
gameLoop();
