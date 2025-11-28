import { type Locator, type Page, expect } from "@playwright/test";

export class GenerationPage {
  readonly page: Page;
  readonly sourceTextInput: Locator;
  readonly generateButton: Locator;
  readonly proposalsList: Locator;
  readonly acceptAllButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sourceTextInput = page.getByTestId("source-text-input");
    this.generateButton = page.getByTestId("generate-button");
    this.proposalsList = page.getByTestId("proposals-list");
    this.acceptAllButton = page.getByTestId("accept-all-button");
  }

  async goto() {
    await this.page.goto("/");
    // Wait for potential redirects or page load
    await this.page.waitForLoadState("networkidle");

    // If redirected to login, wait for login form to be visible
    if (this.page.url().includes("/auth/login")) {
      await expect(this.page.getByRole("heading", { name: "Zaloguj się" })).toBeVisible();
    } else {
      // Ensure we are on the generation page by waiting for the button to be visible
      await expect(this.generateButton).toBeVisible();
    }
  }

  async fillSourceText(text: string) {
    await this.sourceTextInput.fill(text);
    // Verify the text was filled correctly
    await expect(this.sourceTextInput).toHaveValue(text);
  }

  async generateProposals() {
    await this.generateButton.click();
  }

  async waitForProposals() {
    await expect(this.proposalsList).toBeVisible({ timeout: 30000 });
  }

  async acceptAll() {
    await this.acceptAllButton.click();
  }

  async openSavedFlashcards() {
    // Click the link that appears after saving
    // Use getByText because the element is wrapped in a Button asChild, which might affect role accessibility tree
    await this.page.getByText("Otwórz zapisane fiszki").click();
  }
}
