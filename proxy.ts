import { NextResponse, type NextRequest } from "next/server";
import { buildAllowedOrigins, isAllowedMutationOrigin } from "@/server/security/origin-policy";

function securityHeaders(isDevelopment: boolean) {
  const scriptSource = ["'self'", "'unsafe-inline'", ...(isDevelopment ? ["'unsafe-eval'"] : []), "https://vercel.live"].join(" ");
  const connectSources = new Set<string>(["'self'"]);
  try {
    const realtime = new URL(process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001");
    connectSources.add(realtime.origin);
    if (realtime.protocol === "https:") connectSources.add(`wss://${realtime.host}`);
    if (realtime.protocol === "http:") connectSources.add(`ws://${realtime.host}`);
  } catch { /* Invalid realtime URL will fail at application config/runtime checks. */ }
  if (isDevelopment) {
    // Next dev HMR may use a separate WebSocket endpoint.
    connectSources.add("ws:");
    connectSources.add("wss:");
  }
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src ${scriptSource}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src ${[...connectSources].join(" ")}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  };
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(securityHeaders(process.env.NODE_ENV !== "production"))) {
    response.headers.set(key, value);
  }

  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/invite/") || pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Pragma", "no-cache");
  }

  if (pathname.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const allowed = isAllowedMutationOrigin({
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      fetchSite: request.headers.get("sec-fetch-site"),
    }, buildAllowedOrigins());
    if (!allowed) {
      const blocked = NextResponse.json({ error: "forbidden" }, { status: 403 });
      for (const [key, value] of Object.entries(securityHeaders(process.env.NODE_ENV !== "production"))) {
        blocked.headers.set(key, value);
      }
      blocked.headers.set("Cache-Control", "no-store");
      return blocked;
    }
  }

  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
