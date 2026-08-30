import { expect, test } from "@playwright/test";

test("loads the application shell and navigates", async ({ page }) => {
  const externalRequests: string[] = [];
  const browserErrors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:4173") {
      externalRequests.push(request.url());
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Know what's due." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  expect(externalRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("reopens the precached shell while offline", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForFunction(async () =>
    Boolean(await navigator.serviceWorker?.ready),
  );
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Know what's due." }),
  ).toBeVisible();
});
