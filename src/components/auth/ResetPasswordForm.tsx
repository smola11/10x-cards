import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from "@/components/ui/use-toast";
import { FormField, FormMessage } from "./FormField";
import { supabaseClient } from "@/db/supabase.client";

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

const resetSchema = z
  .object({
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

type ResetFormValues = z.infer<typeof resetSchema>;

export default function ResetPasswordForm() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const initialValues = useMemo<ResetFormValues>(
    () => ({
      password: "",
      confirmPassword: "",
    }),
    []
  );

  const [values, setValues] = useState<ResetFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ResetFormValues, string>>>({});
  const [formMessage, setFormMessage] = useState<{
    tone: "error" | "info" | "success";
    title: string;
    description?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Wyciągnij token z hash URL (Supabase wysyła token w #access_token, nie w ?access_token)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      setIsCheckingToken(false);
      return;
    }

    // Parse hash parameters
    const params = new URLSearchParams(hash.substring(1)); // usuń # na początku
    const token = params.get("access_token");
    const type = params.get("type");
    const email = params.get("email");

    if (type === "recovery" && token) {
      setAccessToken(token);
      setEmailHint(email);
    }

    setIsCheckingToken(false);
  }, []);

  const isTokenMissing = !accessToken;

  const updateField = useCallback(<Key extends keyof ResetFormValues>(field: Key, value: ResetFormValues[Key]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isTokenMissing) {
        setFormMessage({
          tone: "error",
          title: "Link do resetu jest nieprawidłowy lub wygasł.",
          description: "Poproś o nowy link resetujący i spróbuj ponownie.",
        });
        return;
      }

      setIsSubmitting(true);
      setFormMessage(null);
      setFieldErrors({});

      const result = resetSchema.safeParse(values);

      if (!result.success) {
        const nextErrors: Partial<Record<keyof ResetFormValues, string>> = {};
        const issues = result.error.flatten().fieldErrors;
        for (const key of Object.keys(issues) as (keyof ResetFormValues)[]) {
          const message = issues[key]?.[0];
          if (message) {
            nextErrors[key] = message;
          }
        }

        setFieldErrors(nextErrors);
        setFormMessage({
          tone: "error",
          title: "Nie udało się zaktualizować hasła.",
          description: "Sprawdź wymagania dotyczące hasła i spróbuj ponownie.",
        });
        setIsSubmitting(false);
        return;
      }
      try {
        // Supabase po kliknięciu w link resetujący tworzy tymczasową sesję recovery.
        // W tym stanie możemy zaktualizować hasło po stronie klienta.
        const { error } = await supabaseClient.auth.updateUser({
          password: values.password,
        });

        if (error) {
          setFormMessage({
            tone: "error",
            title: "Nie udało się zaktualizować hasła.",
            description: "Link mógł wygasnąć lub wystąpił inny błąd. Poproś o nowy link i spróbuj ponownie.",
          });
          setIsSubmitting(false);
          return;
        }

        toast({
          variant: "success",
          title: "Hasło zostało zaktualizowane.",
          description: "Możesz zalogować się nowym hasłem.",
        });

        setFormMessage({
          tone: "success",
          title: "Hasło zostało zaktualizowane.",
          description: "Za chwilę przeniesiemy Cię do strony logowania.",
        });

        setIsSubmitting(false);

        // Kilkusekundowe opóźnienie na przeczytanie komunikatu, potem redirect do logowania.
        setTimeout(() => {
          window.location.assign("/auth/login");
        }, 1200);
      } catch {
        setFormMessage({
          tone: "error",
          title: "Wystąpił błąd.",
          description: "Nieoczekiwany błąd podczas zapisywania nowego hasła. Spróbuj ponownie.",
        });
        setIsSubmitting(false);
      }
    },
    [isTokenMissing, values]
  );

  // Pokaż loader podczas sprawdzania tokenu
  if (isCheckingToken) {
    return (
      <form className="w-full max-w-md">
        <Card className="border-border/70 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Ustaw nowe hasło</CardTitle>
            <CardDescription>
              Wprowadź nowe hasło, którego będziesz używać do logowania. Link jest jednorazowy i wygasa po kilku
              minutach.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            <FormMessage tone="info" title="Sprawdzanie tokenu resetującego..." description="Proszę czekać." />
          </CardContent>
        </Card>
      </form>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-md">
        <Card className="border-border/70 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Ustaw nowe hasło</CardTitle>
            <CardDescription>
              Wprowadź nowe hasło, którego będziesz używać do logowania. Link jest jednorazowy i wygasa po kilku
              minutach.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            {formMessage ? (
              <FormMessage tone={formMessage.tone} title={formMessage.title} description={formMessage.description} />
            ) : isTokenMissing ? (
              <FormMessage
                tone="error"
                title="Brak ważnego tokenu resetującego."
                description="Link mógł wygasnąć lub został już użyty. Poproś o nowy link."
              />
            ) : (
              <FormMessage
                tone="info"
                title="Token resetu został zweryfikowany."
                description="Po zapisaniu nowego hasła przekierujemy Cię do logowania."
              />
            )}

            {emailHint ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                Resetujesz hasło dla konta: <span className="font-medium text-foreground">{emailHint}</span>
              </div>
            ) : null}

            <div className="flex flex-col gap-5">
              <FormField
                htmlFor="password"
                label="Nowe hasło"
                required
                error={fieldErrors.password}
                hint="Min. 8 znaków, jedna wielka litera, jedna mała litera oraz cyfra."
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
                  disabled={isSubmitting || isTokenMissing}
                />
              </FormField>

              <FormField
                htmlFor="confirm-password"
                label="Potwierdź nowe hasło"
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
                  disabled={isSubmitting || isTokenMissing}
                />
              </FormField>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border/70 bg-background/40">
            <Button type="submit" className="w-full" disabled={isSubmitting || isTokenMissing}>
              {isSubmitting ? "Zapisywanie…" : "Zapisz nowe hasło"}
            </Button>
            <a className="text-center text-sm font-medium text-primary hover:underline" href="/auth/login">
              Wróć do logowania
            </a>
          </CardFooter>
        </Card>
      </form>

      <Toaster />
    </>
  );
}
