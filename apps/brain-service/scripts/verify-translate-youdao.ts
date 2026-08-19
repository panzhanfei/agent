/**
 * 冒烟：translate_text → 有道。
 *
 *   pnpm --filter @fambrain/brain-service run verify:translate
 */
import { translateTextTool } from "../src/agentflow/tools/local/translate";

const main = async () => {
  const raw = await translateTextTool.invoke({
    text: "你好，世界",
    targetLang: "en",
    sourceLang: "zh",
  });
  const parsed = JSON.parse(String(raw)) as {
    status: string;
    translation?: string;
    message?: string;
  };
  console.log("status:", parsed.status);
  if (parsed.message) console.log("message:", parsed.message);
  if (parsed.translation) console.log("translation:", parsed.translation);

  if (parsed.status === "disabled") {
    console.error("FAIL: YOUDAO credentials missing in .env");
    process.exit(1);
  }
  if (parsed.status !== "ok" || !parsed.translation?.trim()) {
    console.error("FAIL: expected ok translation");
    process.exit(1);
  }
  const lower = parsed.translation.toLowerCase();
  if (!lower.includes("hello") && !lower.includes("world")) {
    console.warn(
      "WARN: translation may be unexpected (no hello/world); still counted ok"
    );
  }
  console.log("OK: translate_text / Youdao");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
