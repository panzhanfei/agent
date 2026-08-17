/** 助手消息结构化块（列举型 UI + composite 分段） */

export type EnumerationListKind = "project" | "employer";

export type EnumerationListItem = {
    id: string;
    title: string;
    subtitle?: string;
    path: string;
    excerpt?: string;
};

export type AssistantMessageBlock =
    | { type: "heading"; text: string; sectionNo?: number }
    | { type: "text"; markdown: string }
    | {
          type: "enumeration";
          listKind: EnumerationListKind;
          items: EnumerationListItem[];
          total: number;
          shown: number;
          page: number;
          pageSize: number;
          hasMore: boolean;
          /** 本页首项在全库列表中的序号（分页续问从 9、21… 起） */
          startIndex?: number;
          /** 分页说明（Web 展示，与纯文本 footer 一致） */
          paginationHint?: string;
      }
    | {
          type: "actions";
          actions: Array<{
              id: string;
              label: string;
              /** 发给后端的 exact-match / 工具 prompt（可含内部前缀） */
              prompt: string;
              /** 用户气泡展示文案；缺省用 label，不展示 prompt */
              displayText?: string;
              /** 历史卡片作废时由客户端置位 */
              disabled?: boolean;
              /**
               * chat：走消息发送；open_editor：客户端打开双模式编辑器（不发聊天）；
               * vault_save_name：打开文件名弹窗，确认后才 Resume
               */
              clientHandler?: "chat" | "open_editor" | "vault_save_name";
          }>;
      };

export type AssistantMessagePayload = {
    /** 纯文本 fallback（搜索、通知、旧客户端） */
    plainText: string;
    blocks: AssistantMessageBlock[];
};
