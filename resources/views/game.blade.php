<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="stylesheet" href="{{ asset('css/style.css') }}">
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
                    <!-- El botón gotoregister ahora será gestionado por showPage('register') en script.js -->
                    <p>no tiene cuenta?<button id="gotoregister">registrarme</button></p>
                </div>
                <div id="lobby">
                    <button id="userbutton" onclick="visualizarlogout()">
                        <img src="" alt="user" id="imagenusuario">
                        <p></p>
                    </button>
                    <div id="absoluto_invisible">
                        <div id="goingtoperfil">
                            <img src="{{ asset('assets/portraits/usuario.png') }}">
                            <button id="gotoperfil">Perfil</button>
                        </div>
                        <button id="logoutbutton" onclick="logout()">cerrar sesion</button>
                    </div>
                </div>
            </header>

            <!-- Login Page (CORREGIDO: data-page-id a "login-page") -->
            <article data-page-id="login-page" class="page active">
                <div id="logincontainer">
                    <form id="loginform">
                        <h2>Iniciar Sesión</h2>
                        <input type="text" id="loginusername" placeholder="Nombre de Usuario">
                        <input type="password" id="loginpassword" placeholder="Contraseña">
                        <button id="buscar" type="submit">Entrar</button>
                    </form>
                </div>
            </article>

            <!-- Register Page (CORREGIDO: data-page-id a "register-page" y AÑADIDO: campo Región) -->
            <article data-page-id="register-page" class="page">
                <div id="registercontainer">
                    <form id="registerform">
                        <h2>Registro de Usuario</h2>
                        <input type="text" id="registerusername" placeholder="Nombre de Usuario">
                        <input type="password" id="registerpassword" placeholder="Contraseña">
                        <input type="text" id="registerregion" placeholder="Región/País"> <!-- CAMPO AÑADIDO -->
                        <button id="register" type="submit">Registrar</button>
                    </form>
                    <p>ya tienes cuenta?<button id="gotologin">iniciar sesion</button></p>
                </div>
            </article>

            <!-- Lobby Page -->
            <article data-page-id="lobby-page" class="page">
                <h2 id="lobbytitle">Bienvenido al lobby</h2>
                <div id="busqueda rapida">
                    <button id="partidarapida">partida rapida</button>
                    <button id="rankets">juego local</button>
                    <button id="ranketsreal">rankets</button>
                </div>
                <div id="lobbycompu">
                    <section id="izquierda">
                        Luchadores activos:
                    </section>
                    <aside id="derecha">
                        Partidas activas:
                    </aside>
                </div>
            </article>

            <!-- Game Page -->
            <article data-page-id="game-page" class="page">
                <canvas id="main" width="0" height="0"></canvas>
            </article>

            <!-- Spectate Page -->
            <article data-page-id="spectate-page" class="page">
                <!-- Spectator view -->
            </article>
        </section>
    </main>

    <!-- Modal de Mensajes (Añadido para que 'mostrarMensajeModal' funcione) -->
    <div id="message-modal" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.8); color:white; padding:20px; border-radius:10px; z-index:1000;">
        <p id="message-text"></p>
    </div>

    <!-- Socket.io Client -->
    <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
    
    <!-- Configuración global -->
    <script>
        window.Laravel = {
            csrfToken: '{{ csrf_token() }}',
            baseUrl: '{{ url('/') }}',
            // Asegúrate de que SOCKET_SERVER_URL esté configurado en tu .env de Laravel
            socketUrl: '{{ env('SOCKET_SERVER_URL', 'http://127.0.0.1:3000') }}' 
        };
    </script>
    
    <!-- CARGA DE SCRIPT.JS COMO MÓDULO (CORRECCIÓN) -->
    <script type="module" src="{{ asset('js/script.js') }}"></script>
</body>
</html>