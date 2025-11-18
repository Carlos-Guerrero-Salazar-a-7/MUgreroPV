import { Ryu } from './characters/ryu.js';
import { Ken } from './characters/ken.js'; 

let characters = [];
let gameRunning = false;
let gameCanvas = null;
let gameCtx = null;
let animationFrameId = null;
let lastFrameTime = performance.now();
let timeleft = 99;

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
let localPlayerIndex = -1; // 0 = Jugador 1 (izquierda), 1 = Jugador 2 (derecha)
let socketConnection = null;
let currentRoomID = null;

// Buffer para sincronización
let remoteInputBuffer = [];
let lastSyncTime = 0;
const SYNC_INTERVAL = 50; // Sincronizar cada 50ms

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
    
    // Crear ambos personajes
    characters = [
        new Ryu(gameCanvas.width, gameCanvas.height, {x: 200, y: gameCanvas.height}, 
                {width: gameCanvas.width*0.15, height: gameCanvas.height*0.35}, 8),
        new Ken(gameCanvas.width, gameCanvas.height, {x: gameCanvas.width - 200, y: gameCanvas.height}, 
                {width: gameCanvas.width*0.15, height: gameCanvas.height*0.35}, 8)
    ];
    
    console.log("=".repeat(60));
    if (isMultiplayer) {
        console.log(`🌐 MODO MULTIJUGADOR`);
        console.log(`   Sala: ${currentRoomID}`);
        console.log(`   Controlas: ${localPlayerIndex === 0 ? 'Jugador 1 (Ryu)' : 'Jugador 2 (Ken)'}`);
    } else {
        console.log(`🎮 MODO LOCAL (2 jugadores, 1 PC)`);
    }
    console.log("=".repeat(60));
    
    setupControls();
    setupResize();
    setupDebugControls();
    
    if (isMultiplayer) {
        setupNetworkListeners();
    }
    
    window.dispatchEvent(new Event('resize')); 
    
    gameRunning = true;
    gameLoop(performance.now());
}

// ===== CONFIGURAR LISTENERS DE RED =====
function setupNetworkListeners() {
    if (!socketConnection || !currentRoomID) {
        console.error("❌ No hay conexión de socket o roomID");
        return;
    }
    
    // Escuchar inputs del oponente
    socketConnection.on('gameInput', (data) => {
        if (data.roomID === currentRoomID) {
            // Aplicar el input del oponente
            const opponentIndex = localPlayerIndex === 0 ? 1 : 0;
            const opponentChar = characters[opponentIndex];
            
            if (opponentChar && data.moves) {
                // Aplicar todos los inputs del oponente
                Object.keys(data.moves).forEach(key => {
                    opponentChar.moves[key] = data.moves[key];
                });
            }
        }
    });
    
    // Sincronizar estado completo del juego
    socketConnection.on('gameStateSync', (data) => {
        if (data.roomID === currentRoomID) {
            syncGameState(data.gameState);
        }
    });
    
    // Manejar fin de partida por desconexión
    socketConnection.on('opponentDisconnected', () => {
        if (!gameEnded) {
            gameEnded = true;
            alert('Tu oponente se desconectó. Partida terminada.');
            stopGame();
        }
    });
    
    console.log("✅ Network listeners configurados");
}

// ===== SINCRONIZAR ESTADO DEL JUEGO =====
function syncGameState(remoteState) {
    // Sincronizar posiciones y salud (autoritativo del servidor)
    characters.forEach((char, index) => {
        if (remoteState.characters && remoteState.characters[index]) {
            const remoteChar = remoteState.characters[index];
            
            // Solo sincronizar datos críticos
            char.health = remoteChar.health;
            char.position.x = remoteChar.position.x;
            char.position.y = remoteChar.position.y;
            char.currentState = remoteChar.currentState;
            char.facingDirection = remoteChar.facingDirection;
        }
    });
    
    // Sincronizar tiempo
    if (remoteState.timeleft !== undefined) {
        timeleft = remoteState.timeleft;
    }
}

// ===== EMITIR INPUT LOCAL AL SERVIDOR =====
function emitLocalInput(moves) {
    if (!isMultiplayer || !socketConnection || !currentRoomID) return;
    
    const now = Date.now();
    if (now - lastSyncTime < SYNC_INTERVAL) return; // Limitar frecuencia
    
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
        if (e.key === 'F1') {
            e.preventDefault();
            showHurtboxes = !showHurtboxes;
            console.log(`Hurtboxes: ${showHurtboxes ? 'ON' : 'OFF'}`);
        }
        if (e.key === 'F2') {
            e.preventDefault();
            showHitboxes = !showHitboxes;
            console.log(`Hitboxes: ${showHitboxes ? 'ON' : 'OFF'}`);
        }
        if (e.key === 'F3') {
            e.preventDefault();
            showDebugInfo = !showDebugInfo;
            console.log(`Debug Info: ${showDebugInfo ? 'ON' : 'OFF'}`);
        }
    });
}

