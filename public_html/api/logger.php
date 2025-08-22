<?php
declare(strict_types=1);
require dirname(__DIR__, 2) . '/app/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
enforce_same_origin();

header('Content-Type: application/json; charset=utf-8');
function v(array $a,string $k,string $d=''){ return isset($a[$k]) ? trim((string)$a[$k]) : $d; }
function clean(string $s){ return trim(str_replace(["\r","\n","\t"], ' ', $s)); }

$raw = file_get_contents('php://input') ?: '';
$payload = $raw ? json_decode($raw, true) : [];
if (!is_array($payload)) $payload = [];

$ip   = $_SERVER['REMOTE_ADDR'] ?? '-';
$ua   = $_SERVER['HTTP_USER_AGENT'] ?? '-';
$ref  = $_SERVER['HTTP_REFERER'] ?? '-';
$now  = date('Y-m-d H:i:s');

$type    = v($payload,'type','event');
$codigo  = v($payload,'codigo');
$carta   = v($payload,'carta');
$set     = v($payload,'set');
$dest    = v($payload,'dest');
$path    = v($payload,'path', $_SERVER['REQUEST_URI'] ?? '-');
$device   = v($payload,'device'); $brand=v($payload,'brand'); $model=v($payload,'model');
$os       = v($payload,'os');     $browser=v($payload,'browser'); $viewport=v($payload,'viewport');

$DELIM  = "\t";
$HEADER = "FechaHora\tTipo\tdispositivo\tIP\tPath\tCodigo\tCarta\tSet\tDestino\tReferer\tUserAgent\tDevice\tBrand\tModel\tOS\tBrowser\tViewport";
$file   = LOG_DIR . '/log_' . date('Y-m-d') . '.tsv';

if (!file_exists($file) || filesize($file) === 0) {
  if (@file_put_contents($file, "\xEF\xBB\xBF".$HEADER.PHP_EOL, LOCK_EX) === false) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'No se pudo crear log']); exit; }
}

$disp = (preg_match('/Mobi|Android|iPhone|iPad|iPod/i',$ua)) ? 'smartphone' :
        ((preg_match('/WINDOWS NT|MACINTOSH|X11; LINUX/i',$ua) && !preg_match('/Mobi/i',$ua)) ? 'pc' : 'otros');

$fields = [$now,$type,$disp,clean($ip),clean($path),clean($codigo),clean($carta),clean($set),clean($dest),clean($ref),clean($ua),clean($device),clean($brand),clean($model),clean($os),clean($browser),clean($viewport)];
$ok = (bool) @file_put_contents($file, implode($DELIM,$fields).PHP_EOL, FILE_APPEND|LOCK_EX);

echo json_encode($ok ? ['ok'=>true,'file'=>basename($file)] : ['ok'=>false,'error'=>'No se pudo escribir']);
