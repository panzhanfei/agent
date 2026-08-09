/**
 * vault workspace 执行：list/CRUD + 语料化/硬删同步（同步执行；队列可选加速）。
 */
import {
  createVaultWorkspaceFolder,
  createVaultWorkspaceTxt,
  deleteVaultWorkspaceFolder,
  deleteVaultWorkspaceTxt,
  listVaultWorkspaceDir,
  materializeWorkspaceTxt,
  purgeWorkspaceMaterialized,
  purgeWorkspaceTxtCascade,
  readVaultWorkspaceTxt,
  writeVaultWorkspaceTxt,
} from "@fambrain/corpus";
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import { buildVaultWorkspaceListBlocks } from "./compose-actions";
import type { VaultWorkspaceParams } from "./interface";
import { VAULT_WORKSPACE_OPS } from "./interface";
import {
  enqueueCorpusMaterialize,
  enqueueCorpusPurge,
  isCorpusQueueEnabled,
} from "@fambrain/infra";

export const parseVaultWorkspaceParams = (
  raw: Record<string, unknown> | undefined | null
): VaultWorkspaceParams | null => {
  if (!raw || typeof raw !== "object") return null;
  const op = String(raw.operation ?? raw.op ?? "").trim().toLowerCase();
  if (!(VAULT_WORKSPACE_OPS as readonly string[]).includes(op)) return null;
  return {
    operation: op as VaultWorkspaceParams["operation"],
    targetPath:
      typeof raw.targetPath === "string"
        ? raw.targetPath
        : typeof raw.target_path === "string"
          ? raw.target_path
          : "",
    name: typeof raw.name === "string" ? raw.name : null,
    afterContent:
      typeof raw.afterContent === "string"
        ? raw.afterContent
        : typeof raw.after_content === "string"
          ? raw.after_content
          : null,
    recursive: Boolean(raw.recursive),
  };
};

export type VaultWorkspaceRunResult = {
  ok: boolean;
  answer: string;
  blocks?: AssistantMessageBlock[];
  error?: string;
  syncNote?: string;
};

const syncMaterialize = async (
  corpusUserId: string,
  workspaceRel: string
): Promise<string> => {
  if (isCorpusQueueEnabled()) {
    await enqueueCorpusMaterialize({ corpusUserId, workspaceRel });
    return "已入队语料化（异步更新 md/向量）";
  }
  await materializeWorkspaceTxt({
    corpusUserId,
    workspaceRel,
    indexAfter: true,
  });
  return "已同步语料化并更新向量";
};

const syncPurge = async (
  corpusUserId: string,
  workspaceRels: string[]
): Promise<string> => {
  if (isCorpusQueueEnabled()) {
    await enqueueCorpusPurge({ corpusUserId, workspaceRels });
    return "已入队硬删语料/向量";
  }
  await purgeWorkspaceTxtCascade({ corpusUserId, workspaceRels });
  return "已硬删对应 md 与向量";
};

