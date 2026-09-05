import { readFile } from "node:fs/promises";
import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

const APP_URL = "http://127.0.0.1:4173";
const FIXED_NOW = new Date("2026-09-03T12:00:00.000Z");

interface PaymentDraft {
  readonly name: string;
  readonly amount?: string;
  readonly currency?: string;
  readonly frequency?: "weekly" | "monthly" | "quarterly" | "yearly";
  readonly nextDueDate?: string;
  readonly status?: "active" | "paused" | "archived";
  readonly category?: string;
  readonly paymentMethodLabel?: string;
  readonly freeTrialEndDate?: string;
  readonly reminderLeadDays?: string;
  readonly providerUrl?: string;
  readonly notes?: string;
}

interface PortablePayment {
  readonly id: string;
  readonly name: string;
  readonly [field: string]: unknown;
}

interface PortableBackup {
  readonly format: string;
  readonly version: number;
  readonly exportedAt: string;
  readonly payments: readonly PortablePayment[];
}

async function completeOnboarding(page: Page, currency = "USD") {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Know what’s due. Keep it yours." }),
  ).toBeVisible();

  const currencySelect = page.getByRole("combobox", {
    name: "Default currency",
  });
  if (currency !== "USD") {
    await currencySelect.selectOption(currency);
    await expect(
      page.getByRole("heading", { name: "Settings saved" }),
    ).toBeVisible();
  }

  await page
    .getByRole("button", { name: "Save and add first payment" })
    .click();
  await expect(page).toHaveURL(/\/add$/);
  await expect(
    page.getByRole("heading", { name: "Add payment" }),
  ).toBeVisible();
}

async function addPayment(page: Page, draft: PaymentDraft) {
  await page.goto("/add");
  await expect(
    page.getByRole("heading", { name: "Add payment" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).fill(draft.name);
  await page
    .getByRole("textbox", { name: "Amount" })
    .fill(draft.amount ?? "10.00");

  if (draft.currency) {
    await page
      .getByRole("combobox", { name: "Currency" })
      .selectOption(draft.currency);
  }
  if (draft.frequency) {
    await page
      .getByRole("combobox", { name: "Frequency" })
      .selectOption(draft.frequency);
  }
  if (draft.nextDueDate) {
    await page.getByLabel("Next due date").fill(draft.nextDueDate);
  }
  if (draft.status) {
    await page
      .getByRole("combobox", { name: "Status" })
      .selectOption(draft.status);
  }
  if (draft.category) {
    await page.getByRole("textbox", { name: "Category" }).fill(draft.category);
  }
  if (draft.paymentMethodLabel) {
    await page
      .getByRole("textbox", { name: "Payment method" })
      .fill(draft.paymentMethodLabel);
  }
  if (draft.freeTrialEndDate) {
    await page.getByLabel("Free-trial end date").fill(draft.freeTrialEndDate);
  }
  if (draft.reminderLeadDays) {
    await page
      .getByRole("spinbutton", { name: "Reminder lead time (days)" })
      .fill(draft.reminderLeadDays);
  }
  if (draft.providerUrl) {
    await page
      .getByRole("textbox", { name: "Provider URL" })
      .fill(draft.providerUrl);
  }
  if (draft.notes) {
    await page.getByRole("textbox", { name: "Notes" }).fill(draft.notes);
  }

  await page.getByRole("button", { name: "Add payment" }).click();
  await expect(
    page.getByRole("heading", { name: "Payments", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Payment added.")).toBeVisible();
}

const paymentRow = (page: Page, name: string): Locator =>
  page
    .locator(".payment-manifest-row")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });

const upcomingRow = (page: Page, name: string): Locator =>
  page
    .locator(".upcoming-payment-row")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });

async function tabTo(
  page: Page,
  target: Locator,
  tabKey: "Tab" | "Alt+Tab",
  maximumTabs = 40,
) {
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press(tabKey);
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
  }
  throw new Error(
    "Could not reach the expected control with keyboard navigation",
  );
}

async function uploadBackup(page: Page, backup: PortableBackup, name: string) {
  await page.getByLabel("Backup file").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByRole("heading", { name: "Import preview" }),
  ).toBeVisible();
}

