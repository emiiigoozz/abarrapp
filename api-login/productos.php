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

/** Responde 404 si el producto no existe o es de otra tienda. */
function exigirProductoDeTienda(PDO $pdo, int $id, int $tiendaId): void
{
    $stmt = $pdo->prepare('SELECT 1 FROM productos WHERE id = ? AND tienda_id = ?');
    $stmt->execute([$id, $tiendaId]);
    if (!$stmt->fetchColumn()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'El producto no existe en esta tienda']);
        exit;
    }
}

if ($method === 'GET') {
    $tiendaId = requerirTiendaId();
    $stmt = $pdo->prepare('SELECT * FROM productos WHERE tienda_id = ? ORDER BY nombre ASC');
    $stmt->execute([$tiendaId]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $tiendaId = requerirTiendaId($body);

    $nombre = trim($body['nombre'] ?? '');
    $codigo = trim($body['codigo'] ?? '') ?: null;
    $categoria = trim($body['categoria'] ?? '') ?: null;
    $costo = (float) ($body['costo'] ?? 0);
    $precio_venta = (float) ($body['precio_venta'] ?? 0);
    $stock = (int) ($body['stock'] ?? 0);

    if ($nombre === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'El nombre es obligatorio']);
        exit;
    }

    $insert = $pdo->prepare('INSERT INTO productos (tienda_id, nombre, codigo, categoria, costo, precio_venta, stock) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $insert->execute([$tiendaId, $nombre, $codigo, $categoria, $costo, $precio_venta, $stock]);

    http_response_code(201);
    echo json_encode(['success' => true, 'message' => 'Producto creado', 'id' => (int) $pdo->lastInsertId()]);
    exit;
}

if ($method === 'PUT') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Falta el id del producto']);
        exit;
    }

    $body = json_decode(file_get_contents('php://input'), true);
    $tiendaId = requerirTiendaId($body);
    exigirProductoDeTienda($pdo, $id, $tiendaId);

    $nombre = trim($body['nombre'] ?? '');
    $codigo = trim($body['codigo'] ?? '') ?: null;
    $categoria = trim($body['categoria'] ?? '') ?: null;
    $costo = (float) ($body['costo'] ?? 0);
    $precio_venta = (float) ($body['precio_venta'] ?? 0);
    $stock = (int) ($body['stock'] ?? 0);

    if ($nombre === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'El nombre es obligatorio']);
        exit;
    }

    $update = $pdo->prepare('UPDATE productos SET nombre = ?, codigo = ?, categoria = ?, costo = ?, precio_venta = ?, stock = ? WHERE id = ?');
    $update->execute([$nombre, $codigo, $categoria, $costo, $precio_venta, $stock, $id]);

    echo json_encode(['success' => true, 'message' => 'Producto actualizado']);
    exit;
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Falta el id del producto']);
        exit;
    }

    $tiendaId = requerirTiendaId();
    exigirProductoDeTienda($pdo, $id, $tiendaId);

    $foto = $pdo->prepare('SELECT foto FROM productos WHERE id = ?');
    $foto->execute([$id]);
    $foto = $foto->fetchColumn();

    $delete = $pdo->prepare('DELETE FROM productos WHERE id = ? AND tienda_id = ?');
    $delete->execute([$id, $tiendaId]);

    // La foto del producto ya no se usa: se borra el archivo.
    if ($foto && str_starts_with($foto, 'uploads/productos/') && is_file(__DIR__ . '/' . $foto)) {
        unlink(__DIR__ . '/' . $foto);
    }

    echo json_encode(['success' => true, 'message' => 'Producto eliminado']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Método no permitido']);
