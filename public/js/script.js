import { iniciarJuego, stopGame } from './game.js';

// --- CONFIGURACIÓN DE URLS PARA LARAVEL API (Puerto 8000) ---
const API_SERVER_ROOT = "http://127.0.0.1:8000";
const AUTH_API_PREFIX = "/api/auth";
const GAME_API_PREFIX = "/api/game";
// -------------------------------------------------------------

const WS_URL = "http://127.0.0.1:3000";
let socket = null;
let currentUserId = null;
let incomingChallengeRoomID = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Mensajes de usuario
function mostrarMensajeModal(mensaje) {
    // Nota: Necesitas añadir el HTML para el modal de mensaje en game.blade.php
    const modal = document.getElementById('message-modal');
    const messageText = document.getElementById('message-text');
    
    if (modal && messageText) {
        messageText.textContent = mensaje;
        modal.style.display = 'block';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 3000);
    } else {
        // Fallback si el modal no existe
        console.warn('Modal de mensaje no encontrado. Mensaje:', mensaje);
    }
}

// Lógica de navegación de páginas
function showPage(pageName) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.style.display = 'none';
        page.classList.remove('active');
    });

    // CORRECCIÓN: Usamos el ID de la página, que ahora sigue el sufijo '-page'
    const pageElementId = pageName + '-page';
    const pageElement = document.querySelector(`[data-page-id="${pageElementId}"]`); // Busca por el atributo data-page-id
    
    if (pageElement) {
        pageElement.style.display = 'block';
        pageElement.classList.add('active');
        console.log(`Página mostrada: ${pageName}`);
        // Lógica adicional para mostrar/ocultar botones de header
        const isAuthPage = (pageName === 'login' || pageName === 'register');
        
        const soloInicio = document.getElementById('soloinicio');
        const lobbyHeader = document.getElementById('lobby');
        
        if (soloInicio) soloInicio.style.display = isAuthPage ? 'flex' : 'none';
        if (lobbyHeader) lobbyHeader.style.display = !isAuthPage ? 'flex' : 'none';

    } else {
        console.error(`Error: Elemento de página no encontrado con data-page-id: ${pageElementId}`);
    }
}

// Autenticación: Login
async function login(event) {
    if (event) event.preventDefault();
    
    const username = document.getElementById('loginusername')?.value;
    const password = document.getElementById('loginpassword')?.value;

    if (!username || !password) {
        mostrarMensajeModal("Por favor, introduce usuario y contraseña.");
        return;
    }

    try {
        // PASO 1: Obtener la cookie CSRF
        await fetch(API_SERVER_ROOT + '/sanctum/csrf-cookie', { credentials: 'include' });

        // PASO 2: Intentar el login
        const response = await fetch(API_SERVER_ROOT + AUTH_API_PREFIX + '/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': window.Laravel.csrfToken
            },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            currentUserId = data.user.id;
            // Configurar la UI de usuario
            const userButtonP = document.querySelector('#userbutton p');
            if (userButtonP) userButtonP.textContent = data.user.name;
            
            // Iniciar conexión Socket.IO
            connectSocketIO(currentUserId);
            // Navegar a la página del lobby
            showPage('lobby');
            mostrarMensajeModal("¡Bienvenido!");
        } else {
            // Manejar errores de validación o credenciales incorrectas
            const errorMessage = data.message || "Error de inicio de sesión. Credenciales inválidas.";
            mostrarMensajeModal(errorMessage);
        }
    } catch (error) {
        console.error('Error al intentar iniciar sesión:', error);
        mostrarMensajeModal("Error de conexión con el servidor de autenticación.");
    }
}

