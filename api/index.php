<?php
// API del menú de Casa Nápoles para cPanel.
//   GET  index.php?accion=menu     -> menú completo (público)
//   POST index.php?accion=login    -> { password } => { token }
//   POST index.php?accion=guardar  -> guarda el menú completo (requiere token)
//   POST index.php?accion=subir    -> sube una imagen, campo "imagen" (requiere token)
// La configuración (clave y secreto) vive en config.php, que genera scripts/crear-config.mjs.

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

if (!is_file(__DIR__ . '/config.php')) {
    responder(500, ['error' => 'Falta api/config.php. Genéralo con: npm run clave']);
}
require __DIR__ . '/config.php';

const DIR_DATOS = __DIR__ . '/datos';
const ARCHIVO_MENU = DIR_DATOS . '/menu.json';
const DIR_IMAGENES = __DIR__ . '/../uploads';
const MAX_BYTES = 6 * 1024 * 1024;
const TIPOS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

$accion = $_GET['accion'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    match (true) {
        $accion === 'menu' && $metodo === 'GET' => responder(200, leerMenu()),
        $accion === 'login' && $metodo === 'POST' => login(),
        $accion === 'guardar' && $metodo === 'POST' => guardar(),
        $accion === 'subir' && $metodo === 'POST' => subir(),
        default => responder(404, ['error' => 'Acción no encontrada']),
    };
} catch (Throwable $e) {
    error_log('[menu-api] ' . $e->getMessage());
    responder(500, ['error' => 'Error del servidor. Revisa el registro de errores de cPanel.']);
}

function responder(int $codigo, array $datos): never
{
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function leerMenu(): array
{
    if (!is_file(ARCHIVO_MENU)) {
        // Primera vez en el servidor: se parte de la semilla generada desde el md.
        if (!is_dir(DIR_DATOS)) mkdir(DIR_DATOS, 0755, true);
        copy(__DIR__ . '/semilla.json', ARCHIVO_MENU);
    }
    return json_decode((string) file_get_contents(ARCHIVO_MENU), true, 512, JSON_THROW_ON_ERROR);
}

function login(): never
{
    $cuerpo = json_decode((string) file_get_contents('php://input'), true) ?: [];
    $clave = (string) ($cuerpo['password'] ?? '');
    // Pausa corta para frenar intentos repetidos de adivinar la clave.
    usleep(400000);
    if ($clave === '' || !hash_equals(CLAVE_HASH, hash('sha256', CLAVE_SAL . $clave))) {
        responder(401, ['error' => 'Contraseña incorrecta']);
    }
    $vence = time() + 60 * 60 * 12;
    responder(200, ['token' => $vence . '.' . hash_hmac('sha256', (string) $vence, SECRETO), 'vence' => $vence]);
}

function exigirToken(): void
{
    $cabecera = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $token = str_starts_with($cabecera, 'Bearer ') ? substr($cabecera, 7) : ($_SERVER['HTTP_X_TOKEN'] ?? '');
    [$vence, $firma] = array_pad(explode('.', $token, 2), 2, '');
    $valido = ctype_digit($vence)
        && (int) $vence > time()
        && hash_equals(hash_hmac('sha256', $vence, SECRETO), $firma);
    if (!$valido) responder(401, ['error' => 'Tu sesión venció. Vuelve a entrar.']);
}

function guardar(): never
{
    exigirToken();
    $menu = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($menu) || !isset($menu['categorias'], $menu['productos']) || !is_array($menu['productos'])) {
        responder(400, ['error' => 'El menú recibido no tiene categorías y productos.']);
    }
    $menu['actualizado'] = gmdate('c');
    if (!is_dir(DIR_DATOS)) mkdir(DIR_DATOS, 0755, true);

    // Respaldo del menú anterior; se conservan los 20 más recientes.
    if (is_file(ARCHIVO_MENU)) {
        copy(ARCHIVO_MENU, DIR_DATOS . '/respaldo-' . date('Ymd-His') . '.json');
        $respaldos = glob(DIR_DATOS . '/respaldo-*.json') ?: [];
        sort($respaldos);
        foreach (array_slice($respaldos, 0, max(0, count($respaldos) - 20)) as $viejo) unlink($viejo);
    }
    $json = json_encode($menu, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    file_put_contents(ARCHIVO_MENU, $json, LOCK_EX);
    responder(200, ['ok' => true, 'actualizado' => $menu['actualizado']]);
}

function subir(): never
{
    exigirToken();
    $archivo = $_FILES['imagen'] ?? null;
    if (!$archivo || $archivo['error'] !== UPLOAD_ERR_OK) {
        $limite = $archivo && in_array($archivo['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
        responder(400, ['error' => $limite ? 'La imagen pesa más de lo que permite el hosting.' : 'No llegó ninguna imagen.']);
    }
    if ($archivo['size'] > MAX_BYTES) responder(400, ['error' => 'La imagen pesa más de 6 MB.']);

    $tipo = (new finfo(FILEINFO_MIME_TYPE))->file($archivo['tmp_name']);
    if (!isset(TIPOS[$tipo]) || @getimagesize($archivo['tmp_name']) === false) {
        responder(400, ['error' => 'Solo se aceptan imágenes JPG, PNG o WEBP.']);
    }
    if (!is_dir(DIR_IMAGENES)) mkdir(DIR_IMAGENES, 0755, true);
    $nombre = date('Ymd') . '-' . bin2hex(random_bytes(8)) . '.' . TIPOS[$tipo];
    if (!move_uploaded_file($archivo['tmp_name'], DIR_IMAGENES . '/' . $nombre)) {
        responder(500, ['error' => 'No se pudo guardar la imagen en el servidor.']);
    }
    responder(200, ['url' => 'uploads/' . $nombre]);
}
