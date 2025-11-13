const BASE_URL = "http://192.168.122.1/SF3PWM/php/conexion.php"; // <--- CAMBIAR 'TU_IP_PUBLICA' por la IP real de tu servidor (ej. 192.168.1.5)
// Nueva URL para el servidor de WebSockets
const WS_URL = "http://192.168.122.1:3000"; // <--- CAMBIAR 'TU_IP_PUBLICA' por la IP real de tu servidor
let socket = null;
let currentUserId = null;
let incomingChallengeRoomID = null;
let currentGameState = null; // Estado para manejar el juego y la vista de espectador

document.addEventListener("DOMContentLoaded", () => {
    // Escucha el evento del botón de Login (buscado por su ID)
    const buscarBoton = document.getElementById("buscar");
    if (buscarBoton) {
        // Enlaza el evento click a la función global buscarpersona
        buscarBoton.addEventListener('click', buscarpersona); 
    }

    // Convertimos el DOMContentLoaded a async para manejar la inicialización
    inicializarAplicacion(); 

    let anchoVentana = window.innerWidth;
    let altoVentana = window.innerHeight;
    const pantalla_computadoras = document.getElementById("conputadoras");
    const htmlroot = document.documentElement;
    // Corregido el error tipográfico: anchoVentura -> anchoVentana
    htmlroot.style.width = `${anchoVentana}px`; 
    htmlroot.style.height = `${altoVentana}px`;
    
    // Asumiendo que existe un modal para retos en tu HTML con ID 'challenge-modal'
    // Y un div para mensajes dentro de él con ID 'challenge-message'
    const modal = document.createElement('div');
    modal.id = 'challenge-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: none; justify-content: center; align-items: center; z-index: 1000;';
    modal.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 10px; text-align: center;">
            <p id="challenge-message" style="font-weight: bold; margin-bottom: 15px;"></p>
            <button onclick="acceptChallengeHandler()" style="padding: 10px 20px; margin-right: 10px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Aceptar</button>
            <button onclick="rejectChallengeHandler()" style="padding: 10px 20px; background-color: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">Rechazar</button>
        </div>
    `;
    document.body.appendChild(modal);
});


// NUEVA FUNCIÓN ASÍNCRONA PARA EL INICIO (Verificación de Persistencia de Sesión)
async function inicializarAplicacion() {
    try {
        const logueado = await verificarSesion();
        if (logueado) {
            // El usuario está logueado (currentUserId ya está establecido)
            
            // 1. Conectar Socket.IO. Esto manejará la RECONEXIÓN automática si la página se recargó.
            connectToGameServer();
            
            // 2. Mostrar la interfaz
            showPage('lobby-page');
            
        } else {
            showPage('login');
        }
    } catch (error) {
        console.error("Error durante la inicialización de la aplicación:", error);
        showPage('login');
    }
}


// MODIFICACIÓN CRÍTICA: Ahora devuelve una promesa/boolean
async function verificarSesion() {
    try {
        // ✅ CORS: Si 'localhost' está haciendo la petición a '192.168.1.93', 
        // el problema podría ser que la respuesta no es interpretada como JSON.
        const response = await fetch(`${BASE_URL}?accion=verificar`);
        
        // La solicitud falló (NetworkError) antes de recibir una respuesta HTTP válida 
        // debido a CORS. Si el servidor PHP tiene 'Access-Control-Allow-Origin: *', 
        // esto debería resolverse. De lo contrario, el catch se activará.

        const data = await response.json();
        
        if (data.logueado) {
            currentUserId = data.user.nombre; // Guardamos el nombre del usuario
            actualizarUIUsuario(data.user.nombre, data.user.icono);
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error("Error al verificar la sesión con PHP:", error);
        return false;
    }
};

function connectToGameServer() {
    if (!socket) {
        // Inicialización por primera vez
        socket = io(WS_URL, {
             // Opcional: Configuración para reintentos automáticos
             reconnection: true, 
             reconnectionAttempts: Infinity,
             // Importante: forzar WebSockets si es posible para evitar el polling (más estable)
             transports: ['websocket', 'polling']
        }); 

        socket.on('connect', () => {
            console.log(`Conectado al servidor de juegos con ID: ${socket.id}`);
            
            // Unirse al lobby automáticamente después de la conexión y autenticación
            if(currentUserId) {
                // Emitimos joinLobby solo después de que el socket está conectado Y tenemos el currentUserId
                socket.emit('joinLobby', currentUserId);
            }
            setupSocketListeners(); // Configurar oyentes de eventos de juego
        });

        socket.on('disconnect', () => {
            console.log('Desconectado del servidor de juegos.');
        });
        
        socket.on('roomError', (message) => {
            console.error("Error de Sala:", message);
            // Mostrar un mensaje de error al usuario
            // Usamos el modal de reto como un simple notificador para evitar 'alert'
            const modal = document.getElementById('challenge-modal');
            document.getElementById('challenge-message').innerText = message;
            // Ocultamos los botones de aceptar/rechazar para un simple error
            modal.querySelector('button:nth-child(2)').style.display = 'none'; 
            modal.querySelector('button:nth-child(3)').style.display = 'none';
            modal.style.display = 'flex'; 
        });
    } else if (socket.disconnected && currentUserId) {
        // ✅ SOLUCIÓN CRÍTICA: RECONEXIÓN FORZADA después de un F5 o pérdida de red.
        socket.connect();
        socket.once('connect', () => {
             // Reenviar joinLobby asegura que el servidor Node.js
             // actualice el activeUsers[userName] con el nuevo socket.id.
             socket.emit('joinLobby', currentUserId);
             console.log("Socket reconectado y lobby re-unido.");
        });
    }
}

function setupSocketListeners() {
    // Oyente para cuando unirse al juego sea exitoso (Jugador)
    socket.on('gameJoined', (roomID) => {
        console.log(`Te has unido a la partida ${roomID} como jugador.`);
        showPage('game-page'); // Cambiar a la vista de Partida
    });
    
    // Oyente para cuando unirse al juego sea exitoso (Espectador)
    socket.on('spectatorJoined', (roomID) => {
        console.log(`Te has unido a la partida ${roomID} como espectador.`);
        showPage('spectator-page'); // Nueva vista de Espectador
    });
    
    // Oyente para recibir el estado inicial del juego (usado por Espectadores)
    socket.on('gameState', (gameState) => {
        currentGameState = gameState;
        console.log('Estado inicial del juego recibido:', currentGameState);
        // Aquí llamarías a la función para renderizar el tablero en la vista de espectador
        // renderGame(currentGameState); 
    });

    // Oyente para recibir actualizaciones del juego
    socket.on('updateGame', (data) => {
        currentGameState = data.gameState; // Actualiza el estado global
        console.log('Actualización de la partida:', data.moveData);
        // Aquí iría la lógica para renderizar el nuevo estado del juego en el canvas
        // renderGame(currentGameState);
    });

    // Oyente para el inicio de la partida (sala llena)
    socket.on('startGame', (data) => {
        console.log(`La partida ${data.roomID} ha comenzado! Jugadores: ${data.players.join(' vs ')}`);
        // Iniciar la lógica de tu juego/canvas aquí
    });
    
    // Oyente para reto ENTRANTE (el que recibe el reto)
    socket.on('receiveChallenge', ({ challenger, roomID }) => {
        incomingChallengeRoomID = roomID;
        const modal = document.getElementById('challenge-modal');
        document.getElementById('challenge-message').innerText = `${challenger} te ha retado a una partida! ¿Aceptas?`;
        // Aseguramos que los botones de aceptar/rechazar estén visibles para el reto
        modal.querySelector('button:nth-child(2)').style.display = 'inline-block'; 
        modal.querySelector('button:nth-child(3)').style.display = 'inline-block';
        modal.style.display = 'flex'; // Mostrar el modal
    });
    
    // Oyente para cuando el reto es enviado exitosamente (el que envia el reto)
    socket.on('challengeSent', (opponentName) => {
        // Podrías mostrar un mensaje de "Esperando respuesta de X"
        console.log(`Reto enviado a ${opponentName}. Esperando respuesta...`);
    });

    // Lógica de limpieza cuando el host se va
    socket.on('gameEnded', (message) => {
        console.warn(message);
        // Volver al lobby
        showPage('lobby-page');
    });
    
    // NUEVO: Oyente para notificaciones de que un usuario se conectó o desconectó (Node.js)
    socket.on('userOnline', (userName) => {
        // Refrescar la lista si estamos en el lobby, ya que un nuevo usuario se conectó
        if (document.querySelector("[data-page-id='lobby-page']")?.classList.contains('active')) {
            callAllActives();
        }
    });

    socket.on('userOffline', (userName) => {
        // Refrescar la lista si estamos en el lobby, ya que un nuevo usuario se desconectó
        if (document.querySelector("[data-page-id='lobby-page']")?.classList.contains('active')) {
            callAllActives();
        }
    });
}

function setupGame() {
    const canvas = document.getElementById("main");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // next mugenpv
}
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    // Se usa el selector más robusto por si no tiene el atributo data-page-id
    document.querySelector(`[data-page-id='${pageId}']`)?.classList.add('active');

    // Aquí se manejaría la inicialización específica de cada "sala"
    if (pageId === 'game-page') {
        setupGame();
    } else if (pageId === 'lobby-page') {
        // Asegurarse de que el usuario esté en la sala de Socket.IO del lobby
        if (socket && socket.connected && currentUserId) {
             // Emitimos 'joinLobby' aquí también por si el usuario vuelve de una partida, 
             // asegurando que Node.js mueva el socket a la sala 'lobby'.
             socket.emit('joinLobby', currentUserId);
        }
        // FIX: La llamada a la lista de activos (AJAX/PHP) SIEMPRE debe ir aquí
        // para rellenar la lista del lobby cada vez que la página del lobby se muestra.
        if(currentUserId) {
            callAllActives(); 
        }
    }
    // 'spectator-page' tendría su propia función de inicialización, similar a setupGame
}


function actualizarUIUsuario(nombre, icono) {
    // ... Tu lógica existente ...
    const lobbyDiv = document.getElementById("lobby");
    const soloinicioDiv = document.getElementById("soloinicio");
    const imagenusuario = document.getElementById("imagenusuario");
    lobbyDiv.style.display = "flex";
    soloinicioDiv.style.display = "none";
    imagenusuario.src = icono;
    lobbyDiv.querySelector("p").innerText = nombre;
}
// CORRECCIÓN 1: Se saca del DOMContentLoaded para ser global y accesible por onclick/addEventListener.
async function buscarpersona(){
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const boton = document.getElementById("buscar");
    const messageDiv = document.getElementById("messageDiv");
    
    // Deshabilitar botón y mostrar estado
    boton.innerText = "Iniciando sesión...";
    boton.disabled = true;

    try {
        const datos = new URLSearchParams();
        datos.append("nombre", username);
        datos.append("password", password);
        
        // Uso de fetch (asíncrono)
        const response = await fetch(`${BASE_URL}?accion=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: datos
        });

        const json = await response.json();
        
        if (json.success) {
            messageDiv.innerHTML = '<div style="background-color: #d4edda; color: #155724; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">¡Bienvenido ' + json.user + '! Redirigiendo...</div>';
            
            // Esperar un momento antes de redirigir la UI
            await new Promise(resolve => setTimeout(resolve, 500)); // Espera reducida para mejor UX
            
            currentUserId = json.user; 
            actualizarUIUsuario(json.user, json.icono);
            
            // 1. Reestablecer la conexión del Socket.IO (necesario para el nuevo socket.id)
            connectToGameServer(); 
            
            // 2. Mostrar la página del lobby, lo que disparará callAllActives()
            showPage('lobby-page'); 

        } else {
            messageDiv.innerHTML = '<div style="background-color: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">' + json.mensaje + '</div>';
        }
    } catch(e) {
        // Este catch puede capturar errores de red, incluyendo el CORS si el navegador lo reporta como NetworkError
        console.error("Error en buscarpersona:", e);
        messageDiv.innerHTML = '<div style="background-color: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">Error fatal al procesar la solicitud. Asegúrate de que el servidor PHP esté activo y las URLs (BASE_URL) sean correctas.</div>';
    }

    boton.innerText = "iniciar sesion";
    boton.disabled = false;
}

