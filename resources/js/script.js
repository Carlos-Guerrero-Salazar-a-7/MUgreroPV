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
    const buscarBoton = document.getElementById("buscar");
    if (buscarBoton) {
        // [CORRECCIÓN] Ahora llama directamente a login, reemplazando buscarpersona
        buscarBoton.addEventListener('click', login);
    }

    const registerBoton = document.getElementById("register");
    if (registerBoton) {
        registerBoton.addEventListener('click', registrarpersona);
    }

    const registerPageLink = document.getElementById("gotoregister");
    if (registerPageLink) {
        registerPageLink.addEventListener('click', () => showPage('register'));
    }

    const quickMatchButton = document.getElementById("partidarapida");
    if (quickMatchButton) {
        quickMatchButton.addEventListener('click', () => {
            if (socket && socket.connected) {
                socket.emit('quickMatch', currentUserId);
                console.log(`🚀 Solicitando partida rápida.`);
            } else {
                mostrarMensajeModal("No conectado al servidor de juegos.");
            }
        });
    }

    // Inicializar el estado de autenticación al cargar
    verifyAuthStatus();
});

// ==========================================================
// FUNCIONES DE AUTENTICACIÓN (APUNTANDO A LARAVEL API)
// ==========================================================

async function login() {
    const url = API_SERVER_ROOT + AUTH_API_PREFIX + '/login';

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Importante para la sesión de Laravel Sanctum
                'X-Requested-With': 'XMLHttpRequest',
            },
            // [AÑADIDO] Importante para enviar y recibir cookies de sesión
            credentials: 'include',
            body: JSON.stringify({ nombre: username, password: password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log("✅ Login exitoso:", data.user);
            currentUserId = data.user;
            document.getElementById('profile-icon').src = data.icono;

            showPage('lobby');
            initializeSocketConnection(currentUserId);
        } else {
            console.error("❌ Error de login:", data.mensaje);
            mostrarMensajeModal(data.mensaje || "Error al intentar iniciar sesión.");
        }
    } catch (error) {
        console.error("❌ Error de conexión al API:", error);
        mostrarMensajeModal("Error de red. Asegúrate de que Laravel esté corriendo en http://127.0.0.1:8000.");
    }
}

async function registrarpersona() {
    const url = API_SERVER_ROOT + AUTH_API_PREFIX + '/register';

    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const region = document.getElementById('reg-region').value; // Asumiendo este ID

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
            body: JSON.stringify({
                nombre: username,
                password: password,
                region: region
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log("✅ Registro exitoso. Iniciando sesión...");
            mostrarMensajeModal("Registro exitoso. ¡Inicia sesión!");
            showPage('login');
        } else {
            console.error("❌ Error de registro:", data.mensaje);
            mostrarMensajeModal(data.mensaje || "Error al registrar.");
        }
    } catch (error) {
        console.error("❌ Error de conexión al API:", error);
        mostrarMensajeModal("Error de red. Asegúrate de que Laravel esté corriendo en http://127.0.0.1:8000.");
    }
}

async function logout() {
    const url = API_SERVER_ROOT + AUTH_API_PREFIX + '/logout';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include', // Necesario para enviar la cookie de sesión
        });

        const data = await response.json();

        if (response.ok || !data.logueado) { // Si es ok o si ya no está logueado (Sanctum)
            console.log("👋 Sesión cerrada exitosamente.");
            currentUserId = null;
            if (socket) {
                socket.disconnect();
                socket = null;
            }
            showPage('login');
            mostrarMensajeModal("Sesión cerrada. ¡Vuelve pronto!");
        } else {
            console.error("❌ Error al cerrar sesión:", data.mensaje);
            showPage('login');
        }
    } catch (error) {
        console.error("❌ Error de conexión al API durante logout:", error);
        showPage('login');
    }
}

