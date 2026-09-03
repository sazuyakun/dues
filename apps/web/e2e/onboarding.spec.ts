import { expect, test } from "@playwright/test";

test("persists resumable onboarding and opens the first-payment route", async ({
  page,
}) => {
  await page.goto("/backup");
  await expect(
    page.getByRole("heading", { name: "Know what’s due. Keep it yours." }),
  ).toBeVisible();
  await expect(
    page.getByText(/no account, analytics, advertising/i),
  ).toBeVisible();

  const currency = page.getByRole("combobox", { name: "Default currency" });
  await currency.selectOption("EUR");
  await expect(
    page.getByRole("heading", { name: "Settings saved" }),
  ).toBeVisible();

  await page.reload();
  await expect(currency).toHaveValue("EUR");
  await page
    .getByRole("button", { name: "Save and add first payment" })
    .click();
  await expect(page).toHaveURL(/\/add$/);
  await expect(
    page.getByRole("heading", { name: "Add payment" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Add payment" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Know what’s due. Keep it yours." }),
  ).toHaveCount(0);
});
