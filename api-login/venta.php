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
$tiendaId = requerirTiendaId($body);
$items = $body['items'] ?? [];

if (!is_array($items) || count($items) === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El carrito está vacío']);
    exit;
}

// Normalizamos y validamos la forma básica antes de tocar la base de datos
$itemsLimpios = [];
foreach ($items as $item) {
    $producto_id = (int) ($item['producto_id'] ?? 0);
    $cantidad = (int) ($item['cantidad'] ?? 0);

    if ($producto_id <= 0 || $cantidad <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Cada línea del carrito necesita producto y cantidad válidos']);
        exit;
    }

    $itemsLimpios[] = ['producto_id' => $producto_id, 'cantidad' => $cantidad];
}

$pdo->beginTransaction();

try {
    $total = 0;
    $ganancia = 0;
    $movimientos = [];

    foreach ($itemsLimpios as $item) {
        $stmt = $pdo->prepare('SELECT nombre, costo, precio_venta, stock FROM productos WHERE id = ? AND tienda_id = ? FOR UPDATE');
        $stmt->execute([$item['producto_id'], $tiendaId]);
        $producto = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$producto) {
            throw new Exception("El producto #{$item['producto_id']} no existe en esta tienda");
        }

        if ($producto['stock'] < $item['cantidad']) {
            throw new Exception("Stock insuficiente de \"{$producto['nombre']}\" (disponible: {$producto['stock']})");
        }

        $nuevoStock = $producto['stock'] - $item['cantidad'];
        $pdo->prepare('UPDATE productos SET stock = ? WHERE id = ?')
            ->execute([$nuevoStock, $item['producto_id']]);

        $pdo->prepare(
            "INSERT INTO movimientos (producto_id, tipo, cantidad, costo_unitario, precio_unitario) VALUES (?, 'salida', ?, ?, ?)"
        )->execute([$item['producto_id'], $item['cantidad'], $producto['costo'], $producto['precio_venta']]);

        $subtotal = $item['cantidad'] * $producto['precio_venta'];
        $total += $subtotal;
        $ganancia += $item['cantidad'] * ($producto['precio_venta'] - $producto['costo']);

        $movimientos[] = [
            'producto_id' => $item['producto_id'],
            'nombre' => $producto['nombre'],
            'cantidad' => $item['cantidad'],
            'subtotal' => $subtotal,
            'stock_restante' => $nuevoStock,
        ];
    }

    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Venta registrada',
        'total' => $total,
        'ganancia' => $ganancia,
        'items' => $movimientos,
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
