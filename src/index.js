const GAFIW_API = "https://gafiwshop.xyz/api/api_product";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "IDMart GAFIWSHOP Proxy"
      });
    }

    // API สินค้า
    if (url.pathname === "/api/gafiw-products") {
      return await getGafiwProducts(request, ctx);
    }

    return Response.json(
      {
        ok: false,
        message: "IDMart GAFIWSHOP Proxy"
      },
      { status: 404 }
    );
  }
};

async function getGafiwProducts(request, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(
    "https://idmart-gafiw-products-cache.local/api/products"
  );

  // ใช้ cache ก่อน เพื่อลดจำนวนครั้งที่ยิงไป GAFIWSHOP
  const cached = await cache.match(cacheKey);

  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set("X-IDMart-Proxy", "CACHE");
    return response;
  }

  try {
    const upstream = await fetch(GAFIW_API, {
      method: "GET",
      redirect: "follow",
      headers: {
        "Accept": "application/json",
        "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
        "User-Agent": "IDMart-GAFIWSHOP-Proxy/1.0"
      }
    });

    const body = await upstream.text();

    // ถ้าต้นทางตอบ 403 ให้ส่งรายละเอียดกลับมา
    if (!upstream.ok) {
      return Response.json(
        {
          ok: false,
          error: "GAFIWSHOP_HTTP_ERROR",
          status: upstream.status,
          body: body.substring(0, 500)
        },
        { status: 502 }
      );
    }

    let data;

    try {
      data = JSON.parse(body);
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: "GAFIWSHOP_NOT_JSON",
          body: body.substring(0, 500)
        },
        { status: 502 }
      );
    }

    if (
      data.ok !== true ||
      !Array.isArray(data.data)
    ) {
      return Response.json(
        {
          ok: false,
          error: "INVALID_GAFIWSHOP_RESPONSE"
        },
        { status: 502 }
      );
    }

    const response = new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Cache-Control": "public, max-age=60",
          "Access-Control-Allow-Origin": "*",
          "X-IDMart-Proxy": "ORIGIN"
        }
      }
    );

    // เก็บข้อมูลสินค้าไว้ 60 วินาที
    ctx.waitUntil(
      cache.put(
        cacheKey,
        response.clone()
      )
    );

    return response;

  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "PROXY_ERROR",
        message: error?.message || "Unknown error"
      },
      { status: 502 }
    );
  }
}
