/** LangChain Tool 调用时的 corpus / actor 上下文（由编排层或 verify 脚本注入） */
export type FambrainToolContext = {
  corpusUserId: string;
  actorUserId: string;
};
