import { useCallback, useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage } from "./FormField";

const loginSchema = z.object({
  email: z
    .string({ required_error: "Adres email jest wymagany." })
    .trim()
    .min(1, "Adres email jest wymagany.")
    .email("Podaj poprawny adres email."),
  password: z.string({ required_error: "Hasło jest wymagane." }).min(1, "Hasło jest wymagane."),
  redirectTo: z.string().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  redirectTo?: string | null;
}

export default function LoginForm({ redirectTo }: LoginFormProps) {
  const initialValues = useMemo<LoginFormValues>(
    () => ({
      email: "",
      password: "",
      redirectTo: redirectTo ?? undefined,
    }),
    [redirectTo]
  );

  const [values, setValues] = useState<LoginFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>({});
  const [formMessage, setFormMessage] = useState<{
    tone: "error" | "info" | "success";
    title: string;
    description?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const updateField = useCallback(<Key extends keyof LoginFormValues>(field: Key, value: LoginFormValues[Key]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const sanitizeRedirect = useCallback((raw: string | null | undefined): string => {
    if (!raw || typeof raw !== "string") {
      return "/";
    }
    try {
      // Only allow same-origin relative paths
      // Block absolute URLs and protocol-relative URLs
      if (raw.startsWith("//")) return "/";
      if (raw.includes("://")) return "/";
      if (!raw.startsWith("/")) return "/";
      // Optionally, disallow navigating back to login
      if (raw.startsWith("/auth/login")) return "/";
      return raw;
    } catch {
      return "/";
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      setFormMessage(null);
      setFieldErrors({});

      const result = loginSchema.safeParse(values);

      if (!result.success) {
        const nextErrors: Partial<Record<keyof LoginFormValues, string>> = {};
        const issues = result.error.flatten().fieldErrors;
        for (const key of Object.keys(issues) as (keyof LoginFormValues)[]) {
          const message = issues[key]?.[0];
          if (message) {
            nextErrors[key] = message;
          }
        }

        setFieldErrors(nextErrors);
        setFormMessage({
          tone: "error",
          title: "Formularz zawiera błędy.",
          description: "Popraw zaznaczone pola i spróbuj ponownie.",
        });
        setIsSubmitting(false);
        return;
      }

      // Real login via server-side Supabase Auth API
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
          }),
        });

        if (!response.ok) {
          let description = "Wystąpił błąd logowania. Spróbuj ponownie.";

          if (response.status === 401) {
            try {
              const data = (await response.json()) as { error?: string };
              if (data?.error) {
                description = data.error;
              }
            } catch {
              description = "Nieprawidłowy email lub hasło.";
            }
          }

          setFormMessage({
            tone: "error",
            title: "Logowanie nie powiodło się.",
            description,
          });
          setIsSubmitting(false);
          return;
        }

        const target = sanitizeRedirect(redirectTo);
        setFormMessage({
          tone: "success",
          title: "Zalogowano pomyślnie.",
          description: "Przekierowuję…",
        });

        window.location.assign(target);
      } catch {
        setFormMessage({
          tone: "error",
          title: "Wystąpił błąd.",
          description: "Nieoczekiwany błąd logowania. Spróbuj ponownie.",
        });
        setIsSubmitting(false);
      }
    },
    [redirectTo, values, sanitizeRedirect]
  );

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-md">
        <Card className="border-border/70 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Logowanie</CardTitle>
            <CardDescription>Zaloguj się, aby uzyskać dostęp do swoich fiszek i generacji.</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            {formMessage ? (
              <FormMessage tone={formMessage.tone} title={formMessage.title} description={formMessage.description} />
            ) : (
              <FormMessage
                tone="info"
                title="Brak aktywnej sesji."
                description="Po poprawnym logowaniu przekierujemy Cię do panelu głównego."
              />
            )}

            <div className="flex flex-col gap-5">
              <FormField
                htmlFor="email"
                label="Adres email"
                required
                error={fieldErrors.email}
                hint="Użyj adresu, którego używasz do logowania."
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="jan.kowalski@example.com"
                  value={values.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  disabled={isSubmitting}
                />
              </FormField>

              <FormField
                htmlFor="password"
                label="Hasło"
                required
                error={fieldErrors.password}
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                  </Button>
                }
              >
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={values.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  disabled={isSubmitting}
                />
              </FormField>

              <div className="flex flex-wrap justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  Potrzebujesz konta?{" "}
                  <a className="font-medium text-primary hover:underline" href="/auth/register">
                    Zarejestruj się
                  </a>
                  .
                </span>
                <a className="font-medium text-primary hover:underline" href="/auth/forgot-password">
                  Nie pamiętam hasła
                </a>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border/70 bg-background/40">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Logowanie…" : "Zaloguj się"}
            </Button>
            {redirectTo ? (
              <p className="text-center text-xs text-muted-foreground">
                Po udanym logowaniu wrócisz do:{" "}
                <span className="font-medium text-foreground">{sanitizeRedirect(redirectTo)}</span>
              </p>
            ) : null}
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
