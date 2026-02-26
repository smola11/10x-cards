import { useCallback, useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage } from "./FormField";

const passwordSchema = z
  .string({ required_error: "Hasło jest wymagane." })
  .min(8, "Hasło musi mieć co najmniej 8 znaków.")
  .superRefine((value, ctx) => {
    if (!/[A-Z]/.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hasło musi zawierać co najmniej jedną wielką literę." });
    }
    if (!/[a-z]/.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hasło musi zawierać co najmniej jedną małą literę." });
    }
    if (!/\d/.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hasło musi zawierać cyfrę." });
    }
  });

const registerSchema = z
  .object({
    email: z
      .string({ required_error: "Adres email jest wymagany." })
      .trim()
      .min(1, "Adres email jest wymagany.")
      .email("Podaj poprawny adres email."),
    password: passwordSchema,
    confirmPassword: z.string({ required_error: "Potwierdź hasło." }).min(1, "Potwierdź hasło."),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Hasła muszą być identyczne.",
      });
    }
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const initialValues = useMemo<RegisterFormValues>(
    () => ({
      email: "",
      password: "",
      confirmPassword: "",
    }),
    []
  );

  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterFormValues, string>>>({});
  const [formMessage, setFormMessage] = useState<{
    tone: "error" | "info" | "success";
    title: string;
    description?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updateField = useCallback(
    <Key extends keyof RegisterFormValues>(field: Key, value: RegisterFormValues[Key]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      setFormMessage(null);
      setFieldErrors({});

      const result = registerSchema.safeParse(values);

      if (!result.success) {
        const nextErrors: Partial<Record<keyof RegisterFormValues, string>> = {};
        const issues = result.error.flatten().fieldErrors;
        for (const key of Object.keys(issues) as (keyof RegisterFormValues)[]) {
          const message = issues[key]?.[0];
          if (message) {
            nextErrors[key] = message;
          }
        }

        setFieldErrors(nextErrors);
        setFormMessage({
          tone: "error",
          title: "Formularz zawiera błędy.",
          description: "Upewnij się, że adres email i hasła spełniają wymagania.",
        });
        setIsSubmitting(false);
        return;
      }

      // Real registration via server-side Supabase Auth API
      try {
        const response = await fetch("/api/auth/register", {
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
          let description = "Nie udało się utworzyć konta. Spróbuj ponownie.";

          try {
            const data = (await response.json()) as { error?: string };
            if (data?.error) {
              description = data.error;
            }
          } catch {
            // fallback zostaje
          }

          setFormMessage({
            tone: "error",
            title: "Rejestracja nie powiodła się.",
            description,
          });
          setIsSubmitting(false);
          return;
        }

        // Expect { ok: true, requiresConfirmation: boolean }
        let requiresConfirmation = false;
        try {
          const data = (await response.json()) as { ok?: boolean; requiresConfirmation?: boolean };
          requiresConfirmation = Boolean(data?.requiresConfirmation);
        } catch {
          requiresConfirmation = false;
        }

        if (requiresConfirmation) {
          setFormMessage({
            tone: "success",
            title: "Sprawdź skrzynkę pocztową.",
            description: "Wysłaliśmy link aktywacyjny. Po potwierdzeniu zalogujesz się automatycznie.",
          });
          setIsSubmitting(false);
          return;
        }

        // Email confirmation disabled – sesja gotowa, przekierowujemy do strony głównej
        window.location.assign("/");
      } catch {
        setFormMessage({
          tone: "error",
          title: "Wystąpił błąd.",
          description: "Nieoczekiwany błąd podczas rejestracji. Spróbuj ponownie.",
        });
        setIsSubmitting(false);
      }
    },
    [values]
  );

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-md">
        <Card className="border-border/70 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Rejestracja</CardTitle>
            <CardDescription>Utwórz konto, aby zapisywać fiszki i kontynuować naukę.</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            {formMessage ? (
              <FormMessage tone={formMessage.tone} title={formMessage.title} description={formMessage.description} />
            ) : (
              <FormMessage
                tone="info"
                title="Wypełnij formularz, aby utworzyć konto."
              />
            )}

            <div className="flex flex-col gap-5">
              <FormField htmlFor="email" label="Adres email" required error={fieldErrors.email}>
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
                hint="Min. 8 znaków, co najmniej jedna wielka litera, mała litera i cyfra."
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? "Ukryj" : "Pokaż"}
                  </Button>
                }
              >
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={values.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  disabled={isSubmitting}
                />
              </FormField>

              <FormField
                htmlFor="confirm-password"
                label="Potwierdź hasło"
                required
                error={fieldErrors.confirmPassword}
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? "Ukryj" : "Pokaż"}
                  </Button>
                }
              >
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={values.confirmPassword}
                  onChange={(event) => updateField("confirmPassword", event.target.value)}
                  disabled={isSubmitting}
                />
              </FormField>

              <p className="text-sm text-muted-foreground">
                Masz już konto?{" "}
                <a className="font-medium text-primary hover:underline" href="/auth/login">
                  Zaloguj się
                </a>
                .
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border/70 bg-background/40">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Tworzenie konta…" : "Utwórz konto"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
