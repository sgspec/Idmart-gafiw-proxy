const GAFIW_ORIGIN = "https://gafiwshop.xyz";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-GAFIW-API-KEY",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    try {
      /*
       * =====================================================
       * สินค้า
       * GET /api/gafiw-products
       *
       * ใช้ api_product ของ GAFIWSHOP
       * ไม่ต้องส่ง API Key จาก Browser
       * =====================================================
       */
      if (
        request.method === "GET" &&
        url.pathname === "/api/gafiw-products"
      ) {
        return await proxyGet(
          `${GAFIW_ORIGIN}/api/api_product`
        );
      }

      /*
       * =====================================================
       * Endpoint ที่ต้องใช้ API KEY
       * =====================================================
       */
      const protectedPaths = [
        "/api/gafiw-money",
        "/api/gafiw-buy",
        "/api/gafiw-history",
        "/api/gafiw-claim",
        "/api/gafiw-check-claim",
        "/api/gafiw-netflix-otp",
        "/api/gafiw-youku-otp",
        "/api/gafiw-disney-otp",
      ];

      if (protectedPaths.includes(url.pathname)) {
        const clientKey = request.headers.get("X-GAFIW-API-KEY");

        if (!env.GAFIW_API_KEY) {
          return json(
            {
              ok: false,
              error: "WORKER_API_KEY_NOT_CONFIGURED",
            },
            500
          );
        }

        if (!clientKey || clientKey !== env.GAFIW_API_KEY) {
          return json(
            {
              ok: false,
              error: "UNAUTHORIZED",
            },
            401
          );
        }
      }

      /*
       * =====================================================
       * เช็กยอดเงิน
       * POST /api/gafiw-money
       *
       * GAFIWSHOP:
       * POST /api/api_money
       * =====================================================
       */
      if (
        url.pathname === "/api/gafiw-money" &&
        request.method === "POST"
      ) {
        return await proxyFormPost(
          `${GAFIW_ORIGIN}/api/api_money`,
          request,
          env.GAFIW_API_KEY
        );
      }

      /*
       * =====================================================
       * สั่งซื้อ
       *
       * POST /api/gafiw-buy
       *
       * รับ:
       * type_id
       * username_buy
       *
       * แล้ว Worker เติม keyapi ให้เอง
       * =====================================================
       */
      if (
        url.pathname === "/api/gafiw-buy" &&
        request.method === "POST"
      ) {
        return await proxyFormPost(
          `${GAFIW_ORIGIN}/api/api_buy`,
          request,
          env.GAFIW_API_KEY
        );
      }

      /*
       * =====================================================
       * ประวัติคำสั่งซื้อ
       *
       * GET /api/gafiw-history
       *
       * รองรับ:
       * limit
       * username_buy
       * =====================================================
       */
      if (
        url.pathname === "/api/gafiw-history" &&
        request.method === "GET"
      ) {
        const target = new URL(
          `${GAFIW_ORIGIN}/api/api_history`
        );

        copyQuery(url, target, [
          "limit",
          "username_buy",
        ]);

        target.searchParams.set(
          "keyapi",
          env.GAFIW_API_KEY
        );

        return await fetchExternal(target.toString(), {
          method: "GET",
        });
      }

      /*
       * =====================================================
       * ส่งเคลม
       *
       * POST /api/gafiw-claim
       *
       * รับ:
       * order_id
       * reason
       * =====================================================
       */
      if (
        url.pathname === "/api/gafiw-claim" &&
        request.method === "POST"
      ) {
        return await proxyFormPost(
          `${GAFIW_ORIGIN}/api/api_claim`,
          request,
          env.GAFIW_API_KEY
        );
      }

      /*
       * =====================================================
       * ตรวจสอบสถานะเคลม
       *
       * POST /api/gafiw-check-claim
       *
       * รับ:
       * order_id
       * =====================================================
       */
      if (
        url.pathname === "/api/gafiw-check-claim" &&
        request.method === "POST"
      ) {
        return await proxyFormPost(
          `${GAFIW_ORIGIN}/api/v1/check_claim_status.php`,
          request,
          env.GAFIW_API_KEY
        );
      }

      /*
       * =====================================================
       * Netflix OTP
       *
       * POST /api/gafiw-netflix-otp
       *
       * รับ:
       * order_id
       * type
       *
       * type:
       * 4code
       * 6code
       * household
       * =====================================================
       */
      if (
        url.pathname === "/api/gafiw-netflix-otp" &&
        request.method === "POST"
      ) {
        return await proxyFormPost(
          `${GAFIW_ORIGIN}/api/netflix_otp`,
          request,
          env.GAFIW_API_KEY,
          "api_key"
        );
      }

      /*
       * =====================================================
       * YouKu OTP
       *
       * GET /api/gafiw-youku-otp?email=...
       *
       * ไม่ต้องใช้ API Key ตาม API ต้นทาง
       * แต่ Worker ยังตรวจ X-GAFIW-API-KEY
       * เพื่อไม่ให้คนอื่นเอา Worker ไปใช้งานฟรี
       * =====================================================
       */
      if (
        url.pathname === "/api/gafiw-youku-otp" &&
        request.method === "GET"
      ) {
        const email = url.searchParams.get("email") || "";

        const target = new URL(
          `${GAFIW_ORIGIN}/api/otp_youku`
        );

        target.searchParams.set("email", email);

        return await fetchExternal(target.toString(), {
          method: "GET",
        });
      }

      /*
       * =====================================================
       * Disney+ OTP
       *
       * GET /api/gafiw-disney-otp?phone=...
       *
       * ส่ง:
       * keyapi
       * phone
       * =====================================================
       */
      if (
        url.pathname === "/api/gafiw-disney-otp" &&
        request.method === "GET"
      ) {
        const phone = url.searchParams.get("phone") || "";

        const target = new URL(
          `${GAFIW_ORIGIN}/api/otp_disney`
        );

        target.searchParams.set(
          "keyapi",
          env.GAFIW_API_KEY
        );

        target.searchParams.set("phone", phone);

        return await fetchExternal(target.toString(), {
          method: "GET",
        });
      }

      /*
       * =====================================================
       * Health Check
       * =====================================================
       */
      if (
        request.method === "GET" &&
        url.pathname === "/"
      ) {
        return json({
          ok: true,
          service: "IDMart GAFIWSHOP Proxy",
          version: "0.3.0",
        });
      }

      return json(
        {
          ok: false,
          error: "NOT_FOUND",
        },
        404
      );
    } catch (error) {
      return json(
        {
          ok: false,
          error: "WORKER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : String(error),
        },
        502
      );
    }
  },
};


