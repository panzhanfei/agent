import {
    getBrainServiceConfig,
    type BrainServiceConfig,
} from "@fambrain/brain-config";
import { configureLangSmithTracing, type LangSmithStatus } from "@fambrain/brain-config/langsmith";
import { resolveBrainServicePort } from "@fambrain/brain-config/service-url";
import { loadRootEnv } from "./env";

export type BrainServiceRuntimeConfig = {
    langSmith: LangSmithStatus;
    port: number;
    brain: BrainServiceConfig;
};

/** 服务 / CLI 入口：加载根 .env → 校验 chat/Ollama 配置 → LangSmith → 解析端口 */
export const bootstrapBrainServiceRuntime = (): BrainServiceRuntimeConfig => {
    loadRootEnv();
    return {
        brain: getBrainServiceConfig(),
        langSmith: configureLangSmithTracing(),
        port: resolveBrainServicePort(),
    };
};

/** Pipeline 等非 HTTP 入口：确保 env 与 LangSmith 已初始化 */
export const ensureBrainServiceRuntime = (): LangSmithStatus => {
    loadRootEnv();
    getBrainServiceConfig();
    return configureLangSmithTracing();
};
