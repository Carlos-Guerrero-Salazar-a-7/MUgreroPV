import { Ryu } from './characters/ryu.js';
import { Ken } from './characters/ken.js'; 

const VIRTUAL_WIDTH = 2000;
const VIRTUAL_HEIGHT = 2000;

let characters = [];
let gameRunning = false;
let gameCanvas = null;
let gameCtx = null;
let animationFrameId = null;
let lastFrameTime = performance.now();
let timeleft = 99;

let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Variables para la animación de resultado
let gameEnded = false;
let resultAnimationProgress = 0;
const ANIMATION_DURATION = 1.5;

// Variables de debug visual
let showHurtboxes = false;
let showHitboxes = false;
let showDebugInfo = true;

// ===== NUEVAS VARIABLES PARA NETWORKING =====
let isMultiplayer = false;
let localPlayerIndex = -1; 
let socketConnection = null;
let currentRoomID = null;

// Buffer para sincronización
let lastSyncTime = 0;
const SYNC_INTERVAL = 50; 

// ===== FUNCIÓN PRINCIPAL: INICIAR JUEGO =====
export async function iniciarJuego(config = {}) {
    if (gameRunning) {
        console.log("El juego ya está corriendo");
        return;
    }
    
    // Configuración del modo de juego
    isMultiplayer = config.multiplayer || false;
    localPlayerIndex = config.playerIndex || 0;
    socketConnection = config.socket || null;
    currentRoomID = config.roomID || null;
    
    gameEnded = false;
    resultAnimationProgress = 0;
    timeleft = 99;
    
    gameCanvas = document.getElementById('main');
    gameCtx = gameCanvas.getContext('2d');
    
    // Ejecutar configuración de pantalla inicial para calcular escala
    setupResize(); 
    window.dispatchEvent(new Event('resize')); // Forzar primer ajuste

    // Crear personajes usando la RESOLUCIÓN VIRTUAL (2000x2000)
    // Nota: Los personajes se crean relativos al tamaño VIRTUAL, no al canvas real.
    characters = [
        new Ryu(VIRTUAL_WIDTH, VIRTUAL_HEIGHT, {x: 200, y: VIRTUAL_HEIGHT}, 
                {width: VIRTUAL_WIDTH*0.15, height: VIRTUAL_HEIGHT*0.35}, 8),
        new Ken(VIRTUAL_WIDTH, VIRTUAL_HEIGHT, {x: VIRTUAL_WIDTH - 200, y: VIRTUAL_HEIGHT}, 
                {width: VIRTUAL_WIDTH*0.15, height: VIRTUAL_HEIGHT*0.35}, 8)
    ];
    
    console.log("=".repeat(60));
    console.log(`📺 RESOLUCIÓN VIRTUAL: ${VIRTUAL_WIDTH}x${VIRTUAL_HEIGHT}`);
    if (isMultiplayer) {
        console.log(`🌐 MODO MULTIJUGADOR - Sala: ${currentRoomID}`);
    } else {
        console.log(`🎮 MODO LOCAL`);
    }
    console.log("=".repeat(60));
    
    setupControls();
    setupDebugControls();
    
    if (isMultiplayer) {
        setupNetworkListeners();
    }
    
    gameRunning = true;
    gameLoop(performance.now());
}

// ===== CONFIGURAR LISTENERS DE RED =====
function setupNetworkListeners() {
    if (!socketConnection || !currentRoomID) return;
    
    socketConnection.on('gameInput', (data) => {
        if (data.roomID === currentRoomID) {
            const opponentIndex = localPlayerIndex === 0 ? 1 : 0;
            const opponentChar = characters[opponentIndex];
            if (opponentChar && data.moves) {
                Object.keys(data.moves).forEach(key => {
                    opponentChar.moves[key] = data.moves[key];
                });
            }
        }
    });
    
    socketConnection.on('gameStateSync', (data) => {
        if (data.roomID === currentRoomID) {
            syncGameState(data.gameState);
        }
    });
    
    socketConnection.on('opponentDisconnected', () => {
        if (!gameEnded) {
            gameEnded = true;
            alert('Tu oponente se desconectó. Partida terminada.');
            stopGame();
        }
    });
}

