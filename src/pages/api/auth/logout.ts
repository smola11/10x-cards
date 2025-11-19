export const prerender = false;

import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Supabase client not available" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return new Response(JSON.stringify({ error: "Logout failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Cookies are cleared by the Supabase SSR client via provided cookie adapter
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/auth/logout error", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
