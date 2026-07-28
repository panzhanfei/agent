/**
 * P0-13：Intake chitchat — 服务端固定 briefReply + live 连跑 N 次「你好」。
 *
 *   pnpm --filter @fambrain/brain-service run verify:intake-chitchat
 *   CHITCHAT_RUNS=10 pnpm --filter @fambrain/brain-service run verify:intake-chitchat
 */
import {
    applyIntakeChitchatGuard,
    applyPureSocialUtteranceGuard,
    DEFAULT_CHITCHAT_BRIEF_REPLY,
    isPureSocialUtterance,
    runIntakePipeline,
    type IntakeRoutingDecision,
} from "../src/agentflow/agents/online/intake-coordinator/index";
import { bootstrapBrainServiceRuntime } from "../src/config/index";
import { completeIntakeCoordinator } from "../src/agentflow/agents/online/intake-coordinator/llm";

const DEFAULT_RUNS = 10;

const FORBIDDEN_ANSWER_RE =
    /大表哥|表哥|老铁|宝子|亲爱的|昵称|南起|赵一|陈明/i;

const parseRuns = (): number => {
    const raw = process.env.CHITCHAT_RUNS?.trim() ?? String(DEFAULT_RUNS);
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1)
        throw new Error(`CHITCHAT_RUNS 须为正整数，当前: ${raw}`);
    return n;
};

const assertSync = (name: string, fn: () => void) => {
    try {
        fn();
        console.log(`  ✓ ${name}`);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ✗ ${name}: ${msg}`);
        process.exitCode = 1;
    }
};

const chitchatStub = (
    briefReply: string | null
): IntakeRoutingDecision => ({
    intent: "chitchat",
    searchQuery: "",
    subTasks: [],
    topics: [],
    language: "zh",
    confidence: 0.98,
    queryType: null,
    clarifyingQuestion: null,
    briefReply,
    retrievalPlan: [],
    pathPlan: { steps: [] },
    answerOrder: [],
    composeMode: "qa",
    userFactKey: null,
    userFactLabel: null,
    userFactValue: null,
    coreference: "none",
});

console.log("verify-intake-chitchat\n— guard 单测 —");

assertSync("guard：LLM 大表哥 → 固定模板", () => {
    const out = applyIntakeChitchatGuard(
        chitchatStub("你好，大表哥，我是助手。")
    );
    if (out.briefReply !== DEFAULT_CHITCHAT_BRIEF_REPLY) {
        throw new Error(`期望模板，实际: ${out.briefReply}`);
    }
});

assertSync("guard：null briefReply → 固定模板", () => {
    const out = applyIntakeChitchatGuard(chitchatStub(null));
    if (out.briefReply !== DEFAULT_CHITCHAT_BRIEF_REPLY) {
        throw new Error(`期望模板，实际: ${out.briefReply}`);
    }
});

assertSync("guard：非 chitchat 不改动", () => {
    const retrieve: IntakeRoutingDecision = {
        ...chitchatStub(null),
        intent: "retrieve_and_answer",
        searchQuery: "姓名",
        queryType: "identity",
    };
    const out = applyIntakeChitchatGuard(retrieve);
    if (out.briefReply !== null) {
        throw new Error("retrieve 不应被 chitchat guard 改写");
    }
});

assertSync("guard：纯社交口语短路已废弃（恒不改写）", () => {
    const retrieve: IntakeRoutingDecision = {
        ...chitchatStub(null),
        intent: "retrieve_and_answer",
        searchQuery: "你好",
        queryType: "default",
    };
    const out = applyPureSocialUtteranceGuard(retrieve, "你好");
    if (out.intent !== "retrieve_and_answer") {
        throw new Error(`期望不改写 retrieve，实际 ${out.intent}`);
    }
});

assertSync("signals：纯社交口语识别已废弃（恒 false）", () => {
    if (isPureSocialUtterance("你好")) {
        throw new Error("「你好」不应再口语短路");
    }
    if (isPureSocialUtterance("谢谢！")) {
        throw new Error("「谢谢」不应再口语短路");
    }
});

await bootstrapBrainServiceRuntime();

const runs = parseRuns();
console.log(`\n— chitchat live × ${runs}（「你好」走 Intake LLM，无口语短路）—`);

for (let i = 1; i <= runs; i++) {
    try {
        const history = [{ role: "user" as const, content: "你好" }];
        const intakeRaw = await completeIntakeCoordinator(history, {
            memoryBlock: null,
            intakeHistory: history,
        });
        const { decision, earlyExit } = await runIntakePipeline({
            intakeRaw,
            userQuestion: "你好",
            intakeHistory: history,
        });
        const reply =
            decision.intent === "chitchat"
                ? (decision.briefReply ?? "")
                : (decision.clarifyingQuestion ?? decision.briefReply ?? "");
        if (decision.intent !== "chitchat" && decision.intent !== "clarify") {
            throw new Error(`期望 chitchat|clarify，实际 ${decision.intent}`);
        }
        if (!earlyExit) {
            throw new Error("应 pipeline 早退");
        }
        if (decision.routeMode !== "respondEarly") {
            throw new Error(`应 routeMode=respondEarly，实际 ${decision.routeMode}`);
        }
        if (decision.intent === "chitchat" && reply !== DEFAULT_CHITCHAT_BRIEF_REPLY) {
            throw new Error(`chitchat 期望固定模板，实际: ${reply}`);
        }
        if (!reply.trim()) {
            throw new Error("应答为空");
        }
        if (FORBIDDEN_ANSWER_RE.test(reply)) {
            throw new Error(`含禁用称呼: ${reply}`);
        }
        console.log(`  ✓ run ${i}/${runs}: ${reply.slice(0, 48)}…`);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ✗ run ${i}/${runs}: ${msg}`);
        process.exitCode = 1;
    }
}

if (process.exitCode) {
    console.log("\nFAILED");
    process.exit(process.exitCode);
}
console.log(`\nOK (${runs}/${runs})`);