// CORRECCIÓN 1: Se saca del DOMContentLoaded para ser global y accesible por onclick/addEventListener.
function visualizarlogout(){
    const absoluto_invisible = document.getElementById("absoluto_invisible");
    if(absoluto_invisible.style.display === "block"){
        absoluto_invisible.style.visibility = "hidden";
        absoluto_invisible.style.display = "none";
    }else{
        absoluto_invisible.style.display = "block";
        absoluto_invisible.style.visibility = "visible";
    }
}

// CORRECCIÓN 1: Se saca del DOMContentLoaded para ser global y accesible por onclick/addEventListener.
function logout(){
    // MODIFICACIÓN: Usar BASE_URL para la petición
    fetch(`${BASE_URL}?accion=logout`)
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Si el logout fue exitoso, desconectar de Socket.IO y mostrar la página de login
            if (socket) {
                // Desconexión limpia: usa 'socket.disconnect()' para que el servidor Node.js
                // ejecute la lógica de limpieza de 'disconnect' (marcar como inactivo en PHP/DB)
                socket.disconnect(); 
                socket = null;
            }
            showPage('login');
            const lobbyDiv = document.getElementById("lobby");
            const soloinicioDiv = document.getElementById("soloinicio");
            const absoluto_invisible = document.getElementById("absoluto_invisible");
            absoluto_invisible.style.visibility = "hidden";
            absoluto_invisible.style.display = "none";
            lobbyDiv.style.display = "none";
            soloinicioDiv.style.display = "block";
            currentUserId = null; // Limpiamos el ID de usuario local
        }
    });
}

