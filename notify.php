<?php
// ===== CONFIG (sirf yahin bharna) =====
$BOT_TOKEN = "8579632854:AAH6a5hT2qpx47NkFQUt8EXuVgLMDqwBoAU";
$CHAT_ID   = "6528342007";
// ======================================

date_default_timezone_set("Asia/Kolkata");
header("Content-Type: text/plain; charset=utf-8");

// Spam rok: 10 second mein ek hi notification
$f = sys_get_temp_dir() . "/notify_last";
if (file_exists($f) && time() - filemtime($f) < 10) exit("Wait a few seconds");
touch($f);

$msg  = trim(strip_tags($_GET["msg"] ?? ""));
$text = ($msg !== "" ? mb_substr($msg, 0, 200) : "Someone is asking you to come online on Baatify")
      . "\n" . date("d M Y, h:i A");

function tg($token, $chat, $text, $ip = null) {
  $ch = curl_init("https://api.telegram.org/bot" . $token . "/sendMessage");
  $o = [
    CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12,
    CURLOPT_POSTFIELDS => ["chat_id" => $chat, "text" => $text],
  ];
  if ($ip) $o[CURLOPT_RESOLVE] = ["api.telegram.org:443:" . $ip];   // DNS bypass
  curl_setopt_array($ch, $o);
  $raw = curl_exec($ch); $err = curl_error($ch); curl_close($ch);
  return [$raw, $err];
}

[$raw, $err] = tg($BOT_TOKEN, $CHAT_ID, $text);
if ($raw === false) {                                   // pehla tareeka fail to IP se try karo
  [$raw, $err2] = tg($BOT_TOKEN, $CHAT_ID, $text, "149.154.167.220");
  if ($raw === false) $err = $err2;
}

if ($raw === false) { @unlink($f); exit("FAILED (network): " . $err); }
$res = json_decode($raw, true);
if (!empty($res["ok"])) exit("Sent ✓");
@unlink($f);
exit("FAILED (telegram): " . ($res["description"] ?? "unknown"));