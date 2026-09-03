import type { BackupDownload } from "../../app/index";

export interface BackupFileAccess {
  readText(file: File): Promise<string>;
  download(backup: BackupDownload): void;
}

const readText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Backup file did not contain text"));
      }
    });
    reader.addEventListener("error", () => {
      reject(new Error("Backup file could not be read"));
    });
    reader.addEventListener("abort", () => {
      reject(new Error("Backup file reading was cancelled"));
    });
    reader.readAsText(file, "UTF-8");
  });

const download = (backup: BackupDownload): void => {
  const blob = new Blob([backup.contents], {
    type: `${backup.mediaType};charset=utf-8`,
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    link.href = objectUrl;
    link.download = backup.filename;
    link.rel = "noopener";
    link.hidden = true;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
};

export const browserBackupFileAccess: BackupFileAccess = {
  readText,
  download,
};
