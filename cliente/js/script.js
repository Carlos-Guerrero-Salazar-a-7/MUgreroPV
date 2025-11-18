import { iniciarJuego, stopGame } from './game.js';

const BASE_URL = "http://127.0.0.1/SF3PWM/php/conexion.php";
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

document.addEventListener("DOMContentLoaded", () => {
    const buscarBoton = document.getElementById("buscar");
    if (buscarBoton) {
        buscarBoton.addEventListener('click', buscarpersona); 
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
            if (socket && socket.connected && currentUserId) {
                socket.emit('getrandomchallenger');
                console.log('🎲 Buscando partida rápida...');
            } else {
                console.error("No conectado al servidor de juegos.");
                mostrarMensajeModal("No estás conectado al servidor. Recargando...");
                setTimeout(() => location.reload(), 2000);
            }
        });
    }
    
    const ranketsButton = document.getElementById("rankets");
    if (ranketsButton) {
        ranketsButton.addEventListener('click', () => {
            showPage('game-page');
            setupLocalGame();
        }); 
    }

    inicializarAplicacion(); 

    let anchoVentana = window.innerWidth;
    let altoVentana = window.innerHeight;
    const htmlroot = document.documentElement;
    htmlroot.style.width = `${anchoVentana}px`; 
    htmlroot.style.height = `${altoVentana}px`;
    
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

function registrarpersona(){
    const username = document.getElementById("registerusername").value;
    const password = document.getElementById("registerpassword").value;
    const boton = document.getElementById("register");
    const messageDiv = document.getElementById("messageDiv");
    
    boton.innerText = "Registrando...";
    boton.disabled = true;
    
    fetch(`${BASE_URL}?accion=register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ nombre: username, password: password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            messageDiv.innerHTML = '<div style="background-color: #d4edda; color: #155724; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">¡Registro exitoso! Ahora puedes iniciar sesión.</div>';
            showPage('login');
        }
        else {
            messageDiv.innerHTML = '<div style="background-color: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">' + data.mensaje + '</div>';
        }
    })
    .catch(error => {
        console.error("Error en registrarpersona:", error);
        messageDiv.innerHTML = '<div style="background-color: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">Error al conectar con el servidor.</div>';
    })
    .finally(() => {
        boton.innerText = "Registrarme";
        boton.disabled = false;
    });
}

async function inicializarAplicacion() {
    try {
        const logueado = await verificarSesion();
        if (logueado) {
            await conectarYEsperarSocket();
            showPage('lobby-page');
        } else {
            showPage('login');
        }
    } catch (error) {
        console.error("Error durante la inicialización:", error);
        showPage('login');
    }
}

function conectarYEsperarSocket() {
    return new Promise((resolve, reject) => {
        if (!currentUserId) {
            reject(new Error("No hay usuario para conectar"));
            return;
        }

        connectToGameServer();
        
        const timeout = setTimeout(() => {
            reject(new Error("Timeout en conexión de socket"));
        }, 5000);

        if (socket) {
            socket.once('connect', () => {
                clearTimeout(timeout);
                console.log("✅ Socket conectado exitosamente");
                resolve();
            });

            if (socket.connected) {
                clearTimeout(timeout);
                resolve();
            }
        }
    });
}

async function verificarSesion() {
    try {
        const response = await fetch(`${BASE_URL}?accion=verificar`);
        const data = await response.json();
        
        if (data.logueado) {
            currentUserId = data.user.nombre;
            actualizarUIUsuario(data.user.nombre, data.user.icono);
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error("Error al verificar la sesión:", error);
        return false;
    }
}

function connectToGameServer() {
    if (!socket) {
        socket = io(WS_URL, {
            reconnection: true, 
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            transports: ['websocket', 'polling']
        }); 

        setupSocketEvents();
    } else if (socket.disconnected && currentUserId) {
        socket.connect();
    }
}

function setupSocketEvents() {
    socket.on('connect', () => {
        console.log(`🔌 Conectado al servidor con ID: ${socket.id}`);
        reconnectAttempts = 0;
        
        if(currentUserId) {
            socket.emit('joinLobby', currentUserId);
            console.log(`👤 Usuario ${currentUserId} se unió al lobby`);
        }
        
        setupSocketListeners();
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ Desconectado del servidor:', reason);
        
        if (reason === 'io server disconnect') {
            socket.connect();
        }
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Reconectado después de ${attemptNumber} intentos`);
        
        if (currentUserId) {
            socket.emit('joinLobby', currentUserId);
            
            const lobbyPage = document.querySelector("[data-page-id='lobby-page']");
            if (lobbyPage && lobbyPage.classList.contains('active')) {
                callAllActives();
            }
        }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Intento de reconexión #${attemptNumber}`);
        reconnectAttempts = attemptNumber;
    });

    socket.on('reconnect_error', (error) => {
        console.error('⚠️ Error al reconectar:', error);
    });

    socket.on('reconnect_failed', () => {
        console.error('❌ Falló la reconexión después de múltiples intentos');
        mostrarMensajeConexion('No se pudo reconectar al servidor. Por favor, recarga la página.');
    });
    
    socket.on('roomError', (message) => {
        console.error("❌ Error de Sala:", message);
        mostrarMensajeModal(message);
    });
}

