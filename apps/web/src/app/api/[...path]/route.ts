import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const base = (
    process.env.API_INTERNAL_URL ||
    process.env.API_URL ||
    "http://localhost:8000"
  ).replace(/\/+$/, "");
  try {
    const res = await fetch(
      `${base}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`,
      {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : await req.text(),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    return new Response(await res.text(), {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch {
    return Response.json({ message: "API_UNAVAILABLE" }, { status: 503 });
  }
}
export {
  proxy as DELETE,
  proxy as GET,
  proxy as PATCH,
  proxy as POST,
  proxy as PUT,
};
