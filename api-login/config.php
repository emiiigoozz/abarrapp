<?php

// Datos de conexión (ajustá si tu MySQL usa otro usuario/contraseña)
$db_host = 'localhost';
$db_name = 'login_app';
$db_user = 'root';
$db_pass = '';

try {
    $pdo = new PDO(
        "mysql:host={$db_host};dbname={$db_name};charset=utf8mb4",
        $db_user,
        $db_pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit;
}

/**
 * Devuelve la tienda sobre la que se trabaja (de la URL o del cuerpo JSON).
 * Si no viene, responde 400 y termina: el inventario siempre pertenece a una tienda.
 */
function requerirTiendaId(?array $body = null): int
{
    $tiendaId = (int) ($_GET['tienda_id'] ?? ($body['tienda_id'] ?? 0));
    if ($tiendaId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Falta indicar la tienda']);
        exit;
    }
    return $tiendaId;
}
