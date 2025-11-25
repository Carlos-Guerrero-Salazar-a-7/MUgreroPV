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
let rounds = 2;
let userName = "";
let userOpponentName = "";

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

// ===== VARIABLES PARA SELECCIÓN DE PERSONAJE =====
let isSelecting = false;
let selectionTimer = 20.0; // 20 segundos para selección
let selectedCharacters = [null, null]; // [Player1Char, Player2Char]

// SOLUCIÓN: Agregamos una propiedad 'instance' para guardar la copia visual
const CHARACTER_LIST = [
    { name: "Ryu", constructor: Ryu, portraitX: VIRTUAL_WIDTH / 4, instance: null },
    { name: "Ken", constructor: Ken, portraitX: VIRTUAL_WIDTH * 3 / 4, instance: null }
];

// ===== NUEVAS VARIABLES PARA NETWORKING =====
let isMultiplayer = false;
let localPlayerIndex = -1;
let socketConnection = null;
let currentRoomID = null;

// Buffer para sincronización
let lastSyncTime = 0;
const SYNC_INTERVAL = 50;

// Handler para las teclas del juego (necesario para deshabilitar durante la selección)
let gameKeyHandler = null;
let controlsMap = {};

// --- Helper para inicializar instancias de vista previa UNA sola vez ---
function initSelectionInstances() {
    CHARACTER_LIST.forEach(charData => {
        if (!charData.instance) {
            // Instanciamos el personaje solo para leer sus datos gráficos (portrait, sprite)
            // No nos importa la posición ni la salud aquí
            charData.instance = new charData.constructor(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
            console.log(`Instancia de vista previa creada para: ${charData.name}`);
        }
    });
}

// Handler para la selección de personaje (click)
function handleSelectionClick(event) {
    if (!isSelecting) return;

    // 1. Transformar coordenadas de click a coordenadas virtuales
    const rect = gameCanvas.getBoundingClientRect();
    const clickX = (event.clientX - rect.left - offsetX) / scale;
    const clickY = (event.clientY - rect.top - offsetY) / scale;

    const portraitWidth = VIRTUAL_WIDTH * 0.3;
    const portraitHeight = portraitWidth;
    const portraitY = VIRTUAL_HEIGHT / 2 - portraitHeight / 2;

    let selectionMade = false;

    CHARACTER_LIST.forEach((charData, index) => {
        const charX = charData.portraitX;
        // Hitbox del retrato en coordenadas virtuales
        const hitbox = {
            x: charX - portraitWidth / 2,
            y: portraitY,
            width: portraitWidth,
            height: portraitHeight
        };

        if (clickX >= hitbox.x && clickX <= hitbox.x + hitbox.width &&
            clickY >= hitbox.y && clickY <= hitbox.y + hitbox.height) {

            // Lógica de selección: El jugador local selecciona su personaje
            let playerIndexToSelect = -1;

            if (isMultiplayer) {
                // Modo online: El jugador local selecciona su índice
                playerIndexToSelect = localPlayerIndex;
            } else {
                // Modo local: Intentar seleccionar P1 si no está seleccionado
                if (!selectedCharacters[0]) {
                    playerIndexToSelect = 0;
                }
                // Si P1 ya seleccionó, intentar seleccionar P2
                else if (!selectedCharacters[1]) {
                    playerIndexToSelect = 1;
                }
            }

            if (playerIndexToSelect !== -1 && !selectedCharacters[playerIndexToSelect]) {
                selectedCharacters[playerIndexToSelect] = charData;
                selectionMade = true;

                console.log(`P${playerIndexToSelect + 1} seleccionó: ${charData.name}`);

                if (isMultiplayer && socketConnection) {
                    // Enviar selección al servidor
                    socketConnection.emit('selectCharacter', {
                        roomID: currentRoomID,
                        playerIndex: localPlayerIndex,
                        characterName: charData.name
                    });
                }
            }
        }
    });

    // En modo local, si ambos están seleccionados, iniciar el juego
    if (!isMultiplayer && selectedCharacters[0] && selectedCharacters[1]) {
        finalizeSelection();
    }
}

function finalizeSelection(forceRandom = false) {
    if (!isSelecting) return;

    isSelecting = false;
    gameCanvas.removeEventListener('click', handleSelectionClick);

    // 1. Determinar personajes finales (por defecto a Ryu/Ken)
    const P1CharData = selectedCharacters[0] || CHARACTER_LIST.find(c => c.name === "Ryu");
    const P2CharData = selectedCharacters[1] || CHARACTER_LIST.find(c => c.name === "Ken");

    if (isMultiplayer) {
        console.log("Selección finalizada. Esperando al servidor para el inicio de partida.");
        return;
    }

    // Lógica para modo LOCAL

    // 2. Instanciar personajes NUEVOS para la pelea (independientes de las vistas previas)
    characters = [
        new P1CharData.constructor(VIRTUAL_WIDTH, VIRTUAL_HEIGHT, { x: 200, y: VIRTUAL_HEIGHT },
            { width: VIRTUAL_WIDTH * 0.15, height: VIRTUAL_HEIGHT * 0.35 }, 8),
        new P2CharData.constructor(VIRTUAL_WIDTH, VIRTUAL_HEIGHT, { x: VIRTUAL_WIDTH - 200, y: VIRTUAL_HEIGHT },
            { width: VIRTUAL_WIDTH * 0.15, height: VIRTUAL_HEIGHT * 0.35 }, 8)
    ];

    // 3. Resetear controles para el juego
    setupControls();
    console.log(`✅ Juego iniciado. P1: ${characters[0].name}, P2: ${characters[1].name}`);
}

function drawSelectionScreen(ctx, secondspassed) {
    // Fondo de Selección
    ctx.fillStyle = '#0f0f1c';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    ctx.textAlign = 'center';

    // Título
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Inter, sans-serif';
    ctx.fillText('SELECCIÓN DE PERSONAJE', VIRTUAL_WIDTH / 2, 150);

    // Tiempo Restante
    const timeDisplay = Math.ceil(selectionTimer).toString().padStart(2, '0');
    ctx.fillStyle = selectionTimer <= 5 ? '#ff4444' : '#ffee56';
    ctx.font = 'bold 160px Inter, sans-serif';
    ctx.fillText(timeDisplay, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 30);

    // Recuadro del Temporizador
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, 120, 0, Math.PI * 2);
    ctx.stroke();

    // Character Portraits (Virtual Coordinates)
    const portraitWidth = VIRTUAL_WIDTH * 0.3;
    const portraitHeight = portraitWidth;
    const portraitY = VIRTUAL_HEIGHT / 2 - portraitHeight / 2;

    CHARACTER_LIST.forEach((charData, index) => {
        // SOLUCIÓN: Usamos la instancia YA creada, en lugar de hacer 'new'
        const tempChar = charData.instance;

        // Si por alguna razón no se inicializó, saltamos este frame para evitar error
        if (!tempChar) return;

        const charX = charData.portraitX;

        // Marco de Selección
        const isP1Selected = selectedCharacters[0]?.name === tempChar.name;
        const isP2Selected = selectedCharacters[1]?.name === tempChar.name;

        let strokeColor = '#444444';
        if (isP1Selected && isP2Selected) {
            strokeColor = '#00ff00';
        } else if (isP1Selected || isP2Selected) {
            strokeColor = '#ff6600'; // Color de selección (Naranja)
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 15;
        ctx.fillStyle = '#1a1a1a';

        const rectX = charX - portraitWidth / 2;
        ctx.fillRect(rectX, portraitY, portraitWidth, portraitHeight);
        ctx.strokeRect(rectX, portraitY, portraitWidth, portraitHeight);

        // Dibujar Nombre
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px Inter, sans-serif';
        ctx.fillText(tempChar.name.toUpperCase(), charX, portraitY + portraitHeight + 100);

        // Dibujar el Portrait
        if (tempChar.spriteLoaded && tempChar.portrait) {
            const pData = tempChar.portrait; // { offsetX, offsetY, width, height }
            const img = tempChar.sprite;

            ctx.drawImage(
                img,
                pData.offsetX, pData.offsetY, pData.width, pData.height,
                rectX + 20, // X Dest (con padding)
                portraitY + 20, // Y Dest (con padding)
                portraitWidth - 40, // Draw size (con padding)
                portraitHeight - 40 // Draw size (con padding)
            );
        } else {
            // Placeholder text si el sprite no carga
            ctx.fillStyle = '#ff0000';
            ctx.font = '40px Inter, sans-serif';
            ctx.fillText(tempChar.name, charX, portraitY + portraitHeight / 2);
        }

        // Etiquetas de Jugador
        let tags = '';
        if (isP1Selected) tags += 'P1';
        if (isP2Selected) tags += (tags ? ' & ' : '') + 'P2';

        if (tags) {
            ctx.fillStyle = isP1Selected && isP2Selected ? '#00ff00' : '#ff9900';
            ctx.font = 'bold 60px Inter, sans-serif';
            ctx.fillText(tags, charX, portraitY - 20);
        }
    });

    // Instrucciones
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '30px Inter, sans-serif';
    if (isMultiplayer) {
        ctx.fillText(`Jugador ${localPlayerIndex + 1}: Haz click en tu personaje.`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT - 50);
    } else {
        ctx.fillText('Jugadores 1 y 2: Haz click en el retrato para seleccionar.', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT - 50);
    }
}

// ===== FUNCIÓN PRINCIPAL: INICIAR JUEGO (Modificado) =====
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

    gameCanvas = document.getElementById('main_game');
    gameCtx = gameCanvas.getContext('2d');

    setupResize();
    window.dispatchEvent(new Event('resize'));

    // SOLUCIÓN: Inicializamos las imágenes de selección UNA sola vez
    initSelectionInstances();

    // === INICIAR PANTALLA DE SELECCIÓN ===
    isSelecting = true;
    selectionTimer = 20.0;
    selectedCharacters = [null, null];

    // Si la configuración ya tiene personajes, los pre-selecciona
    if (config.p1Char) {
        selectedCharacters[0] = CHARACTER_LIST.find(c => c.name === config.p1Char);
    }
    if (config.p2Char) {
        selectedCharacters[1] = CHARACTER_LIST.find(c => c.name === config.p2Char);
    }

    console.log("=".repeat(60));
    console.log(`📺 RESOLUCIÓN VIRTUAL: ${VIRTUAL_WIDTH}x${VIRTUAL_HEIGHT}`);
    console.log(`⏳ INICIANDO SELECCIÓN DE PERSONAJE. Tiempo: ${selectionTimer}s`);
    if (isMultiplayer) {
        console.log(`🌐 MODO MULTIJUGADOR - Sala: ${currentRoomID} | Jugador: ${localPlayerIndex + 1}`);
        userName = config.userName || "Player 1";
        userOpponentName = config.opponentName || "Player 2";
    } else {
        console.log(`🎮 MODO LOCAL`);
    }
    console.log("=".repeat(60));

    // Inicializa los controles de selección (click)
    setupControls();
    setupDebugControls();

    if (isMultiplayer) {
        setupNetworkListeners();
    }

    gameRunning = true;
    gameLoop(performance.now());
}

