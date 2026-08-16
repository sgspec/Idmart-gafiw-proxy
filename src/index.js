const GAFIW_API = "https://gafiwshop.xyz/api/api_product";

const PRODUCT_KEY = "gafiw_products";
const PRODUCT_TTL = 300; // 5 นาที

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --------------------------------------------------
    // Health check
    // --------------------------------------------------
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "IDMart GAFIWSHOP Proxy",
        version: "0.4.0"
      });
    }

    // --------------------------------------------------
    // อ่านสินค้า
    // WordPress ใช้ endpoint นี้
    // --------------------------------------------------
    if (
      url.pathname === "/api/gafiw-products" &&
      request.method === "GET"
    ) {
      return await getProducts(env, ctx);
    }

    // --------------------------------------------------
    // สั่ง Refresh สินค้าจาก GAFIWSHOP
    // ใช้ POST เท่านั้น
    // --------------------------------------------------
    if (
      url.pathname === "/api/gafiw-refresh" &&
      request.method === "POST"
    ) {
      return await refreshProducts(request, env);
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


// ======================================================
// GET PRODUCTS
// ======================================================

async function getProducts(env, ctx) {

  // ------------------------------------------
  // 1. ถ้ามี KV ให้ใช้ KV ก่อน
  // ------------------------------------------
  if (env.GAFIW_PRODUCTS) {

    try {

      const stored = await env.GAFIW_PRODUCTS.get(
        PRODUCT_KEY,
        "json"
      );

      if (stored && stored.ok === true && Array.isArray(stored.data)) {

        return jsonResponse({
          ...stored,
          source: "KV"
        });

      }

    } catch (error) {

      console.error(
        "KV read error:",
        error?.message || error
      );

    }
  }


  // ------------------------------------------
  // 2. ถ้ายังไม่มี KV
  // ใช้ Cache API เป็น fallback
  // ------------------------------------------

  const cache = caches.default;

  const cacheKey = new Request(
    "https://idmart-gafiw-products-cache.local/products"
  );

  const cached = await cache.match(cacheKey);

  if (cached) {

    const body = await cached.text();

    try {

      const data = JSON.parse(body);

      return jsonResponse({
        ...data,
        source: "CACHE"
      });

    } catch {
      // cache เสีย ให้ไป origin
    }
  }


  // ------------------------------------------
  // 3. ยังไม่มีข้อมูล
  // ดึงจาก GAFIWSHOP
  // ------------------------------------------

  const result = await fetchGafiwProducts();

  if (!result.ok) {

    return jsonResponse(
      result,
      502
    );
  }


  // ------------------------------------------
  // 4. เก็บ Cache
  // ------------------------------------------

  const responseBody = JSON.stringify(result);

  const response = new Response(
    responseBody,
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",
        "Cache-Control":
          `public, max-age=${PRODUCT_TTL}`,
        "Access-Control-Allow-Origin": "*",
        "X-IDMart-Proxy": "ORIGIN"
      }
    }
  );


  ctx.waitUntil(
    cache.put(
      cacheKey,
      response.clone()
    )
  );


  // ------------------------------------------
  // 5. ถ้ามี KV ให้บันทึกด้วย
  // ------------------------------------------

  if (env.GAFIW_PRODUCTS) {

    ctx.waitUntil(
      env.GAFIW_PRODUCTS.put(
        PRODUCT_KEY,
        JSON.stringify(result)
      )
    );

  }


  return response;
}


// ======================================================
// REFRESH PRODUCTS
// ======================================================

async function refreshProducts(request, env) {

  // ------------------------------------------------
  // ป้องกันคนอื่นเรียก Refresh
  // ------------------------------------------------

  const configuredToken =
    env.GAFIW_REFRESH_TOKEN;

  if (configuredToken) {

    const authorization =
      request.headers.get("Authorization") || "";

    const expected =
      `Bearer ${configuredToken}`;

    if (authorization !== expected) {

      return jsonResponse(
        {
          ok: false,
          error: "UNAUTHORIZED"
        },
        401
      );

    }

  }


  // ------------------------------------------------
  // ดึงข้อมูลใหม่จาก GAFIWSHOP
  // ------------------------------------------------

  const result =
    await fetchGafiwProducts();


  // ถ้า GAFIWSHOP ตอบ 403
  // ห้ามลบข้อมูลเก่า
  if (!result.ok) {

    return jsonResponse(
      {
        ...result,
        message:
          "Refresh ไม่สำเร็จ ข้อมูลเดิมยังคงอยู่"
      },
      502
    );

  }


  // ------------------------------------------------
  // บันทึกลง KV
  // ------------------------------------------------

  if (env.GAFIW_PRODUCTS) {

    await env.GAFIW_PRODUCTS.put(
      PRODUCT_KEY,
      JSON.stringify(result)
    );

  }


  // ------------------------------------------------
  // ล้าง Cache API
  // ------------------------------------------------

  const cache = caches.default;

  const cacheKey = new Request(
    "https://idmart-gafiw-products-cache.local/products"
  );

  await cache.delete(cacheKey);


  return jsonResponse({
    ...result,
    source: "REFRESHED"
  });
}


// ======================================================
// FETCH GAFIWSHOP
// ======================================================

async function fetchGafiwProducts() {

  try {

    const response = await fetch(
      GAFIW_API,
      {
        method: "GET",
        redirect: "follow",

        headers: {
          "Accept": "application/json",
          "Accept-Language":
            "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
          "User-Agent":
            "IDMart-GAFIWSHOP-Proxy/1.0"
        }
      }
    );


    const body =
      await response.text();


    // ------------------------------------------
    // HTTP Error
    // ------------------------------------------

    if (!response.ok) {

      return {
        ok: false,
        error: "GAFIWSHOP_HTTP_ERROR",
        status: response.status,
        body: body.substring(0, 500)
      };

    }


    // ------------------------------------------
    // JSON
    // ------------------------------------------

    let data;

    try {

      data = JSON.parse(body);

    } catch {

      return {
        ok: false,
        error: "GAFIWSHOP_NOT_JSON",
        body: body.substring(0, 500)
      };

    }


    // ------------------------------------------
    // ตรวจโครงสร้าง
    // ------------------------------------------

    if (
      data.ok !== true ||
      !Array.isArray(data.data)
    ) {

      return {
        ok: false,
        error:
          "INVALID_GAFIWSHOP_RESPONSE"
      };

    }


    return {
      ok: true,
      count: data.data.length,
      data: data.data,
      updated_at:
        new Date().toISOString()
    };


  } catch (error) {

    return {
      ok: false,
      error: "PROXY_ERROR",
      message:
        error?.message ||
        "Unknown error"
    };

  }
}


// ======================================================
// JSON RESPONSE
// ======================================================

function jsonResponse(data, status = 200) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":
          "no-store"
      }
    }
  );
}
