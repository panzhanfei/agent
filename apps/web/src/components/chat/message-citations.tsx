"use client";

import { useState } from "react";
import type { Citation } from "@fambrain/brain-types";

type Props = {
  citations?: Citation[];
};

const shortPath = (path: string): string => {
  const norm = path.replace(/\\/g, "/");
  const parts = norm.split("/");
  if (parts.length <= 2) return norm;
  return parts.slice(-2).join("/");
};

/** 助手消息引用列表（轨迹旁证：path + excerpt） */
export const MessageCitations = ({ citations }: Props) => {
  const [open, setOpen] = useState(false);
  if (!citations?.length) return null;

  return (
    <div className="mt-2 border-t border-black/[0.06] pt-2 text-[11px] leading-snug text-[#6b7280]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-left font-medium text-[#4b5563] hover:text-[#111827]"
      >
        引用 {citations.length} 条{open ? " ▴" : " ▾"}
      </button>
      {open ? (
        <ol className="mt-1.5 list-decimal space-y-1.5 pl-4">
          {citations.map((c, i) => (
            <li key={`${c.path}-${i}`} className="marker:text-[#9ca3af]">
              <div className="font-mono text-[10px] text-[#4f46e5]">
                {shortPath(c.path)}
              </div>
              {c.excerpt?.trim() ? (
                <div className="mt-0.5 line-clamp-3 text-[#6b7280]">
                  {c.excerpt.trim()}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
};
