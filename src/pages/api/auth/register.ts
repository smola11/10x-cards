export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";

const PasswordSchema = z
  .string({ required_error: "Hasło jest wymagane." })
  .min(8, "Hasło musi mieć co najmniej 8 znaków.");

const RegisterSchema = z.object({
  email: z
    .string({ required_error: "Adres email jest wymagany." })
    .trim()
    .min(1, "Adres email jest wymagany.")
    .email("Podaj poprawny adres email."),
  password: PasswordSchema,
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

  const parsed = RegisterSchema.safeParse(body);
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      const msg = error.message;
      let mapped: string;

      if (msg === "User already registered" || msg.toLowerCase().includes("already registered")) {
        mapped = "Konto z tym emailem już istnieje.";
      } else if (msg.toLowerCase().includes("password")) {
        mapped = "Hasło zbyt słabe.";
      } else {
        mapped = "Nie udało się utworzyć konta. Spróbuj ponownie.";
      }

      return json({ error: mapped }, 400);
    }

    const hasSession = Boolean(data.session);

    // Cookies są ustawiane przez klienta SSR Supabase poprzez adapter ciasteczek.
    // Jeśli sesja jest dostępna, frontend może przekierować użytkownika do "/".
    // Jeśli wymagana jest weryfikacja email, zwracamy odpowiednią flagę.
    return json(
      {
        ok: true,
        requiresConfirmation: !hasSession,
      },
      200
    );
  } catch (error) {
    console.error("POST /api/auth/register failed", error);
    return json({ error: "Internal server error" }, 500);
  }
};

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}
