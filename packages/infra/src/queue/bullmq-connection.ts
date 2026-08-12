import type { ConnectionOptions } from "bullmq";
import { createRedisConnection } from "../redis/client";

/** ioredis 与 bullmq 内嵌 ioredis 类型不完全兼容，统一桥接 */
export const bullmqConnection = (): ConnectionOptions =>
  createRedisConnection() as unknown as ConnectionOptions;
