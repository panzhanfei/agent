/** Intake 路由信号：topics → web / hybrid DAG（非口语词表） */

export const topicsSuggestWebSource = (topics: string[]): boolean =>
  topics.includes("external");

/** @deprecated 改用 topicsSuggestWebSource(topics)。 */
export const labelSuggestsWebSource = (
  _label: string,
  _searchQuery: string,
  topics: string[] = []
): boolean => topicsSuggestWebSource(topics);

/** topics 含 external 且同时有语料向 topics → hybrid DAG */
export const decisionSuggestsHybridDag = (input: {
  topics: string[];
  planTopics?: string[][];
}): boolean => {
  const all = [...input.topics, ...(input.planTopics ?? []).flat()];
  const hasExternal = all.includes("external");
  const hasCorpus = all.some((t) =>
    ["personal", "resume", "experience", "project", "tech-stack"].includes(t)
  );
  return hasExternal && hasCorpus;
};

/** @deprecated 改用 decisionSuggestsHybridDag。 */
export const userQuestionSuggestsHybridDag = (
  _userQuestion: string,
  topics: string[] = []
): boolean => decisionSuggestsHybridDag({ topics });
