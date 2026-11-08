import { describe, expect, it } from "vitest";
// @ts-expect-error Railway companion is plain JavaScript.
import { backupDue, privateFolder, driveHeaders } from "./drive-backup-core.mjs";

describe("private platform Drive backups", () => {
  it("does not run until explicitly requested or enabled", () => {
    expect(backupDue({})).toBe(false);
    expect(backupDue({ enabled: false, requestId: "new", completedRequestId: "old" })).toBe(true);
    expect(backupDue({ enabled: false, requestId: "same", completedRequestId: "same" })).toBe(false);
  });
  it("recovers a crashed running backup after thirty minutes without overlapping a fresh one", () => {
    const settings = { status: "running", lastAttemptAt: new Date(0).toISOString() };
    expect(backupDue(settings, 1799999)).toBe(false);
    expect(backupDue(settings, 1800000)).toBe(true);
  });
  it.each([6, 12, 24])("enforces the selected %s-hour interval", (hours) => {
    const settings = { enabled: true, intervalHours: hours, lastAttemptAt: new Date(0).toISOString() };
    expect(backupDue(settings, hours * 3600000 - 1)).toBe(false);
    expect(backupDue(settings, hours * 3600000)).toBe(true);
    expect(backupDue({ ...settings, intervalHours: 1 }, 86400000)).toBe(false);
  });
  it("rejects shared, unknown, trashed and non-folder destinations", () => {
    const folder = { mimeType: "application/vnd.google-apps.folder", permissions: [{ type: "user", role: "owner" }] };
    expect(privateFolder(folder)).toBe(true);
    expect(privateFolder({ ...folder, permissions: [...folder.permissions, { type: "anyone", role: "reader" }] })).toBe(false);
    expect(privateFolder({ ...folder, permissions: undefined })).toBe(false);
    expect(privateFolder({ ...folder, trashed: true })).toBe(false);
    expect(privateFolder({ ...folder, mimeType: "text/plain" })).toBe(false);
  });
  it("requires both gateway credentials, with no direct-provider fallback", () => {
    expect(() => driveHeaders({})).toThrow("not configured");
    expect(() => driveHeaders({ LOVABLE_API_KEY: "test-only" })).toThrow("not configured");
    expect(Object.keys(driveHeaders({ LOVABLE_API_KEY: "test-only", GOOGLE_DRIVE_API_KEY: "test-only" }))).toEqual(["Authorization", "X-Connection-Api-Key"]);
  });
});