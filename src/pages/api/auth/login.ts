export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";

const LoginSchema = z.object({
  email: z
    .string({ required_error: "Adres email jest wymagany." })
    .trim()
    .min(1, "Adres email jest wymagany.")
    .email("Podaj poprawny adres email."),
  password: z.string({ required_error: "Hasło jest wymagane." }).min(1, "Hasło jest wymagane."),
});

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;

  if (!supabase) {
    return json({ error: "Supabase client not available" }, 500);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      422
    );
  }

  const { email, password } = parsed.data;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      // Wyrównanie komunikatu z frontendem – nie ujawniamy, czy konto istnieje.
      const message =
        error?.message === "Invalid login credentials"
          ? "Nieprawidłowy email lub hasło."
          : "Wystąpił błąd logowania. Spróbuj ponownie.";

      return json({ error: message }, 401);
    }

    // Cookies są ustawiane przez klienta SSR Supabase poprzez adapter ciasteczek.
    // Zwracamy minimalną odpowiedź; klient tylko sprawdza, czy status jest OK.
    return json({ ok: true }, 200);
  } catch (error) {
    console.error("POST /api/auth/login failed", error);
    return json({ error: "Internal server error" }, 500);
  }
};

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}
