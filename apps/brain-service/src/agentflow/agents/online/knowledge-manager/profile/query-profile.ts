/**
 * KM-08 queryProfile：Intake queryType 为单一意图来源（Wave C / QU-06）。
 *
 * Pipeline / guard / composite 主路径须传显式 queryType。
 * 脚本直调 KM 且未传 queryType 时回落 default（不再口语正则推断）。
 */
import type { QueryProfile } from "./interface";

export type { QueryProfile };

/**
 * @deprecated 不再口语推断；恒为 default。保留签名供脚本兼容。
 */
export const inferQueryProfile = (
    _searchQuery?: string,
    _subTasks?: string[]
): QueryProfile => "default";

/**
 * QU-05/06：Intake queryType 优先。
 * - 有明确 queryType → 直接用；
 * - queryType === null（Intake 未给类型）→ default；
 * - queryType === undefined（脚本直调 KM）→ default（无口语 fallback）。
 */
export const resolveQueryProfile = (
    _searchQuery: string,
    _subTasks: string[] = [],
    queryType?: QueryProfile | null
): QueryProfile => {
    if (queryType !== undefined && queryType !== null) {
        return queryType;
    }
    return "default";
};
