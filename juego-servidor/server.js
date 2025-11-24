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
const LARAVEL_API_URL = process.env.LARAVEL_API_URL || 'http://127.0.0.1:8000';

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
    try {
        const response = await fetch(`${LARAVEL_API_URL}/matches`, {
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

        const data = await response.json();
        console.log(`📊 Partida registrada en DB: ${roomID}`, data);
        return data;
    } catch (error) {
        console.error('❌ Error al crear partida en DB:', error.message);
        return null;
    }
}

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
    console.log(`🔌 Usuario conectado: ${socket.id}`);

    socket.on('joinLobby', (userName) => {
        if (!userName) return;
        
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
    
    socket.on('challengeUser', async ({ opponentName }) => {
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
        
        io.to(opponentSocketId).emit('receiveChallenge', { 
            challenger: challengerName, 
            roomID: roomID 
        });
        
        socket.emit('challengeSent', opponentName);
        console.log(`⚔️ ${challengerName} retó a ${opponentName}. Sala: ${roomID}`);
    });

    socket.on('acceptChallenge', async ({ roomID }) => {
        const userName = userMap[socket.id];
        const room = gameRooms[roomID];

        if (!room || room.status !== 'waiting' || room.opponent !== userName) {
            socket.emit('roomError', 'El reto no es válido, ha expirado, o no eres el destinatario.');
            return;
        }

        socket.leave('lobby');
        socket.join(roomID);
        room.players.push(socket.id);
        
        const challengerSocketId = room.host;
        const opponentSocketId = socket.id;
        
        io.to(challengerSocketId).emit('gameJoined', {
            roomID: roomID,
            playerIndex: 0,
            opponentName: room.opponent
        });
        
        io.to(opponentSocketId).emit('gameJoined', {
            roomID: roomID,
            playerIndex: 1,
            opponentName: room.challenger
        });

        room.status = 'active';
        
        // Iniciar en la base de datos
        await startMatchInDB(roomID);
        
        io.to(roomID).emit('startGame', { 
            roomID: room.id, 
            players: [room.challenger, room.opponent] 
        });

        console.log(`🎮 Partida ${roomID} iniciada. ${room.challenger} vs ${room.opponent}`);
    });
    
    socket.on('gameInput', (data) => {
        const { roomID, playerIndex, moves, timestamp } = data;
        const room = gameRooms[roomID];
        
        if (!room || room.status !== 'active') {
            return;
        }
        
        if (!room.players.includes(socket.id)) {
            return;
        }
        
        socket.to(roomID).emit('gameInput', {
            roomID: roomID,
            playerIndex: playerIndex,
            moves: moves,
            timestamp: timestamp
        });
    });
    
    socket.on('gameStateUpdate', (data) => {
        const { roomID, gameState } = data;
        const room = gameRooms[roomID];
        
        if (!room || room.status !== 'active') {
            return;
        }
        
        if (socket.id !== room.host) {
            return;
        }
        
        room.gameState = gameState;
        room.lastUpdate = Date.now();
        
        socket.to(roomID).emit('gameStateSync', {
            roomID: roomID,
            gameState: gameState
        });
    });
    
    socket.on('gameEnded', async (data) => {
        const { roomID, winner, finalState, stats } = data;
        const room = gameRooms[roomID];
        
        if (!room) return;
        
        console.log(`🏆 Partida ${roomID} terminada. Ganador: ${winner}`);
        
        // Finalizar en la base de datos
        await finishMatchInDB(roomID, winner, finalState, stats || room.stats);
        
        io.to(roomID).emit('matchEnded', {
            winner: winner,
            finalState: finalState
        });
        
        setTimeout(() => {
            if (gameRooms[roomID]) {
                delete gameRooms[roomID];
                console.log(`🗑️ Sala ${roomID} eliminada`);
            }
        }, 10000);
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
            lastUpdate: Date.now(),
            stats: {
                golpes_jugador1: 0,
                golpes_jugador2: 0,
                combos_jugador1: 0,
                combos_jugador2: 0
            }
        };

        // Registrar en DB
        createMatchInDB(roomID, gameRooms[roomID]);
        
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

    socket.on('disconnect', async () => {
        const userName = userMap[socket.id];
        console.log(`❌ Usuario desconectado: ${socket.id} (${userName})`);

        if (!userName) {
            delete userMap[socket.id];
            return;
        }

        disconnectTimers[userName] = setTimeout(() => {
            console.log(`⏱️ Tiempo de gracia expirado para ${userName}. Marcando como offline.`);
            
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
                
                io.to(roomID).emit('gameEnded', 'Un jugador se desconectó. Partida terminada.');
                
                // Cancelar en DB
                await cancelMatchInDB(roomID);
                
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
║   Tiempo de gracia: ${DISCONNECT_GRACE_PERIOD / 1000}s                              ║
║   Estado: ✅ ACTIVO                                        ║
╚═══════════════════════════════════════════════════════════╝
    `);
});