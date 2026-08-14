/** 语料噪声路径：入库与查询共用（README / 模板）。 */
export const isCorpusNoisePath = (repoPath: string): boolean => {
  const p = repoPath.replace(/\\/g, "/").toLowerCase();
  if (p.endsWith("/readme.md")) return true;
  if (p.includes("/_template.md")) return true;
  return false;
};
