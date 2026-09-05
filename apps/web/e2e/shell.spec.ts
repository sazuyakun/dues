import { expect, test } from "@playwright/test";

async function completeOnboarding(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Know what’s due. Keep it yours." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save and add first payment" })
    .click();
  await expect(page).toHaveURL(/\/add$/);
}

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

  await completeOnboarding(page);
  await page.goto("/upcoming");
  await expect(
    page.getByRole("heading", { name: "Upcoming", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  expect(externalRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("reopens the precached shell while offline", async ({
  browserName,
  page,
  context,
}) => {
  test.skip(
    browserName === "webkit",
    "Playwright WebKit blocks offline navigation before its service worker can respond.",
  );
  await completeOnboarding(page);
  await page.goto("/upcoming");
  await page.waitForFunction(async () =>
    Boolean(await navigator.serviceWorker?.ready),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Upcoming", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Upcoming", exact: true }),
  ).toBeVisible();
});

test("keeps the field log usable at wide and narrow viewports", async ({
  browserName,
  page,
}) => {
  const routes = ["upcoming", "payments", "add", "backup", "settings"];
  await completeOnboarding(page);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });

    for (const route of routes) {
      await page.goto(`/${route}`);
      const viewport = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(viewport.scrollWidth).toBe(viewport.clientWidth);
    }
  }

  await page.goto("/add");
  const dateFields = page.locator("#payment-next-due, #payment-trial-end");
  await expect(dateFields).toHaveCount(2);
  const dateFieldsAreContained = await dateFields.evaluateAll((inputs) =>
    inputs.every((input) => {
      const field = input.closest(".form-field");
      const fieldset = input.closest("fieldset");
      if (!field || !fieldset) return false;

      return (
        getComputedStyle(field).minWidth === "0px" &&
        input.getBoundingClientRect().right <=
          fieldset.getBoundingClientRect().right
      );
    }),
  );
  expect(dateFieldsAreContained).toBe(true);

  await page.goto("/upcoming");
  const navigationTargets = page.getByRole("navigation", {
    name: "Main navigation",
  });
  const heights = await navigationTargets
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => link.getBoundingClientRect().height),
    );
  expect(heights.every((height) => height >= 44)).toBe(true);

  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  const focusStyle = await page
    .locator(":focus-visible")
    .evaluate((element) => {
      const styles = getComputedStyle(element);
      return { style: styles.outlineStyle, width: styles.outlineWidth };
    });
  expect(focusStyle.style).toBe("solid");
  expect(Number.parseFloat(focusStyle.width)).toBeGreaterThanOrEqual(2);
});
