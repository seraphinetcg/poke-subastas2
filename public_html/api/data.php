<?php
declare(strict_types=1);
require dirname(__DIR__, 2) . '/app/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }
enforce_same_origin();

header('Content-Type: text/plain; charset=utf-8');

$file = STORAGE_DIR . '/subastas.txt';
if (!is_file($file)) { http_response_code(404); echo "NO_SUBASTAS_TXT"; exit; }

$h = fopen($file, 'rb'); if (!$h) { http_response_code(500); echo "READ_ERROR"; exit; }
fpassthru($h); fclose($h);