/* =========================================================
 * GET Proxy
 * ========================================================= */

async function proxyGet(targetUrl) {
  return fetchExternal(targetUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
}


/* =========================================================
 * POST Form Proxy
 *
 * Worker รับข้อมูลจาก WordPress
 * แล้วเติม API Key ก่อนส่งให้ GAFIWSHOP
 * ========================================================= */

async function proxyFormPost(
  targetUrl,
  request,
  apiKey,
  keyName = "keyapi"
) {
  let input = {};

  const contentType =
    request.headers.get("content-type") || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    input = await request.json();
  } else {
    const form = await request.formData();

    for (const [key, value] of form.entries()) {
      if (typeof value === "string") {
        input[key] = value;
      }
    }
  }

  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      body.set(key, String(value));
    }
  }

  /*
   * สำคัญ:
   * ลบ keyapi/api_key ที่ Client อาจส่งมา
   * แล้วใช้ Secret ของ Worker แทน
   */
  body.delete("keyapi");
  body.delete("api_key");

  body.set(keyName, apiKey);

  return fetchExternal(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type":
        "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
}


/* =========================================================
 * External Request
 * ========================================================= */

async function fetchExternal(
  targetUrl,
  options = {}
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    const response = await fetch(targetUrl, {
      ...options,
      redirect: "follow",
      signal: controller.signal,
    });

    const contentType =
      response.headers.get("content-type") ||
      "application/json";

    const body = await response.arrayBuffer();

    const headers = new Headers();

    headers.set(
      "Content-Type",
      contentType
    );

    headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    for (const [key, value] of Object.entries(
      CORS_HEADERS
    )) {
      headers.set(key, value);
    }

    return new Response(body, {
      status: response.status,
      headers,
    });
  } finally {
    clearTimeout(timeout);
  }
}


/* =========================================================
 * Query Helper
 * ========================================================= */

function copyQuery(
  source,
  target,
  names
) {
  for (const name of names) {
    const value =
      source.searchParams.get(name);

    if (
      value !== null &&
      value !== ""
    ) {
      target.searchParams.set(
        name,
        value
      );
    }
  }
}


/* =========================================================
 * JSON Response
 * ========================================================= */

function json(data, status = 200) {
  const headers = new Headers({
    "Content-Type":
      "application/json; charset=utf-8",
    "Cache-Control":
      "no-store, no-cache, must-revalidate",
  });

  for (const [key, value] of Object.entries(
    CORS_HEADERS
  )) {
    headers.set(key, value);
  }

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers,
    }
  );
}
