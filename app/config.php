<?php
declare(strict_types=1);
date_default_timezone_set('America/Santiago');

/* Dominios permitidos (agrega tu dominio productivo) */
const ALLOWED_HOSTS = [
  'localhost','127.0.0.1','::1',
  'tu-dominio.cl','www.tu-dominio.cl'
];

/* Rutas privadas */
define('APP_DIR', __DIR__);
define('STORAGE_DIR', APP_DIR . '/storage');
define('LOG_DIR', STORAGE_DIR . '/logs');

/* Helpers de seguridad */
function host_ok(?string $h): bool {
  if (!$h) return true;
  $host = strtolower(parse_url($h, PHP_URL_HOST) ?: $h);
  return in_array($host, array_map('strtolower', ALLOWED_HOSTS), true);
}
function enforce_same_origin(): void {
  $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
  $okHost = in_array($host, array_map('strtolower', ALLOWED_HOSTS), true);
  $ok = $okHost && host_ok($_SERVER['HTTP_ORIGIN'] ?? null) && host_ok($_SERVER['HTTP_REFERER'] ?? null);
  if (!$ok) { http_response_code(403); header('Content-Type: text/plain; charset=utf-8'); echo "Forbidden"; exit; }
}

/* Asegurar carpetas */
if (!is_dir(STORAGE_DIR)) @mkdir(STORAGE_DIR, 0775, true);
if (!is_dir(LOG_DIR))     @mkdir(LOG_DIR, 0775, true);
