/** 语料闭集文档类型（入库整篇打标；非用户问句标签） */
export const CORPUS_DOC_KINDS = [
    "identity_card",
    "relations",
    "experience",
    "project",
    "uncategorized",
] as const;

export type CorpusDocKind = (typeof CORPUS_DOC_KINDS)[number];