function callAllActives(){
    const izquierdalobby = document.getElementById("izquierda");
    izquierdalobby.innerHTML = " Luchadores activos: ";
    
    // MODIFICACIÓN: Usar BASE_URL para la petición
    fetch(`${BASE_URL}?accion=callAllActives`)
    .then(response => response.json())
    .then(data => {
        if (data.success && Array.isArray(data.users)) {
            data.users.forEach(usuario => { 
                const div = document.createElement("div");
                div.classList.add('active-user');
                // Se pasa el nombre del usuario a espectar para poder obtener la sala
                div.innerHTML = `
                    <img src="${usuario.icono}" alt="${usuario.nombre}">
                    <h3>${usuario.nombre}</h3>
                    <p>victorias: ${usuario.victorias}</p>
                    <p>Región: ${usuario.region}</p>
                    <button class="active-user-button" onclick="retarUsuario('${usuario.nombre}')">Retar</button>
                    <button class="active-user-button" onclick="espectarUsuario('${usuario.nombre}')">Espectar</button>
                `;
                izquierdalobby.appendChild(div);
            });
                
        } else if (data.success && data.users.length === 0) {
            izquierdalobby.innerHTML = "<p>No hay otros usuarios activos en este momento.</p>";
        } else {
            console.error("Error al cargar usuarios activos:", data.message || "Respuesta incompleta.");
            izquierdalobby.innerHTML = "<p>Error al cargar la lista de activos.</p>";
        }
    })
    .catch(error => {
        console.error("Error en la solicitud callAllActives:", error);
        izquierdalobby.innerHTML = "<p>Hubo un error al conectar con el servidor.</p>";
    });
};

