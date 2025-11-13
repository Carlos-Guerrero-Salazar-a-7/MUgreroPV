<?php
header('Access-Control-Allow-Origin: *'); 
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Session-ID");
header("Access-Control-Max-Age: 86400"); 
header('Content-Type: application/json; charset=utf-8');

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Si la petición es de tipo OPTIONS (pre-vuelo CORS), respondemos y terminamos.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(); // Terminar el script aquí
}

// El resto de la lógica de sesión y PDO se mantiene.
session_start();

$host = "localhost"; // Ya usa localhost
$db = "juego";
$user = "root";
$pass = "";
$charset = "utf8mb4";
// [Immersive content redacted for brevity.]
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // Manejo estricto de errores
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,     // Devolver resultados como array asociativo
    PDO::ATTR_EMULATE_PREPARES   => false,                // Deshabilitar emulación de consultas preparadas (más seguro)
];

try {
    // Intenta crear la conexión PDO
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    // Si falla, devuelve un un error JSON y termina el script
    echo json_encode(["error" => "Error de conexión a la base de datos: " . $e->getMessage()]);
    exit();
}


$accion = $_GET["accion"] ?? "";

// ✅ LÓGICA CLAVE DE PERSISTENCIA: Verifica si la sesión de PHP está activa.
if ($accion == "verificar") {
    if (isset($_SESSION["user_id"]) && $_SESSION["user_id"] != "") {
        // Devuelve el estado de la sesión activa
        echo json_encode([
            "logueado" => true,
            "user" => $_SESSION["user"]
        ]);
    } else {
        echo json_encode(["logueado" => false]);
    }
    exit();
}
//accion del login, recupera nombre e id para la sesión.
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
    $sql_select = "SELECT id, nombre, icono, region FROM usuario WHERE nombre = :nombre AND contraseña = :password";
    $stmt_select = $pdo->prepare($sql_select);
    $stmt_select->bindParam(':nombre', $nombre, PDO::PARAM_STR);
    $stmt_select->bindParam(':password', $password_input, PDO::PARAM_STR);
    $stmt_select->execute();
    
    $fila = $stmt_select->fetch(PDO::FETCH_ASSOC);

    if ($fila) {
        $sql_update_login = "UPDATE usuario SET activo = TRUE WHERE id = :id_usuario";
        $stmt_update_login = $pdo->prepare($sql_update_login);
        $stmt_update_login->bindParam(':id_usuario', $fila["id"], PDO::PARAM_INT);
        $stmt_update_login->execute();
        $_SESSION["user_id"] = $fila["id"];
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
if($accion == "callAllActives"){
    $user_id = $_SESSION["user_id"] ?? null;
    
    if($user_id) {
        $mysql = "SELECT nombre,icono,region,victorias from usuario where id!= :user_id and activo = true";
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
            "users" => $activeUsers,         // The list of users
            "success" => true,               // The status flag
            "message" => "Active users found."
        ];
    } else {
        // FIX: Enviar una respuesta JSON válida incluso si no hay sesión iniciada
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
if ($accion == "logout") {
    $user_id = $_SESSION["user_id"] ?? null;

    if ($user_id) {
        $sql_update_logout = "UPDATE usuario SET activo = FALSE WHERE id = :id_usuario";
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