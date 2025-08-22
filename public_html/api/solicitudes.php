<?php
declare(strict_types=1);
require dirname(__DIR__, 2) . '/app/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
enforce_same_origin();

header('Content-Type: application/json; charset=utf-8');
function clean(string $s){ return trim(str_replace(["\r","\n","\t"], ' ', $s)); }

$raw = file_get_contents('php://input') ?: '';
$in  = $raw ? json_decode($raw, true) : [];
if (!is_array($in)) $in = [];

$nombre   = clean((string)($in['nombre']   ?? ''));
$pais     = clean((string)($in['pais']     ?? ''));
$ciudad   = clean((string)($in['ciudad']   ?? ''));
$telefono = clean((string)($in['telefono'] ?? ''));
$carta    = clean((string)($in['carta']    ?? ''));

if ($nombre==='' || $pais==='' || $ciudad==='' || $telefono==='' || $carta==='') {
  http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Campos incompletos']); exit;
}

$file   = LOG_DIR . '/solicitudes_' . date('Y-m-d') . '.tsv';
$DELIM  = "\t";
$HEADER = "FechaHora\tNombre\tPais\tCiudad\tTelefono\tCarta\tIP\tUserAgent";

if (!file_exists($file) || filesize($file) === 0) {
  if (@file_put_contents($file, "\xEF\xBB\xBF".$HEADER.PHP_EOL, LOCK_EX) === false) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'No se pudo crear log']); exit; }
}

$line = implode($DELIM, [
  date('Y-m-d H:i:s'),
  $nombre,$pais,$ciudad,$telefono,$carta,
  ($_SERVER['REMOTE_ADDR'] ?? '-'),
  ($_SERVER['HTTP_USER_AGENT'] ?? '-')
]) . PHP_EOL;

$ok = (bool) @file_put_contents($file, $line, FILE_APPEND|LOCK_EX);
echo json_encode($ok ? ['ok'=>true,'file'=>basename($file)] : ['ok'=>false,'error'=>'No se pudo escribir']);
