const GAFIW_API = "https://gafiwshop.xyz/api/api_product";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "IDMart GAFIWSHOP Proxy"
      });
    }

    // ดึงสินค้าจาก GAFIWSHOP
    if (url.pathname === "/api/gafiw-products") {
      try {
        const response = await fetch(GAFIW_API, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "IDMart-GAFIWSHOP-Proxy/1.0"
          }
        });

        const body = await response.text();

        if (!response.ok) {
          return Response.json(
            {
              ok: false,
              error: "GAFIWSHOP_HTTP_ERROR",
              status: response.status,
              body: body.substring(0, 500)
            },
            { status: 502 }
          );
        }

        let data;

        try {
          data = JSON.parse(body);
        } catch {
          return Response.json(
            {
              ok: false,
              error: "GAFIWSHOP_NOT_JSON",
              body: body.substring(0, 500)
            },
            { status: 502 }
          );
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Cache-Control": "public, max-age=30",
            "Access-Control-Allow-Origin": "*"
          }
        });

      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: "PROXY_ERROR",
            message: error.message
          },
          { status: 502 }
        );
      }
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
