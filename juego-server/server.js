// Importamos Express para el servidor HTTP y Socket.IO para los WebSockets
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
// Creamos un servidor HTTP a partir de la aplicación Express
const server = http.createServer(app);

// Inicializamos Socket.IO, permitiendo conexiones desde tu cliente (que está en localhost)
const io = new Server(server, {
    cors: {
        origin: "*", // Permite cualquier origen (IDEAL SÓLO PARA DESARROLLO)
        methods: ["GET", "POST"]
    }
});

// --- Almacenamiento Global de Estado ---
// Mapea socket.id al nombre de usuario para fácil referencia
let userMap = {}; // { 'socketId': 'userName' }
// Estado de las salas de juego activas
let gameRooms = {}; // { 'roomID': { host: 'socketId', players: [], spectators: [], status: 'waiting', challenger: 'name', opponent: 'name', gameState: {} } }
// Mapea el nombre de usuario a su ID de socket actual
let activeUsers = {}; // { 'userName': 'socketId' } 


// Función auxiliar para obtener el ID de socket de un nombre de usuario
const getSocketIdByUserName = (userName) => activeUsers[userName];

// Función para encontrar una sala activa donde esté un usuario
const findActiveRoomByUserName = (userName) => {
    for (const roomID in gameRooms) {
        const room = gameRooms[roomID];
        if (room.status === 'active' && (room.challenger === userName || room.opponent === userName)) {
            return roomID;
        }
    }
    return null;
};

