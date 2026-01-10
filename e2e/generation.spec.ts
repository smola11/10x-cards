import { test, expect } from "@playwright/test";
import { GenerationPage } from "./page-objects/GenerationPage";

test.describe("Flashcards Generation", () => {
  test("should generate and accept flashcards from text", async ({ page }) => {
    // Mock the external OpenRouter API endpoint - must be set up before any page navigation
    await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "gen-mock-123",
          model: "openai/gpt-oss-20b:free",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({
                  proposals: [
                    { front: "What is TypeScript?", back: "A typed superset of JavaScript" },
                    { front: "What is Astro?", back: "A modern web framework" },
                  ],
                }),
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
      });
    });

    const generationPage = new GenerationPage(page);

    // Bypass auth by setting a bypass cookie
    await page.context().addCookies([
      {
        name: "e2e-bypass-auth",
        value: "true",
        domain: "localhost",
        path: "/",
      },
    ]);

    await generationPage.goto();

    // Arrange
    const sourceText = "To jest przykładowy tekst, który ma co najmniej 1000 znaków. ".repeat(20);

    // Act
    await generationPage.fillSourceText(sourceText);
    await generationPage.generateProposals();
    await generationPage.waitForProposals();
    await generationPage.acceptAll();

    // Assert
    await expect(page.getByText("Dodano 2 fiszek do Twojej kolekcji.", { exact: true })).toBeVisible();
    await generationPage.openSavedFlashcards();
    await expect(page).toHaveURL(/.*flashcards\?generationId=.*/);
  });
});
