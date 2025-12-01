import { iniciarJuego, stopGame, acceptRematchRequest, rejectRematchRequest } from './game.js';

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
window.acceptRematch = acceptRematch;
window.rejectRematch = rejectRematch;
window.showProfile = showProfile;

let registerarea = document.getElementById("soloinicio");
let loginarea = document.getElementById("lobby");
let page = 'lobby';

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginform");
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Evita la recarga de la página
            login();

        });
    }

    const registerForm = document.getElementById("registerform");
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Evita la recarga de la página
            registrarpersona();
        });
    }

    // Avatar Selection Modal Logic
    const avatarModal = document.getElementById('avatar-modal');
    const openAvatarBtn = document.getElementById('open-avatar-selector');
    const closeAvatarBtn = document.getElementById('close-avatar-modal');
    const iconGrid = document.getElementById('icon-grid');
    const hiddenInput = document.getElementById('registericon');
    const previewImage = document.getElementById('current-avatar-preview');
    const logoutbutton = document.getElementById('logoutbutton');

    if (openAvatarBtn && avatarModal) {
        openAvatarBtn.addEventListener('click', () => {
            avatarModal.classList.add('active');
        });
    }

    if (logoutbutton) {
        logoutbutton.addEventListener('click', () => {
            logout();
            registerarea.classList.remove('hidden');
            registerarea.classList.add('visible');
            loginarea.classList.remove('visible');
            loginarea.classList.add('hidden');
        });
    }

    if (closeAvatarBtn && avatarModal) {
        closeAvatarBtn.addEventListener('click', () => {
            avatarModal.classList.remove('active');
        });
    }

    // Close modal when clicking outside
    if (avatarModal) {
        avatarModal.addEventListener('click', (e) => {
            if (e.target === avatarModal) {
                avatarModal.classList.remove('active');
            }
        });
    }

    if (iconGrid) {
        const icons = iconGrid.querySelectorAll('.profile-option');

        icons.forEach(icon => {
            icon.addEventListener('click', () => {
                // Remove selected class from all
                icons.forEach(i => i.classList.remove('selected-icon'));
                // Add to clicked
                icon.classList.add('selected-icon');

                const selectedValue = icon.getAttribute('data-value');

                // Update hidden input
                if (hiddenInput) {
                    hiddenInput.value = selectedValue;
                }

                // Update preview
                if (previewImage) {
                    previewImage.src = icon.src;
                }

                // Close modal
                if (avatarModal) {
                    avatarModal.classList.remove('active');
                }
            });
        });
    }

    const registerPageLink = document.getElementById("gotoregister");
    if (registerPageLink) {
        registerPageLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('register');
        });
    }

    const loginPageLink = document.getElementById("gotologin");
    if (loginPageLink) {
        loginPageLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('login');
        });
    }

    const quickMatchButton = document.getElementById("partidarapida");
    if (quickMatchButton) {
        quickMatchButton.addEventListener('click', () => {
            if (socket && socket.connected) {
                socket.emit('quickMatch', currentUserId);
                console.log(`🚀 Solicitando partida rápida.`);
                mostrarMensajeModal("Buscando oponente para partida rápida...");
            } else {
                mostrarMensajeModal("No conectado al servidor de juegos.");
            }
        });
    }

    const localMatchButton = document.getElementById("rankets");
    if (localMatchButton) {
        localMatchButton.addEventListener('click', () => {
            showPage('game');
            iniciarJuego({ multiplayer: false });
        });
    }

    const rankedMatchButton = document.getElementById("ranketsreal");
    if (rankedMatchButton) {
        rankedMatchButton.addEventListener('click', () => {
            if (socket && socket.connected) {
                socket.emit('rankedMatch', currentUserId);
                console.log(`🏆 Solicitando partida clasificada (Ranked).`);
                mostrarMensajeModal("Buscando oponente para partida clasificada...");
            } else {
                mostrarMensajeModal("No conectado al servidor de juegos.");
            }
        });
    }

    // Profile Button Logic
    const profileButton = document.getElementById("gotoperfil");
    if (profileButton) {
        profileButton.addEventListener('click', () => {
            // Cerrar el menú desplegable
            const menu = document.getElementById('absoluto_invisible');
            if (menu) {
                menu.style.display = 'none';
            }
            showProfile();
        });
    }

    const backToLobbyButton = document.getElementById("back-to-lobby");
    if (backToLobbyButton) {
        backToLobbyButton.addEventListener('click', () => {
            showPage('lobby');
        });
    }

    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('absoluto_invisible');
        const userButton = document.getElementById('userbutton');

        if (menu && userButton) {
            // Si el clic no fue en el botón de usuario ni en el menú
            if (!userButton.contains(e.target) && !menu.contains(e.target)) {
                menu.style.display = 'none';
            }
        }
    });


    // Inicializar el estado de autenticación al cargar
    verifyAuthStatus();
});
async function login() {
    // ... (código de login existente)
    const url = API_SERVER_ROOT + AUTH_API_PREFIX + '/login';

    // ✅ CORRECCIÓN: IDs correctos del HTML
    const username = document.getElementById('loginusername').value;
    const password = document.getElementById('loginpassword').value;

    // Validación básica
    if (!username || !password) {
        mostrarMensajeModal("Por favor completa todos los campos.");
        return;
    }

    console.log(`🔑 Intentando login: ${username}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ nombre: username, password: password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log("✅ Login exitoso:", data.user);
            currentUserId = data.user;
            document.getElementById('profile-icon').src = data.icono;
            document.getElementById('header-username').textContent = data.user;

            showPage('lobby');
            loginarea.classList.remove('hidden');
            loginarea.classList.add('visible');
            registerarea.classList.remove('visible');
            registerarea.classList.add('hidden');
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
    // ... (código de registro existente)
    const url = API_SERVER_ROOT + AUTH_API_PREFIX + '/register';

    // ✅ CORRECCIÓN: IDs correctos del HTML
    const username = document.getElementById('registerusername').value;
    const password = document.getElementById('registerpassword').value;
    const region = document.getElementById('registerregion').value;
    const icon = document.getElementById('registericon') ? document.getElementById('registericon').value : 'default.png';

    // Validación básica
    if (!username || !password) {
        mostrarMensajeModal("Por favor completa todos los campos obligatorios.");
        return;
    }

    console.log(`📝 Intentando registro: ${username}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                nombre: username,
                password: password,
                region: region || 'Unknown',
                icono: icon
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log("✅ Registro exitoso. Mostrando login...");
            mostrarMensajeModal("Registro exitoso. ¡Ahora inicia sesión!");
            showPage('login');

            // Limpiar campos
            document.getElementById('registerusername').value = '';
            document.getElementById('registerpassword').value = '';
            document.getElementById('registerregion').value = '';
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
    // ... (código de logout existente)
    const url = API_SERVER_ROOT + AUTH_API_PREFIX + '/logout';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
        });

        const data = await response.json();

        if (response.ok || !data.logueado) {
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
            credentials: 'include',
        });

        const data = await response.json();

        if (data.logueado) {
            console.log("✅ Sesión verificada.");
            currentUserId = data.user.nombre;
            const profileIcon = document.getElementById('profile-icon');
            if (profileIcon) {
                profileIcon.src = data.user.icono;
            }
            const headerUsername = document.getElementById('header-username');
            if (headerUsername) {
                headerUsername.textContent = data.user.nombre;
            }
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
// UTILS Y SOCKETS
// ==========================================================

function showPage(pageId) {
    // ... (código de showPage existente)
    console.log(`📄 Mostrando página: ${pageId}`);

    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });

    const page = document.getElementById(pageId + '-page');
    if (page) {
        page.style.display = 'flex';
    } else {
        console.error(`❌ Página no encontrada: ${pageId}-page`);
    }

    // Header Visibility Logic
    const soloinicio = document.getElementById("soloinicio");
    const lobbyHeader = document.getElementById("lobby");

    if (pageId === 'login' || pageId === 'register') {
        if (soloinicio) soloinicio.style.display = 'block'; // Or remove 'hidden' class if using classes
        if (lobbyHeader) lobbyHeader.style.display = 'none';
    } else {
        if (soloinicio) soloinicio.style.display = 'none';
        if (lobbyHeader) lobbyHeader.style.display = 'flex'; // Assuming flex, or block
    }

    // NUEVO: Canvas Visibility Logic
    const gameCanvas = document.getElementById('main_game');
    if (gameCanvas) {
        // Solo mostrar canvas en la página de juego
        if (pageId === 'game') {
            gameCanvas.style.display = 'block';
        } else {
            gameCanvas.style.display = 'none';
        }
    }
}