async function verifyAuthStatus() {
    const url = API_SERVER_ROOT + AUTH_API_PREFIX + '/verify';

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include', // Necesario para enviar la cookie de sesión
        });

        const data = await response.json();

        if (data.logueado) {
            console.log("✅ Sesión verificada.");
            currentUserId = data.user.nombre;
            document.getElementById('profile-icon').src = data.user.icono;
            showPage('lobby');
            initializeSocketConnection(currentUserId);
        } else {
            console.log("❌ Sin sesión. Mostrando login.");
            showPage('login');
        }
    } catch (error) {
        console.error("❌ Error de red al verificar sesión:", error);
        mostrarMensajeModal("Error de red. El servidor API podría no estar disponible.");
        showPage('login');
    }
}

// ==========================================================
// UTILS Y SOCKETS (LÓGICA NO MODIFICADA SIGNIFICATIVAMENTE)
// ==========================================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    const page = document.getElementById(pageId + '-page');
    if (page) {
        page.style.display = 'flex';
    } else {
        console.error(`Página no encontrada: ${pageId}-page`);
    }
}

function mostrarMensajeModal(mensaje) {
    const modal = document.getElementById('message-modal');
    const text = document.getElementById('message-text');
    text.textContent = mensaje;
    modal.style.display = 'flex';

    document.getElementById('close-message-modal').onclick = function () {
        modal.style.display = 'none';
    };
}


function initializeSocketConnection(userId) {
    if (socket && socket.connected) {
        socket.disconnect();
    }
    reconnectAttempts = 0;
    connectSocket(userId);
}

function connectSocket(userId) {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('🚫 Máximo de intentos de reconexión alcanzado.');
        return;
    }

    socket = io(WS_URL, {
        query: { userId: userId },
        reconnectionAttempts: 0
    });

    socket.on('connect', () => {
        console.log(`🔗 Conectado al servidor de juegos: ${socket.id}`);
        reconnectAttempts = 0;
        socket.emit('joinLobby', userId);
        fetchActiveUsers();
    });

    socket.on('disconnect', (reason) => {
        console.log(`🔌 Desconectado del servidor de juegos. Razón: ${reason}`);
        if (reason !== 'io client disconnect' && currentUserId) {
            console.log(`⏳ Intentando reconectar en 2 segundos... Intento ${reconnectAttempts + 1}`);
            reconnectAttempts++;
            setTimeout(() => connectSocket(currentUserId), 2000);
        }
    });

    socket.on('lobbyUpdate', (data) => {
        console.log('🔄 Actualización de lobby recibida.');
        updateActiveUsersList(data.users);
    });

    socket.on('challengeReceived', (data) => {
        handleChallengeReceived(data);
    });

    socket.on('challengeAccepted', (data) => {
        handleChallengeAccepted(data);
    });

    socket.on('gameStart', (config) => {
        console.log('🎉 Partida iniciada!', config);
        showPage('game');
        iniciarJuego(config);
    });

    socket.on('spectateStart', (config) => {
        console.log('👁️ Espectando partida.', config);
        showPage('game');
        iniciarJuego(config);
    });

    socket.on('challengeRejected', (data) => {
        console.log(`🚫 Reto a ${data.challenger} rechazado.`);
        mostrarMensajeModal(`El usuario ${data.challenger} rechazó tu reto.`);
        if (socket && socket.connected && currentUserId) {
            socket.emit('joinLobby', currentUserId);
        }
    });

    socket.on('error', (message) => {
        console.error('Socket Error:', message);
        mostrarMensajeModal('Error del servidor: ' + message);
    });
}

function fetchActiveUsers() {
    const url = API_SERVER_ROOT + GAME_API_PREFIX + '/active-users';

    fetch(url, { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateActiveUsersList(data.users);
            } else {
                console.error("Error al obtener usuarios activos:", data.message);
            }
        })
        .catch(error => console.error("Error de red al obtener usuarios activos:", error));
}