// Autenticación: Registro
async function registrarpersona(event) {
    if (event) event.preventDefault();

    // CORRECCIÓN: Usar los IDs de formulario correctos de game.blade.php
    const username = document.getElementById('registerusername')?.value;
    const password = document.getElementById('registerpassword')?.value;
    const region = document.getElementById('registerregion')?.value; 

    if (!username || !password || !region) {
        mostrarMensajeModal("Por favor, completa todos los campos.");
        return;
    }

    try {
        // PASO 1: Obtener la cookie CSRF
        await fetch(API_SERVER_ROOT + '/sanctum/csrf-cookie', { credentials: 'include' });

        // PASO 2: Intentar el registro
        const response = await fetch(API_SERVER_ROOT + AUTH_API_PREFIX + '/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': window.Laravel.csrfToken
            },
            // CAMBIO: Aseguramos que se envíe 'region'
            body: JSON.stringify({ name: username, password, region }), 
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            // Asumiendo que el registro exitoso también inicia sesión automáticamente
            currentUserId = data.user.id;
            // Configurar la UI de usuario
            const userButtonP = document.querySelector('#userbutton p');
            if (userButtonP) userButtonP.textContent = data.user.name;
            
            // Iniciar conexión Socket.IO
            connectSocketIO(currentUserId);
            // Navegar al lobby
            showPage('lobby');
            mostrarMensajeModal("Registro exitoso. ¡Bienvenido!");
        } else {
            const errorMessage = data.message || (data.errors ? Object.values(data.errors).flat().join(' ') : "Error de registro.");
            mostrarMensajeModal(errorMessage);
        }
    } catch (error) {
        console.error('Error al intentar registrarse:', error);
        mostrarMensajeModal("Error de conexión con el servidor de autenticación.");
    }
}

// Autenticación: Logout
function logout() {
    // Implementación real del logout en Laravel. Asume que hay un endpoint /logout
    fetch(API_SERVER_ROOT + AUTH_API_PREFIX + '/logout', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': window.Laravel.csrfToken
        },
        credentials: 'include'
    }).then(response => {
        if (!response.ok && response.status !== 401) { 
             // 401 puede ser si la sesión ya expiró, que es aceptable en logout
             console.warn('Logout server response was not OK:', response);
        }
    }).catch(error => {
        console.error('Error during logout fetch:', error);
    }).finally(() => {
        // Limpieza de estado local y UI
        if (socket) {
            socket.disconnect();
        }
        currentUserId = null;
        const userButtonP = document.querySelector('#userbutton p');
        if (userButtonP) userButtonP.textContent = '';
        mostrarMensajeModal("Sesión cerrada.");
        showPage('login');
    });
}

// Conexión Socket.IO
function connectSocketIO(userId) {
    if (socket && socket.connected) {
        console.log("Socket ya conectado. Desconectando para reconectar...");
        socket.disconnect();
    }

    const socketUrl = window.Laravel.socketUrl || WS_URL;

    socket = io(socketUrl, {
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        auth: {
            userId: userId
        }
    });

    socket.on('connect', () => {
        console.log(`🟢 Conectado al servidor de juegos con ID de socket: ${socket.id}`);
        reconnectAttempts = 0;
        // Unirse al lobby al conectar
        if (currentUserId) {
            socket.emit('joinLobby', currentUserId);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`🔴 Desconectado del servidor: ${reason}`);
        if (reason === 'io server disconnect') {
            // El servidor nos desconectó, no intentamos reconectar automáticamente
        } else {
            // Desconexión normal o error de red. El cliente intentará reconectar
        }
    });

    socket.on('connect_error', (error) => {
        console.error(`❌ Error de conexión Socket.IO: ${error.message}`);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Intentando reconexión (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        } else {
            console.error("Máximo de intentos de reconexión alcanzado. Recargue la página.");
            mostrarMensajeModal("Máximo de intentos de reconexión alcanzado. Por favor, recarga la página.");
        }
    });

    // --- MANEJO DE EVENTOS DEL JUEGO ---
    socket.on('lobbyUpdate', (data) => {
        console.log('Actualización del lobby recibida:', data);
        // Implementar lógica para actualizar la lista de usuarios y partidas
        // ... (Tu código para actualizar la interfaz)
    });

    socket.on('challengeReceived', (data) => {
        incomingChallengeRoomID = data.roomID;
        // Mostrar modal de desafío (necesitarías implementar el HTML para esto)
        mostrarMensajeModal(`¡Has sido retado por ${data.challengerName}!`);
        // Lógica para mostrar el modal de aceptación/rechazo
    });

    socket.on('challengeAccepted', (data) => {
        console.log(`Reto aceptado para sala: ${data.roomID}. Iniciando juego...`);
        showPage('game');
        // Asegúrate de que iniciarJuego esté implementada en game.js
        // iniciarJuego(data.roomID, socket, data.opponentName); 
    });

    socket.on('gameStarted', (data) => {
        console.log(`Juego iniciado en sala: ${data.roomID}`);
        showPage('game');
        // Asegúrate de que iniciarJuego esté implementada en game.js
        // iniciarJuego(data.roomID, socket, data.opponentName);
    });

    socket.on('spectatorJoined', (data) => {
        console.log(`Espectador unido a sala: ${data.roomID}`);
        showPage('spectate');
        // Lógica para inicializar la vista de espectador
    });
}