// --- LÓGICA DE WEBSOCKETS ---
io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    // --- 1. LÓGICA DEL LOBBY (Conexión y mapeo de usuario) ---
    socket.on('joinLobby', (userName) => {
        if (!userName) return;

        // Aseguramos que el socket salga de cualquier sala anterior antes de unirse al lobby
        for (const roomID in gameRooms) {
            socket.leave(roomID);
        }

        socket.join('lobby');
        userMap[socket.id] = userName; // Almacenamos el mapeo socket -> usuario
        // La clave aquí: SOBREESCRIBIR el socket.id viejo con el nuevo.
        // Esto permite la reconexión sin perder el estado de 'activo'.
        activeUsers[userName] = socket.id; 
        
        console.log(`Usuario ${userName} (${socket.id}) se unió al Lobby.`);
        
        socket.broadcast.emit('userOnline', userName); 
    });
    
    // --- 2. LÓGICA DE RETO (Challenge) ---
    socket.on('challengeUser', ({ opponentName }) => {
        const challengerName = userMap[socket.id];
        const opponentSocketId = getSocketIdByUserName(opponentName);
        
        if (!challengerName || !opponentSocketId) {
            socket.emit('roomError', `No se pudo encontrar a ${opponentName} o tu usuario.`);
            return;
        }
        
        const roomID = `game_${challengerName}_vs_${opponentName}_${Date.now()}`;
        
        // 1. Crear la sala en estado 'waiting'
        gameRooms[roomID] = {
            id: roomID,
            host: socket.id, // El retador es el host inicial
            players: [socket.id], // El retador es el primer jugador
            spectators: [],
            status: 'waiting',
            challenger: challengerName,
            opponent: opponentName,
            // Estado inicial vacío o por defecto
            gameState: { 
                board: Array(9).fill(null), // Ejemplo: tablero Tic-Tac-Toe
                turn: challengerName 
            }
        };
        
        // 2. Notificar al oponente (el cliente de JS mostrará un modal de "Aceptar/Rechazar")
        io.to(opponentSocketId).emit('receiveChallenge', { 
            challenger: challengerName, 
            roomID: roomID 
        });
        
        socket.emit('challengeSent', opponentName);
        console.log(`${challengerName} retó a ${opponentName}. Sala: ${roomID}`);
    });

    // --- 3. LÓGICA DE ACEPTAR RETO (El oponente se une a la partida) ---
    socket.on('acceptChallenge', ({ roomID }) => {
        const userName = userMap[socket.id];
        const room = gameRooms[roomID];

        if (!room || room.status !== 'waiting' || room.opponent !== userName) {
            socket.emit('roomError', 'El reto no es válido, ha expirado, o no eres el destinatario.');
            return;
        }

        // El oponente deja el lobby y se une a la sala
        socket.leave('lobby');
        socket.join(roomID);
        room.players.push(socket.id); // El oponente es el segundo jugador

        // 3a. Notifica al jugador
        socket.emit('gameJoined', roomID);

        // 3b. Iniciar la Partida (sala llena)
        room.status = 'active';
        io.to(roomID).emit('startGame', { roomID: room.id, players: [room.challenger, room.opponent] });

        console.log(`Partida ${roomID} iniciada. Jugadores: ${room.challenger} vs ${room.opponent}.`);
    });

    // --- 4. LÓGICA DE ESPECTADOR (Unirse a una partida activa) ---
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
        
        // 4a. Notifica solo al espectador
        socket.emit('spectatorJoined', roomID); 
        
        // 4b. Envía el estado actual del juego
        socket.emit('gameState', room.gameState); 

        console.log(`Espectador ${userMap[socket.id]} se unió a la Sala ${roomID} (Espectando a ${userNameToSpectate}).`);
    });
    
    // --- 5. COMUNICACIÓN DENTRO DE LA PARTIDA ---
    socket.on('makeMove', ({ roomID, moveData }) => {
        const room = gameRooms[roomID];
        // Solo los jugadores pueden enviar movimientos en partidas activas
        if (room && room.status === 'active' && room.players.includes(socket.id)) {
            // Lógica de validación y actualización del estado del juego
            
            // Ejemplo de actualización de estado (deberías manejar la lógica real aquí)
            // room.gameState = updateGameState(room.gameState, moveData);

            // Envía el movimiento a todos los de la sala (jugadores y espectadores)
            io.to(roomID).emit('updateGame', { 
                moveData, 
                gameState: room.gameState // Envía el estado completo
            });
            console.log(`Movimiento en sala ${roomID} por ${userMap[socket.id]}.`);
        } else {
            socket.emit('roomError', 'Movimiento inválido o no es tu turno.');
        }
    });

    // --- DESCONEXIÓN Y LIMPIEZA ---
    socket.on('disconnect', () => {
        const userName = userMap[socket.id];
        console.log(`Usuario desconectado: ${socket.id} (${userName})`);

        // CRÍTICO PARA LA PERSISTENCIA (al recargar la página):
        // NO BORRAR activeUsers[userName] aquí. Esto permite que el cliente se reconecte 
        // y el nuevo 'joinLobby' simplemente sobrescriba su ID de socket.
        if (userName) {
            // delete activeUsers[userName]; // Mantener comentado para la persistencia
            // socket.broadcast.emit('userOffline', userName); // Mantener comentado para evitar el parpadeo
        }
        delete userMap[socket.id]; // Esto debe permanecer para limpiar el mapeo del socket ID antiguo

        // Lógica para limpiar las salas si un host o jugador se desconecta
        for (const roomID in gameRooms) {
            let room = gameRooms[roomID];

            // Si el desconectado era un jugador (host o no)
            if (room.players.includes(socket.id)) {
                io.to(roomID).emit('gameEnded', 'Un jugador se desconectó. Partida terminada.');
                // Opción 1: Eliminar la sala
                delete gameRooms[roomID];
                console.log(`Sala ${roomID} eliminada por desconexión de jugador.`);
            } 
        }
    });
});

// Inicia el servidor de Node.js en el puerto 3000
const PORT = process.env.PORT || 3000;
// FIX: Escucha en '0.0.0.0' para ser accesible por IP externa, no solo 'localhost'
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de WebSockets corriendo en todas las interfaces (0.0.0.0) en el puerto: ${PORT}`);
    console.log(`\n¡Asegúrate de ejecutar 'npm install express socket.io' primero!`);
});