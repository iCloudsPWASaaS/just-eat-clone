import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SCHEMA,
  SUPABASE_URL,
} from "@/lib/env";

// Routes that require a signed-in customer. `/basket` is deliberately absent —
// Just Eat lets you build a basket anonymously and only asks for an account at
// checkout, and the same applies here.
const PROTECTED = ["/account", "/checkout", "/orders"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request: req });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: SUPABASE_SCHEMA },
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: CookieOptions;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/account/:path*", "/checkout/:path*", "/orders/:path*"],
};