// ===== CONFIGURAR LISTENERS DE RED (Adición para selección) =====
function setupNetworkListeners() {
    if (!socketConnection || !currentRoomID) return;

    // Listener para recibir la selección del oponente
    socketConnection.on('opponentCharacterSelected', (data) => {
        if (data.roomID === currentRoomID && data.playerIndex !== localPlayerIndex) {
            const opponentIndex = data.playerIndex;
            selectedCharacters[opponentIndex] = CHARACTER_LIST.find(c => c.name === data.characterName);
            console.log(`Oponente (P${opponentIndex + 1}) seleccionó: ${data.characterName}`);
        }
    });

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

    socketConnection.on('gameStart', (config) => {
        console.log('🎉 Partida iniciada desde el servidor!', config);

        // Finalizar la selección en el cliente
        isSelecting = false;
        gameCanvas.removeEventListener('click', handleSelectionClick);

        // Usar los personajes confirmados por el servidor
        const p1CharData = CHARACTER_LIST.find(c => c.name === config.p1Char) || CHARACTER_LIST.find(c => c.name === "Ryu");
        const p2CharData = CHARACTER_LIST.find(c => c.name === config.p2Char) || CHARACTER_LIST.find(c => c.name === "Ken");

        // Instanciar personajes
        characters = [
            new p1CharData.constructor(VIRTUAL_WIDTH, VIRTUAL_HEIGHT, { x: 200, y: VIRTUAL_HEIGHT },
                { width: VIRTUAL_WIDTH * 0.15, height: VIRTUAL_HEIGHT * 0.35 }, 8),
            new p2CharData.constructor(VIRTUAL_WIDTH, VIRTUAL_HEIGHT, { x: VIRTUAL_WIDTH - 200, y: VIRTUAL_HEIGHT },
                { width: VIRTUAL_WIDTH * 0.15, height: VIRTUAL_HEIGHT * 0.35 }, 8)
        ];

        setupControls(); // Cargar controles de juego
        window.showPage('game');
    });
}

