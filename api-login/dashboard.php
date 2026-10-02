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
$tiendaId = requerirTiendaId();

/** Ejecuta una consulta preparada y devuelve todas las filas. */
function filas(PDO $pdo, string $sql, array $params): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// Resumen de la tienda (todas sus salidas registradas)
$resumen = filas($pdo,
    "SELECT
        COALESCE(SUM(m.cantidad * m.precio_unitario), 0) AS ingresos,
        COALESCE(SUM(m.cantidad * m.costo_unitario), 0) AS costos,
        COALESCE(SUM(m.cantidad * (m.precio_unitario - m.costo_unitario)), 0) AS ganancia,
        COALESCE(SUM(m.cantidad), 0) AS unidades
     FROM movimientos m
     JOIN productos p ON p.id = m.producto_id
     WHERE m.tipo = 'salida' AND p.tienda_id = ?",
    [$tiendaId]
)[0];

// Ganancia por día (últimos 14 días con actividad)
$porDia = filas($pdo,
    "SELECT
        DATE(m.fecha) AS dia,
        SUM(m.cantidad * (m.precio_unitario - m.costo_unitario)) AS ganancia
     FROM movimientos m
     JOIN productos p ON p.id = m.producto_id
     WHERE m.tipo = 'salida' AND p.tienda_id = ? AND m.fecha >= (CURDATE() - INTERVAL 14 DAY)
     GROUP BY DATE(m.fecha)
     ORDER BY dia ASC",
    [$tiendaId]
);

// Top 5 productos más vendidos
$topProductos = filas($pdo,
    "SELECT
        p.id, p.nombre,
        SUM(m.cantidad) AS unidades_vendidas,
        SUM(m.cantidad * (m.precio_unitario - m.costo_unitario)) AS ganancia
     FROM movimientos m
     JOIN productos p ON p.id = m.producto_id
     WHERE m.tipo = 'salida' AND p.tienda_id = ?
     GROUP BY p.id, p.nombre
     ORDER BY unidades_vendidas DESC
     LIMIT 5",
    [$tiendaId]
);

// Productos con stock bajo
$stockBajo = filas($pdo,
    "SELECT id, nombre, stock FROM productos WHERE tienda_id = ? AND stock <= ? ORDER BY stock ASC",
    [$tiendaId, $STOCK_BAJO_UMBRAL]
);

// Productos que se venderían con pérdida o sin margen (precio <= costo)
$conPerdida = filas($pdo,
    "SELECT id, nombre, costo, precio_venta FROM productos WHERE tienda_id = ? AND precio_venta <= costo ORDER BY nombre ASC",
    [$tiendaId]
);

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
