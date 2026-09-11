<?php

// ---- CORS: permite que la app Ionic (otro origen) consuma esta API ----
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// El navegador manda un preflight OPTIONS antes del POST real; solo hay que responder 200 vacío
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

require __DIR__ . '/config.php';

// axios manda el body como JSON
$body = json_decode(file_get_contents('php://input'), true);

$email = trim($body['email'] ?? '');
$password = (string) ($body['password'] ?? '');

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email y contraseña son obligatorios']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, nombre, email, password FROM usuarios WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$usuario = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$usuario || !password_verify($password, $usuario['password'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Email o contraseña incorrectos']);
    exit;
}

// Token simple para identificar la sesión en el cliente.
// Para producción real conviene reemplazar esto por un JWT firmado.
$token = bin2hex(random_bytes(32));

http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Login exitoso',
    'token' => $token,
    'user' => [
        'id' => (int) $usuario['id'],
        'nombre' => $usuario['nombre'],
        'email' => $usuario['email'],
    ],
]);
