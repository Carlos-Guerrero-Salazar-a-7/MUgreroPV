const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch'); // npm install node-fetch@2

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    upgradeTimeout: 30000
});

// URL de Laravel para sincronización
const LARAVEL_API_URL = process.env.LARAVEL_API_URL || 'http://127.0.0.1:8000/api';

let userMap = {}; // { 'socketId': 'userName' }
let gameRooms = {}; // { 'roomID': { ... } }
let activeUsers = {}; // { 'userName': 'socketId' }
let disconnectTimers = {}; // { 'userName': timeoutId }

const DISCONNECT_GRACE_PERIOD = 5000;

const getSocketIdByUserName = (userName) => activeUsers[userName];

const findActiveRoomByUserName = (userName) => {
    for (const roomID in gameRooms) {
        const room = gameRooms[roomID];
        if (room.status === 'active' && (room.challenger === userName || room.opponent === userName)) {
            return roomID;
        }
    }
    return null;
};

// Función para sincronizar con Laravel - Crear partida
async function createMatchInDB(roomID, room) {
    const url = `${LARAVEL_API_URL}/matches`;
    console.log(`📡 Intentando crear partida en DB: ${url}`, {
        room_id: roomID,
        nombre_jugador1: room.challenger,
        nombre_jugador2: room.opponent
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                room_id: roomID,
                nombre_jugador1: room.challenger,
                nombre_jugador2: room.opponent,
                personaje_jugador1: 'Ryu', // Aquí puedes agregar selección de personajes
                personaje_jugador2: 'Ken'
            })
        });

        const text = await response.text();
        console.log(`📡 Respuesta DB (Status ${response.status}):`, text);

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('❌ Error al parsear JSON de DB:', e);
            return null;
        }

        if (!response.ok) {
            console.error(`❌ Error HTTP al crear partida: ${response.status} - ${data.mensaje || text}`);
            return null;
        }

        console.log(`📊 Partida registrada en DB: ${roomID}`, data);
        return data;
    } catch (error) {
        console.error('❌ Error de red al crear partida en DB:', error.message);
        return null;
    }
}

// Verificación de conexión al inicio
(async () => {
    try {
        console.log(`🔍 Verificando conexión con API Laravel: ${LARAVEL_API_URL}/active-users`);
        const res = await fetch(`${LARAVEL_API_URL}/game/active-users`); // Usamos una ruta GET existente
        if (res.ok) {
            console.log('✅ Conexión con API Laravel exitosa.');
        } else {
            console.error(`⚠️ Advertencia: API Laravel respondió con status ${res.status}`);
        }
    } catch (e) {
        console.error(`❌ Error crítico: No se puede conectar con API Laravel en ${LARAVEL_API_URL}. Detalles:`, e.message);
    }
})();

// Función para iniciar partida en DB
async function startMatchInDB(roomID) {
    try {
        const response = await fetch(`${LARAVEL_API_URL}/matches/${roomID}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        console.log(`▶️ Partida iniciada en DB: ${roomID}`);
        return data;
    } catch (error) {
        console.error('❌ Error al iniciar partida en DB:', error.message);
        return null;
    }
}

// Función para finalizar partida en DB
async function finishMatchInDB(roomID, winner, finalState, stats = {}) {
    try {
        const response = await fetch(`${LARAVEL_API_URL}/matches/${roomID}/finish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                nombre_ganador: winner,
                salud_jugador1_final: finalState.p1Health || 0,
                salud_jugador2_final: finalState.p2Health || 0,
                tiempo_restante: finalState.timeLeft || 0,
                golpes_jugador1: stats.golpes_jugador1 || 0,
                golpes_jugador2: stats.golpes_jugador2 || 0,
                combos_jugador1: stats.combos_jugador1 || 0,
                combos_jugador2: stats.combos_jugador2 || 0
            })
        });

        const data = await response.json();
        console.log(`🏁 Partida finalizada en DB: ${roomID}`, data);
        return data;
    } catch (error) {
        console.error('❌ Error al finalizar partida en DB:', error.message);
        return null;
    }
}

