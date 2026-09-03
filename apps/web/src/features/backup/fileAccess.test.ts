import { describe, expect, it, vi } from "vitest";
import { browserBackupFileAccess } from "./fileAccess";

describe("browser backup file access", () => {
  it("reads file contents as UTF-8 text", async () => {
    const file = new File(["₹ café — due"], "unicode.json", {
      type: "application/json",
    });

    await expect(browserBackupFileAccess.readText(file)).resolves.toBe(
      "₹ café — due",
    );
  });

  it("downloads JSON through a short-lived object URL", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:dues-backup");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const originalCreateObjectURL = Object.getOwnPropertyDescriptor(
      URL,
      "createObjectURL",
    );
    const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(
      URL,
      "revokeObjectURL",
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    try {
      browserBackupFileAccess.download({
        filename: "dues-backup-2026-09-03.json",
        mediaType: "application/json",
        contents: "{}\n",
      });
      const link = click.mock.instances[0];
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(link?.download).toBe("dues-backup-2026-09-03.json");
      expect(link?.rel).toBe("noopener");
      expect(link?.href).toBe("blob:dues-backup");
      expect(document.body).not.toContainElement(link ?? null);
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:dues-backup");
    } finally {
      vi.useRealTimers();
      click.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
      } else {
        Reflect.deleteProperty(URL, "createObjectURL");
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
      } else {
        Reflect.deleteProperty(URL, "revokeObjectURL");
      }
    }
  });
});