function updateActiveUsersList(users) {
    const list = document.getElementById('active-users-list');
    if (!list) return;

    list.innerHTML = '';

    const currentUser = currentUserId;

    users.forEach(user => {
        if (user.nombre === currentUser) return;

        const li = document.createElement('li');
        li.className = 'flex items-center justify-between p-3 bg-gray-700 rounded-lg shadow-md mb-2';

        li.innerHTML = `
            <div class="flex items-center">
                <img src="${user.icono}" alt="Icono" class="w-8 h-8 rounded-full mr-3 border-2 border-green-400">
                <div>
                    <span class="font-bold text-lg text-white">${user.nombre}</span>
                    <span class="text-sm text-gray-400 ml-2">(${user.region || 'N/A'})</span>
                </div>
            </div>
            <div class="flex space-x-2">
                <button class="retar-btn bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-full transition duration-150 shadow-lg" 
                        data-user="${user.nombre}">
                    Retar
                </button>
                <button class="espectar-btn bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3 rounded-full transition duration-150 shadow-lg" 
                        data-user="${user.nombre}">
                    Espectar
                </button>
            </div>
        `;
        list.appendChild(li);
    });

    document.querySelectorAll('.retar-btn').forEach(button => {
        button.addEventListener('click', (e) => retarUsuario(e.currentTarget.dataset.user));
    });

    document.querySelectorAll('.espectar-btn').forEach(button => {
        button.addEventListener('click', (e) => espectarUsuario(e.currentTarget.dataset.user));
    });

    const userCount = users.length;
    document.getElementById('user-count').textContent = userCount > 0 ? `${userCount} usuarios activos` : 'No hay otros usuarios activos';
}


function handleChallengeReceived(data) {
    const challenger = data.challengerName;
    incomingChallengeRoomID = data.roomID;

    const modal = document.getElementById('challenge-modal');
    const text = document.getElementById('challenge-text');

    text.textContent = `¡${challenger} te ha retado a una partida!`;
    modal.style.display = 'flex';

    if (socket && socket.connected && currentUserId) {
        socket.emit('leaveLobby', currentUserId);
    }
}

function handleChallengeAccepted(data) {
    console.log(`✅ Reto a ${data.opponentName} aceptado. Esperando inicio de partida.`);
    mostrarMensajeModal(`Reto aceptado por ${data.opponentName}. Preparando la partida...`);
}


function retarUsuario(opponentName) {
    if (socket && socket.connected && currentUserId) {
        socket.emit('challengeUser', { challengerName: currentUserId, opponentName: opponentName });
        console.log(`⚔️ Retando a ${opponentName}.`);
        mostrarMensajeModal(`Reto enviado a ${opponentName}. Esperando respuesta...`);
        if (socket && socket.connected && currentUserId) {
            socket.emit('leaveLobby', currentUserId);
        }
    } else {
        console.error("No conectado al servidor de juegos.");
        mostrarMensajeModal("No estás conectado al servidor. Recargando...");
        setTimeout(() => location.reload(), 2000);
    }
}

function acceptChallengeHandler() {
    const modal = document.getElementById('challenge-modal');
    modal.style.display = 'none';

    if (socket && socket.connected && incomingChallengeRoomID) {
        socket.emit('acceptChallenge', { roomID: incomingChallengeRoomID });
        console.log(`✅ Reto aceptado: ${incomingChallengeRoomID}`);
        incomingChallengeRoomID = null;
        mostrarMensajeModal("Reto aceptado. Esperando al rival...");
    }
}

function rejectChallengeHandler() {
    const modal = document.getElementById('challenge-modal');
    modal.style.display = 'none';

    if (socket && incomingChallengeRoomID) {
        socket.emit('rejectChallenge', { roomID: incomingChallengeRoomID });
        console.log(`❌ Reto ${incomingChallengeRoomID} rechazado.`);
        incomingChallengeRoomID = null;
    }
    if (socket && socket.connected && currentUserId) {
        socket.emit('joinLobby', currentUserId);
    }
}

function espectarUsuario(userNameToSpectate) {
    if (socket && socket.connected && currentUserId) {
        socket.emit('joinSpectator', { userNameToSpectate: userNameToSpectate });
        console.log(`👁️ Solicitando espectar la partida de ${userNameToSpectate}.`);
    } else {
        console.error("No conectado al servidor de juegos.");
        mostrarMensajeModal("No estás conectado al servidor.");
    }
}

function visualizarlogout() {
    logout();
}