export const runVaultWorkspaceOp = async (input: {
  corpusUserId: string;
  params: VaultWorkspaceParams;
  language?: "zh" | "en";
}): Promise<VaultWorkspaceRunResult> => {
  const zh = input.language !== "en";
  const { corpusUserId, params } = input;
  const folderRel = (params.targetPath ?? "").trim();

  try {
    switch (params.operation) {
      case "list": {
        const entries = await listVaultWorkspaceDir(corpusUserId, folderRel);
        const built = buildVaultWorkspaceListBlocks({
          folderRel,
          entries,
          language: input.language,
        });
        return {
          ok: true,
          answer: built.plainText,
          blocks: built.blocks,
        };
      }
      case "open": {
        const body = await readVaultWorkspaceTxt(corpusUserId, folderRel);
        const answer = zh
          ? `【${folderRel}】\n\n\`\`\`txt\n${body}\n\`\`\``
          : `【${folderRel}】\n\n\`\`\`txt\n${body}\n\`\`\``;
        return {
          ok: true,
          answer,
          blocks: [
            { type: "text", markdown: answer },
            {
              type: "actions",
              actions: [
                {
                  id: "back-list",
                  label: zh ? "返回列表" : "Back to list",
                  prompt: `__FAMBRAIN_VAULT_WS_LIST__:${folderRel.includes("/") ? folderRel.replace(/\/[^/]+$/, "") : ""}`,
                },
              ],
            },
          ],
        };
      }
      case "create_folder": {
        const name = params.name?.trim();
        if (!name) {
          return {
            ok: false,
            answer: zh
              ? "请提供文件夹名称（可再说一次并带上名称）。"
              : "Please provide a folder name.",
            error: "missing_name",
          };
        }
        const created = await createVaultWorkspaceFolder(
          corpusUserId,
          folderRel,
          name
        );
        const entries = await listVaultWorkspaceDir(corpusUserId, folderRel);
        const built = buildVaultWorkspaceListBlocks({
          folderRel,
          entries,
          language: input.language,
        });
        return {
          ok: true,
          answer: zh
            ? `已新建文件夹 ${created.relativePath}\n\n${built.plainText}`
            : `Created folder ${created.relativePath}\n\n${built.plainText}`,
          blocks: built.blocks,
        };
      }
      case "create_file": {
        const name = params.name?.trim() || "untitled.txt";
        const content = params.afterContent ?? "";
        const created = await createVaultWorkspaceTxt(
          corpusUserId,
          folderRel,
          name,
          content
        );
        const note = await syncMaterialize(corpusUserId, created.relativePath);
        return {
          ok: true,
          answer: zh
            ? `已新建 ${created.relativePath}。${note}`
            : `Created ${created.relativePath}. ${note}`,
          syncNote: note,
        };
      }
      case "update": {
        if (!folderRel.toLowerCase().endsWith(".txt")) {
          return {
            ok: false,
            answer: zh ? "更新仅支持 .txt 路径。" : "Update requires a .txt path.",
            error: "not_txt",
          };
        }
        const content = params.afterContent ?? "";
        await writeVaultWorkspaceTxt(corpusUserId, folderRel, content);
        const note = await syncMaterialize(corpusUserId, folderRel);
        return {
          ok: true,
          answer: zh
            ? `已更新 ${folderRel}。${note}`
            : `Updated ${folderRel}. ${note}`,
          syncNote: note,
        };
      }
      case "delete_file": {
        await deleteVaultWorkspaceTxt(corpusUserId, folderRel);
        const note = await syncPurge(corpusUserId, [folderRel]);
        return {
          ok: true,
          answer: zh
            ? `已硬删除 ${folderRel}。${note}`
            : `Hard-deleted ${folderRel}. ${note}`,
          syncNote: note,
        };
      }
      case "delete_folder": {
        const { deletedTxtRels } = await deleteVaultWorkspaceFolder(
          corpusUserId,
          folderRel,
          { recursive: params.recursive !== false }
        );
        const note =
          deletedTxtRels.length > 0
            ? await syncPurge(corpusUserId, deletedTxtRels)
            : zh
              ? "文件夹已删（无 txt）"
              : "Folder removed (no txt)";
        return {
          ok: true,
          answer: zh
            ? `已硬删除文件夹 ${folderRel}（${deletedTxtRels.length} 个 txt）。${note}`
            : `Hard-deleted folder ${folderRel} (${deletedTxtRels.length} txt). ${note}`,
          syncNote: note,
        };
      }
      default:
        return {
          ok: false,
          answer: zh ? "不支持的操作。" : "Unsupported operation.",
          error: "bad_op",
        };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      answer: zh ? `原文库操作失败：${msg}` : `Vault workspace error: ${msg}`,
      error: msg,
    };
  }
};

/** 供单测：强制同步 purge 单文件 md+向量 */
export const purgeOneForTest = purgeWorkspaceMaterialized;