async function applyImport(page: Page, mode: "merge" | "replace") {
  const reviewLabel = mode === "merge" ? "Review merge" : "Review replacement";
  const dialogName =
    mode === "merge" ? "Merge this backup?" : "Replace the local register?";
  const confirmLabel = mode === "merge" ? "Apply merge" : "Replace register";

  await page.getByRole("button", { name: reviewLabel }).click();
  const dialog = page.getByRole("alertdialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirmLabel }).click();
}

async function deleteAllPayments(page: Page) {
  await page.goto("/payments");
  let remaining = await page.locator(".payment-manifest-row").count();
  while (remaining > 0) {
    await page
      .locator(".payment-manifest-row")
      .first()
      .getByRole("button", { name: "Delete permanently" })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete permanently" })
      .click();
    remaining -= 1;
    await expect(page.locator(".payment-manifest-row")).toHaveCount(remaining);
  }
  await expect(
    page.getByRole("heading", { name: "No payments" }),
  ).toBeVisible();
}

test("creates, edits, filters, transitions, and deletes a persisted payment", async ({
  page,
}) => {
  await completeOnboarding(page, "EUR");
  await expect(page.getByRole("combobox", { name: "Currency" })).toHaveValue(
    "EUR",
  );

  await addPayment(page, {
    name: "Month-end hosting",
    amount: "12.99",
    currency: "USD",
    frequency: "monthly",
    nextDueDate: "2026-01-31",
    category: "Work",
    paymentMethodLabel: "Visa business",
    freeTrialEndDate: "2026-01-15",
    reminderLeadDays: "7",
    providerUrl: "https://example.com/manage",
    notes: "Owner: procurement",
  });

  await page.reload();
  let row = paymentRow(page, "Month-end hosting");
  await expect(row).toBeVisible();
  const editUrl = await row
    .getByRole("link", { name: "Edit" })
    .getAttribute("href");
  expect(editUrl).toBeTruthy();
  await page.goto(editUrl!);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Edit payment" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(
    "Month-end hosting",
  );
  await expect(page.getByRole("textbox", { name: "Amount" })).toHaveValue(
    "12.99",
  );
  await expect(page.getByLabel("Next due date")).toHaveValue("2026-01-31");
  await expect(
    page.getByRole("textbox", { name: "Payment method" }),
  ).toHaveValue("Visa business");
  await expect(page.getByLabel("Free-trial end date")).toHaveValue(
    "2026-01-15",
  );
  await expect(page.getByRole("textbox", { name: "Provider URL" })).toHaveValue(
    "https://example.com/manage",
  );

  await page.getByRole("textbox", { name: "Name" }).fill("Edge hosting");
  await page.getByRole("textbox", { name: "Category" }).fill("Infrastructure");
  await page.getByRole("textbox", { name: "Notes" }).fill("Owner: operations");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Payment saved.")).toBeVisible();

  row = paymentRow(page, "Edge hosting");
  await expect(row).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search register" });
  await search.fill("OWNER: OPERATIONS");
  await expect(row).toBeVisible();
  await search.fill("");
  await page
    .getByRole("combobox", { name: "Category" })
    .selectOption("Infrastructure");
  await page.getByRole("combobox", { name: "Status" }).selectOption("active");
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();

  await row.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("Edge hosting is paused.")).toBeVisible();
  await page.getByRole("combobox", { name: "Status" }).selectOption("paused");
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await row.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("Edge hosting is active again.")).toBeVisible();

  await row.getByRole("button", { name: "Archive" }).click();
  await expect(
    page.getByText("Edge hosting moved to the archive."),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Status" }).selectOption("archived");
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await row.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Edge hosting is active again.")).toBeVisible();

  await row.getByRole("button", { name: "Delete permanently" }).click();
  let dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("cannot be undone");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Delete permanently" }).click();
  dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByText("Edge hosting was permanently deleted."),
  ).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("supports onboarding and payment creation with keyboard-only operation", async ({
  browserName,
  page,
}) => {
  const tabKey = browserName === "webkit" ? "Alt+Tab" : "Tab";
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/");
  const currency = page.getByRole("combobox", { name: "Default currency" });
  await tabTo(page, currency, tabKey);
  const continueButton = page.getByRole("button", {
    name: "Save and add first payment",
  });
  await tabTo(page, continueButton, tabKey);
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Add payment" }),
  ).toBeVisible();
  const name = page.getByRole("textbox", { name: "Name" });
  await tabTo(page, name, tabKey);
  await page.keyboard.type("Keyboard plan");
  const amount = page.getByRole("textbox", { name: "Amount" });
  await tabTo(page, amount, tabKey);
  await page.keyboard.type("8.50");
  const addButton = page.getByRole("button", { name: "Add payment" });
  await tabTo(page, addButton, tabKey);
  await page.keyboard.press("Enter");

  await expect(paymentRow(page, "Keyboard plan")).toBeVisible();
  await page.reload();
  await expect(paymentRow(page, "Keyboard plan")).toBeVisible();
});