// ===== SINCRONIZACIÓN DE JUEGO (Netcode) =====
function syncGameState(gameState) {
    if (characters.length < 2) return;

    // Sincronizar posición, estado y salud de P1 y P2
    // Nota: Esto es una simplificación. Un netcode real requeriría rollback.

    // Sincronizar P1 (si este cliente es P2)
    if (localPlayerIndex === 1) {
        characters[0].position.x = gameState.p1.x;
        characters[0].position.y = gameState.p1.y;
        characters[0].health = gameState.p1.health;
        characters[0].changeState(gameState.p1.state);
        // Opcional: Sincronizar frames para suavizar
        characters[0].animationFrame = gameState.p1.frame;
    }

    // Sincronizar P2 (si este cliente es P1)
    if (localPlayerIndex === 0) {
        characters[1].position.x = gameState.p2.x;
        characters[1].position.y = gameState.p2.y;
        characters[1].health = gameState.p2.health;
        characters[1].changeState(gameState.p2.state);
        // Opcional: Sincronizar frames para suavizar
        characters[1].animationFrame = gameState.p2.frame;
    }

    timeleft = gameState.timeLeft;
}

// ===== EMITIR INPUT LOCAL (Netcode) =====
function emitLocalInput(currentMoves) {
    if (isMultiplayer && socketConnection && currentRoomID) {
        // Enviar TODOS los movimientos (true/false) para que el servidor sepa cuando se suelta una tecla
        socketConnection.emit('gameInput', {
            roomID: currentRoomID,
            playerIndex: localPlayerIndex,
            moves: currentMoves,
            // Aquí podríamos incluir la secuencia de frames para el rollback, pero lo omitimos por simplicidad.
        });
    }
}


