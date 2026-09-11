<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int) $_GET['id'] : null;

switch ($method) {
    case 'GET':
        if ($id) {
            obtenerUno($pdo, $id);
        } else {
            listar($pdo);
        }
        break;

    case 'POST':
        crear($pdo);
        break;

    case 'PUT':
        if (!$id) {
            responder(400, ['success' => false, 'message' => 'Falta el id']);
        }
        actualizar($pdo, $id);
        break;

    case 'DELETE':
        if (!$id) {
            responder(400, ['success' => false, 'message' => 'Falta el id']);
        }
        eliminar($pdo, $id);
        break;

    default:
        responder(405, ['success' => false, 'message' => 'Método no permitido']);
}

// ---------------------------------------------------------------

function responder(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function leerBody(): array {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function listar(PDO $pdo): void {
    $stmt = $pdo->query('SELECT id, nombre, usuario, email, rol, estado, creado_en FROM usuarios ORDER BY id DESC');
    responder(200, ['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

function obtenerUno(PDO $pdo, int $id): void {
    $stmt = $pdo->prepare('SELECT id, nombre, usuario, email, rol, estado, creado_en FROM usuarios WHERE id = ?');
    $stmt->execute([$id]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario) {
        responder(404, ['success' => false, 'message' => 'Usuario no encontrado']);
    }

    responder(200, ['success' => true, 'data' => $usuario]);
}

function crear(PDO $pdo): void {
    $body = leerBody();

    $nombre = trim($body['nombre'] ?? '');
    $usuario = trim($body['usuario'] ?? '');
    $email = trim($body['email'] ?? '');
    $password = (string) ($body['password'] ?? '');
    $rol = trim($body['rol'] ?? 'usuario');
    $estado = isset($body['estado']) ? (int) $body['estado'] : 1;

    if ($nombre === '' || $usuario === '' || $email === '' || $password === '') {
        responder(400, ['success' => false, 'message' => 'Nombre, usuario, email y contraseña son obligatorios']);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        responder(400, ['success' => false, 'message' => 'El email no es válido']);
    }

    if (strlen($password) < 6) {
        responder(400, ['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres']);
    }

    $check = $pdo->prepare('SELECT id FROM usuarios WHERE email = ? OR usuario = ? LIMIT 1');
    $check->execute([$email, $usuario]);

    if ($check->fetch()) {
        responder(409, ['success' => false, 'message' => 'Ya existe un usuario con ese email o nombre de usuario']);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);

    $insert = $pdo->prepare(
        'INSERT INTO usuarios (nombre, usuario, email, password, rol, estado) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $insert->execute([$nombre, $usuario, $email, $hash, $rol, $estado]);

    responder(201, ['success' => true, 'message' => 'Usuario creado correctamente', 'id' => (int) $pdo->lastInsertId()]);
}

function actualizar(PDO $pdo, int $id): void {
    $body = leerBody();

    $check = $pdo->prepare('SELECT id FROM usuarios WHERE id = ?');
    $check->execute([$id]);

    if (!$check->fetch()) {
        responder(404, ['success' => false, 'message' => 'Usuario no encontrado']);
    }

    $nombre = trim($body['nombre'] ?? '');
    $usuario = trim($body['usuario'] ?? '');
    $email = trim($body['email'] ?? '');
    $password = (string) ($body['password'] ?? '');
    $rol = trim($body['rol'] ?? 'usuario');
    $estado = isset($body['estado']) ? (int) $body['estado'] : 1;

    if ($nombre === '' || $usuario === '' || $email === '') {
        responder(400, ['success' => false, 'message' => 'Nombre, usuario y email son obligatorios']);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        responder(400, ['success' => false, 'message' => 'El email no es válido']);
    }

    $dup = $pdo->prepare('SELECT id FROM usuarios WHERE (email = ? OR usuario = ?) AND id != ?');
    $dup->execute([$email, $usuario, $id]);

    if ($dup->fetch()) {
        responder(409, ['success' => false, 'message' => 'Ya existe otro usuario con ese email o nombre de usuario']);
    }

    if ($password !== '') {
        if (strlen($password) < 6) {
            responder(400, ['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres']);
        }
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $update = $pdo->prepare(
            'UPDATE usuarios SET nombre = ?, usuario = ?, email = ?, password = ?, rol = ?, estado = ? WHERE id = ?'
        );
        $update->execute([$nombre, $usuario, $email, $hash, $rol, $estado, $id]);
    } else {
        $update = $pdo->prepare(
            'UPDATE usuarios SET nombre = ?, usuario = ?, email = ?, rol = ?, estado = ? WHERE id = ?'
        );
        $update->execute([$nombre, $usuario, $email, $rol, $estado, $id]);
    }

    responder(200, ['success' => true, 'message' => 'Usuario actualizado correctamente']);
}

function eliminar(PDO $pdo, int $id): void {
    $check = $pdo->prepare('SELECT id FROM usuarios WHERE id = ?');
    $check->execute([$id]);

    if (!$check->fetch()) {
        responder(404, ['success' => false, 'message' => 'Usuario no encontrado']);
    }

    $delete = $pdo->prepare('DELETE FROM usuarios WHERE id = ?');
    $delete->execute([$id]);

    responder(200, ['success' => true, 'message' => 'Usuario eliminado correctamente']);
}
