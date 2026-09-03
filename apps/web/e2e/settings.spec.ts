import { expect, test, type Page } from "@playwright/test";

async function completeOnboarding(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Save and add first payment" })
    .click();
  await expect(page).toHaveURL(/\/add$/);
}

test("persists default currency and appearance", async ({ page }) => {
  await completeOnboarding(page);
  await page.goto("/settings");

  const currency = page.getByRole("combobox", { name: "Default currency" });
  await currency.selectOption("INR");
  await expect(
    page.getByRole("heading", { name: "Settings saved" }),
  ).toBeVisible();

  await page.getByText("Paper", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("radio", { name: /paper/i })).toBeChecked();

  await page.reload();
  await expect(currency).toHaveValue("INR");
  await expect(page.getByRole("radio", { name: /paper/i })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("reacts to operating-system theme changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await completeOnboarding(page);
  await page.goto("/settings");
  await expect(page.getByRole("radio", { name: /system/i })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
