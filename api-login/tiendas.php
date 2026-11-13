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

function generarCodigoInvitacion(PDO $pdo): string {
    $caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusiones
    do {
        $codigo = '';
        for ($i = 0; $i < 6; $i++) {
            $codigo .= $caracteres[random_int(0, strlen($caracteres) - 1)];
        }
        $existe = $pdo->prepare('SELECT id FROM tiendas WHERE codigo_invitacion = ?');
        $existe->execute([$codigo]);
    } while ($existe->fetch());

    return $codigo;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $usuario_id = (int) ($_GET['usuario_id'] ?? 0);

    if ($usuario_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Falta el usuario_id']);
        exit;
    }

    $stmt = $pdo->prepare(
        'SELECT t.id, t.nombre, t.codigo_invitacion, t.dueno_id, t.latitud, t.longitud, tm.rol, tm.estado
         FROM tienda_miembros tm
         JOIN tiendas t ON t.id = tm.tienda_id
         WHERE tm.usuario_id = ?
         ORDER BY t.nombre ASC'
    );
    $stmt->execute([$usuario_id]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $accion = $body['accion'] ?? 'crear';
    $usuario_id = (int) ($body['usuario_id'] ?? 0);

    if ($usuario_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Falta el usuario_id']);
        exit;
    }

    if ($accion === 'crear') {
        $nombre = trim($body['nombre'] ?? '');

        if ($nombre === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'El nombre de la tienda es obligatorio']);
            exit;
        }

        $codigo = generarCodigoInvitacion($pdo);

        $pdo->beginTransaction();
        try {
            $pdo->prepare('INSERT INTO tiendas (nombre, codigo_invitacion, dueno_id) VALUES (?, ?, ?)')
                ->execute([$nombre, $codigo, $usuario_id]);
            $tienda_id = (int) $pdo->lastInsertId();

            $pdo->prepare(
                "INSERT INTO tienda_miembros (tienda_id, usuario_id, rol, estado) VALUES (?, ?, 'admin', 'aceptado')"
            )->execute([$tienda_id, $usuario_id]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'No se pudo crear la tienda']);
            exit;
        }

        http_response_code(201);
        echo json_encode(['success' => true, 'message' => 'Tienda creada', 'tienda_id' => $tienda_id, 'codigo_invitacion' => $codigo]);
        exit;
    }

    if ($accion === 'unirse') {
        $codigo = strtoupper(trim($body['codigo_invitacion'] ?? ''));

        if ($codigo === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Ingresá un código de invitación']);
            exit;
        }

        $tienda = $pdo->prepare('SELECT id, nombre FROM tiendas WHERE codigo_invitacion = ?');
        $tienda->execute([$codigo]);
        $tienda = $tienda->fetch(PDO::FETCH_ASSOC);

        if (!$tienda) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'No existe ninguna tienda con ese código']);
            exit;
        }

        $existente = $pdo->prepare('SELECT id, estado FROM tienda_miembros WHERE tienda_id = ? AND usuario_id = ?');
        $existente->execute([$tienda['id'], $usuario_id]);
        $existente = $existente->fetch(PDO::FETCH_ASSOC);

        if ($existente) {
            http_response_code(409);
            $mensaje = $existente['estado'] === 'pendiente'
                ? 'Ya tenés una solicitud pendiente para esta tienda'
                : 'Ya sos miembro de esta tienda';
            echo json_encode(['success' => false, 'message' => $mensaje]);
            exit;
        }

        $pdo->prepare(
            "INSERT INTO tienda_miembros (tienda_id, usuario_id, rol, estado) VALUES (?, ?, 'lector', 'pendiente')"
        )->execute([$tienda['id'], $usuario_id]);

        http_response_code(201);
        echo json_encode(['success' => true, 'message' => "Solicitud enviada a \"{$tienda['nombre']}\". Un administrador debe aprobarte."]);
        exit;
    }

    // Guardar la ubicación de la tienda: { accion: "ubicacion", usuario_id, tienda_id, latitud, longitud }
    if ($accion === 'ubicacion') {
        $tienda_id = (int) ($body['tienda_id'] ?? 0);
        $latitud = $body['latitud'] ?? null;
        $longitud = $body['longitud'] ?? null;

        if ($tienda_id <= 0 || !is_numeric($latitud) || !is_numeric($longitud)
            || $latitud < -90 || $latitud > 90 || $longitud < -180 || $longitud > 180) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Ubicación inválida']);
            exit;
        }

        $admin = $pdo->prepare(
            "SELECT 1 FROM tienda_miembros WHERE tienda_id = ? AND usuario_id = ? AND rol = 'admin' AND estado = 'aceptado'"
        );
        $admin->execute([$tienda_id, $usuario_id]);
        if (!$admin->fetchColumn()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Solo un administrador puede cambiar la ubicación de la tienda']);
            exit;
        }

        $pdo->prepare('UPDATE tiendas SET latitud = ?, longitud = ? WHERE id = ?')
            ->execute([round((float) $latitud, 7), round((float) $longitud, 7), $tienda_id]);
        echo json_encode(['success' => true, 'message' => 'Ubicación de la tienda guardada']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Acción no reconocida']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Método no permitido']);