function setupControls() {
    if (gameKeyHandler) {
        document.removeEventListener('keydown', gameKeyHandler);
        document.removeEventListener('keyup', gameKeyHandler);
    }
    gameCanvas.removeEventListener('click', handleSelectionClick);

    if (isSelecting) {
        // En modo de selección, solo se usa el click para seleccionar
        gameCanvas.addEventListener('click', handleSelectionClick);
        return;
    }

    // === CONFIGURACIÓN DE CONTROLES DE JUEGO (existente) ===
    if (isMultiplayer) {
        // En multiplayer, ambos jugadores usan WASD/Teclas de ataque para SU personaje
        const myCharIndex = localPlayerIndex;

        controlsMap = {
            // WASD para movimiento
            'w': { charIndex: myCharIndex, move: 'up' },
            'a': { charIndex: myCharIndex, move: 'left' },
            's': { charIndex: myCharIndex, move: 'down' },
            'd': { charIndex: myCharIndex, move: 'right' },

            // Teclas de ataque (J, K, U, I)
            'j': { charIndex: myCharIndex, move: 'punchone' },
            'k': { charIndex: myCharIndex, move: 'kickone' },
            'u': { charIndex: myCharIndex, move: 'punchtwo' },
            'i': { charIndex: myCharIndex, move: 'kicktwo' },

            // Flechas también por si acaso (para comodidad)
            'arrowup': { charIndex: myCharIndex, move: 'up' },
            'arrowleft': { charIndex: myCharIndex, move: 'left' },
            'arrowdown': { charIndex: myCharIndex, move: 'down' },
            'arrowright': { charIndex: myCharIndex, move: 'right' },
            '1': { charIndex: myCharIndex, move: 'punchone' },
            '2': { charIndex: myCharIndex, move: 'kickone' },
            '3': { charIndex: myCharIndex, move: 'punchtwo' },
            '4': { charIndex: myCharIndex, move: 'kicktwo' },
        };
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

    // Handler de juego
    gameKeyHandler = (e, isDown) => {
        const key = e.key.toLowerCase();
        const control = controlsMap[key];
        if (control) {
            const character = characters[control.charIndex];
            if (character) {
                // Actualiza el estado de movimiento local
                character.moves[control.move] = isDown;

                // Si es multijugador y el movimiento es del jugador local, emitir el input
                if (isMultiplayer && control.charIndex === localPlayerIndex) {
                    emitLocalInput(character.moves);
                }
                e.preventDefault();
            }
        }
    };
    document.addEventListener('keydown', (e) => gameKeyHandler(e, true));
    document.addEventListener('keyup', (e) => gameKeyHandler(e, false));
}

// ===== CONTROLES DE DEPURACIÓN (Debug) =====
function setupDebugControls() {
    document.addEventListener('keydown', (e) => {
        if (!gameRunning || isSelecting) return;

        switch (e.key) {
            case 'F1':
                e.preventDefault();
                showHurtboxes = !showHurtboxes;
                console.log(`Debug: Hurtboxes ${showHurtboxes ? 'ON' : 'OFF'}`);
                break;
            case 'F2':
                e.preventDefault();
                showHitboxes = !showHitboxes;
                console.log(`Debug: Hitboxes ${showHitboxes ? 'ON' : 'OFF'}`);
                break;
            case 'F3':
                e.preventDefault();
                showDebugInfo = !showDebugInfo;
                console.log(`Debug: Info ${showDebugInfo ? 'ON' : 'OFF'}`);
                break;
        }
    });
}

// ===== MANEJO DE REDIMENSIONAMIENTO (Responsive) =====
function setupResize() {
    window.addEventListener('resize', () => {
        if (!gameCanvas) return;

        const container = gameCanvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        const aspectRatio = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
        let newWidth;
        let newHeight;

        // Determinar si el ancho o el alto es el factor limitante
        if (width / height > aspectRatio) {
            // La altura es el factor limitante (Barras negras a los lados)
            newHeight = height;
            newWidth = height * aspectRatio;
        } else {
            // El ancho es el factor limitante (Barras negras arriba/abajo)
            newWidth = width;
            newHeight = width / aspectRatio;
        }

        // Aplicar tamaño físico (llenar el contenedor)
        gameCanvas.width = width;
        gameCanvas.height = height;

        // Calcular el factor de escala (escala) y el desplazamiento (offsetX, offsetY)
        scale = newWidth / VIRTUAL_WIDTH;
        offsetX = (width - newWidth) / 2;
        offsetY = (height - newHeight) / 2;

        // Actualizar el tamaño del canvas en los personajes (si están instanciados)
        characters.forEach(char => {
            char.updateCanvasSize(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
        });

        console.log(`Resize: New Canvas: ${newWidth.toFixed(0)}x${newHeight.toFixed(0)}, Scale: ${scale.toFixed(3)}`);
    });
}


// ===== BUCLE PRINCIPAL DE JUEGO (Modificado) =====
function gameLoop(currentTime) {
    if (!gameRunning) return;

    const secondspassed = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    // 1. Limpiar toda la pantalla física
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

    // === LÓGICA DE SELECCIÓN ===
    if (isSelecting) {
        selectionTimer -= secondspassed;
        if (selectionTimer <= 0) {
            selectionTimer = 0;
            finalizeSelection(true); // Forzar selección (aleatoria/por defecto)
        }
        drawSelectionScreen(gameCtx, secondspassed);
    }
    // === LÓGICA DE JUEGO ===
    else if (characters.length > 0 && !gameEnded) {
        // Fondo del juego
        gameCtx.fillStyle = '#1a1a2e';
        gameCtx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

        // Línea del suelo
        gameCtx.strokeStyle = '#ffffff';
        gameCtx.lineWidth = 3;
        gameCtx.beginPath();
        gameCtx.moveTo(0, VIRTUAL_HEIGHT); // CORRECCIÓN: Usar gameCtx o ctx (aquí se usa ctx)
        gameCtx.lineTo(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
        gameCtx.stroke();

        drawHealthBars(gameCtx);

        // Actualizar lógica 
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

        // NETCODE: Enviar el estado del juego al servidor para sincronización
        if (isMultiplayer && socketConnection && currentRoomID && performance.now() - lastSyncTime > SYNC_INTERVAL) {
            socketConnection.emit('syncGameState', {
                roomID: currentRoomID,
                gameState: {
                    p1: { x: characters[0].position.x, y: characters[0].position.y, health: characters[0].health, state: characters[0].currentState, frame: characters[0].animationFrame },
                    p2: { x: characters[1].position.x, y: characters[1].position.y, health: characters[1].health, state: characters[1].currentState, frame: characters[1].animationFrame },
                    timeLeft: timeleft
                }
            });
            lastSyncTime = performance.now();
        }


        // Verificar fin de juego
        if (timeleft <= 0 || characters[0].health <= 0 || characters[1].health <= 0) {
            if (!gameEnded) {
                gameEnded = true;
                resultAnimationProgress = 0;
                if (isMultiplayer && socketConnection && currentRoomID) {
                    const winnerName = characters[0].health > characters[1].health ?
                        userName : userOpponentName; // userName es P1, userOpponentName es P2

                    socketConnection.emit('gameEnded', {
                        roomID: currentRoomID,
                        winner: winnerName,
                        finalState: {
                            p1Health: characters[0].health,
                            p2Health: characters[1].health,
                            timeLeft: timeleft
                        }
                    });
                }
            }
        }
    }
    // === LÓGICA DE RESULTADO ===
    else if (gameEnded) {
        drawResultAnimation(gameCtx, secondspassed);
    }

    // 4. Restaurar el contexto
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

    // Usamos el cálculo de escala de drawCharacter en character.js, 
    // pero aquí usamos un valor fijo para simplificar el dibujo de debug.
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
    if (isMultiplayer) {
        // En multiplayer, userName es P1 y userOpponentName es P2 (según nuestra asignación en iniciarJuego)
        if (characters[0].health > characters[1].health) {
            resultText = `${userName.toUpperCase()} WINS!`;
            textColor = '#00ff00';
        } else if (characters[1].health > characters[0].health) {
            resultText = `${userOpponentName.toUpperCase()} WINS!`;
            textColor = '#ff0000';
        }
    } else {
        if (characters[0].health > characters[1].health) {
            resultText = `${characters[0].name.toUpperCase()} WINS!`;
            textColor = '#00ff00';
        } else if (characters[1].health > characters[0].health) {
            resultText = `${characters[1].name.toUpperCase()} WINS!`;
            textColor = '#ff0000';
        }
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
    // Asegurar que se limpia el listener de selección si está activo
    if (gameCanvas) {
        gameCanvas.removeEventListener('click', handleSelectionClick);
        // Quitar los listeners de juego al detener
        if (gameKeyHandler) {
            document.removeEventListener('keydown', gameKeyHandler);
            document.removeEventListener('keyup', gameKeyHandler);
        }
    }
    if (socketConnection && isMultiplayer) {
        socketConnection.off('opponentCharacterSelected');
        socketConnection.off('gameStart');
        socketConnection.off('gameInput');
        socketConnection.off('gameStateSync');
        socketConnection.off('opponentDisconnected');
    }
    isSelecting = false;
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
            window.showPage('lobby');
        }
    }
}); 