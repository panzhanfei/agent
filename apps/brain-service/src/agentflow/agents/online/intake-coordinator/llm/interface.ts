import type { DbChatTurn } from "@fambrain/brain-types";

/** completeIntakeCoordinator 可选参数 */
export type CompleteIntakeCoordinatorOptions = {
  memoryBlock?: string | null;
  intakeHistory?: DbChatTurn[];
  /** 散文/非 JSON：追加格式修复说明（仅 1 次） */
  jsonFormatRepair?: boolean;
  /**
   * 上轮实质用户问（结构化上下文字段，输入增强）。
   * 非二次规划；消不了指代 → clarify。
   */
  priorSubstantiveQuestion?: string | null;
  /** 本轮已抽取附件清单（仅元数据+预览；全文不进 Intake） */
  attachmentBrief?: string | null;
};