function mostrarMensajeConexion(mensaje) {
    const messageDiv = document.getElementById("messageDiv");
    if (messageDiv) {
        messageDiv.innerHTML = `<div style="background-color: #fff3cd; color: #856404; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">${mensaje}</div>`;
    }
}

function setupSocketListeners() {
    // ===== EVENTO ACTUALIZADO: gameJoined con configuración del jugador =====
    socket.on('gameJoined', (data) => {
        console.log(`🎮 Te uniste a la partida ${data.roomID} como Jugador ${data.playerIndex + 1}`);
        console.log(`   Tu oponente es: ${data.opponentName}`);
        
        showPage('game-page');
        
        const canvas = document.getElementById("main");
        const header = document.querySelector('#conputadoras header');
        const headerHeight = header ? header.offsetHeight : 80;
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - headerHeight;
        if (canvas.height < 400) canvas.height = 400;
        
        canvas.style.display = 'block';
        
        // Iniciar juego multijugador con configuración correcta
        iniciarJuego({
            multiplayer: true,
            playerIndex: data.playerIndex,
            socket: socket,
            roomID: data.roomID,
            opponentName: data.opponentName
        });
    });
    
    socket.on('spectatorJoined', (roomID) => {
        console.log(`👁️ Te has unido a la partida ${roomID} como espectador.`);
        showPage('spectate');
    });

    socket.on('startGame', (data) => {
        console.log(`🏁 La partida ${data.roomID} ha comenzado!`);
        console.log(`   Jugadores: ${data.players.join(' vs ')}`);
    });
    
    socket.on('receiveChallenge', ({ challenger, roomID }) => {
        incomingChallengeRoomID = roomID;
        const modal = document.getElementById('challenge-modal');
        document.getElementById('challenge-message').innerText = `⚔️ ${challenger} te ha retado a una partida! ¿Aceptas?`;
        modal.querySelector('button:nth-child(2)').style.display = 'inline-block'; 
        modal.querySelector('button:nth-child(3)').style.display = 'inline-block';
        modal.style.display = 'flex';
    });
    
    socket.on('challengeSent', (opponentName) => {
        console.log(`📤 Reto enviado a ${opponentName}. Esperando respuesta...`);
        mostrarMensajeModal(`Reto enviado a ${opponentName}. Esperando respuesta...`);
    });

    socket.on('gameEnded', (message) => {
        console.warn("🏁 ", message);
        setTimeout(() => {
            stopGame();
            showPage('lobby-page');
        }, 3000);
    });
    
    socket.on('matchEnded', (data) => {
        console.log(`🏆 Partida terminada. Ganador: ${data.winner}`);
        console.log('   Estado final:', data.finalState);
    });
    
    socket.on('opponentDisconnected', (data) => {
        console.warn("❌ Tu oponente se desconectó");
        mostrarMensajeModal(data.message || 'Tu oponente se desconectó. Regresando al lobby...');
        
        setTimeout(() => {
            stopGame();
            showPage('lobby-page');
        }, 3000);
    });
    
    socket.on('userOnline', (userName) => {
        if (document.querySelector("[data-page-id='lobby-page']")?.classList.contains('active')) {
            callAllActives();
        }
    });

    socket.on('userOffline', (userName) => {
        if (document.querySelector("[data-page-id='lobby-page']")?.classList.contains('active')) {
            callAllActives();
        }
    });
}

