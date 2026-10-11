import { NextResponse, type NextRequest } from "next/server";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
};

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(key, value);
  if (process.env.NODE_ENV === "production") response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  if (request.nextUrl.pathname.startsWith("/invite/")) response.headers.set("Cache-Control", "no-store");
  const pathname = request.nextUrl.pathname;
  if (
  pathname.startsWith("/api/") &&
  ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
) {
  const origin = request.headers.get("origin");
  const appOrigin = new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  ).origin;

  const allowedOrigins = new Set([appOrigin]);

  // Allow local development while testing through ngrok.
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://127.0.0.1:3000");
  }

  if (origin && !allowedOrigins.has(origin)) {
    return new NextResponse(
      JSON.stringify({ error: "forbidden" }),
      {
        status: 403,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
