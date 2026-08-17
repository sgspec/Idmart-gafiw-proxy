<?php
/**
 * check_money_debug.php
 * -------------------------------------------------------------
 * สคริปต์ทดสอบเดี่ยว (ไม่ต้องพึ่ง WordPress / Worker)
 * ใช้เช็คว่าถ้ายิง POST ไปที่ gafiwshop.xyz/api/api_money
 * "ตรงจาก Server ของคุณเอง" (ไม่ผ่าน Cloudflare Worker)
 * จะโดนบล็อก (403 / Cloudflare challenge) เหมือนตอนยิงผ่าน
 * Worker หรือไม่
 *
 * วิธีใช้:
 * 1) อัปโหลดไฟล์นี้ไปไว้ที่ root ของเว็บ (หรือโฟลเดอร์ใดก็ได้ที่เข้าถึงผ่านเบราว์เซอร์ได้)
 * 2) เปิดผ่านเบราว์เซอร์ เช่น https://yourdomain.com/check_money_debug.php
 * 3) ดูผลลัพธ์ที่แสดง — จะบอก HTTP code, เนื้อหาที่ตอบกลับ,
 *    และสรุปว่าถูกบล็อกโดย Cloudflare challenge หรือไม่
 *
 * *** ลบไฟล์นี้ทิ้งหลังใช้งานเสร็จ เพราะมี API key ฝังอยู่ ***
 * -------------------------------------------------------------
 */

// ตั้ง Key ตรงนี้ (จาก api_gafiwshop.txt)
$keyapi = 'DjwrnztxXtA11kdRZZAe';

$targetUrl = 'https://gafiwshop.xyz/api/api_money';

header('Content-Type: text/html; charset=utf-8');

function h($s) {
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

function run_test($label, $url, $method, $keyapi) {
    $ch = curl_init();

    $headers = [
        'Accept: application/json, text/plain, */*',
    ];

    $opts = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true, // เอา response header มาด้วย เพื่อดู server/cf-ray ฯลฯ
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER => $headers,
    ];

    if ($method === 'POST') {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = http_build_query(['keyapi' => $keyapi]);
        $opts[CURLOPT_HTTPHEADER][] = 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8';
    }

    curl_setopt_array($ch, $opts);

    $start = microtime(true);
    $raw = curl_exec($ch);
    $elapsed = round((microtime(true) - $start) * 1000);

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $err = curl_error($ch);
    $errno = curl_errno($ch);

    curl_close($ch);

    $respHeaders = '';
    $respBody = '';

    if ($raw !== false) {
        $respHeaders = substr($raw, 0, $headerSize);
        $respBody = substr($raw, $headerSize);
    }

    // เดาว่าเจอ Cloudflare challenge หรือไม่
    $looksLikeChallenge = (
        stripos($respBody, 'Just a moment') !== false ||
        stripos($respBody, 'Enable JavaScript and cookies') !== false ||
        stripos($respBody, 'cf-browser-verification') !== false ||
        stripos($respHeaders, 'cf-mitigated') !== false
    );

    $isJson = false;
    $decoded = null;
    if (trim($respBody) !== '') {
        $decoded = json_decode($respBody, true);
        $isJson = (json_last_error() === JSON_ERROR_NONE);
    }

    echo '<div style="margin:18px 0;padding:16px;border:1px solid #ddd;border-radius:10px;background:#fafafa;">';
    echo '<h3 style="margin:0 0 10px;">' . h($label) . '</h3>';

    echo '<table style="border-collapse:collapse;width:100%;font-size:14px;">';

    $row = function ($k, $v) {
        echo '<tr><td style="padding:4px 10px 4px 0;color:#555;white-space:nowrap;vertical-align:top;"><strong>' . h($k) . '</strong></td><td style="padding:4px 0;word-break:break-all;">' . $v . '</td></tr>';
    };

    $row('URL', h($url));
    $row('Method', h($method));
    $row('HTTP Code', '<span style="font-weight:700;color:' . ($httpCode >= 200 && $httpCode < 300 ? '#008a20' : '#b32d2e') . ';">' . h($httpCode) . '</span>');
    $row('เวลาที่ใช้', h($elapsed) . ' ms');
    $row('Content-Type', h($contentType));

    if ($errno) {
        $row('cURL Error', '<span style="color:#b32d2e;">[' . h($errno) . '] ' . h($err) . '</span>');
    }

    $row('รูปแบบ Response', $isJson ? '<span style="color:#008a20;">JSON ถูกต้อง</span>' : '<span style="color:#b32d2e;">ไม่ใช่ JSON</span>');

    if ($looksLikeChallenge) {
        $row('สรุปผล', '<span style="color:#b32d2e;font-weight:700;">🚫 โดนบล็อกด้วย Cloudflare Challenge (Just a moment...)</span>');
    } elseif ($httpCode === 403) {
        $row('สรุปผล', '<span style="color:#b32d2e;font-weight:700;">🚫 โดนปฏิเสธ HTTP 403 (ไม่ใช่หน้า challenge แต่ก็ถูกบล็อก)</span>');
    } elseif ($isJson && $httpCode >= 200 && $httpCode < 300) {
        $row('สรุปผล', '<span style="color:#008a20;font-weight:700;">✅ เรียกสำเร็จ ไม่โดนบล็อก</span>');
    } else {
        $row('สรุปผล', '<span style="color:#b45309;font-weight:700;">⚠️ ไม่ใช่ทั้ง success ปกติและไม่ใช่ challenge — ดู raw body ด้านล่าง</span>');
    }

    echo '</table>';

    if ($isJson) {
        echo '<p style="margin-top:10px;"><strong>JSON Response:</strong></p>';
        echo '<pre style="white-space:pre-wrap;background:#fff;border:1px solid #eee;border-radius:6px;padding:10px;max-height:300px;overflow:auto;">' . h(json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) . '</pre>';
    } else {
        $shortBody = trim(strip_tags($respBody));
        $shortBody = preg_replace('/\s+/', ' ', $shortBody);
        $shortBody = mb_substr($shortBody, 0, 800);
        echo '<p style="margin-top:10px;"><strong>Body (ตัดข้อความ HTML แล้ว):</strong></p>';
        echo '<pre style="white-space:pre-wrap;background:#fff;border:1px solid #eee;border-radius:6px;padding:10px;max-height:300px;overflow:auto;">' . h($shortBody ?: '(ว่างเปล่า)') . '</pre>';
    }

    echo '<details style="margin-top:10px;"><summary style="cursor:pointer;color:#555;">ดู Response Headers ดิบ</summary>';
    echo '<pre style="white-space:pre-wrap;background:#fff;border:1px solid #eee;border-radius:6px;padding:10px;max-height:200px;overflow:auto;">' . h($respHeaders) . '</pre>';
    echo '</details>';

    echo '</div>';

    return [
        'http_code' => $httpCode,
        'blocked' => $looksLikeChallenge || $httpCode === 403,
        'json' => $isJson,
    ];
}

