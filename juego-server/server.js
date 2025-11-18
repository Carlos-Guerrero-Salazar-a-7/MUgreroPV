const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Configuraciones para mejor rendimiento en juegos
    pingInterval: 25000,
    pingTimeout: 60000,
    upgradeTimeout: 30000
});

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

io.on('connection', (socket) => {
    console.log(`🔌 Usuario conectado: ${socket.id}`);

    socket.on('joinLobby', (userName) => {
        if (!userName) return;
        
        if (disconnectTimers[userName]) {
            clearTimeout(disconnectTimers[userName]);
            delete disconnectTimers[userName];
            console.log(`⏱️ Timer de desconexión cancelado para ${userName}`);
        }
        
        // Salir de todas las salas de juego
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
    
    socket.on('challengeUser', ({ opponentName }) => {
        const challengerName = userMap[socket.id];
        const opponentSocketId = getSocketIdByUserName(opponentName);
        
        if (!challengerName || !opponentSocketId) {
            socket.emit('roomError', `No se pudo encontrar a ${opponentName} o tu usuario.`);
            return;
        }
        
        const roomID = `game_${challengerName}_vs_${opponentName}_${Date.now()}`;
        
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
            lastUpdate: Date.now()
        };
        
        io.to(opponentSocketId).emit('receiveChallenge', { 
            challenger: challengerName, 
            roomID: roomID 
        });
        
        socket.emit('challengeSent', opponentName);
        console.log(`⚔️ ${challengerName} retó a ${opponentName}. Sala: ${roomID}`);
    });

    socket.on('acceptChallenge', ({ roomID }) => {
        const userName = userMap[socket.id];
        const room = gameRooms[roomID];

        if (!room || room.status !== 'waiting' || room.opponent !== userName) {
            socket.emit('roomError', 'El reto no es válido, ha expirado, o no eres el destinatario.');
            return;
        }

        socket.leave('lobby');
        socket.join(roomID);
        room.players.push(socket.id);
        
        // Determinar qué índice de jugador es cada uno
        const challengerSocketId = room.host;
        const opponentSocketId = socket.id;
        
        // Enviar configuración de juego a cada jugador
        io.to(challengerSocketId).emit('gameJoined', {
            roomID: roomID,
            playerIndex: 0, // Challenger es jugador 1
            opponentName: room.opponent
        });
        
        io.to(opponentSocketId).emit('gameJoined', {
            roomID: roomID,
            playerIndex: 1, // Opponent es jugador 2
            opponentName: room.challenger
        });

        room.status = 'active';
        io.to(roomID).emit('startGame', { 
            roomID: room.id, 
            players: [room.challenger, room.opponent] 
        });

        console.log(`🎮 Partida ${roomID} iniciada. ${room.challenger} vs ${room.opponent}`);
    });
    
    // ===== NUEVO: MANEJO DE INPUTS DE JUEGO EN TIEMPO REAL =====
    socket.on('gameInput', (data) => {
        const { roomID, playerIndex, moves, timestamp } = data;
        const room = gameRooms[roomID];
        
        if (!room || room.status !== 'active') {
            return;
        }
        
        // Verificar que el socket pertenece a uno de los jugadores
        if (!room.players.includes(socket.id)) {
            return;
        }
        
        // Retransmitir el input al otro jugador
        socket.to(roomID).emit('gameInput', {
            roomID: roomID,
            playerIndex: playerIndex,
            moves: moves,
            timestamp: timestamp
        });
    });
    
    // ===== NUEVO: SINCRONIZACIÓN DE ESTADO AUTORITATIVO =====
    socket.on('gameStateUpdate', (data) => {
        const { roomID, gameState } = data;
        const room = gameRooms[roomID];
        
        if (!room || room.status !== 'active') {
            return;
        }
        
        // Solo el host puede actualizar el estado autoritativo
        if (socket.id !== room.host) {
            return;
        }
        
        // Actualizar el estado en el servidor
        room.gameState = gameState;
        room.lastUpdate = Date.now();
        
        // Enviar el estado actualizado a todos en la sala
        socket.to(roomID).emit('gameStateSync', {
            roomID: roomID,
            gameState: gameState
        });
    });
    
    // ===== NUEVO: FIN DE PARTIDA =====
    socket.on('gameEnded', (data) => {
        const { roomID, winner, finalState } = data;
        const room = gameRooms[roomID];
        
        if (!room) return;
        
        console.log(`🏆 Partida ${roomID} terminada. Ganador: ${winner}`);
        
        // Notificar a todos en la sala
        io.to(roomID).emit('matchEnded', {
            winner: winner,
            finalState: finalState
        });
        
        // Aquí podrías guardar estadísticas en la base de datos
        // Por ejemplo, llamar a tu API PHP para actualizar victorias/derrotas
        
        // Limpiar la sala después de un tiempo
        setTimeout(() => {
            if (gameRooms[roomID]) {
                delete gameRooms[roomID];
                console.log(`🗑️ Sala ${roomID} eliminada`);
            }
        }, 10000); // 10 segundos después del fin
    });

    socket.on('getrandomchallenger', () => {
        const userName = userMap[socket.id];
        let availableOpponents = Object.keys(activeUsers).filter(name => name !== userName);
        
        if (availableOpponents.length === 0) {
            socket.emit('roomError', 'No hay oponentes disponibles en este momento.');
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * availableOpponents.length);
        const opponentName = availableOpponents[randomIndex];
        
        // Emitir el reto automáticamente
        const opponentSocketId = getSocketIdByUserName(opponentName);
        const roomID = `game_${userName}_vs_${opponentName}_${Date.now()}`;
        
        gameRooms[roomID] = {
            id: roomID,
            host: socket.id,
            players: [socket.id],
            spectators: [],
            status: 'waiting',
            challenger: userName,
            opponent: opponentName,
            gameState: {
                timeleft: 99,
                characters: [
                    { health: 100, position: { x: 200, y: 0 }, currentState: 'standing', facingDirection: 1 },
                    { health: 100, position: { x: 800, y: 0 }, currentState: 'standing', facingDirection: -1 }
                ]
            },
            lastUpdate: Date.now()
        };
        
        io.to(opponentSocketId).emit('receiveChallenge', { 
            challenger: userName, 
            roomID: roomID 
        });
        
        socket.emit('challengeSent', opponentName);
        console.log(`🎲 ${userName} retó aleatoriamente a ${opponentName}`);
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

    socket.on('disconnect', () => {
        const userName = userMap[socket.id];
        console.log(`❌ Usuario desconectado: ${socket.id} (${userName})`);

        if (!userName) {
            delete userMap[socket.id];
            return;
        }

        // Dar tiempo de gracia para reconexión
        disconnectTimers[userName] = setTimeout(() => {
            console.log(`⏱️ Tiempo de gracia expirado para ${userName}. Marcando como offline.`);
            
            if (activeUsers[userName] === socket.id) {
                delete activeUsers[userName];
                socket.broadcast.emit('userOffline', userName);
            }
            
            delete disconnectTimers[userName];
        }, DISCONNECT_GRACE_PERIOD);

        delete userMap[socket.id];

        // Limpiar salas donde el usuario era jugador
        for (const roomID in gameRooms) {
            let room = gameRooms[roomID];

            if (room.players.includes(socket.id)) {
                // Notificar al otro jugador
                socket.to(roomID).emit('opponentDisconnected', {
                    message: 'Tu oponente se desconectó. Partida terminada.'
                });
                
                io.to(roomID).emit('gameEnded', 'Un jugador se desconectó. Partida terminada.');
                
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
        
        // Eliminar salas en espera por más de 5 minutos
        if (room.status === 'waiting' && (now - room.lastUpdate) > 300000) {
            console.log(`🗑️ Sala ${roomID} eliminada por inactividad`);
            delete gameRooms[roomID];
        }
    }
}, 60000); // Cada minuto

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   🎮 SERVIDOR DE JUEGO EN TIEMPO REAL                      ║
║   Puerto: ${PORT}                                          ║
║   Tiempo de gracia: ${DISCONNECT_GRACE_PERIOD / 1000}s                              ║
║   Estado: ✅ ACTIVO                                        ║
╚════════════════════════════════════════════════════════════╝
    `);
});