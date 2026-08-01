/** 静默用户记忆抽取：结构化候选（仅 Mem0）。 */

export type ExtractedUserMemoryFact = {
  factKey: string;
  label: string;
  value: string;
  confidence: number;
};

export type UserMemoryExtractLlmResult = {
  facts: ExtractedUserMemoryFact[];
};

export type UserMemoryAutoLearnConfig = {
  /** USER_MEMORY_AUTO_LEARN_ENABLED；默认 false */
  enabled: boolean;
  /** 低于此置信度丢弃；默认 0.85 */
  minConfidence: number;
  /** Ollama 模型；未设则用 intakeCoordinator → default */
  ollamaModel: string;
};