function syncGameState(remoteState) {
    characters.forEach((char, index) => {
        if (remoteState.characters && remoteState.characters[index]) {
            const remoteChar = remoteState.characters[index];
            char.health = remoteChar.health;
            // Las posiciones recibidas del servidor deben ser relativas al mundo virtual
            char.position.x = remoteChar.position.x;
            char.position.y = remoteChar.position.y;
            char.currentState = remoteChar.currentState;
            char.facingDirection = remoteChar.facingDirection;
        }
    });
    if (remoteState.timeleft !== undefined) {
        timeleft = remoteState.timeleft;
    }
}

function emitLocalInput(moves) {
    if (!isMultiplayer || !socketConnection || !currentRoomID) return;
    const now = Date.now();
    if (now - lastSyncTime < SYNC_INTERVAL) return;
    lastSyncTime = now;
    socketConnection.emit('gameInput', {
        roomID: currentRoomID,
        playerIndex: localPlayerIndex,
        moves: moves,
        timestamp: now
    });
}

function setupDebugControls() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F1') showHurtboxes = !showHurtboxes;
        if (e.key === 'F2') showHitboxes = !showHitboxes;
        if (e.key === 'F3') showDebugInfo = !showDebugInfo;
    });
}

// ===== SISTEMA DE ESCALADO DE PANTALLA =====
function setupResize() {
    const handleResize = () => {
        const header = document.querySelector('#conputadoras header');
        const headerHeight = header ? header.offsetHeight : 0; 
        
        // 1. Ajustar el canvas al tamaño total de la ventana disponible
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight - headerHeight; 
        
        gameCanvas.width = windowWidth;
        gameCanvas.height = windowHeight < 400 ? 400 : windowHeight;
        
        // 2. Calcular el factor de escala
        // Queremos que el mundo de 2000x2000 quepa en la ventana (letterboxing)
        const scaleX = gameCanvas.width / VIRTUAL_WIDTH;
        const scaleY = gameCanvas.height / VIRTUAL_HEIGHT;
        scale = Math.min(scaleX, scaleY); // Usar el menor para mantener proporción (aspect fit)

        // 3. Calcular offsets para centrar el juego
        offsetX = (gameCanvas.width - (VIRTUAL_WIDTH * scale)) / 2;
        offsetY = (gameCanvas.height - (VIRTUAL_HEIGHT * scale)) / 2;
        
        // Nota: NO actualizamos characters.updateCanvasSize aquí porque
        // los personajes viven en el mundo de 2000x2000 siempre.
        
        console.log(`Escalado: Canvas(${gameCanvas.width}x${gameCanvas.height}) -> Scale: ${scale.toFixed(4)}`);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Llamada inicial
}

function setupControls() {
    let controlsMap;
    
    if (isMultiplayer) {
        if (localPlayerIndex === 0) {
            controlsMap = {
                'w': { charIndex: 0, move: 'up' },
                'a': { charIndex: 0, move: 'left' },
                's': { charIndex: 0, move: 'down' },
                'd': { charIndex: 0, move: 'right' },
                'j': { charIndex: 0, move: 'punchone' },
                'k': { charIndex: 0, move: 'kickone' },
                'u': { charIndex: 0, move: 'punchtwo' },
                'i': { charIndex: 0, move: 'kicktwo' },
            };
        } else {
            controlsMap = {
                'arrowup': { charIndex: 1, move: 'up' },
                'arrowleft': { charIndex: 1, move: 'left' },
                'arrowdown': { charIndex: 1, move: 'down' },
                'arrowright': { charIndex: 1, move: 'right' },
                '1': { charIndex: 1, move: 'punchone' },
                '2': { charIndex: 1, move: 'kickone' },
                '3': { charIndex: 1, move: 'punchtwo' },
                '4': { charIndex: 1, move: 'kicktwo' },
            };
        }
    } else {
        controlsMap = {
            'w': { charIndex: 0, move: 'up' },
            'a': { charIndex: 0, move: 'left' },
            's': { charIndex: 0, move: 'down' },
            'd': { charIndex: 0, move: 'right' },
            'j': { charIndex: 0, move: 'punchone' },
            'k': { charIndex: 0, move: 'kickone' },
            'u': { charIndex: 0, move: 'punchtwo' },
            'i': { charIndex: 0, move: 'kicktwo' },
            'arrowup': { charIndex: 1, move: 'up' },
            'arrowleft': { charIndex: 1, move: 'left' },
            'arrowdown': { charIndex: 1, move: 'down' },
            'arrowright': { charIndex: 1, move: 'right' },
            '1': { charIndex: 1, move: 'punchone' },
            '2': { charIndex: 1, move: 'kickone' },
            '3': { charIndex: 1, move: 'punchtwo' },
            '4': { charIndex: 1, move: 'kicktwo' },
        };
    }

    const handleKey = (e, isDown) => {
        const key = e.key.toLowerCase();
        const control = controlsMap[key];
        if (control) {
            const character = characters[control.charIndex];
            if (character) {
                character.moves[control.move] = isDown;
                if (isMultiplayer && control.charIndex === localPlayerIndex) {
                    emitLocalInput(character.moves);
                }
                e.preventDefault();
            }
        }
    };
    document.addEventListener('keydown', (e) => handleKey(e, true));
    document.addEventListener('keyup', (e) => handleKey(e, false));
}

// ===== BUCLE PRINCIPAL DE JUEGO =====
function gameLoop(currentTime) {
    if (!gameRunning) return;
    
    const secondspassed = (currentTime - lastFrameTime) / 1000; 
    lastFrameTime = currentTime;
    
    // 1. Limpiar toda la pantalla física (incluyendo bordes negros)
    gameCtx.fillStyle = '#000000'; // Color de las barras negras
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // 2. Guardar contexto y aplicar transformación
    gameCtx.save();
    gameCtx.translate(offsetX, offsetY); // Mover al centro
    gameCtx.scale(scale, scale);         // Escalar al tamaño calculado
    
    // 3. Recortar área de dibujo (Clip) para que nada se salga del cuadro de 2000x2000
    gameCtx.beginPath();
    gameCtx.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    gameCtx.clip();

    // --- A PARTIR DE AQUÍ TODO SE DIBUJA EN COORDENADAS 2000x2000 ---

    // Fondo del juego
    gameCtx.fillStyle = '#1a1a2e';
    gameCtx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    
    // Línea del suelo
    gameCtx.strokeStyle = '#ffffff';
    gameCtx.lineWidth = 3;
    gameCtx.beginPath();
    gameCtx.moveTo(0, VIRTUAL_HEIGHT);
    gameCtx.lineTo(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    gameCtx.stroke();
    
    drawHealthBars(gameCtx);
    
    // Actualizar lógica (usando coordenadas virtuales implícitas en los objetos)
    characters.forEach((char, index) => {
        const otherCharacter = characters[(index + 1) % 2]; 
        char.update(secondspassed, otherCharacter);
    });
    
    // Dibujar personajes
    characters.forEach(char => {
        drawCharacterWithDebug(gameCtx, char);
    });
    
    DrawTimer(gameCtx, secondspassed);
    fpscounter(gameCtx, secondspassed);
    
    if (showDebugInfo) {
        drawDebugInfo(gameCtx);
        drawDebugLegend(gameCtx);
    }
    
    // Verificar fin de juego
    if (timeleft <= 0 || characters[0].health <= 0 || characters[1].health <= 0) {
        if (!gameEnded) {
            gameEnded = true;
            resultAnimationProgress = 0;
            if (isMultiplayer && socketConnection && currentRoomID) {
                const winner = characters[0].health > characters[1].health ? 
                    characters[0].name : characters[1].name;
                socketConnection.emit('gameEnded', {
                    roomID: currentRoomID,
                    winner: winner,
                    finalState: {
                        p1Health: characters[0].health,
                        p2Health: characters[1].health,
                        timeLeft: timeleft
                    }
                });
            }
        }
        drawResultAnimation(gameCtx, secondspassed);
    }

    // 4. Restaurar el contexto para el siguiente frame
    gameCtx.restore();
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

function drawCharacterWithDebug(ctx, char) {
    const currentAnimationFrames = char.animations.get(char.currentState);
    const animationToUse = currentAnimationFrames || char.animations.get('standing');
    const frameIndex = char.animationFrame % (animationToUse ? animationToUse.length : 1);
    const frameKey = animationToUse ? animationToUse[frameIndex] : 'standing-1'; 
    const frameData = char.frames.get(frameKey);

    if (frameData) {
        char.frame = {
            x: frameData[0], y: frameData[1], width: frameData[2], height: frameData[3]
        };
    }

    const drawWidth = char.size.width;
    const drawHeight = char.height;
    
    if (char.spriteLoaded) {
        ctx.save();
        ctx.translate(char.position.x, char.position.y);
        if (char.facingDirection === 1) ctx.scale(-1, 1); 
        
        ctx.drawImage(
            char.sprite,
            char.frame.x, char.frame.y, char.frame.width, char.frame.height,
            -drawWidth / 2, -drawHeight, drawWidth, drawHeight
        );
        ctx.restore();
    } else {
        const rectX = char.position.x - (char.size.width / 2);
        const rectY = char.position.y - drawHeight;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(rectX, rectY, char.size.width, drawHeight);
    }
    
    if (showHurtboxes) {
        const hurtbox = char.getHurtbox();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(hurtbox.x, hurtbox.y, hurtbox.width, hurtbox.height);
    }
    
    if (showHitboxes) {
        const hitbox = char.getAttackHitbox();
        if (hitbox) {
            ctx.strokeStyle = '#ff0000';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            ctx.lineWidth = 3;
            ctx.strokeRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
        }
    }
    
    if (showDebugInfo) {
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(char.position.x, char.position.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawDebugLegend(ctx) {
    // Posicionamiento relativo al VIRTUAL_HEIGHT
    const legendX = 10;
    const legendY = VIRTUAL_HEIGHT - 150;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(legendX, legendY, 250, 140);
    
    ctx.font = '20px monospace'; // Fuente más grande por la resolución 2000x
    ctx.textAlign = 'left';
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Debug Controls:', legendX + 10, legendY + 30);
    
    ctx.fillStyle = showHurtboxes ? '#00ffff' : '#666666';
    ctx.fillText(`F1: Hurtboxes ${showHurtboxes ? 'ON' : 'OFF'}`, legendX + 10, legendY + 60);
    
    ctx.fillStyle = showHitboxes ? '#ff0000' : '#666666';
    ctx.fillText(`F2: Hitboxes ${showHitboxes ? 'ON' : 'OFF'}`, legendX + 10, legendY + 90);
    
    ctx.fillStyle = '#00ff00';
    ctx.fillText(`RES: ${VIRTUAL_WIDTH}x${VIRTUAL_HEIGHT}`, legendX + 10, legendY + 120);
}

function DrawTimer(ctx, secondspassed) {
    if (!gameEnded) {
        timeleft -= secondspassed;
        if (timeleft < 0) timeleft = 0;
    }
    
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.font = 'bold 80px Arial'; // Fuente más grande
    ctx.textAlign = 'center';
    const timeDisplay = Math.floor(timeleft).toString().padStart(2, '0');
    ctx.strokeText(timeDisplay, VIRTUAL_WIDTH / 2, 100);
    ctx.fillText(timeDisplay, VIRTUAL_WIDTH / 2, 100);
}

function drawHealthBars(ctx) {
    if (characters.length < 2) return;

    const p1 = characters[0];
    const p2 = characters[1];

    const barHeight = 50; // Barras más altas
    const totalBarWidth = VIRTUAL_WIDTH * 0.4; // 40% del ancho virtual
    const padding = 50;
    const barY = padding + 50;
    const p1X = padding;
    
    // Barra P1
    ctx.fillStyle = '#222222';
    ctx.fillRect(p1X, barY, totalBarWidth, barHeight);
    
    ctx.fillStyle = p1.health > 30 ? '#ffee56ff' : '#ff4444';
    const p1CurrentWidth = totalBarWidth * (p1.health / p1.maxHealth);
    ctx.fillRect(p1X, barY, p1CurrentWidth, barHeight);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(p1X, barY, totalBarWidth, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${p1.name}`, p1X, barY - 10);
    
    // Barra P2
    const p2X = VIRTUAL_WIDTH - padding - totalBarWidth;
    ctx.fillStyle = '#222222';
    ctx.fillRect(p2X, barY, totalBarWidth, barHeight);
    
    ctx.fillStyle = p2.health > 30 ? '#ffee56ff' : '#ff4444';
    const p2CurrentWidth = totalBarWidth * (p2.health / p2.maxHealth);
    ctx.fillRect(p2X + totalBarWidth - p2CurrentWidth, barY, p2CurrentWidth, barHeight);

    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(p2X, barY, totalBarWidth, barHeight);

    ctx.textAlign = 'right';
    ctx.fillText(`${p2.name}`, VIRTUAL_WIDTH - padding, barY - 10);
}

function fpscounter(ctx, secondspassed) {
    ctx.fillStyle = '#00ff00';
    ctx.font = '30px monospace';
    ctx.textAlign = 'right';
    const fps = secondspassed > 0 ? Math.round(1 / secondspassed) : 60; 
    ctx.fillText(`FPS: ${fps}`, VIRTUAL_WIDTH - 20, VIRTUAL_HEIGHT - 20);
}

function drawDebugInfo(ctx) {
    const ryu = characters[0];
    const ken = characters[1];
    if (!ryu || !ken) return;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(VIRTUAL_WIDTH - 520, 20, 500, 150);
    
    ctx.fillStyle = '#ffff00';
    ctx.font = '20px monospace';
    ctx.textAlign = 'right';
    
    const debugInfo = [
        `P1: ${ryu.currentState} | Hitstun: ${ryu.isInHitstun}`,
        `Pos: (${Math.round(ryu.position.x)}, ${Math.round(ryu.position.y)})`,
        `P2: ${ken.currentState} | Hitstun: ${ken.isInHitstun}`,
        `Pos: (${Math.round(ken.position.x)}, ${Math.round(ken.position.y)})`,
        `Virtual Res: ${VIRTUAL_WIDTH}x${VIRTUAL_HEIGHT}`,
        `Scale: ${scale.toFixed(3)}`
    ];
    
    debugInfo.forEach((text, index) => {
        ctx.fillText(text, VIRTUAL_WIDTH - 30, 50 + (index * 25));
    });
}

function drawResultAnimation(ctx, secondspassed) {
    if (resultAnimationProgress < 1) {
        resultAnimationProgress += secondspassed / ANIMATION_DURATION;
        if (resultAnimationProgress > 1) resultAnimationProgress = 1;
    }
    const easeProgress = 1 - Math.pow(1 - resultAnimationProgress, 3);
    
    let resultText = "DRAW!";
    let textColor = '#ffdb5b';
    
    if (characters[0].health > characters[1].health) {
        resultText = `${characters[0].name.toUpperCase()} WINS!`;
        textColor = '#00ff00';
    } else if (characters[1].health > characters[0].health) {
        resultText = `${characters[1].name.toUpperCase()} WINS!`;
        textColor = '#ff0000';
    }
    
    const startX = VIRTUAL_WIDTH + 500;
    const endX = VIRTUAL_WIDTH / 2;
    const currentX = startX + (endX - startX) * easeProgress;
    const currentY = VIRTUAL_HEIGHT / 2;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    
    const cardWidth = 1000;
    const cardHeight = 400;
    const cardX = currentX - cardWidth / 2;
    const cardY = currentY - cardHeight / 2;
    
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
    
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 10;
    ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);
    
    ctx.fillStyle = textColor;
    ctx.font = 'bold 140px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(resultText, currentX, currentY - 40);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '40px Arial';
    ctx.fillText('Press SPACE to return to lobby', currentX, currentY + 100);
}

export function stopGame() {
    gameRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (socketConnection && isMultiplayer) {
        socketConnection.off('gameInput');
        socketConnection.off('gameStateSync');
        socketConnection.off('opponentDisconnected');
    }
    isMultiplayer = false;
    localPlayerIndex = -1;
    socketConnection = null;
    currentRoomID = null;
    console.log("Juego detenido");
}

document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && gameEnded && resultAnimationProgress >= 1) {
        e.preventDefault();
        stopGame();
        if (window.showPage) {
            window.showPage('lobby-page');
        }
    }
});