?>
<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ทดสอบเรียก GAFIWSHOP api_money ตรงจาก Server</title>
<style>
body{font-family:-apple-system,system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px;color:#111827;}
.container{max-width:800px;margin:0 auto;}
h1{font-size:1.4rem;}
.warn{background:#fff7ed;border:1px solid #fdba74;color:#9a3412;padding:12px 14px;border-radius:10px;margin-bottom:18px;font-size:14px;}
</style>
</head>
<body>
<div class="container">
    <h1>ทดสอบเรียก GAFIWSHOP <code>api_money</code> ตรงจาก Server (ไม่ผ่าน Worker)</h1>

    <div class="warn">
        ⚠️ สคริปต์นี้มี API key ฝังอยู่ในไฟล์ — ใช้ทดสอบเสร็จแล้ว
        <strong>กรุณาลบไฟล์นี้ออกจาก Server ทันที</strong>
        เพื่อความปลอดภัย ไม่ควรเก็บไว้ถาวร
    </div>

    <?php
    // ทดสอบ POST (ตามที่ api_gafiwshop.txt ระบุว่า api_money เป็น POST)
    run_test('เทส 1: POST https://gafiwshop.xyz/api/api_money (keyapi ใน body)', $targetUrl, 'POST', $keyapi);

    // ทดสอบ GET เผื่อ endpoint รองรับทั้งสองแบบ (บาง API บางเวอร์ชันอาจรับ GET ด้วย)
    $getUrl = $targetUrl . '?' . http_build_query(['keyapi' => $keyapi]);
    run_test('เทส 2: GET https://gafiwshop.xyz/api/api_money?keyapi=... (เผื่อ endpoint รองรับ GET)', $getUrl, 'GET', $keyapi);
    ?>

    <p style="color:#6b7280;font-size:13px;margin-top:20px;">
        เซิร์ฟเวอร์นี้: <?php echo h($_SERVER['SERVER_ADDR'] ?? 'ไม่ทราบ IP'); ?>
        &middot; เวลาที่ทดสอบ: <?php echo h(date('Y-m-d H:i:s')); ?>
    </p>
</div>
</body>
</html>
