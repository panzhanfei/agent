"use client";

import type { AssistantMessageBlock } from "@fambrain/brain-types";
import { LinkifiedText } from "@/components/chat/linkified-text";
import {
  actionIsStale,
  type ChatActionPayload,
} from "@/lib/chat/action-lifecycle";

type EnumerationBlockProps = {
  block: Extract<AssistantMessageBlock, { type: "enumeration" }>;
};

export const EnumerationBlockView = ({ block }: EnumerationBlockProps) => {
  const startIndex =
    block.startIndex ?? (block.page - 1) * block.pageSize + 1;
  return (
    <div className="mt-2 space-y-2">
      <div className="overflow-x-auto rounded-lg border border-[#e5e7eb]">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-[#f9fafb] text-[#6b7280]">
            <tr>
              <th className="w-10 px-2 py-2 font-medium text-center">#</th>
              <th className="px-3 py-2 font-medium">
                {block.listKind === "employer" ? "公司 / 任职" : "项目名称"}
              </th>
              {block.listKind === "employer" ? (
                <th className="px-3 py-2 font-medium">职位</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {block.items.map((item, idx) => (
              <tr
                key={item.id}
                className="border-t border-[#f3f4f6] align-top"
              >
                <td className="px-2 py-2 text-center text-[#6b7280] tabular-nums">
                  {startIndex + idx}
                </td>
                <td className="px-3 py-2 font-medium text-[#111827]">
                  {item.title}
                </td>
                {block.listKind === "employer" ? (
                  <td className="px-3 py-2 text-[#4b5563]">
                    {item.subtitle?.trim() || "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {block.paginationHint ? (
        <p className="text-[12px] leading-relaxed text-[#6b7280]">
          {block.paginationHint}
        </p>
      ) : null}
    </div>
  );
};

type AssistantMessageContentProps = {
  content: string;
  blocks?: AssistantMessageBlock[];
  onAction?: (action: ChatActionPayload) => void;
  staleActionKeys?: ReadonlySet<string>;
  /** 非当前轮 / 发送中 → 全部 action 置灰 */
  actionsLocked?: boolean;
  messageId?: string;
  messageCreatedAt?: string | null;
};

export const AssistantMessageContent = ({
  content,
  blocks,
  onAction,
  staleActionKeys,
  actionsLocked = false,
  messageId,
  messageCreatedAt,
}: AssistantMessageContentProps) => {
  if (!blocks?.length) {
    return (
      <LinkifiedText text={content} className="whitespace-pre-wrap" />
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <div
              key={`h-${i}`}
              className="text-[15px] font-semibold text-[#111827]"
            >
              {block.sectionNo != null
                ? `${block.sectionNo}. ${block.text}`
                : block.text}
            </div>
          );
        }
        if (block.type === "text") {
          return (
            <p key={`t-${i}`} className="whitespace-pre-wrap text-[15px]">
              <LinkifiedText text={block.markdown} />
            </p>
          );
        }
        if (block.type === "enumeration") {
          return <EnumerationBlockView key={`e-${i}`} block={block} />;
        }
        if (block.type === "actions") {
          return (
            <div key={`a-${i}`} className="flex flex-wrap gap-2">
              {block.actions.map((action) => {
                const stale =
                  actionsLocked ||
                  action.disabled ||
                  (staleActionKeys != null &&
                    actionIsStale(action.prompt, staleActionKeys, {
                      messageId,
                      messageCreatedAt,
                    }));
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={stale}
                    aria-disabled={stale}
                    onClick={() =>
                      onAction?.({
                        id: action.id,
                        label: action.label,
                        prompt: action.prompt,
                        displayText: action.displayText,
                        disabled: action.disabled,
                        clientHandler: action.clientHandler,
                        sourceMessageId: messageId,
                      })
                    }
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium ${
                      stale
                        ? "cursor-not-allowed border-[#e5e7eb] bg-[#f3f4f6] text-[#9ca3af]"
                        : "border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca] hover:bg-[#e0e7ff]"
                    }`}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};
