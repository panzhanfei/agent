import { filesFromInput, type UploadDocumentItem } from "./upload-documents";

export type ExtractFileResult = {
  fileName: string;
  title: string;
  text: string;
  format: string;
  ok: boolean;
  error?: string;
  textLength: number;
};

export type ExtractBatchResult = {
  batchId: string;
  files: ExtractFileResult[];
  okCount: number;
  failCount: number;
  error?: string;
};

export type ExtractDocumentsOutcome =
  | { ok: true; result: ExtractBatchResult }
  | { ok: false; error: string };

const MAX_FILES = 20;

/** 解开嵌套 error JSON，便于展示 multimodal / vision 提示 */
const unwrapErrorMessage = (raw: string): string => {
  let message = raw.trim();
  for (let i = 0; i < 3; i += 1) {
    try {
      const parsed = JSON.parse(message) as {
        error?: string | { message?: string };
        message?: string;
      };
      if (typeof parsed.error === "string") {
        message = parsed.error;
        continue;
      }
      if (parsed.error && typeof parsed.error === "object" && parsed.error.message) {
        message = parsed.error.message;
        continue;
      }
      if (typeof parsed.message === "string") {
        message = parsed.message;
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return message;
};

/** 聊天发送时：抽取文本并暂存（不入库）。 */
export const extractDocuments = async (options: {
  files: UploadDocumentItem[];
  signal?: AbortSignal;
}): Promise<ExtractDocumentsOutcome> => {
  const { files, signal } = options;
  if (files.length === 0) {
    return { ok: false, error: "请选择至少 1 个文件" };
  }
  if (files.length > MAX_FILES) {
    return { ok: false, error: `单次最多 ${MAX_FILES} 个附件` };
  }

  const formData = new FormData();
  for (const item of files) {
    formData.append("files", item.file, item.file.name);
  }

  let res: Response;
  try {
    res = await fetch("/api/documents/extract", {
      method: "POST",
      body: formData,
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, error: "已取消附件抽取" };
    }
    return { ok: false, error: "无法连接服务器，请确认 Brain 服务已启动" };
  }

  let payload: ExtractBatchResult & { error?: string };
  try {
    payload = (await res.json()) as ExtractBatchResult & { error?: string };
  } catch {
    return {
      ok: false,
      error: `附件抽取失败（HTTP ${res.status}）`,
    };
  }

  if (!res.ok) {
    const raw =
      typeof payload.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : `附件抽取失败（HTTP ${res.status}）`;
    const fileErr = payload.files?.find((f) => f.error)?.error;
    return { ok: false, error: unwrapErrorMessage(fileErr || raw) };
  }

  if (!payload.batchId || !payload.okCount) {
    const fileErr =
      payload.files?.find((f) => f.error)?.error ??
      payload.error ??
      "未能从附件提取有效文本";
    return { ok: false, error: fileErr };
  }

  return { ok: true, result: payload };
};

export { filesFromInput };