test("shows every upcoming group, separated currencies, reminders, and overdue advancement", async ({
  page,
}) => {
  await completeOnboarding(page);
  await addPayment(page, {
    name: "Overdue service",
    amount: "10.00",
    currency: "USD",
    nextDueDate: "2026-01-31",
  });
  await addPayment(page, {
    name: "Due today",
    amount: "20.00",
    currency: "USD",
    nextDueDate: "2026-09-03",
  });
  await addPayment(page, {
    name: "Reminder plan",
    amount: "30.00",
    currency: "EUR",
    nextDueDate: "2026-09-08",
    reminderLeadDays: "7",
  });
  await addPayment(page, {
    name: "Later plan",
    amount: "40.00",
    currency: "USD",
    nextDueDate: "2026-09-20",
  });
  await addPayment(page, {
    name: "Beyond plan",
    amount: "50.00",
    currency: "EUR",
    nextDueDate: "2026-10-01",
  });
  await addPayment(page, {
    name: "Paused plan",
    amount: "60.00",
    currency: "GBP",
    nextDueDate: "2026-09-03",
    status: "paused",
  });

  await page.goto("/upcoming");
  for (const [sectionClass, payment] of [
    ["overdue", "Overdue service"],
    ["today", "Due today"],
    ["nextSevenDays", "Reminder plan"],
    ["laterThisMonth", "Later plan"],
    ["beyond", "Beyond plan"],
  ] as const) {
    await expect(
      page.locator(`.upcoming-section--${sectionClass}`).getByText(payment),
    ).toBeVisible();
  }
  await expect(page.getByText("Paused plan")).toHaveCount(0);
  await expect(upcomingRow(page, "Reminder plan")).toContainText(
    "Reminder window · 7 days",
  );

  for (const period of ["Current month", "Current year"]) {
    const totals = page.getByRole("region", { name: period });
    await expect(totals.getByText("USD", { exact: true })).toBeVisible();
    await expect(totals.getByText("EUR", { exact: true })).toBeVisible();
    await expect(totals.getByText("GBP", { exact: true })).toHaveCount(0);
  }

  await upcomingRow(page, "Overdue service")
    .getByRole("button", { name: "Mark Overdue service paid" })
    .click();
  await expect(
    page.getByText("Overdue service was marked paid. Next due 2026-09-30."),
  ).toBeVisible();
  await expect(upcomingRow(page, "Overdue service")).toContainText(
    "Due 2026-09-30",
  );
});

