const GAFIW_ORIGIN = "https://gafiwshop.xyz";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-GAFIW-API-KEY",
  "Access-Control-Max-Age": "86400",
};

const UPSTREAM_HEADERS = {
  "Accept":
    "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (compatible; IDMart-GAFIW-Proxy/0.4.0)",
  "Referer":
    "https://gafiwshop.xyz/",
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
       * ==========================================
       * HEALTH CHECK
       * ==========================================
       */
      if (
        request.method === "GET" &&
        url.pathname === "/"
      ) {
        return json({
          ok: true,
          service: "IDMart GAFIWSHOP Proxy",
          version: "0.4.0",
        });
      }

      /*
       * ==========================================
       * ตรวจ Secret ของ Worker
       * ==========================================
       */
      if (!env.GAFIW_API_KEY) {
        return json(
          {
            ok: false,
            error: "WORKER_API_KEY_NOT_CONFIGURED",
          },
          500
        );
      }

      /*
       * ==========================================
       * PRODUCT
       *
       * GET /api/gafiw-products
       *
       * API ต้นทาง:
       * GET /api/api_product
       *
       * ไม่ใช้ key ตามข้อมูล API
       * ==========================================
       */
      if (
        request.method === "GET" &&
        url.pathname === "/api/gafiw-products"
      ) {
        const response = await upstreamFetch(
          `${GAFIW_ORIGIN}/api/api_product`,
          {
            method: "GET",
            headers: UPSTREAM_HEADERS,
          }
        );

        return await normalizeUpstreamResponse(
          response,
          "PRODUCT"
        );
      }

      /*
       * ==========================================
       * Endpoint สำคัญ
       * ต้องมี Client Key จาก WordPress
       * ==========================================
       */
      const protectedPaths = [
        "/api/gafiw-money",
        "/api/gafiw-buy",
        "/api/gafiw-history",
        "/api/gafiw-claim",
        "/api/gafiw-check-claim",
        "/api/gafiw-netflix-otp",
        "/api/gafiw-disney-otp",
      ];

      if (protectedPaths.includes(url.pathname)) {
        const clientKey =
          request.headers.get(
            "X-GAFIW-API-KEY"
          );

        if (
          !clientKey ||
          clientKey !== env.GAFIW_API_KEY
        ) {
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
       * ==========================================
       * MONEY
       *
       * POST /api/gafiw-money
       *
       * GAFIWSHOP:
       * POST /api/api_money
       *
       * keyapi = Worker Secret
       * ==========================================
       */
      if (
        request.method === "POST" &&
        url.pathname === "/api/gafiw-money"
      ) {
        const body =
          new URLSearchParams();

        body.set(
          "keyapi",
          String(env.GAFIW_API_KEY).trim()
        );

        const response =
          await upstreamFetch(
            `${GAFIW_ORIGIN}/api/api_money`,
            {
              method: "POST",
              headers: {
                ...UPSTREAM_HEADERS,
                "Content-Type":
                  "application/x-www-form-urlencoded",
              },
              body: body.toString(),
            }
          );

        return await normalizeUpstreamResponse(
          response,
          "MONEY"
        );
      }

      /*
       * ==========================================
       * BUY
       *
       * POST /api/gafiw-buy
       *
       * รับ:
       * type_id
       * username_buy
       *
       * Worker เติม keyapi เอง
       * ==========================================
       */
      if (
        request.method === "POST" &&
        url.pathname === "/api/gafiw-buy"
      ) {
        const input =
          await readRequestData(request);

        const body =
          new URLSearchParams();

        const typeId =
          String(
            input.type_id || ""
          ).trim();

        const username =
          String(
            input.username_buy || ""
          ).trim();

        if (!typeId) {
          return json(
            {
              ok: false,
              error: "TYPE_ID_REQUIRED",
            },
            400
          );
        }

        if (!username) {
          return json(
            {
              ok: false,
              error:
                "USERNAME_BUY_REQUIRED",
            },
            400
          );
        }

        body.set(
          "type_id",
          typeId
        );

        body.set(
          "username_buy",
          username
        );

        body.set(
          "keyapi",
          String(env.GAFIW_API_KEY).trim()
        );

        const response =
          await upstreamFetch(
            `${GAFIW_ORIGIN}/api/api_buy`,
            {
              method: "POST",
              headers: {
                ...UPSTREAM_HEADERS,
                "Content-Type":
                  "application/x-www-form-urlencoded",
              },
              body: body.toString(),
            }
          );

        return await normalizeUpstreamResponse(
          response,
          "BUY"
        );
      }

      /*
       * ==========================================
       * HISTORY
       *
       * GET /api/gafiw-history
       * ==========================================
       */
      if (
        request.method === "GET" &&
        url.pathname === "/api/gafiw-history"
      ) {
        const target =
          new URL(
            `${GAFIW_ORIGIN}/api/api_history`
          );

        copyQuery(
          url,
          target,
          [
            "limit",
            "offset",
            "username_buy",
          ]
        );

        target.searchParams.set(
          "keyapi",
          String(
            env.GAFIW_API_KEY
          ).trim()
        );

        const response =
          await upstreamFetch(
            target.toString(),
            {
              method: "GET",
              headers: UPSTREAM_HEADERS,
            }
          );

        return await normalizeUpstreamResponse(
          response,
          "HISTORY"
        );
      }

      /*
       * ==========================================
       * CLAIM
       *
       * POST /api/gafiw-claim
       *
       * ส่งข้อมูลจาก WordPress ต่อไป
       * ==========================================
       */
      if (
        request.method === "POST" &&
        url.pathname === "/api/gafiw-claim"
      ) {
        const input =
          await readRequestData(request);

        const body =
          new URLSearchParams();

        for (
          const [key, value]
          of Object.entries(input)
        ) {
          if (
            value !== undefined &&
            value !== null &&
            value !== ""
          ) {
            body.set(
              key,
              String(value)
            );
          }
        }

        body.delete("keyapi");

        body.set(
          "keyapi",
          String(
            env.GAFIW_API_KEY
          ).trim()
        );

        const response =
          await upstreamFetch(
            `${GAFIW_ORIGIN}/api/api_claim`,
            {
              method: "POST",
              headers: {
                ...UPSTREAM_HEADERS,
                "Content-Type":
                  "application/x-www-form-urlencoded",
              },
              body: body.toString(),
            }
          );

        return await normalizeUpstreamResponse(
          response,
          "CLAIM"
        );
      }

      /*
       * ==========================================
       * CHECK CLAIM STATUS
       * ==========================================
       */
      if (
        request.method === "POST" &&
        url.pathname ===
          "/api/gafiw-check-claim"
      ) {
        const input =
          await readRequestData(request);

        const body =
          new URLSearchParams();

        for (
          const [key, value]
          of Object.entries(input)
        ) {
          if (
            value !== undefined &&
            value !== null &&
            value !== ""
          ) {
            body.set(
              key,
              String(value)
            );
          }
        }

        body.delete("keyapi");

        body.set(
          "keyapi",
          String(
            env.GAFIW_API_KEY
          ).trim()
        );

        const response =
          await upstreamFetch(
            `${GAFIW_ORIGIN}/api/v1/check_claim_status.php`,
            {
              method: "POST",
              headers: {
                ...UPSTREAM_HEADERS,
                "Content-Type":
                  "application/x-www-form-urlencoded",
              },
              body: body.toString(),
            }
          );

        return await normalizeUpstreamResponse(
          response,
          "CHECK_CLAIM"
        );
      }

      /*
       * ==========================================
       * NETFLIX OTP
       *
       * API จริงใช้ api_key
       * ไม่ใช่ keyapi
       * ==========================================
       */
      if (
        request.method === "POST" &&
        url.pathname ===
          "/api/gafiw-netflix-otp"
      ) {
        const input =
          await readRequestData(request);

        const body =
          new URLSearchParams();

        const orderId =
          String(
            input.order_id || ""
          ).trim();

        const type =
          String(
            input.type || ""
          ).trim();

        if (!orderId) {
          return json(
            {
              ok: false,
              error:
                "ORDER_ID_REQUIRED",
            },
            400
          );
        }

        body.set(
          "api_key",
          String(
            env.GAFIW_API_KEY
          ).trim()
        );

        body.set(
          "order_id",
          orderId
        );

        if (type) {
          body.set(
            "type",
            type
          );
        }

        const response =
          await upstreamFetch(
            `${GAFIW_ORIGIN}/api/netflix_otp`,
            {
              method: "POST",
              headers: {
                ...UPSTREAM_HEADERS,
                "Content-Type":
                  "application/x-www-form-urlencoded",
              },
              body: body.toString(),
            }
          );

        return await normalizeUpstreamResponse(
          response,
          "NETFLIX_OTP"
        );
      }

      /*
       * ==========================================
       * YOUKU OTP
       *
       * GET /api/gafiw-youku-otp?email=
       * ไม่ใช้ API Key ตามเอกสาร
       * ==========================================
       */
      if (
        request.method === "GET" &&
        url.pathname ===
          "/api/gafiw-youku-otp"
      ) {
        const email =
          String(
            url.searchParams.get(
              "email"
            ) || ""
          ).trim();

        if (!email) {
          return json(
            {
              ok: false,
              error: "EMAIL_REQUIRED",
            },
            400
          );
        }

        const target =
          new URL(
            `${GAFIW_ORIGIN}/api/otp_youku`
          );

        target.searchParams.set(
          "email",
          email
        );

        const response =
          await upstreamFetch(
            target.toString(),
            {
              method: "GET",
              headers: UPSTREAM_HEADERS,
            }
          );

        return await normalizeUpstreamResponse(
          response,
          "YOUKU_OTP"
        );
      }

      /*
       * ==========================================
       * DISNEY OTP
       * ==========================================
       */
      if (
        request.method === "GET" &&
        url.pathname ===
          "/api/gafiw-disney-otp"
      ) {
        const phone =
          String(
            url.searchParams.get(
              "phone"
            ) || ""
          ).trim();

        if (!phone) {
          return json(
            {
              ok: false,
              error:
                "PHONE_REQUIRED",
            },
            400
          );
        }

        const target =
          new URL(
            `${GAFIW_ORIGIN}/api/otp_disney`
          );

        target.searchParams.set(
          "keyapi",
          String(
            env.GAFIW_API_KEY
          ).trim()
        );

        target.searchParams.set(
          "phone",
          phone
        );

        const response =
          await upstreamFetch(
            target.toString(),
            {
              method: "GET",
              headers: UPSTREAM_HEADERS,
            }
          );

        return await normalizeUpstreamResponse(
          response,
          "DISNEY_OTP"
        );
      }

      /*
       * ==========================================
       * NOT FOUND
       * ==========================================
       */
      return json(
        {
          ok: false,
          error: "NOT_FOUND",
          path: url.pathname,
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


/*
 * ========================================================
 * FETCH GAFIWSHOP
 * ========================================================
 */

async function upstreamFetch(
  target,
  options = {}
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, 30000);

  try {
    return await fetch(
      target,
      {
        ...options,
        redirect: "follow",
        signal: controller.signal,

        /*
         * ป้องกัน Cloudflare Worker
         * เอา Response เก่าจาก Cache มาใช้
         */
        cf: {
          cacheTtl: 0,
          cacheEverything: false,
        },
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}


/*
 * ========================================================
 * อ่าน Request
 * ========================================================
 */

async function readRequestData(
  request
) {
  const contentType =
    request.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    const data =
      await request.json();

    return data &&
      typeof data === "object"
      ? data
      : {};
  }

  if (
    contentType.includes(
      "application/x-www-form-urlencoded"
    ) ||
    contentType.includes(
      "multipart/form-data"
    )
  ) {
    const form =
      await request.formData();

    const data = {};

    for (
      const [
        key,
        value
      ] of form.entries()
    ) {
      if (
        typeof value === "string"
      ) {
        data[key] = value;
      }
    }

    return data;
  }

  return {};
}


/*
 * ========================================================
 * Response Normalizer
 *
 * จุดสำคัญ:
 * ถ้า GAFIWSHOP ตอบ JSON -> ส่ง JSON
 *
 * ถ้าตอบ HTML เช่น Cloudflare 403
 * -> แปลงเป็น JSON เพื่อให้ WordPress
 * ไม่เจอ "ตอบกลับไม่ใช่ JSON"
 * ========================================================
 */

async function normalizeUpstreamResponse(
  response,
  endpoint
) {
  const status =
    response.status;

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  const raw =
    await response.text();

  /*
   * ลอง JSON ก่อน
   */
  let data = null;

  try {
    data =
      JSON.parse(raw);
  } catch (_) {
    data = null;
  }

  /*
   * JSON จาก GAFIWSHOP
   */
  if (data !== null) {
    return json(
      {
        ...data,

        /*
         * metadata สำหรับ Admin
         * ไม่ทำลายข้อมูลเดิม
         */
        _proxy: {
          endpoint,
          upstream_status: status,
          content_type: contentType,
        },
      },
      status
    );
  }

  /*
   * HTML / Cloudflare / Text
   */
  let shortBody =
    String(raw || "")
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        ""
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        ""
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (
    shortBody.length > 500
  ) {
    shortBody =
      shortBody.substring(
        0,
        500
      );
  }

  return json(
    {
      ok: false,

      error:
        status === 403
          ? "GAFIWSHOP_HTTP_403"
          : "GAFIWSHOP_HTTP_ERROR",

      status,

      endpoint,

      message:
        status === 403
          ? "GAFIWSHOP ปฏิเสธคำขอจาก Worker"
          : "GAFIWSHOP ตอบกลับไม่ใช่ JSON",

      upstream_content_type:
        contentType,

      upstream_body:
        shortBody || null,

      /*
       * สำคัญสำหรับ Admin:
       * จะเห็นว่า 403 เกิดที่ upstream
       * ไม่ใช่ Worker ของเรา
       */
      upstream_ok:
        response.ok,
    },
    status
  );
}


/*
 * ========================================================
 * Query Helper
 * ========================================================
 */

function copyQuery(
  source,
  target,
  names
) {
  for (
    const name of names
  ) {
    const value =
      source.searchParams.get(
        name
      );

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


/*
 * ========================================================
 * JSON Response
 * ========================================================
 */

function json(
  data,
  status = 200
) {
  const headers =
    new Headers();

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0"
  );

  for (
    const [
      key,
      value
    ] of Object.entries(
      CORS_HEADERS
    )
  ) {
    headers.set(
      key,
      value
    );
  }

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers,
    }
  );
}