// --- LÓGICA DE BOTONES DE NAVEGACIÓN Y ACCIÓN ---

function retarUsuario(targetUserId) {
    if (socket && socket.connected && currentUserId) {
        socket.emit('challengeUser', { targetUserId: targetUserId, challengerId: currentUserId });
        mostrarMensajeModal(`Retando al usuario ${targetUserId}...`);
    } else {
        console.error("No conectado al servidor de juegos.");
        mostrarMensajeModal("No estás conectado al servidor.");
    }
}

function acceptChallengeHandler(){
    const modal = document.getElementById('challenge-modal');
    // Implementar modal en HTML si no existe
    if (modal) modal.style.display = 'none';
    
    if (socket && socket.connected && incomingChallengeRoomID) {
        socket.emit('acceptChallenge', { roomID: incomingChallengeRoomID });
        console.log(`✅ Reto aceptado: ${incomingChallengeRoomID}`);
        incomingChallengeRoomID = null;
        mostrarMensajeModal("Reto aceptado. Esperando al rival...");
    }
}

function rejectChallengeHandler(){
    const modal = document.getElementById('challenge-modal');
    // Implementar modal en HTML si no existe
    if (modal) modal.style.display = 'none';
    
    if (socket && incomingChallengeRoomID) {
        socket.emit('rejectChallenge', { roomID: incomingChallengeRoomID });
        console.log(`❌ Reto ${incomingChallengeRoomID} rechazado.`);
        incomingChallengeRoomID = null;
    }
    if(socket && socket.connected && currentUserId) {
        socket.emit('joinLobby', currentUserId);
    }
}

function espectarUsuario(userNameToSpectate){
    if (socket && socket.connected && currentUserId) {
        socket.emit('joinSpectator', { userNameToSpectate: userNameToSpectate }); 
        console.log(`👁️ Solicitando espectar la partida de ${userNameToSpectate}.`);
    } else {
        console.error("No conectado al servidor de juegos.");
        mostrarMensajeModal("No estás conectado al servidor.");
    }
}

function visualizarlogout() {
    const absInvisible = document.getElementById('absoluto_invisible');
    // Alternar visibilidad (ejemplo simple)
    if (absInvisible) {
        absInvisible.style.display = absInvisible.style.display === 'block' ? 'none' : 'block';
    }
}

// Hacer las funciones accesibles globalmente para los botones HTML
window.acceptChallengeHandler = acceptChallengeHandler;
window.rejectChallengeHandler = rejectChallengeHandler;
window.retarUsuario = retarUsuario;
window.espectarUsuario = espectarUsuario;
window.visualizarlogout = visualizarlogout;
window.logout = logout;
window.showPage = showPage;
window.login = login;
window.registrarpersona = registrarpersona;


document.addEventListener("DOMContentLoaded", () => {
    // Escucha de botones de navegación
    const gotoRegisterButton = document.getElementById('gotoregister');
    if (gotoRegisterButton) {
        gotoRegisterButton.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('register');
        });
    }

    const gotoLoginButton = document.getElementById('gotologin');
    if (gotoLoginButton) {
        gotoLoginButton.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('login');
        });
    }
    
    // Escucha de botones de formulario (previene el submit default y llama a la función)
    const loginForm = document.getElementById('loginform');
    if (loginForm) {
        loginForm.addEventListener('submit', login); 
    }
    
    const registerForm = document.getElementById('registerform');
    if (registerForm) {
        registerForm.addEventListener('submit', registrarpersona); 
    }

    // Inicialización: nos aseguramos de que solo la página de login esté visible al cargar.
    showPage('login');
});