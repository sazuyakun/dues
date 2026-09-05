import { expect, test } from "@playwright/test";

test("persists resumable onboarding and opens the first-payment route", async ({
  page,
}) => {
  await page.goto("/backup");
  await expect(
    page.getByRole("heading", { name: "Set up Dues" }),
  ).toBeVisible();

  const currency = page.getByRole("combobox", { name: "Default currency" });
  await currency.selectOption("EUR");
  await expect(
    page.getByRole("heading", { name: "Settings saved" }),
  ).toBeVisible();

  await page.reload();
  await expect(currency).toHaveValue("EUR");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/add$/);
  await expect(
    page.getByRole("heading", { name: "Add payment" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Add payment" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Set up Dues" })).toHaveCount(
    0,
  );
});
