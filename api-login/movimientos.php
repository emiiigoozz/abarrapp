<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $tiendaId = requerirTiendaId();
    $limit = (int) ($_GET['limit'] ?? 30);
    $limit = $limit > 0 && $limit <= 200 ? $limit : 30;

    $stmt = $pdo->prepare(
        'SELECT m.id, m.producto_id, p.nombre AS producto_nombre, m.tipo, m.cantidad,
                m.costo_unitario, m.precio_unitario, m.fecha
         FROM movimientos m
         JOIN productos p ON p.id = m.producto_id
         WHERE p.tienda_id = ?
         ORDER BY m.fecha DESC, m.id DESC
         LIMIT ' . $limit
    );
    $stmt->execute([$tiendaId]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $tiendaId = requerirTiendaId($body);

    $producto_id = (int) ($body['producto_id'] ?? 0);
    $tipo = $body['tipo'] ?? '';
    $cantidad = (int) ($body['cantidad'] ?? 0);

    if ($producto_id <= 0 || !in_array($tipo, ['entrada', 'salida'], true) || $cantidad <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Datos inválidos: producto, tipo y cantidad (mayor a 0) son obligatorios']);
        exit;
    }

    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare('SELECT costo, precio_venta, stock FROM productos WHERE id = ? AND tienda_id = ? FOR UPDATE');
        $stmt->execute([$producto_id, $tiendaId]);
        $producto = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$producto) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'El producto no existe en esta tienda']);
            exit;
        }

        if ($tipo === 'salida' && $producto['stock'] < $cantidad) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => "Stock insuficiente. Disponible: {$producto['stock']}"]);
            exit;
        }

        $nuevoStock = $tipo === 'entrada'
            ? $producto['stock'] + $cantidad
            : $producto['stock'] - $cantidad;

        $pdo->prepare('UPDATE productos SET stock = ? WHERE id = ?')
            ->execute([$nuevoStock, $producto_id]);

        $pdo->prepare(
            'INSERT INTO movimientos (producto_id, tipo, cantidad, costo_unitario, precio_unitario) VALUES (?, ?, ?, ?, ?)'
        )->execute([$producto_id, $tipo, $cantidad, $producto['costo'], $producto['precio_venta']]);

        $pdo->commit();

        http_response_code(201);
        echo json_encode(['success' => true, 'message' => 'Movimiento registrado', 'stock_actual' => $nuevoStock]);
        exit;
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo registrar el movimiento']);
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Método no permitido']);
