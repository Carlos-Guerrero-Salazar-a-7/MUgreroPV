<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="stylesheet" href="{{ asset('css/style.css') }}">
    <link rel="stylesheet" href="{{ asset('css/profile.css') }}">
    <title>SF3 PWM - Street Fighter Game</title>
</head>
<body>
    <main>
        <section id="conputadoras">
            <header>
                <img src="{{ asset('assets/portraits/UPV.png') }}" alt="logo">
                <div id="portada-header">
                    <center><img src="{{ asset('assets/portraits/nombre.png') }}" alt="Mugenupv"></center>
                </div>
                <div id="soloinicio">
                    <p>¿No tienes cuenta? <button id="gotoregister">Registrarme</button></p>
                </div>
                <div id="lobby">
                    <button id="userbutton" onclick="visualizarlogout()">
                        <img src="" alt="user" id="profile-icon">
                        <p id="header-username"></p>
                    </button>
                    <div id="absoluto_invisible">
                        <div id="goingtoperfil">
                            <img src="{{ asset('assets/portraits/usuario.png') }}">
                            <button id="gotoperfil">Perfil</button>
                        </div>
                        <button id="logoutbutton" onclick="logout()">Cerrar sesión</button>
                    </div>
                </div>
            </header>

            <!-- Login Page -->
            <article id="login-page" class="page active">
                <div id="logincontainer">
                    <form id="loginform">
                        <h2>Iniciar Sesión</h2>
                        <input type="text" id="loginusername" placeholder="Nombre de Usuario" required>
                        <input type="password" id="loginpassword" placeholder="Contraseña" required>
                        <button type="submit">Entrar</button>
                    </form>
                </div>
            </article>

            <!-- Register Page -->
            <article id="register-page" class="page">
                <div id="registercontainer">
                    <form id="registerform">
                        <h2>Registro de Usuario</h2>
                        <input type="text" id="registerusername" placeholder="Nombre de Usuario" required>
                        <input type="hidden" id="registericon" value="default.png">
                        
                        <div id="avatar-selection-wrapper">
                            <label>Avatar:</label>
                            <div class="avatar-preview-container">
                                <img id="current-avatar-preview" src="{{ asset('assets/portraits/default.png') }}" alt="Avatar Seleccionado">
                                <button type="button" id="open-avatar-selector">Seleccionar Personaje</button>
                            </div>
                        </div>

                        <!-- Modal de Selección de Avatar -->
                        <div id="avatar-modal" class="modal-hidden">
                            <div class="avatar-modal-content">
                                <h3>Elige tu Luchador</h3>
                                <div id="icon-grid">
                                    <img src="{{ asset('assets/portraits/default.png') }}" data-value="default.png" class="profile-option selected-icon" alt="Default">
                                    <img src="{{ asset('assets/portraits/Ryu.png') }}" data-value="Ryu.png" class="profile-option" alt="Ryu">
                                    <img src="{{ asset('assets/portraits/ken.png') }}" data-value="ken.png" class="profile-option" alt="Ken">
                                    <img src="{{ asset('assets/portraits/Chun.png') }}" data-value="Chun.png" class="profile-option" alt="Chun-Li">
                                    <img src="{{ asset('assets/portraits/akuma.png') }}" data-value="akuma.png" class="profile-option" alt="Akuma">
                                    <img src="{{ asset('assets/portraits/dante.png') }}" data-value="dante.png" class="profile-option" alt="Dante">
                                    <img src="{{ asset('assets/portraits/gatilargo.png') }}" data-value="gatilargo.png" class="profile-option" alt="Gatilargo">
                                </div>
                                <button type="button" id="close-avatar-modal" class="cancel-btn">Cancelar</button>
                            </div>
                        </div>
                        <input type="password" id="registerpassword" placeholder="Contraseña" required>
                        <input type="text" id="registerregion" placeholder="Región/País (opcional)">
                        <button type="submit">Registrar</button>
                    </form>
                    <p>¿Ya tienes cuenta? <button id="gotologin">Iniciar sesión</button></p>
                </div>
            </article>

            <!-- Lobby Page -->
            <article id="lobby-page" class="page">
                <h2 id="lobbytitle">Bienvenido al Lobby</h2>
                <p id="user-count">Cargando usuarios...</p>
                <div id="busqueda-rapida">
                    <button id="partidarapida">Partida Rápida</button>
                    <button id="rankets">Juego Local</button>
                    <button id="ranketsreal">Rankets</button>
                </div>
                <div id="lobbycompu">
                    <section id="izquierda">
                        <h3>Luchadores Activos:</h3>
                        <ul id="active-users-list"></ul>
                    </section>
                    <aside id="derecha">
                        <h3>Partidas Activas:</h3>
                        <ul id="active-matches-list"></ul>
                    </aside>
                </div>
            </article>

            <!-- Game Page -->
            <article id="game-page" class="page">
                <canvas id="main_game" width="0" height="0"></canvas>
            </article>

            <!-- Spectate Page -->
            <article id="spectate-page" class="page">
                <!-- Spectator view -->
            </article>
            <article id="rankets-page" class="page">
                <!-- Rankets view -->
            </article>
            <article id="profile-page" class="page">
                <div class="profile-container">
                    <div class="profile-header" id="profile-header">
                        <img id="profile-avatar" src="" alt="Avatar" class="profile-avatar-large">
                        <div id = "names">
                        <h2 id="profile-username">Nombre de Usuario</h2>
                        <p id="profile-region" class="profile-region">Región</p>
                        <div class="profile-stats">
                            <div class="stat-card">
                                <h3>Victorias</h3>
                                <p id="profile-wins">0</p>
                            </div>
                            <div class="stat-card">
                                <h3>Derrotas</h3>
                                <p id="profile-losses">0</p>
                            </div>
                            <div class="stat-card">
                                <h3>Total Partidas</h3>
                                <p id="profile-total">0</p>
                            </div>
                        </div>
                        <button id="back-to-lobby" class="back-btn">Volver al Lobby</button>
                    </div>
                </div>
            </article>
        </section>
    </main>

    <!-- Modal de Mensajes -->
    <div id="message-modal" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.9); color:white; padding:30px; border-radius:10px; z-index:1000; max-width:400px; text-align:center; box-shadow: 0 4px 6px rgba(0,0,0,0.5);">
        <p id="message-text" style="margin-bottom:15px; font-size:16px;"></p>
        <button id="close-message-modal" style="background:#3b82f6; color:white; padding:8px 16px; border:none; border-radius:5px; cursor:pointer;">Cerrar</button>
    </div>

    <!-- Modal de Reto -->
    <div id="challenge-modal" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.9); color:white; padding:30px; border-radius:10px; z-index:1000; max-width:400px; text-align:center; box-shadow: 0 4px 6px rgba(0,0,0,0.5);">
        <p id="challenge-text" style="margin-bottom:20px; font-size:18px;"></p>
        <div style="display:flex; gap:10px; justify-content:center;">
            <button onclick="acceptChallengeHandler()" style="background:#10b981; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Aceptar</button>
            <button onclick="rejectChallengeHandler()" style="background:#ef4444; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Rechazar</button>
        </div>
    </div>

    <!-- Modal de Rematch -->
    <div id="rematch-modal" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.95); color:white; padding:40px; border-radius:15px; z-index:1001; max-width:500px; text-align:center; box-shadow: 0 8px 16px rgba(0,0,0,0.7); border: 2px solid #fbbf24;">
        <h2 style="margin-bottom:15px; font-size:28px; color:#fbbf24;">¡Partida Finalizada!</h2>
        <p id="rematch-winner-text" style="margin-bottom:25px; font-size:20px; font-weight:bold;"></p>
        <p style="margin-bottom:30px; font-size:18px;">¿Deseas la revancha?</p>
        <div style="display:flex; gap:15px; justify-content:center;">
            <button onclick="acceptRematch()" style="background:#10b981; color:white; padding:12px 30px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:16px; transition: all 0.3s;">Aceptar Revancha</button>
            <button onclick="rejectRematch()" style="background:#ef4444; color:white; padding:12px 30px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:16px; transition: all 0.3s;">Volver al Lobby</button>
        </div>
        <p id="rematch-status" style="margin-top:20px; font-size:14px; color:#9ca3af;"></p>
    </div>

    <!-- Socket.io Client -->
    <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
    
    <!-- Configuración global -->
    <script>
        window.Laravel = {
            csrfToken: '{{ csrf_token() }}',
            baseUrl: '{{ url('/') }}',
            socketUrl: '{{ env('SOCKET_SERVER_URL', 'http://127.0.0.1:3000') }}' 
        };
    </script>
    
    <!-- Script principal -->
    <script type="module" src="{{ asset('js/script.js') }}"></script>
</body>
</html>