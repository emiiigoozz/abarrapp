<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require __DIR__ . '/config.php';

// Fotos de productos. Se guardan como archivos en uploads/productos/ y en la tabla
// solo se guarda la ruta relativa (productos.foto).
const CARPETA = 'uploads/productos';
const MAX_BYTES = 3 * 1024 * 1024;
const TIPOS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

function responder(int $codigo, array $cuerpo): void
{
    http_response_code($codigo);
    echo json_encode($cuerpo);
    exit;
}

/** Devuelve la foto actual del producto, o responde 404 si no existe en esa tienda. */
function fotoActual(PDO $pdo, int $productoId, int $tiendaId): ?string
{
    $stmt = $pdo->prepare('SELECT foto FROM productos WHERE id = ? AND tienda_id = ?');
    $stmt->execute([$productoId, $tiendaId]);
    $fila = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$fila) {
        responder(404, ['success' => false, 'message' => 'El producto no existe en esta tienda']);
    }
    return $fila['foto'];
}

function borrarArchivo(?string $ruta): void
{
    // Solo se borran archivos de la carpeta de fotos (nunca una ruta arbitraria).
    if ($ruta && str_starts_with($ruta, CARPETA . '/') && is_file(__DIR__ . '/' . $ruta)) {
        unlink(__DIR__ . '/' . $ruta);
    }
}

$method = $_SERVER['REQUEST_METHOD'];

// Subir o reemplazar la foto: { tienda_id, producto_id, imagen: "<base64>" }
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $tiendaId = requerirTiendaId($body);
    $productoId = (int) ($body['producto_id'] ?? 0);
    $base64 = (string) ($body['imagen'] ?? '');

    if ($productoId <= 0 || $base64 === '') {
        responder(400, ['success' => false, 'message' => 'Faltan el producto o la imagen']);
    }

    // Acepta tanto "data:image/jpeg;base64,..." como el base64 solo.
    $base64 = preg_replace('/^data:image\/[a-z]+;base64,/', '', $base64);
    $bytes = base64_decode($base64, true);
    if ($bytes === false) {
        responder(400, ['success' => false, 'message' => 'La imagen no es válida']);
    }
    if (strlen($bytes) > MAX_BYTES) {
        responder(413, ['success' => false, 'message' => 'La imagen pesa más de 3 MB']);
    }

    // Se revisa el contenido real del archivo, no lo que diga el cliente.
    $info = @getimagesizefromstring($bytes);
    if (!$info || !isset(TIPOS[$info['mime']])) {
        responder(415, ['success' => false, 'message' => 'Formato no permitido (usa JPG, PNG o WEBP)']);
    }

    $anterior = fotoActual($pdo, $productoId, $tiendaId);

    if (!is_dir(__DIR__ . '/' . CARPETA)) {
        mkdir(__DIR__ . '/' . CARPETA, 0755, true);
    }
    $ruta = CARPETA . "/{$tiendaId}_{$productoId}_" . time() . '.' . TIPOS[$info['mime']];
    file_put_contents(__DIR__ . '/' . $ruta, $bytes);

    $pdo->prepare('UPDATE productos SET foto = ? WHERE id = ? AND tienda_id = ?')->execute([$ruta, $productoId, $tiendaId]);
    borrarArchivo($anterior);

    responder(201, ['success' => true, 'message' => 'Foto guardada', 'foto' => $ruta]);
}

// Quitar la foto: ?producto_id=…&tienda_id=…
if ($method === 'DELETE') {
    $tiendaId = requerirTiendaId();
    $productoId = (int) ($_GET['producto_id'] ?? 0);
    if ($productoId <= 0) {
        responder(400, ['success' => false, 'message' => 'Falta el producto']);
    }

    borrarArchivo(fotoActual($pdo, $productoId, $tiendaId));
    $pdo->prepare('UPDATE productos SET foto = NULL WHERE id = ? AND tienda_id = ?')->execute([$productoId, $tiendaId]);

    responder(200, ['success' => true, 'message' => 'Foto eliminada']);
}

responder(405, ['success' => false, 'message' => 'Método no permitido']);
