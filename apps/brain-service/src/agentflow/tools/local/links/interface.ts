/** 从 KM excerpt 抽出的外链 */
export type ExtractedLink = {
  url: string;
  path: string;
  excerpt: string;
  /** 展示名：优先 excerpt 邻近实体 / 仓库名，非文件名 */
  title: string;
};

/** Intake 槽 label（结构化子问文案，非用户口语 regex） */
export type ExternalLinkScope = {
  label?: string;
};