// --- Nuevas funciones de comunicación con Socket.IO ---
// (Estas funciones ya eran globales y se llaman desde el HTML con onclick)

function retarUsuario(opponentName){
    if (socket && currentUserId) {
        // Emitimos el evento al servidor Node.js
        socket.emit('challengeUser', { opponentName: opponentName });
        
        console.log(`Retando a ${opponentName}.`);
        // Opcional: Deshabilitar el botón de reto para ese usuario y mostrar 'Reto enviado...'
    } else {
        console.error("No conectado al servidor de juegos o ID de usuario no disponible.");
    }
}

// Handler para ACEPTAR el reto (el que recibe el reto)
// ELIMINADA: let incomingChallengeRoomID = null;
// ELIMINADA: let currentGameState = null;

function acceptChallengeHandler(){
    const modal = document.getElementById('challenge-modal');
    modal.style.display = 'none';
    
    if (socket && incomingChallengeRoomID) {
        socket.emit('acceptChallenge', { roomID: incomingChallengeRoomID }); // <-- Corregido aquí
        incomingChallengeRoomID = null;
    }
}

// Handler para RECHAZAR el reto (el que recibe el reto)
function rejectChallengeHandler(){
    const modal = document.getElementById('challenge-modal');
    modal.style.display = 'none';
    
    if (socket && incomingChallengeRoomID) {
        // Opcional: Emitir un evento para notificar al retador que el reto fue rechazado.
        console.log(`Reto ${incomingChallengeRoomID} rechazado.`);
        // Nota: La sala debe ser eliminada por el retador o por tiempo de espera en el servidor.
        incomingChallengeRoomID = null;
    }
    // Volver a asegurar que estamos en el lobby, aunque ya deberíamos estarlo.
    if(socket && currentUserId) {
        socket.emit('joinLobby', currentUserId);
    }
}

function espectarUsuario(userNameToSpectate){
    // Ya no asumimos el roomID. Enviamos el nombre de usuario al servidor para que lo busque.
    
    if (socket && currentUserId) {
        // El usuario se une como espectador a una sala activa de ese usuario
        socket.emit('joinSpectator', { userNameToSpectate: userNameToSpectate }); 
        console.log(`Solicitando espectar la partida de ${userNameToSpectate}.`);
    } else {
        console.error("No conectado al servidor de juegos.");
    }
}

function Enviarsolicitud(){
    // Esta función queda obsoleta, usamos retarUsuario
    console.warn("La función Enviarsolicitud es obsoleta. Usar retarUsuario para WebSockets.");
};

function recirsolicitud(){
    // Esta función queda obsoleta, se usa el oyente socket.on('receiveChallenge')
    console.warn("La función recirsolicitud ahora debe usar Socket.IO.");
};