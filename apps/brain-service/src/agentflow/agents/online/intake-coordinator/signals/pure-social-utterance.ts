/**
 * @deprecated 禁止生产路径用问候口语词表短路。
 * 问候 / 感谢一律走 Intake LLM → intent=chitchat。
 * 保留导出供 verify 兼容；恒为 false。
 */
export const isPureSocialUtterance = (_question: string): boolean => false;
