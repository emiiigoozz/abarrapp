<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

require __DIR__ . '/config.php';

$STOCK_BAJO_UMBRAL = 5;

// Resumen general (todas las salidas registradas)
$resumen = $pdo->query(
    "SELECT
        COALESCE(SUM(cantidad * precio_unitario), 0) AS ingresos,
        COALESCE(SUM(cantidad * costo_unitario), 0) AS costos,
        COALESCE(SUM(cantidad * (precio_unitario - costo_unitario)), 0) AS ganancia,
        COALESCE(SUM(cantidad), 0) AS unidades
     FROM movimientos WHERE tipo = 'salida'"
)->fetch(PDO::FETCH_ASSOC);

// Ganancia por día (últimos 14 días con actividad)
$porDia = $pdo->query(
    "SELECT
        DATE(fecha) AS dia,
        SUM(cantidad * (precio_unitario - costo_unitario)) AS ganancia
     FROM movimientos
     WHERE tipo = 'salida' AND fecha >= (CURDATE() - INTERVAL 14 DAY)
     GROUP BY DATE(fecha)
     ORDER BY dia ASC"
)->fetchAll(PDO::FETCH_ASSOC);

// Top 5 productos más vendidos
$topProductos = $pdo->query(
    "SELECT
        p.id, p.nombre,
        SUM(m.cantidad) AS unidades_vendidas,
        SUM(m.cantidad * (m.precio_unitario - m.costo_unitario)) AS ganancia
     FROM movimientos m
     JOIN productos p ON p.id = m.producto_id
     WHERE m.tipo = 'salida'
     GROUP BY p.id, p.nombre
     ORDER BY unidades_vendidas DESC
     LIMIT 5"
)->fetchAll(PDO::FETCH_ASSOC);

// Productos con stock bajo
$stockBajo = $pdo->prepare(
    "SELECT id, nombre, stock FROM productos WHERE stock <= ? ORDER BY stock ASC"
);
$stockBajo->execute([$STOCK_BAJO_UMBRAL]);
$stockBajo = $stockBajo->fetchAll(PDO::FETCH_ASSOC);

// Productos que se venderían con pérdida o sin margen (precio <= costo)
$conPerdida = $pdo->query(
    "SELECT id, nombre, costo, precio_venta FROM productos WHERE precio_venta <= costo ORDER BY nombre ASC"
)->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'success' => true,
    'data' => [
        'resumen' => $resumen,
        'ganancias_por_dia' => $porDia,
        'top_productos' => $topProductos,
        'stock_bajo' => $stockBajo,
        'productos_con_perdida' => $conPerdida,
    ],
]);
