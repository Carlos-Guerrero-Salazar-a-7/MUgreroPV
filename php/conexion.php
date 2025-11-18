<?php
header('Access-Control-Allow-Origin: *'); 
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Session-ID");
header("Access-Control-Max-Age: 86400"); 
header('Content-Type: application/json; charset=utf-8');

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(); 
}

session_start();

$host = "127.0.0.1";
$db = "juego"; // Usamos 'juego' como en el diseño inicial
$user = "root";
$pass = "patito.06";
$charset = "utf8mb4";
$socket_path = "/var/run/mysqld/mysqld.sock"; 

$dsn = "mysql:host=$host;dbname=$db;charset=$charset;unix_socket=$socket_path";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];


try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    echo json_encode(["error" => "Error de conexión a la base de datos: " . $e->getMessage()]);
    exit();
}

$accion = $_GET["accion"] ?? "";

// Verificar Sesión
if ($accion == "verificar") {
    // ... (Lógica de verificar, no requiere cambios de DB)
    if (isset($_SESSION["user_id"]) && $_SESSION["user_id"] != "") {
        echo json_encode([
            "logueado" => true,
            "user" => $_SESSION["user"]
        ]);
    } else {
        echo json_encode(["logueado" => false]);
    }
    exit();
}

// Lógica de Login
if ($accion == "login") {
    $nombre = $_POST["nombre"] ?? "";
    $password_input = $_POST["password"] ?? "";
    
    if (empty($nombre) || empty($password_input)) {
        echo json_encode([
            "success" => false,
            "mensaje" => "Por favor completa todos los campos"
        ]);
        exit();
    }
    // CORREGIDO: Usar id_usuario en lugar de id
    $sql_select = "SELECT id_usuario, nombre, icono, region FROM usuario WHERE nombre = :nombre AND contraseña = :password";
    $stmt_select = $pdo->prepare($sql_select);
    $stmt_select->bindParam(':nombre', $nombre, PDO::PARAM_STR);
    $stmt_select->bindParam(':password', $password_input, PDO::PARAM_STR);
    $stmt_select->execute();
    
    $fila = $stmt_select->fetch(PDO::FETCH_ASSOC);

    if ($fila) {
        // CORREGIDO: Usar id_usuario en lugar de id
        $sql_update_login = "UPDATE usuario SET activo = TRUE WHERE id_usuario = :id_usuario";
        $stmt_update_login = $pdo->prepare($sql_update_login);
        // CORREGIDO: Usar el valor de id_usuario
        $stmt_update_login->bindParam(':id_usuario', $fila["id_usuario"], PDO::PARAM_INT); 
        $stmt_update_login->execute();

        // CORREGIDO: Usar id_usuario para la sesión
        $_SESSION["user_id"] = $fila["id_usuario"];
        $_SESSION["user"] = [
            "nombre" => $fila["nombre"],
            "icono" => $fila["icono"]
        ];
        
        echo json_encode([
            "success" => true,
            "user" => $fila["nombre"],
            "icono" => $fila["icono"]
        ]);
            
    } else {
        echo json_encode([
            "success" => false,
            "mensaje" => "Usuario o contraseña incorrectos"
        ]);
    }
    exit();
}

// Lógica de Obtener Usuarios Activos
if($accion == "callAllActives"){
    $user_id = $_SESSION["user_id"] ?? null;
    
    if($user_id) {
        // CORREGIDO: 
        // 1. Usar id_usuario.
        // 2. Usar JOIN para obtener 'partidas_ganadas' (victorias) de historialpersona.
        // 3. Usar COALESCE para mostrar 0 si el historial no existe aún.
        $mysql = "SELECT u.nombre, u.icono, u.region, COALESCE(h.partidas_ganadas, 0) AS victorias 
                  FROM usuario u
                  LEFT JOIN historialpersona h ON u.id_usuario = h.id_usuario
                  WHERE u.id_usuario != :user_id AND u.activo = TRUE";

        $stmt = $pdo->prepare($mysql);
        $stmt->execute(['user_id' => $user_id]);
        $activeUsers = [];
        
        while($fila = $stmt->fetch(PDO::FETCH_ASSOC)){
            $activeUsers[] = [
                "nombre" => $fila["nombre"],
                "icono" => $fila["icono"],
                "region" => $fila["region"],
                "victorias" => $fila["victorias"]
            ];
        }
        $response = [
            "users" => $activeUsers,
            "success" => true,
            "message" => "Active users found."
        ];
    } else {
        $response = [
            "users" => [],
            "success" => false,
            "message" => "Usuario no autenticado para llamar a usuarios activos."
        ];
    }

    header('Content-Type: application/json');
    echo json_encode($response);
    exit();
}

// Lógica de Logout
if ($accion == "logout") {
    $user_id = $_SESSION["user_id"] ?? null;

    if ($user_id) {
        // CORREGIDO: Usar id_usuario en lugar de id
        $sql_update_logout = "UPDATE usuario SET activo = FALSE WHERE id_usuario = :id_usuario";
        $stmt_update_logout = $pdo->prepare($sql_update_logout);
        $stmt_update_logout->bindParam(':id_usuario', $user_id, PDO::PARAM_INT);
        $stmt_update_logout->execute();
    }
    
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_regenerate_id(true); 
    session_unset();
    session_destroy();
    
    echo json_encode(["success" => true, "mensaje" => "Sesión cerrada"]);
    exit();
}
?>