function setupResize() {
    window.addEventListener('resize', () => {
        if (!gameRunning) return; 
        
        const header = document.querySelector('#conputadoras header');
        const headerHeight = header ? header.offsetHeight : 0; 
        
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight - headerHeight; 
        
        gameCanvas.height = newHeight < 400 ? 400 : newHeight;
        gameCanvas.width = newWidth;
        characters.forEach((char, index) => {
            char.updateCanvasSize(gameCanvas.width, gameCanvas.height);
            if (index === 1) {
                char.position.x = gameCanvas.width - 200;
            }
        });
        
        console.log(`Canvas redimensionado: ${gameCanvas.width}x${gameCanvas.height}`);
    });
}

function setupControls() {
    // En modo multijugador, cada jugador solo controla SU personaje
    let controlsMap;
    
    if (isMultiplayer) {
        // Solo configurar controles para el personaje local
        if (localPlayerIndex === 0) {
            // Jugador 1 usa WASD + JKUI
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
            // Jugador 2 usa Flechas + 1234
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
        // Modo local: ambos jugadores en la misma PC
        controlsMap = {
            // Jugador 1 (Ryu)
            'w': { charIndex: 0, move: 'up' },
            'a': { charIndex: 0, move: 'left' },
            's': { charIndex: 0, move: 'down' },
            'd': { charIndex: 0, move: 'right' },
            'j': { charIndex: 0, move: 'punchone' },
            'k': { charIndex: 0, move: 'kickone' },
            'u': { charIndex: 0, move: 'punchtwo' },
            'i': { charIndex: 0, move: 'kicktwo' },
            
            // Jugador 2 (Ken)
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
                
                // En modo multijugador, enviar input al servidor
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

function gameLoop(currentTime) {
    if (!gameRunning) return;
    
    const secondspassed = (currentTime - lastFrameTime) / 1000; 
    lastFrameTime = currentTime;
    
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Fondo
    gameCtx.fillStyle = '#1a1a2e';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Línea del suelo
    gameCtx.strokeStyle = '#ffffff';
    gameCtx.lineWidth = 3;
    gameCtx.beginPath();
    gameCtx.moveTo(0, gameCanvas.height);
    gameCtx.lineTo(gameCanvas.width, gameCanvas.height);
    gameCtx.stroke();
    
    drawHealthBars(gameCtx);
    
    // Actualizar personajes
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
            
            // Notificar al servidor el resultado
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
            x: frameData[0],
            y: frameData[1],
            width: frameData[2],
            height: frameData[3]
        };
    }

    const drawWidth = char.size.width;
    const drawHeight = char.height;
    
    // Dibujar sprite
    if (char.spriteLoaded) {
        ctx.save();
        ctx.translate(char.position.x, char.position.y);
        
        if (char.facingDirection === 1) { 
            ctx.scale(-1, 1); 
        }
        
        ctx.drawImage(
            char.sprite,
            char.frame.x,
            char.frame.y,
            char.frame.width,
            char.frame.height,
            -drawWidth / 2,
            -drawHeight,
            drawWidth,
            drawHeight
        );
        
        ctx.restore();
    } else {
        const rectX = char.position.x - (char.size.width / 2);
        const rectY = char.position.y - drawHeight;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(rectX, rectY, char.size.width, drawHeight);
    }
    
    // Dibujar hurtbox
    if (showHurtboxes) {
        const hurtbox = char.getHurtbox();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(hurtbox.x, hurtbox.y, hurtbox.width, hurtbox.height);
        
        ctx.fillStyle = '#00ffff';
        ctx.font = '10px monospace';
        ctx.fillText('HURT', hurtbox.x + 2, hurtbox.y + 12);
    }
    
    // Dibujar hitbox
    if (showHitboxes) {
        const hitbox = char.getAttackHitbox();
        if (hitbox) {
            ctx.strokeStyle = '#ff0000';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            ctx.lineWidth = 3;
            ctx.strokeRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`HIT: ${hitbox.damage}dmg`, hitbox.x + 2, hitbox.y + 15);
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
    const legendX = 10;
    const legendY = gameCanvas.height - 120;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(legendX, legendY, 220, 110);
    
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Debug Controls:', legendX + 5, legendY + 15);
    
    ctx.fillStyle = showHurtboxes ? '#00ffff' : '#666666';
    ctx.fillText(`F1: Hurtboxes ${showHurtboxes ? 'ON' : 'OFF'}`, legendX + 5, legendY + 35);
    
    ctx.fillStyle = showHitboxes ? '#ff0000' : '#666666';
    ctx.fillText(`F2: Hitboxes ${showHitboxes ? 'ON' : 'OFF'}`, legendX + 5, legendY + 50);
    
    ctx.fillStyle = showDebugInfo ? '#ffff00' : '#666666';
    ctx.fillText(`F3: Info ${showDebugInfo ? 'ON' : 'OFF'}`, legendX + 5, legendY + 65);
    
    // Mostrar modo de juego
    ctx.fillStyle = '#00ff00';
    ctx.fillText(isMultiplayer ? '🌐 ONLINE' : '🎮 LOCAL', legendX + 5, legendY + 85);
    
    if (isMultiplayer) {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '10px monospace';
        ctx.fillText(`P${localPlayerIndex + 1}: ${characters[localPlayerIndex]?.name}`, legendX + 5, legendY + 100);
    }
}

function DrawTimer(ctx, secondspassed) {
    if (!gameEnded) {
        timeleft -= secondspassed;
        if (timeleft < 0) timeleft = 0;
    }
    
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    const timeDisplay = Math.floor(timeleft).toString().padStart(2, '0');
    ctx.strokeText(timeDisplay, gameCanvas.width / 2, 45);
    ctx.fillText(timeDisplay, gameCanvas.width / 2, 45);
}

function drawHealthBars(ctx) {
    if (characters.length < 2) return;

    const p1 = characters[0];
    const p2 = characters[1];

    const barHeight = 30;
    const totalBarWidth = gameCanvas.width * 0.35;
    const padding = 20;
    const barY = padding + 40;
    const p1X = padding;
    
    // Barra P1
    ctx.fillStyle = '#222222';
    ctx.fillRect(p1X, barY, totalBarWidth, barHeight);
    
    ctx.fillStyle = p1.health > 30 ? '#ffee56ff' : '#ff4444';
    const p1CurrentWidth = totalBarWidth * (p1.health / p1.maxHealth);
    ctx.fillRect(p1X, barY, p1CurrentWidth, barHeight);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(p1X, barY, totalBarWidth, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${p1.name} (P1)`, p1X, barY - 5);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.fillText(`${p1.health}/${p1.maxHealth}`, p1X + 5, barY + 20);
    
    // Barra P2
    const p2X = gameCanvas.width - padding - totalBarWidth;
    ctx.fillStyle = '#222222';
    ctx.fillRect(p2X, barY, totalBarWidth, barHeight);
    
    ctx.fillStyle = p2.health > 30 ? '#ffee56ff' : '#ff4444';
    const p2CurrentWidth = totalBarWidth * (p2.health / p2.maxHealth);
    ctx.fillRect(p2X + totalBarWidth - p2CurrentWidth, barY, p2CurrentWidth, barHeight);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(p2X, barY, totalBarWidth, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${p2.name} (P2)`, gameCanvas.width - padding, barY - 5);
    
    ctx.fillText(`${p2.health}/${p2.maxHealth}`, gameCanvas.width - padding - 5, barY + 20);
}

function fpscounter(ctx, secondspassed) {
    ctx.fillStyle = '#00ff00';
    ctx.font = '16px monospace';
    ctx.textAlign = 'right';
    
    const fps = secondspassed > 0 ? Math.round(1 / secondspassed) : 60; 
    
    ctx.fillText(`FPS: ${fps}`, gameCanvas.width - 10, gameCanvas.height - 10);
}

function drawDebugInfo(ctx) {
    const ryu = characters[0];
    const ken = characters[1];
    if (!ryu || !ken) return;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(gameCanvas.width - 310, 10, 300, 100);
    
    ctx.fillStyle = '#ffff00';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    
    const debugInfo = [
        `P1: ${ryu.currentState} | Stun: ${ryu.isInHitstun ? 'YES' : 'NO'}`,
        `    Pos: (${Math.round(ryu.position.x)}, ${Math.round(ryu.position.y)})`,
        `P2: ${ken.currentState} | Stun: ${ken.isInHitstun ? 'YES' : 'NO'}`,
        `    Pos: (${Math.round(ken.position.x)}, ${Math.round(ken.position.y)})`,
        `Canvas: ${gameCanvas.width}x${gameCanvas.height}`
    ];
    
    debugInfo.forEach((text, index) => {
        ctx.fillText(text, gameCanvas.width - 15, 30 + (index * 18));
    });
}

function drawResultAnimation(ctx, secondspassed) {
    if (resultAnimationProgress < 1) {
        resultAnimationProgress += secondspassed / ANIMATION_DURATION;
        if (resultAnimationProgress > 1) {
            resultAnimationProgress = 1;
        }
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
    
    const startX = gameCanvas.width + 300;
    const endX = gameCanvas.width / 2;
    const currentX = startX + (endX - startX) * easeProgress;
    const currentY = gameCanvas.height / 2;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    const cardWidth = 600;
    const cardHeight = 200;
    const cardX = currentX - cardWidth / 2;
    const cardY = currentY - cardHeight / 2;
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 5;
    ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);
    
    ctx.fillStyle = textColor;
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(resultText, currentX, currentY - 20);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText('Press SPACE to return to lobby', currentX, currentY + 60);
}

export function stopGame() {
    gameRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Limpiar listeners de red
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
        
        // Volver al lobby
        if (window.showPage) {
            window.showPage('lobby-page');
        }
    }
});