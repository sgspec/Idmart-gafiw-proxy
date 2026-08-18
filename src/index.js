addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const targetBase = 'https://gafiwshop.xyz'

  if (url.pathname === '/' || url.pathname === '') {
    return new Response(JSON.stringify({
      ok: true,
      service: 'GAFIWSHOP Worker Proxy Pro',
      version: '2.1.0',
      message: 'Worker is running smoothly'
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    })
  }

  const targetUrl = targetBase + url.pathname + url.search
  const clientApiKey = request.headers.get('X-GAFIW-API-KEY') || ''

  // ชุด Header จำลอง Browser ระดับสูง
  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://gafiwshop.xyz/',
    'Origin': 'https://gafiwshop.xyz',
    'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive'
  }

  if (clientApiKey) {
    customHeaders['Authorization'] = 'Bearer ' + clientApiKey
    customHeaders['X-API-Key'] = clientApiKey
  }

  try {
    const apiResponse = await fetch(targetUrl, {
      method: request.method,
      headers: customHeaders,
      redirect: 'follow'
    })

    const responseBody = await apiResponse.text()

    // ตรวจสอบว่ายังติดหน้า Cloudflare Challenge อยู่หรือไม่
    if (responseBody.includes('Just a moment') || responseBody.includes('cf-browser-verification')) {
      return new Response(JSON.stringify({
        status: 'error',
        message: 'GAFIWSHOP ป้องกันบอทแน่นหนาเกินไป (Cloudflare Challenge Blocked)',
        _http_code: 403,
        _raw: 'Just a moment... Bot protection triggered.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
      })
    }

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
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
