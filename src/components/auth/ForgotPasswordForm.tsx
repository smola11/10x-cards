import { useCallback, useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from "@/components/ui/use-toast";
import { FormField, FormMessage } from "./FormField";
import { supabaseClient } from "@/db/supabase.client";

const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "Adres email jest wymagany." })
    .trim()
    .min(1, "Adres email jest wymagany.")
    .email("Podaj poprawny adres email."),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordForm() {
  const initialValues = useMemo<ForgotPasswordValues>(
    () => ({
      email: "",
    }),
    []
  );

  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ForgotPasswordValues, string>>>({});
  const [formMessage, setFormMessage] = useState<{
    tone: "error" | "info" | "success";
    title: string;
    description?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback(
    <Key extends keyof ForgotPasswordValues>(field: Key, value: ForgotPasswordValues[Key]) => {
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

      const result = forgotPasswordSchema.safeParse(values);

      if (!result.success) {
        const nextErrors: Partial<Record<keyof ForgotPasswordValues, string>> = {};
        const issues = result.error.flatten().fieldErrors;
        for (const key of Object.keys(issues) as (keyof ForgotPasswordValues)[]) {
          const message = issues[key]?.[0];
          if (message) {
            nextErrors[key] = message;
          }
        }

        setFieldErrors(nextErrors);
        setFormMessage({
          tone: "error",
          title: "Nie możemy wysłać wiadomości.",
          description: "Sprawdź poprawność adresu email i spróbuj ponownie.",
        });
        setIsSubmitting(false);
        return;
      }
      try {
        const origin = window.location.origin;
        const redirectTo = `${origin}/auth/reset-password`;

        const { error } = await supabaseClient.auth.resetPasswordForEmail(values.email, {
          redirectTo,
        });

        if (error) {
          // Nie ujawniamy, czy konto istnieje – komunikat zawsze neutralny.
          console.error("resetPasswordForEmail error", error);
          setFormMessage({
            tone: "error",
            title: "Nie możemy wysłać wiadomości.",
            description: "Spróbuj ponownie za chwilę. Jeśli problem się powtarza, skontaktuj się z nami.",
          });
          setIsSubmitting(false);
          return;
        }

        toast({
          variant: "success",
          title: "Jeśli podany email istnieje w systemie, wysłaliśmy link resetujący.",
          description: "Sprawdź skrzynkę odbiorczą oraz folder spam.",
        });

        setFormMessage({
          tone: "success",
          title: "Sprawdź skrzynkę odbiorczą.",
          description: "Jeśli podany adres jest powiązany z kontem, otrzymasz wiadomość z linkiem do resetu hasła.",
        });
        setIsSubmitting(false);
      } catch (error) {
        console.error("ForgotPasswordForm submit failed", error);
        setFormMessage({
          tone: "error",
          title: "Wystąpił błąd.",
          description: "Nieoczekiwany błąd podczas wysyłania wiadomości. Spróbuj ponownie.",
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
            <CardTitle>Reset hasła</CardTitle>
            <CardDescription>Podaj adres email powiązany z kontem, a wyślemy link do resetu.</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            {formMessage ? (
              <FormMessage tone={formMessage.tone} title={formMessage.title} description={formMessage.description} />
            ) : (
              <FormMessage
                tone="info"
                title="Wprowadź email powiązany z kontem."
                description="Jeśli konta nie ma w systemie, dla bezpieczeństwa nie poinformujemy o tym explicite."
              />
            )}

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
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border/70 bg-background/40">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Wysyłanie…" : "Wyślij link resetujący"}
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
