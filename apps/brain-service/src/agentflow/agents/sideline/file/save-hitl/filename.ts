import { isSafeWorkspaceSegment } from "@fambrain/corpus";

/** 建议名：untitled-{time}，不含 .txt */
export const suggestedVaultSaveBasename = (): string =>
  `untitled-${Date.now().toString(36)}`;

/**
 * 用户输入 → workspace 基名（不含 .txt）。
 * 剥后缀、路径分隔、控制字符；空则 null。
 */
export const sanitizeVaultSaveBasename = (raw: string): string | null => {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/[/\\]/g, "");
  s = s.replace(/\.txt$/i, "");
  s = s.replace(/\.{2,}/g, ".");
  s = s.replace(/[<>:"|?*\x00-\x1f]/g, "");
  s = s.trim().replace(/^\.+|\.+$/g, "");
  if (!s || s === "." || s === "..") return null;
  const withExt = `${s}.txt`;
  if (!isSafeWorkspaceSegment(withExt) && !isSafeWorkspaceSegment(s)) {
    return null;
  }
  return s.slice(0, 80);
};