test("round-trips backups, preserves conflicts, and rolls back a failed replacement", async ({
  page,
}, testInfo) => {
  await completeOnboarding(page);
  await addPayment(page, {
    name: "Export alpha",
    amount: "11.00",
    nextDueDate: "2026-10-31",
  });
  await addPayment(page, {
    name: "Export beta",
    amount: "22.00",
    currency: "EUR",
    nextDueDate: "2026-11-30",
  });

  await page.goto("/backup");
  await expect(page.getByText(/not encrypted/i)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const exportPath = testInfo.outputPath("dues-backup.json");
  await download.saveAs(exportPath);
  const exported = JSON.parse(
    await readFile(exportPath, "utf8"),
  ) as PortableBackup;
  expect(exported.payments).toHaveLength(2);

  await deleteAllPayments(page);
  await page.goto("/backup");
  await page.getByLabel("Backup file").setInputFiles(exportPath);
  await expect(
    page.getByRole("heading", { name: "Import preview" }),
  ).toBeVisible();
  await applyImport(page, "merge");
  await expect(
    page.getByRole("heading", { name: "Merge complete" }),
  ).toBeVisible();
  await page.goto("/payments");
  await expect(paymentRow(page, "Export alpha")).toBeVisible();
  await expect(paymentRow(page, "Export beta")).toBeVisible();

  const alpha = exported.payments.find(({ name }) => name === "Export alpha")!;
  const beta = exported.payments.find(({ name }) => name === "Export beta")!;
  const conflictBackup: PortableBackup = {
    ...exported,
    exportedAt: "2026-09-03T13:00:00.000Z",
    payments: [
      { ...alpha, name: "Imported overwrite attempt" },
      beta,
      { ...alpha, id: "merged-new-record", name: "Merged newcomer" },
    ],
  };
  await page.goto("/backup");
  await uploadBackup(page, conflictBackup, "conflicts.json");
  const conflictCount = page
    .locator(".backup-preview-counts div")
    .filter({ hasText: "Conflicts" })
    .locator("dd");
  await expect(conflictCount).toHaveText("2");
  await applyImport(page, "merge");
  await expect(
    page.getByRole("heading", { name: "Merge complete" }),
  ).toBeVisible();
  await page.goto("/payments");
  await expect(paymentRow(page, "Export alpha")).toBeVisible();
  await expect(paymentRow(page, "Merged newcomer")).toBeVisible();
  await expect(page.getByText("Imported overwrite attempt")).toHaveCount(0);

  const replacementRecord = {
    ...alpha,
    id: "replacement-record",
    name: "Replacement only",
  };
  const replacementBackup: PortableBackup = {
    ...exported,
    exportedAt: "2026-09-03T14:00:00.000Z",
    payments: [replacementRecord],
  };
  await page.goto("/backup");
  await uploadBackup(page, replacementBackup, "replacement.json");
  await applyImport(page, "replace");
  await expect(
    page.getByRole("heading", { name: "Replacement complete" }),
  ).toBeVisible();
  await page.goto("/payments");
  await expect(paymentRow(page, "Replacement only")).toBeVisible();
  await expect(page.locator(".payment-manifest-row")).toHaveCount(1);

  const failedBackup: PortableBackup = {
    ...exported,
    exportedAt: "2026-09-03T15:00:00.000Z",
    payments: [
      { ...replacementRecord, name: "Rolled-back update" },
      { ...alpha, id: "force-transaction-failure", name: "Must not persist" },
    ],
  };
  await page.goto("/backup");
  await uploadBackup(page, failedBackup, "failed-replacement.json");
  await page.evaluate(() => {
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (value, key) {
      if (
        typeof value === "object" &&
        value !== null &&
        "id" in value &&
        value.id === "force-transaction-failure"
      ) {
        throw new DOMException("Injected test failure", "QuotaExceededError");
      }
      return originalAdd.call(this, value, key);
    };
  });
  await applyImport(page, "replace");
  await expect(
    page.getByRole("heading", {
      name: /out of storage space|operation could not be completed/i,
    }),
  ).toBeVisible();

  await page.reload();
  await page.goto("/payments");
  await expect(paymentRow(page, "Replacement only")).toBeVisible();
  await expect(page.getByText("Rolled-back update")).toHaveCount(0);
  await expect(page.getByText("Must not persist")).toHaveCount(0);
  await expect(page.locator(".payment-manifest-row")).toHaveCount(1);
});

test("reopens the persisted register in a new browser context while offline", async ({
  browser,
  browserName,
}, testInfo) => {
  test.skip(
    browserName === "webkit",
    "Playwright WebKit blocks cold offline navigation before a persisted service worker starts.",
  );
  const browserType = browser.browserType();
  const profile = testInfo.outputPath("offline-profile");
  let persistentContext: BrowserContext | undefined;

  try {
    persistentContext = await browserType.launchPersistentContext(profile, {
      baseURL: APP_URL,
      timezoneId: "UTC",
    });
    let page =
      persistentContext.pages()[0] ?? (await persistentContext.newPage());
    await completeOnboarding(page);
    await addPayment(page, {
      name: "Offline survivor",
      amount: "9.00",
      nextDueDate: "2026-09-30",
    });
    await page.waitForFunction(async () =>
      Boolean(await navigator.serviceWorker?.ready),
    );
    await page.reload();
    await expect(paymentRow(page, "Offline survivor")).toBeVisible();
    await persistentContext.close();
    persistentContext = undefined;

    persistentContext = await browserType.launchPersistentContext(profile, {
      baseURL: APP_URL,
      timezoneId: "UTC",
    });
    await persistentContext.route("**/*", (route) =>
      route.abort("internetdisconnected"),
    );
    page = persistentContext.pages()[0] ?? (await persistentContext.newPage());
    await page.goto("/payments");
    await expect(
      page.getByRole("heading", { name: "Payments", exact: true }),
    ).toBeVisible();
    await expect(paymentRow(page, "Offline survivor")).toBeVisible();
  } finally {
    await persistentContext?.close();
  }
});
