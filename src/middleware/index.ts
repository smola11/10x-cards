import { defineMiddleware } from "astro:middleware";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (key) => context.cookies.get(key)?.value,
      set: (key, value, options) => context.cookies.set(key, value, options),
      remove: (key, options) => context.cookies.delete(key, options),
    },
  });

  // Assign with a safe cast to the runtime SupabaseClient interface
  context.locals.supabase = supabase as unknown as SupabaseClient;

  // Fetch SSR session for server-rendered pages/layouts
  try {
    const { data } = await supabase.auth.getSession();
    context.locals.session = data.session ?? null;
  } catch {
    context.locals.session = null;
  }

  // Auth guard: protect app pages (e.g., "/", "/flashcards") and keep auth pages public
  const isApiRequest = pathname.startsWith("/api/");
  const isAuthPage = pathname.startsWith("/auth/");
  const isStaticAsset =
    pathname.startsWith("/_image") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".ico");

  const requiresAuth =
    !isApiRequest &&
    !isAuthPage &&
    !isStaticAsset &&
    // Protect "/" (flashcards generation screen) and any future user pages by default
    (pathname === "/" || pathname.startsWith("/flashcards") || pathname.startsWith("/generations"));

  if (requiresAuth && !context.locals.session) {
    const redirectParam = encodeURIComponent(pathname + (url.search ? url.search : ""));
    return Response.redirect(new URL(`/auth/login?redirect=${redirectParam}`, url), 302);
  }

  return next();
});
