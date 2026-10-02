<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require __DIR__ . '/config.php';

function esAdminDeTienda(PDO $pdo, int $tienda_id, int $usuario_id): bool {
    $stmt = $pdo->prepare(
        "SELECT id FROM tienda_miembros WHERE tienda_id = ? AND usuario_id = ? AND rol = 'admin' AND estado = 'aceptado'"
    );
    $stmt->execute([$tienda_id, $usuario_id]);
    return (bool) $stmt->fetch();
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $tienda_id = (int) ($_GET['tienda_id'] ?? 0);
    $usuario_id = (int) ($_GET['usuario_id'] ?? 0);

    if ($tienda_id <= 0 || $usuario_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Faltan tienda_id o usuario_id']);
        exit;
    }

    if (!esAdminDeTienda($pdo, $tienda_id, $usuario_id)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Solo un administrador puede ver los miembros']);
        exit;
    }

    $stmt = $pdo->prepare(
        'SELECT tm.id, tm.usuario_id, u.nombre, u.email, tm.rol, tm.estado, tm.creado_en
         FROM tienda_miembros tm
         JOIN usuarios u ON u.id = tm.usuario_id
         WHERE tm.tienda_id = ?
         ORDER BY FIELD(tm.estado, "pendiente", "aceptado"), tm.creado_en ASC'
    );
    $stmt->execute([$tienda_id]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

if ($method === 'PUT') {
    $id = (int) ($_GET['id'] ?? 0);
    $body = json_decode(file_get_contents('php://input'), true);
    $usuario_id = (int) ($body['usuario_id'] ?? 0);

    if ($id <= 0 || $usuario_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Faltan datos']);
        exit;
    }

    $miembro = $pdo->prepare('SELECT tienda_id FROM tienda_miembros WHERE id = ?');
    $miembro->execute([$id]);
    $miembro = $miembro->fetch(PDO::FETCH_ASSOC);

    if (!$miembro) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Miembro no encontrado']);
        exit;
    }

    if (!esAdminDeTienda($pdo, (int) $miembro['tienda_id'], $usuario_id)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Solo un administrador puede modificar miembros']);
        exit;
    }

    $rol = $body['rol'] ?? null;
    $estado = $body['estado'] ?? null;

    if ($rol !== null && !in_array($rol, ['admin', 'trabajador', 'lector'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Rol inválido']);
        exit;
    }

    if ($estado !== null && !in_array($estado, ['pendiente', 'aceptado'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Estado inválido']);
        exit;
    }

    $campos = [];
    $valores = [];
    if ($rol !== null) { $campos[] = 'rol = ?'; $valores[] = $rol; }
    if ($estado !== null) { $campos[] = 'estado = ?'; $valores[] = $estado; }

    if (empty($campos)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nada para actualizar']);
        exit;
    }

    $valores[] = $id;
    $pdo->prepare('UPDATE tienda_miembros SET ' . implode(', ', $campos) . ' WHERE id = ?')->execute($valores);

    echo json_encode(['success' => true, 'message' => 'Miembro actualizado']);
    exit;
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    $usuario_id = (int) ($_GET['usuario_id'] ?? 0);

    if ($id <= 0 || $usuario_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Faltan datos']);
        exit;
    }

    $miembro = $pdo->prepare(
        'SELECT tm.tienda_id, tm.usuario_id, t.dueno_id FROM tienda_miembros tm JOIN tiendas t ON t.id = tm.tienda_id WHERE tm.id = ?'
    );
    $miembro->execute([$id]);
    $miembro = $miembro->fetch(PDO::FETCH_ASSOC);

    if (!$miembro) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Miembro no encontrado']);
        exit;
    }

    if (!esAdminDeTienda($pdo, (int) $miembro['tienda_id'], $usuario_id)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Solo un administrador puede eliminar miembros']);
        exit;
    }

    if ((int) $miembro['usuario_id'] === (int) $miembro['dueno_id']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No se puede eliminar al dueño de la tienda']);
        exit;
    }

    $pdo->prepare('DELETE FROM tienda_miembros WHERE id = ?')->execute([$id]);

    echo json_encode(['success' => true, 'message' => 'Miembro eliminado']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Método no permitido']);