// Función para cancelar partida en DB
async function cancelMatchInDB(roomID) {
    try {
        const response = await fetch(`${LARAVEL_API_URL}/matches/${roomID}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        console.log(`❌ Partida cancelada en DB: ${roomID}`);
        return data;
    } catch (error) {
        console.error('❌ Error al cancelar partida en DB:', error.message);
        return null;
    }
}

io.on('connection', (socket) => {
    const queryUserId = socket.handshake.query.userId;
    let authTimeout;

    if (queryUserId && queryUserId !== 'null' && queryUserId !== 'undefined') {
        console.log(`🔌 Usuario conectado: ${socket.id} (Autenticado por Query: ${queryUserId})`);

        // Autenticación inmediata
        const userName = queryUserId;

        if (disconnectTimers[userName]) {
            clearTimeout(disconnectTimers[userName]);
            delete disconnectTimers[userName];
            console.log(`⏱️ Timer de desconexión cancelado para ${userName}`);
        }

        const oldSocketId = activeUsers[userName];

        // SIEMPRE actualizar el mapa del socket actual
        userMap[socket.id] = userName;
        activeUsers[userName] = socket.id;

        socket.join('lobby');

        if (oldSocketId && oldSocketId !== socket.id) {
            console.log(`🔄 Usuario ${userName} RECONECTADO (${oldSocketId} -> ${socket.id})`);
            // Opcional: Desconectar el socket viejo para evitar zombies
            // if (io.sockets.sockets.get(oldSocketId)) io.sockets.sockets.get(oldSocketId).disconnect();
            if (userMap[oldSocketId] === userName) delete userMap[oldSocketId];
        } else {
            console.log(`✅ Usuario ${userName} añadido a activos.`);
            socket.broadcast.emit('userOnline', userName);
        }

    } else {
        console.log(`🔌 Usuario conectado (Sin Auth): ${socket.id}`);
        // Timeout de seguridad: Si no se une al lobby en 5 segundos, desconectar
        authTimeout = setTimeout(() => {
            // Verificar si se autenticó en el intermedio
            if (!userMap[socket.id]) {
                console.log(`🚫 Desconectando socket inactivo/no autenticado: ${socket.id}`);
                socket.disconnect();
            }
        }, 5000);
    }

    socket.on('joinLobby', (userName) => {
        if (!userName) return;

        // Cancelar el timeout de desconexión si se autentica
        clearTimeout(authTimeout);

        if (disconnectTimers[userName]) {
            clearTimeout(disconnectTimers[userName]);
            delete disconnectTimers[userName];
            console.log(`⏱️ Timer de desconexión cancelado para ${userName}`);
        }

        for (const roomID in gameRooms) {
            socket.leave(roomID);
        }

        socket.join('lobby');
        const wasOnline = activeUsers[userName] !== undefined;
        const oldSocketId = activeUsers[userName];

        userMap[socket.id] = userName;
        activeUsers[userName] = socket.id;

        if (wasOnline && oldSocketId !== socket.id) {
            console.log(`🔄 Usuario ${userName} RECONECTADO (${oldSocketId} -> ${socket.id})`);
            delete userMap[oldSocketId];
        } else if (!wasOnline) {
            console.log(`✅ Usuario ${userName} (${socket.id}) se unió al Lobby.`);
            socket.broadcast.emit('userOnline', userName);
        }
    });

    // Función auxiliar para iniciar un reto
    async function initiateChallenge(socket, opponentName) {
        let challengerName = userMap[socket.id];

        // Fallback de autenticación si se perdió el mapa
        if (!challengerName && socket.handshake.query.userId) {
            challengerName = socket.handshake.query.userId;
            userMap[socket.id] = challengerName;
            console.log(`⚠️ Restaurando sesión perdida para: ${challengerName} (Socket: ${socket.id})`);
        }

        const opponentSocketId = getSocketIdByUserName(opponentName);

        console.log(`⚔️ Iniciando reto: ${challengerName} (${socket.id}) -> ${opponentName} (${opponentSocketId})`);
        console.log(`   Estado userMap[${socket.id}]: ${userMap[socket.id]}`);

        if (!challengerName) {
            console.error(`❌ Fallo al retar: Usuario no autenticado (Socket: ${socket.id})`);
            socket.emit('authError', 'Tu sesión ha expirado. Por favor recarga la página.');
            return;
        }

        if (!opponentSocketId) {
            console.error(`❌ Fallo al retar: Oponente no encontrado. Challenger: ${challengerName}, Opponent: ${opponentName}`);
            socket.emit('roomError', `No se pudo encontrar a ${opponentName}. Es posible que se haya desconectado.`);
            return;
        }

        const roomID = `game_${challengerName}_vs_${opponentName}_${Date.now()}`;

        // UNIR AL CHALLENGER A LA SALA SOCKET.IO
        socket.join(roomID);

        gameRooms[roomID] = {
            id: roomID,
            host: socket.id,
            players: [socket.id],
            spectators: [],
            status: 'waiting',
            challenger: challengerName,
            opponent: opponentName,
            gameState: {
                timeleft: 99,
                characters: [
                    { health: 100, position: { x: 200, y: 0 }, currentState: 'standing', facingDirection: 1 },
                    { health: 100, position: { x: 800, y: 0 }, currentState: 'standing', facingDirection: -1 }
                ]
            },
            lastUpdate: Date.now(),
            stats: {
                golpes_jugador1: 0,
                golpes_jugador2: 0,
                combos_jugador1: 0,
                combos_jugador2: 0
            }
        };

        // Registrar en la base de datos
        await createMatchInDB(roomID, gameRooms[roomID]);

        io.to(opponentSocketId).emit('challengeReceived', {
            challenger: challengerName,
            roomID: roomID
        });

        socket.emit('challengeSent', opponentName);
        console.log(`⚔️ ${challengerName} retó a ${opponentName}. Sala: ${roomID}`);
        // El evento challengeAccepted se emitirá cuando el oponente realmente acepte
    }

    socket.on('challengeUser', async ({ opponentName }) => {
        await initiateChallenge(socket, opponentName);
    });

    socket.on('acceptChallenge', async ({ roomID }) => {
        const room = gameRooms[roomID];
        if (!room) {
            console.error(`❌ Intento de aceptar reto en sala inexistente: ${roomID}`);
            return;
        }

        console.log(`✅ Reto aceptado en sala: ${roomID}`);
        room.status = 'active';
        room.lastUpdate = Date.now();

        // Notificar al Challenger que el reto fue aceptado
        const challengerSocket = room.players[0];
        if (challengerSocket) {
            io.to(challengerSocket).emit('challengeAccepted', {
                roomID: roomID,
                opponentName: room.opponent
            });
        }

        // Notificar a ambos jugadores para iniciar el juego (Fase de Selección)
        // Enviamos p1Char y p2Char como null para indicar que deben seleccionar
        const gameConfig = {
            roomID: roomID,
            p1Char: null,
            p2Char: null,
            playerIndex: 0
        };

        const p1Socket = room.players[0];

        socket.join(roomID);
        if (!room.players.includes(socket.id)) {
            room.players.push(socket.id);
        }

        // Enviar start a cada uno con su índice
        if (p1Socket) {
            io.to(p1Socket).emit('gameStart', { ...gameConfig, playerIndex: 0, p1Name: room.challenger, p2Name: room.opponent });
        }

        io.to(socket.id).emit('gameStart', { ...gameConfig, playerIndex: 1, p1Name: room.challenger, p2Name: room.opponent });

        // Iniciar en DB
        await startMatchInDB(roomID);
    });

    // Manejo de Selección de Personaje
    socket.on('selectCharacter', ({ roomID, playerIndex, characterName }) => {
        const room = gameRooms[roomID];
        if (!room) return;

        console.log(`👤 Jugador ${playerIndex + 1} seleccionó: ${characterName} en sala ${roomID}`);

        // Guardar selección en la sala
        if (playerIndex === 0) {
            room.p1Char = characterName;
        } else {
            room.p2Char = characterName;
        }

        // Notificar al oponente
        socket.to(roomID).emit('opponentCharacterSelected', {
            roomID: roomID,
            playerIndex: playerIndex,
            characterName: characterName
        });

        // Verificar si ambos han seleccionado
        if (room.p1Char && room.p2Char) {
            console.log(`⚔️ Ambos jugadores listos en sala ${roomID}. Iniciando combate: ${room.p1Char} vs ${room.p2Char}`);

            // Emitir evento de inicio de combate REAL
            // Reutilizamos gameStart pero ahora con personajes definidos
            io.to(roomID).emit('gameStart', {
                roomID: roomID,
                p1Char: room.p1Char,
                p2Char: room.p2Char,
                // Nota: El playerIndex ya lo saben, pero el evento gameStart espera recibirlo.
                // Sin embargo, como es broadcast, no podemos enviar índices diferentes en un solo emit.
                // El cliente debe ser lo suficientemente inteligente para ignorar el playerIndex si ya está en juego
                // O podemos enviar mensajes individuales de nuevo.
            });

            // Para ser seguros y consistentes con la lógica de cliente (que reinicia si recibe gameStart),
            // enviamos individualmente de nuevo.
            const p1Socket = room.players[0];
            const p2Socket = room.players[1];

            if (p1Socket) io.to(p1Socket).emit('gameStart', { roomID, p1Char: room.p1Char, p2Char: room.p2Char, playerIndex: 0, p1Name: room.challenger, p2Name: room.opponent });
            if (p2Socket) io.to(p2Socket).emit('gameStart', { roomID, p1Char: room.p1Char, p2Char: room.p2Char, playerIndex: 1, p1Name: room.challenger, p2Name: room.opponent });
        }
    });

    socket.on('rejectChallenge', async ({ roomID }) => {
        const room = gameRooms[roomID];
        if (!room) return;

        console.log(`🚫 Reto rechazado en sala: ${roomID}`);

        // Notificar al retador
        // El retador es el host (players[0])
        const challengerSocketId = room.host;

        if (challengerSocketId) {
            io.to(challengerSocketId).emit('challengeRejected', {
                challenger: userMap[socket.id] || 'Oponente',
                roomID: roomID
            });
        }
        // Cancelar en DB
        await cancelMatchInDB(roomID);

        delete gameRooms[roomID];
    });

    // Manejo de Inputs de Juego (Movimiento, Ataques)
    socket.on('gameInput', (data) => {
        // Validar que la sala exista
        if (gameRooms[data.roomID]) {
            // Reenviar el input al otro jugador en la sala
            socket.to(data.roomID).emit('gameInput', data);
        }
    });

    // Sincronización de Estado de Juego (Posición, Vida, Tiempo)
    socket.on('syncGameState', (data) => {
        if (gameRooms[data.roomID]) {
            // Reenviar el estado al otro jugador
            socket.to(data.roomID).emit('gameStateSync', data);

            // Actualizar estado en el servidor (para persistencia/validación)
            gameRooms[data.roomID].gameState = data.gameState;
            gameRooms[data.roomID].lastUpdate = Date.now();
        }
    });

    // Manejo de Partida Rápida
    socket.on('quickMatch', async (userId) => {
        console.log(`🚀 Usuario ${userId} busca partida rápida.`);

        // Obtener lista de usuarios activos excluyendo al solicitante
        const availableOpponents = Object.keys(activeUsers).filter(name => name !== userId);

        console.log(`   Oponentes disponibles: ${availableOpponents.join(', ')}`);

        if (availableOpponents.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableOpponents.length);
            const opponentName = availableOpponents[randomIndex];

            console.log(`   -- > Emparejado con: ${opponentName}`);
            await initiateChallenge(socket, opponentName);

        } else {
            console.log('   --> No se encontraron oponentes.');
            socket.emit('roomError', 'No se encontraron oponentes disponibles para partida rápida.');
        }
    });

    // Manejo de Partida Clasificada (Ranked)
    socket.on('rankedMatch', async (userId) => {
        console.log(`🏆 Usuario ${userId} busca partida clasificada.`);
        const availableOpponents = Object.keys(activeUsers).filter(name => name !== userId);

        if (availableOpponents.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableOpponents.length);
            const opponentName = availableOpponents[randomIndex];

            console.log(`   -- > Emparejado(Ranked) con: ${opponentName}`);
            await initiateChallenge(socket, opponentName);
        } else {
            socket.emit('roomError', 'No se encontraron oponentes para partida clasificada.');
        }
    });

    // NUEVO: Manejo de Rematch
    socket.on('rematchResponse', async ({ roomID, playerIndex, accepted }) => {
        const room = gameRooms[roomID];
        if (!room) {
            console.error(`❌ Sala no encontrada para rematch: ${roomID}`);
            return;
        }

        console.log(`🔄 Rematch response en sala ${roomID}: P${playerIndex + 1} = ${accepted ? 'Acepta' : 'Rechaza'}`);

        // Inicializar objeto de votos si no existe
        if (!room.rematchVotes) {
            room.rematchVotes = { player1: null, player2: null };
        }

        // Guardar voto
        if (playerIndex === 0) {
            room.rematchVotes.player1 = accepted;
        } else {
            room.rematchVotes.player2 = accepted;
        }

        // Verificar si ambos han votado
        if (room.rematchVotes.player1 !== null && room.rematchVotes.player2 !== null) {
            // Ambos votaron
            if (room.rematchVotes.player1 && room.rematchVotes.player2) {
                // AMBOS ACEPTARON - Reiniciar partida
                console.log(`✅ Ambos jugadores aceptaron rematch en sala ${roomID}`);

                // Resetear selección de personajes
                room.p1Char = null;
                room.p2Char = null;

                // Resetear estado del juego
                room.gameState = {
                    timeleft: 99,
                    characters: [
                        { health: 100, position: { x: 200, y: 0 }, currentState: 'standing', facingDirection: 1 },
                        { health: 100, position: { x: 800, y: 0 }, currentState: 'standing', facingDirection: -1 }
                    ]
                };
                room.stats = {
                    golpes_jugador1: 0,
                    golpes_jugador2: 0,
                    combos_jugador1: 0,
                    combos_jugador2: 0
                };

                // Notificar a ambos jugadores
                io.to(roomID).emit('rematchAccepted', { roomID });

                // Reiniciar el juego SIN personajes (forzar selección)
                const p1Socket = room.players[0];
                const p2Socket = room.players[1];

                if (p1Socket) {
                    io.to(p1Socket).emit('rematchStart', {
                        roomID,
                        playerIndex: 0,
                        p1Name: room.challenger,
                        p2Name: room.opponent
                    });
                }

                if (p2Socket) {
                    io.to(p2Socket).emit('rematchStart', {
                        roomID,
                        playerIndex: 1,
                        p1Name: room.challenger,
                        p2Name: room.opponent
                    });
                }

                // IMPORTANTE: Resetear votos DESPUÉS de enviar los eventos
                room.rematchVotes = { player1: null, player2: null };

            } else {
                // AL MENOS UNO RECHAZÓ - Finalizar partida y guardar registro
                console.log(`❌ Rematch rechazado en sala ${roomID}. Guardando registro y enviando al lobby.`);

                // Determinar ganador basado en el último estado del juego
                let winner = null;
                let p1Health = 0;
                let p2Health = 0;
                let timeLeft = 0;

                // Verificar que gameState y characters existan
                if (room.gameState) {
                    if (room.gameState.characters && Array.isArray(room.gameState.characters)) {
                        p1Health = room.gameState.characters[0]?.health || 0;
                        p2Health = room.gameState.characters[1]?.health || 0;
                    }
                    timeLeft = room.gameState.timeleft || 0;

                    if (p1Health > p2Health) {
                        winner = room.challenger;
                    } else if (p2Health > p1Health) {
                        winner = room.opponent;
                    }
                }

                // Guardar en base de datos
                await finishMatchInDB(roomID, winner, {
                    p1Health: p1Health,
                    p2Health: p2Health,
                    timeLeft: timeLeft
                }, room.stats);

                // Notificar rechazo
                io.to(roomID).emit('rematchRejected', { roomID });

                // Devolver jugadores al lobby
                const p1Socket = room.players[0];
                const p2Socket = room.players[1];

                if (p1Socket) {
                    const p1SocketObj = io.sockets.sockets.get(p1Socket);
                    if (p1SocketObj) {
                        p1SocketObj.leave(roomID);
                        p1SocketObj.join('lobby');
                    }
                }

                if (p2Socket) {
                    const p2SocketObj = io.sockets.sockets.get(p2Socket);
                    if (p2SocketObj) {
                        p2SocketObj.leave(roomID);
                        p2SocketObj.join('lobby');
                    }
                }

                // Eliminar sala
                delete gameRooms[roomID];
                console.log(`🗑️ Sala ${roomID} eliminada después de rematch rechazado`);
            }
        } else {
            // Solo uno ha votado, esperar al otro
            console.log(`⏳ Esperando voto del otro jugador en sala ${roomID}`);
        }
    });

    socket.on('joinSpectator', ({ userNameToSpectate }) => {
        const roomID = findActiveRoomByUserName(userNameToSpectate);
        const room = gameRooms[roomID];

        if (!room) {
            socket.emit('roomError', `No se encontró una partida activa para ${userNameToSpectate}.`);
            return;
        }
        if (room.status !== 'active') {
            socket.emit('roomError', 'La partida no está activa para ser espectada.');
            return;
        }

        socket.leave('lobby');
        socket.join(roomID);
        room.spectators.push(socket.id);

        socket.emit('spectatorJoined', roomID);
        socket.emit('gameState', room.gameState);

        console.log(`👁️ Espectador ${userMap[socket.id]} se unió a ${roomID}`);
    });

    // Manejo de Fin de Juego
    socket.on('gameEnded', async (data) => {
        const room = gameRooms[data.roomID];
        if (!room) return;

        console.log(`🏁 Partida finalizada en sala ${data.roomID}. Ganador: ${data.winner}`);

        // Actualizar estado en DB (solo una vez)
        if (room.status !== 'finished') {
            room.status = 'finished';

            // Determinar perdedor
            const loser = data.winner === room.challenger ? room.opponent : room.challenger;

            // Guardar en DB
            await finishMatchInDB(data.roomID, data.winner, data.finalState, room.stats);

            // Notificar a todos en la sala (incluyendo espectadores)
            io.to(data.roomID).emit('gameEnded', {
                roomID: data.roomID,
                winner: data.winner,
                loser: loser,
                p1Name: room.challenger,
                p2Name: room.opponent,
                p1Char: room.p1Char,
                p2Char: room.p2Char,
                finalState: data.finalState
            });
        }
    });

    socket.on('disconnect', async () => {
        const userName = userMap[socket.id];
        console.log(`❌ Usuario desconectado: ${socket.id}(${userName})`);

        if (!userName) {
            delete userMap[socket.id];
            return;
        }

        disconnectTimers[userName] = setTimeout(() => {
            console.log(`⏱️ Tiempo de gracia expirado para ${userName}.Marcando como offline.`);

            if (activeUsers[userName] === socket.id) {
                delete activeUsers[userName];
                socket.broadcast.emit('userOffline', userName);
            }

            delete disconnectTimers[userName];
        }, DISCONNECT_GRACE_PERIOD);

        delete userMap[socket.id];

        for (const roomID in gameRooms) {
            let room = gameRooms[roomID];

            if (room.players.includes(socket.id)) {
                socket.to(roomID).emit('opponentDisconnected', {
                    message: 'Tu oponente se desconectó. Partida terminada.'
                });

                // Si la partida estaba activa, cancelarla en DB
                if (room.status === 'active') {
                    await cancelMatchInDB(roomID);
                }

                delete gameRooms[roomID];
                console.log(`🗑️ Sala ${roomID} eliminada por desconexión`);
            } else if (room.spectators.includes(socket.id)) {
                room.spectators = room.spectators.filter(id => id !== socket.id);
                console.log(`👁️ Espectador ${userName} removido de sala ${roomID}`);
            }
        }
    });
});

// Limpieza periódica de salas inactivas
setInterval(() => {
    const now = Date.now();
    for (const roomID in gameRooms) {
        const room = gameRooms[roomID];

        if (room.status === 'waiting' && (now - room.lastUpdate) > 300000) {
            console.log(`🗑️ Sala ${roomID} eliminada por inactividad`);
            cancelMatchInDB(roomID);
            delete gameRooms[roomID];
        }
    }
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║   🎮 SERVIDOR DE JUEGO EN TIEMPO REAL                      ║
║   Puerto: ${PORT}                                          ║
║   Laravel API: ${LARAVEL_API_URL}                         ║
║   Tiempo de gracia: ${DISCONNECT_GRACE_PERIOD / 1000} s                              ║
║   Estado: ✅ ACTIVO                                        ║
╚═══════════════════════════════════════════════════════════╝
        `);
});