function setupLocalGame() {
    const canvas = document.getElementById("main");
    const ctx = canvas.getContext("2d");
    
    const header = document.querySelector('#conputadoras header');
    const headerHeight = header ? header.offsetHeight : 80;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - headerHeight;
    if( canvas.height < 400 ) {
        canvas.height = 400; 
    }
    
    canvas.style.display = 'block';
    console.log(`Canvas configurado: ${canvas.width}x${canvas.height}`);
    
    // Iniciar juego en modo local (2 jugadores, 1 PC)
    iniciarJuego({
        multiplayer: false
    });
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.querySelector(`[data-page-id='${pageId}']`)?.classList.add('active');

    if (pageId === 'game-page') {
        // No hacer nada aquí, el juego se inicia desde gameJoined o ranketsButton
    } else if (pageId === 'lobby-page') {
        if (socket && socket.connected && currentUserId) {
            socket.emit('joinLobby', currentUserId);
        }
        if(currentUserId) {
            callAllActives(); 
        }
    }
}

function actualizarUIUsuario(nombre, icono) {
    const lobbyDiv = document.getElementById("lobby");
    const soloinicioDiv = document.getElementById("soloinicio");
    const imagenusuario = document.getElementById("imagenusuario");
    lobbyDiv.style.display = "flex";
    soloinicioDiv.style.display = "none";
    imagenusuario.src = icono;
    lobbyDiv.querySelector("p").innerText = nombre;
}

async function buscarpersona(){
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const boton = document.getElementById("buscar");
    const messageDiv = document.getElementById("messageDiv");
    
    boton.innerText = "Iniciando sesión...";
    boton.disabled = true;

    try {
        const datos = new URLSearchParams();
        datos.append("nombre", username);
        datos.append("password", password);
        
        const response = await fetch(`${BASE_URL}?accion=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: datos
        });

        const json = await response.json();
        
        if (json.success) {
            messageDiv.innerHTML = '<div style="background-color: #d4edda; color: #155724; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">¡Bienvenido ' + json.user + '! Conectando...</div>';
            
            currentUserId = json.user; 
            actualizarUIUsuario(json.user, json.icono);
            
            await conectarYEsperarSocket();
            showPage('lobby-page');

        } else {
            messageDiv.innerHTML = '<div style="background-color: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">' + json.mensaje + '</div>';
        }
    } catch(e) {
        console.error("Error en buscarpersona:", e);
        messageDiv.innerHTML = '<div style="background-color: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">Error al conectar con el servidor.</div>';
    }

    boton.innerText = "iniciar sesion";
    boton.disabled = false;
}

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

function logout(){
    fetch(`${BASE_URL}?accion=logout`)
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (socket) {
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
            currentUserId = null;
        }
    });
}

function callAllActives(){
    const izquierdalobby = document.getElementById("izquierda");
    izquierdalobby.innerHTML = " Luchadores activos: ";
    
    fetch(`${BASE_URL}?accion=callAllActives`)
    .then(response => response.json())
    .then(data => {
        if (data.success && Array.isArray(data.users)) {
            if (data.users.length === 0) {
                izquierdalobby.innerHTML += "<p>No hay otros usuarios activos en este momento.</p>";
                return;
            }
            
            data.users.forEach(usuario => { 
                const div = document.createElement("div");
                div.classList.add('active-user');
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
        } else {
            console.error("Error al cargar usuarios activos:", data.message);
            izquierdalobby.innerHTML += "<p>Error al cargar la lista de activos.</p>";
        }
    })
    .catch(error => {
        console.error("Error en la solicitud callAllActives:", error);
        izquierdalobby.innerHTML += "<p>Hubo un error al conectar con el servidor.</p>";
    });
}

function mostrarMensajeModal(mensaje) {
    const modal = document.getElementById('challenge-modal');
    document.getElementById('challenge-message').innerText = mensaje;
    modal.querySelector('button:nth-child(2)').style.display = 'none'; 
    modal.querySelector('button:nth-child(3)').style.display = 'none';
    modal.style.display = 'flex';
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 3000);
}

function retarUsuario(opponentName){
    if (socket && socket.connected && currentUserId) {
        socket.emit('challengeUser', { opponentName: opponentName });
        console.log(`⚔️ Retando a ${opponentName}.`);
    } else {
        console.error("No conectado al servidor de juegos.");
        mostrarMensajeModal("No estás conectado al servidor. Recargando...");
        setTimeout(() => location.reload(), 2000);
    }
}

function acceptChallengeHandler(){
    const modal = document.getElementById('challenge-modal');
    modal.style.display = 'none';
    
    if (socket && socket.connected && incomingChallengeRoomID) {
        socket.emit('acceptChallenge', { roomID: incomingChallengeRoomID });
        console.log(`✅ Reto aceptado: ${incomingChallengeRoomID}`);
        incomingChallengeRoomID = null;
    }
}

function rejectChallengeHandler(){
    const modal = document.getElementById('challenge-modal');
    modal.style.display = 'none';
    
    if (socket && incomingChallengeRoomID) {
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