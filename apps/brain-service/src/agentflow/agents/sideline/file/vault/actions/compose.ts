/**
 * 两层 list → AssistantMessageBlock（actions + text）。
 */
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { VaultWorkspaceEntry } from "@fambrain/corpus";
import {
  vaultWsCreateFilePrompt,
  vaultWsCreateFolderPrompt,
  vaultWsDeleteFilePrompt,
  vaultWsDeleteFolderPrompt,
  vaultWsDoneAction,
  vaultWsListPrompt,
  vaultWsOpenPrompt,
} from "./prompts";

/** 每轮 HITL 暂停都带「结束」，点后节点 return 走出图。 */
export const withVaultHitlDone = (
  blocks: AssistantMessageBlock[],
  language?: "zh" | "en"
): AssistantMessageBlock[] => [
  ...blocks,
  { type: "actions", actions: [vaultWsDoneAction(language)] },
];

export const buildVaultWorkspaceListBlocks = (input: {
  folderRel: string;
  entries: VaultWorkspaceEntry[];
  language?: "zh" | "en";
}): { plainText: string; blocks: AssistantMessageBlock[] } => {
  const zh = input.language !== "en";
  const folder = input.folderRel || "(根目录)";
  const blocks: AssistantMessageBlock[] = [];

  if (input.folderRel) {
    const parent = input.folderRel.includes("/")
      ? input.folderRel.replace(/\/[^/]+$/, "")
      : "";
    blocks.push({
      type: "actions",
      actions: [
        {
          id: "vault-ws-up",
          label: zh ? "返回上级" : "Up",
          prompt: vaultWsListPrompt(parent),
          displayText: zh ? "返回上级文件夹" : "Go up",
        },
      ],
    });
  }

  if (input.entries.length === 0) {
    const plain = zh
      ? `原文库「${folder}」暂无文件或文件夹。可新建文件夹（自行分类）或新建 txt。`
      : `Workspace "${folder}" is empty. Create a folder or a .txt file.`;
    blocks.push({ type: "text", markdown: plain });
    blocks.push({
      type: "actions",
      actions: [
        {
          id: "vault-ws-new-folder",
          label: zh ? "新建文件夹" : "New folder",
          prompt: vaultWsCreateFolderPrompt(input.folderRel),
          displayText: zh ? "新建文件夹" : "New folder",
        },
        {
          id: "vault-ws-new-file",
          label: zh ? "新建 txt" : "New txt",
          prompt: vaultWsCreateFilePrompt(input.folderRel),
          displayText: zh ? "新建 txt 文件" : "New txt file",
        },
      ],
    });
    return { plainText: plain, blocks };
  }

  const lines = input.entries.map((e) =>
    e.kind === "folder" ? `📁 ${e.name}/` : `📄 ${e.name}`
  );
  const plain = zh
    ? `原文库「${folder}」共 ${input.entries.length} 项：\n${lines.join("\n")}`
    : `Workspace "${folder}" (${input.entries.length}):\n${lines.join("\n")}`;
  blocks.push({ type: "text", markdown: plain });

  const actions: AssistantMessageBlock & { type: "actions" } = {
    type: "actions",
    actions: [],
  };
  for (const e of input.entries) {
    if (e.kind === "folder") {
      actions.actions.push({
        id: `open-dir-${e.relativePath}`,
        label: `${e.name}/`,
        prompt: vaultWsListPrompt(e.relativePath),
        displayText: zh ? `打开文件夹 ${e.name}` : `Open folder ${e.name}`,
      });
      actions.actions.push({
        id: `del-dir-${e.relativePath}`,
        label: zh ? `删除 ${e.name}/` : `Delete ${e.name}/`,
        prompt: vaultWsDeleteFolderPrompt(e.relativePath),
        displayText: zh
          ? `删除文件夹 ${e.name}（含内文件）`
          : `Delete folder ${e.name}`,
      });
    } else {
      actions.actions.push({
        id: `open-${e.relativePath}`,
        label: e.name,
        prompt: vaultWsOpenPrompt(e.relativePath),
        displayText: zh ? `打开 ${e.name}` : `Open ${e.name}`,
      });
      actions.actions.push({
        id: `del-${e.relativePath}`,
        label: zh ? `删除 ${e.name}` : `Delete ${e.name}`,
        prompt: vaultWsDeleteFilePrompt(e.relativePath),
        displayText: zh ? `删除 ${e.name}` : `Delete ${e.name}`,
      });
    }
  }
  actions.actions.push({
    id: "vault-ws-new-folder",
    label: zh ? "新建文件夹" : "New folder",
    prompt: vaultWsCreateFolderPrompt(input.folderRel),
  });
  actions.actions.push({
    id: "vault-ws-new-file",
    label: zh ? "新建 txt" : "New txt",
    prompt: vaultWsCreateFilePrompt(input.folderRel),
  });
  blocks.push(actions);
  return { plainText: plain, blocks };
};
