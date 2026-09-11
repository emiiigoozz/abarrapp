<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

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

$body = json_decode(file_get_contents('php://input'), true);

$nombre = trim($body['nombre'] ?? '');
$email = trim($body['email'] ?? '');
$password = (string) ($body['password'] ?? '');

if ($nombre === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nombre, email y contraseña son obligatorios']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El email no es válido']);
    exit;
}

if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres']);
    exit;
}

$check = $pdo->prepare('SELECT id FROM usuarios WHERE email = ? LIMIT 1');
$check->execute([$email]);

if ($check->fetch()) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Ese email ya está registrado']);
    exit;
}

$hash = password_hash($password, PASSWORD_BCRYPT);

$insert = $pdo->prepare('INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)');
$insert->execute([$nombre, $email, $hash]);

$userId = (int) $pdo->lastInsertId();
$token = bin2hex(random_bytes(32));

http_response_code(201);
echo json_encode([
    'success' => true,
    'message' => 'Cuenta creada correctamente',
    'token' => $token,
    'user' => [
        'id' => $userId,
        'nombre' => $nombre,
        'email' => $email,
    ],
]);