function mostrarMensajeModal(mensaje) {
    // ... (código de mostrarMensajeModal existente)
    const modal = document.getElementById('message-modal');
    const text = document.getElementById('message-text');
    const closeBtn = document.getElementById('close-message-modal');

    if (!modal || !text) {
        console.error('❌ Modal de mensaje no encontrado en el DOM');
        alert(mensaje); // Fallback
        return;
    }

    text.textContent = mensaje;
    modal.style.display = 'flex';

    if (closeBtn) {
        closeBtn.onclick = function () {
            modal.style.display = 'none';
        };
    }

    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        modal.style.display = 'none';
    }, 5000);
}

function initializeSocketConnection(userId) {
    // ... (código de initializeSocketConnection existente)
    if (socket && socket.connected) {
        socket.disconnect();
    }
    reconnectAttempts = 0;
    connectSocket(userId);
}

function connectSocket(userId) {
    // ... (código de connectSocket existente)
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
        // MODIFICACIÓN: Pasamos la conexión del socket para el modo online
        iniciarJuego({
            multiplayer: true,
            roomID: config.roomID,
            playerIndex: config.playerIndex,
            socket: socket,
            p1Char: config.p1Char, // Esperamos que el servidor envíe la selección final
            p2Char: config.p2Char,
            userName: config.p1Name, // P1 es siempre el challenger
            opponentName: config.p2Name // P2 es siempre el opponent
        });
    });

    socket.on('spectateStart', (config) => {
        console.log('👁️ Espectando partida.', config);
        showPage('game');
        // MODIFICACIÓN: Pasamos la conexión del socket para espectar
        iniciarJuego({
            multiplayer: true,
            mode: 'spectate',
            roomID: config.roomID,
            socket: socket,
            p1Char: config.p1Char,
            p2Char: config.p2Char,
            userName: config.p1Name,
            opponentName: config.p2Name
        });
    });

    socket.on('challengeRejected', (data) => {
        // ... (código de challengeRejected existente)
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

    socket.on('rematchAccepted', (data) => {
        console.log('✅ Ambos jugadores aceptaron el rematch');
        const statusText = document.getElementById('rematch-status');
        if (statusText) {
            statusText.textContent = '¡Ambos aceptaron! Reiniciando partida...';
        }
    });

    socket.on('rematchRejected', (data) => {
        console.log('❌ Rematch rechazado');
        const modal = document.getElementById('rematch-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        mostrarMensajeModal('Un jugador rechazó el rematch. Volviendo al lobby...');
        setTimeout(() => {
            stopGame();
            showPage('lobby');
            if (socket && socket.connected && currentUserId) {
                socket.emit('joinLobby', currentUserId);
            }
        }, 2000);
    });

    socket.on('rematchStart', (config) => {
        console.log('🔄 Iniciando rematch...', config);
        const modal = document.getElementById('rematch-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        stopGame();
        showPage('game');
        iniciarJuego({
            multiplayer: true,
            roomID: config.roomID,
            playerIndex: config.playerIndex,
            socket: socket,
            userName: config.p1Name,
            opponentName: config.p2Name
        });
    });

    socket.on('authError', (message) => {
        console.warn('⚠️ Error de autenticación:', message);
        if (currentUserId) {
            console.log('🔄 Re-enviando joinLobby...');
            socket.emit('joinLobby', currentUserId);
        } else {
            mostrarMensajeModal(message);
            showPage('login');
        }
    });
}

function fetchActiveUsers() {
    // ... (código de fetchActiveUsers existente)
    const url = API_SERVER_ROOT + GAME_API_PREFIX + '/active-users';

    fetch(url, {
        credentials: 'include',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        }
    })
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
    // ... (código de updateActiveUsersList existente)
    const list = document.getElementById('active-users-list');
    if (!list) {
        console.warn('⚠️ Elemento active-users-list no encontrado');
        return;
    }

    list.innerHTML = '';

    const currentUser = currentUserId;

    users.forEach(user => {
        if (user.nombre === currentUser) return;

        const li = document.createElement('li');
        li.className = 'flex items-center justify-between p-2 bg-gray-700 rounded-lg shadow-md mb-2 w-full';

        li.innerHTML = `
            <div class="flex items-center flex-grow min-w-0">
                <img src="${user.icono}" alt="Icono" class="w-[50px] h-[50px] rounded-full mr-3 border-2 border-green-400 flex-shrink-0" style="width: 50px; height: 50px; object-fit: cover;">
                <div class="truncate flex-grow">
                    <span class="font-bold text-lg text-white truncate block">${user.nombre}</span>
                    <span class="text-sm text-gray-400 truncate block">(${user.region || 'N/A'})</span>
                </div>
            </div>
            <div class="flex space-x-2 flex-shrink-0 ml-2">
                <button class="retar-btn bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-full transition duration-150 shadow-lg text-sm" 
                        data-user="${user.nombre}">
                    Retar
                </button>
                <button class="espectar-btn bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3 rounded-full transition duration-150 shadow-lg text-sm" 
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

    const userCount = users.filter(u => u.nombre !== currentUser).length;
    const userCountEl = document.getElementById('user-count');
    if (userCountEl) {
        userCountEl.textContent = userCount > 0 ? `${userCount} usuarios activos` : 'No hay otros usuarios activos';
    }
}

function handleChallengeReceived(data) {
    // ... (código de handleChallengeReceived existente)
    const challenger = data.challenger;
    incomingChallengeRoomID = data.roomID;

    const modal = document.getElementById('challenge-modal');
    const text = document.getElementById('challenge-text');

    if (!modal || !text) {
        console.error('❌ Modal de reto no encontrado');
        return;
    }

    text.textContent = `¡${challenger} te ha retado a una partida!`;
    modal.style.display = 'flex';

    if (socket && socket.connected && currentUserId) {
        socket.emit('leaveLobby', currentUserId);
    }
}

function handleChallengeAccepted(data) {
    // ... (código de handleChallengeAccepted existente)
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
    // ... (código de acceptChallengeHandler existente)
    const modal = document.getElementById('challenge-modal');
    if (modal) modal.style.display = 'none';

    if (socket && socket.connected && incomingChallengeRoomID) {
        socket.emit('acceptChallenge', { roomID: incomingChallengeRoomID });
        console.log(`✅ Reto aceptado: ${incomingChallengeRoomID}`);
        incomingChallengeRoomID = null;
        mostrarMensajeModal("Reto aceptado. Esperando al rival...");
    }
}

function rejectChallengeHandler() {
    // ... (código de rejectChallengeHandler existente)
    const modal = document.getElementById('challenge-modal');
    if (modal) modal.style.display = 'none';

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
    // ... (código de espectarUsuario existente)
    if (socket && socket.connected && currentUserId) {
        socket.emit('joinSpectator', { userNameToSpectate: userNameToSpectate });
        console.log(`👁️ Solicitando espectar la partida de ${userNameToSpectate}.`);
    } else {
        console.error("No conectado al servidor de juegos.");
        mostrarMensajeModal("No estás conectado al servidor.");
    }
}

function visualizarlogout() {
    const menu = document.getElementById('absoluto_invisible');
    if (menu) {
        // Toggle visibility
        if (menu.style.display === 'none' || menu.style.display === '') {
            menu.style.display = 'flex';
        } else {
            menu.style.display = 'none';
        }
    }
}

// NUEVO: Funciones de rematch
function acceptRematch() {
    console.log('✅ Jugador acepta rematch');
    acceptRematchRequest();
}

function rejectRematch() {
    console.log('❌ Jugador rechaza rematch');
    rejectRematchRequest();
}

// NUEVO: Función para mostrar perfil
async function showProfile() {
    if (!currentUserId) {
        mostrarMensajeModal("Debes iniciar sesión para ver tu perfil.");
        return;
    }

    // Si currentUserId es un objeto (del login), usamos su nombre. Si es string (del verify), lo usamos directo.
    const username = typeof currentUserId === 'object' ? currentUserId.nombre : currentUserId;

    console.log(`👤 Cargando perfil de: ${username}`);
    const url = API_SERVER_ROOT + GAME_API_PREFIX + `/user-stats/${username}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            const user = data.user;

            // Actualizar UI del perfil
            document.getElementById('profile-username').textContent = user.nombre;
            document.getElementById('profile-region').textContent = user.region || 'Desconocido';
            document.getElementById('profile-avatar').src = user.icono;

            document.getElementById('profile-wins').textContent = user.stats.victorias;
            document.getElementById('profile-losses').textContent = user.stats.derrotas;
            document.getElementById('profile-total').textContent = user.stats.total;

            // Renderizar historial de partidas
            const historyContainer = document.querySelector('.profile-stats');
            // Buscar si ya existe la lista de historial, si no crearla
            let historyList = document.getElementById('match-history-list');

            if (!historyList) {
                const historySection = document.createElement('div');
                historySection.className = 'match-history-section';
                historySection.style.marginTop = '20px';
                historySection.style.width = '100%';

                const title = document.createElement('h2');
                title.textContent = 'Historial de Partidas';
                title.style.color = '#313b97ff';
                title.style.marginBottom = '10px';

                historyList = document.createElement('ul');
                historyList.id = 'match-history-list';
                historyList.style.listStyle = 'none';
                historyList.style.padding = '0';
                historyList.style.maxHeight = '150px';
                historyList.style.overflowY = 'auto';

                historySection.appendChild(title);
                historySection.appendChild(historyList);

                // Insertar después de las estadísticas
                historyContainer.parentNode.insertBefore(historySection, document.getElementById('back-to-lobby'));
            }

            historyList.innerHTML = ''; // Limpiar lista anterior

            if (user.history && user.history.length > 0) {
                user.history.forEach(match => {
                    const li = document.createElement('li');
                    li.style.display = 'flex';
                    li.style.justifyContent = 'space-between';
                    li.style.padding = '10px';
                    li.style.marginBottom = '5px';
                    li.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    li.style.borderRadius = '5px';
                    li.style.fontSize = '20px';
                    li.style.borderLeft = match.result === 'Victoria' ? '4px solid #10b981' : '4px solid #ef4444';

                    li.innerHTML = `
                        <span style="font-weight: bold;">vs ${match.opponent}</span>
                        <span style="color: #ccc;">${match.character || '?'}</span>
                        <span style="color: ${match.result === 'Victoria' ? '#10b981' : '#ef4444'}; font-weight: bold;">${match.result}</span>
                        <span style="font-size: 0.8em; color: #9ca3af;">${match.date}</span>
                    `;
                    historyList.appendChild(li);
                });
            } else {
                historyList.innerHTML = '<li style="text-align: center; color: #9ca3af; padding: 10px;">No hay partidas recientes</li>';
            }

            showPage('profile');
        } else {
            console.error("❌ Error al cargar perfil:", data.mensaje);
            mostrarMensajeModal("Error al cargar datos del perfil.");
        }
    } catch (error) {
        console.error("❌ Error de red al cargar perfil:", error);
        mostrarMensajeModal("Error de conexión al cargar el perfil.");
    }
}

// Función para guardar el resultado de la partida
export async function saveMatchResult(winnerName, loserName, p1Name, p2Name, p1Char, p2Char, roomID) {
    const url = API_SERVER_ROOT + GAME_API_PREFIX + '/match-result';

    console.log(`💾 Guardando resultado: ${winnerName} vs ${loserName}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                winner: winnerName,
                loser: loserName,
                p1Name: p1Name,
                p2Name: p2Name,
                p1Char: p1Char,
                p2Char: p2Char,
                roomID: roomID
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log("✅ Resultado guardado exitosamente.");
        } else {
            console.error("❌ Error al guardar resultado:", data.mensaje);
        }
    } catch (error) {
        console.error("❌ Error de red al guardar resultado:", error);
    }
}