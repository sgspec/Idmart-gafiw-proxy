addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // กำหนด URL ปลายทางของ Gafiwshop (เปลี่ยนลิงก์นี้ถ้าโดนเปลี่ยนโดเมน)
  const targetBase = 'https://gafiwshop.xyz'

  // ถ้าเข้าหน้าแรกสุดของ Worker ให้แสดงสถานะ Health check แบบ JSON กลับไป
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(JSON.stringify({
      ok: true,
      service: 'GAFIWSHOP Worker Proxy',
      version: '2.0.0',
      message: 'Worker is running successfully'
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    })
  }

  // ประกอบร่าง URL ปลายทางที่ต้องการดึงข้อมูล
  const targetUrl = targetBase + url.pathname + url.search

  // ดึง API Key จาก Header ที่ส่งมาจาก WordPress (ถ้ามี)
  const clientApiKey = request.headers.get('X-GAFIW-API-KEY') || ''

  // สร้าง Header ปลอมตัวเป็น Browser จริง ๆ เพื่อหลบเลี่ยงการบล็อก Bot
  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://gafiwshop.xyz/',
    'Origin': 'https://gafiwshop.xyz',
    'Cache-Control': 'no-cache'
  }

  // ถ้ามีการส่ง API Key มาจากฝั่งเรา ให้แนบส่งต่อไปยังเว็บปลายทางด้วย
  if (clientApiKey) {
    customHeaders['Authorization'] = 'Bearer ' + clientApiKey
    customHeaders['X-API-Key'] = clientApiKey
  }

  try {
    // ส่ง Request ไปยังเว็บปลายทาง
    const apiResponse = await fetch(targetUrl, {
      method: request.method,
      headers: customHeaders,
      body: ['GET', 'HEAD'].includes(request.method) ? null : await request.text(),
      redirect: 'follow'
    })

    const responseBody = await apiResponse.text()

    // ส่งข้อมูลกลับไปหา WordPress (พร้อมรักษา Status Code เดิม)
    return new Response(responseBody, {
      status: apiResponse.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (err) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'Worker fetch error: ' + err.message,
      _http_code: 500
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    })
  }
}
