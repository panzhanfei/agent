import { describe, expect, it } from "vitest";
import {
    actionIsStale,
    chatActionStaleGroupKey,
    isVaultWorkspaceActionPrompt,
    sanitizeClientVaultSaveBasename,
} from "../../../web/src/lib/chat/action-lifecycle";

describe("chatActionStaleGroupKey vault create vs cwd", () => {
    it("create uses vault:create so new-list delete is not born stale", () => {
        expect(chatActionStaleGroupKey("__FAMBRAIN_VAULT_WS_CREATE_FILE__:")).toBe(
            "vault:create:"
        );
        expect(
            chatActionStaleGroupKey("__FAMBRAIN_VAULT_WS_CREATE_FOLDER__:")
        ).toBe("vault:create:");
        expect(
            chatActionStaleGroupKey(
                "__FAMBRAIN_VAULT_WS_DELETE_FILE__:untitled-abc.txt"
            )
        ).toBe("vault:cwd:");
        expect(chatActionStaleGroupKey("__FAMBRAIN_VAULT_WS_LIST__:")).toBe(
            "vault:cwd:"
        );
        expect(chatActionStaleGroupKey("__FAMBRAIN_VAULT_WS_DONE__")).toBe(
            "vault:done"
        );
        expect(
            chatActionStaleGroupKey("__FAMBRAIN_VAULT_SAVE_CONFIRM__")
        ).toBe("vault:save");
        expect(
            chatActionStaleGroupKey("__FAMBRAIN_VAULT_SAVE_CANCEL__")
        ).toBe("vault:save");
    });

    it("staling create at root does not disable delete in the same cwd", () => {
        const stale = new Set(["vault:create:"]);
        expect(
            actionIsStale("__FAMBRAIN_VAULT_WS_CREATE_FILE__:", stale)
        ).toBe(true);
        expect(
            actionIsStale(
                "__FAMBRAIN_VAULT_WS_DELETE_FILE__:untitled-abc.txt",
                stale
            )
        ).toBe(false);
        expect(actionIsStale("__FAMBRAIN_VAULT_WS_LIST__:", stale)).toBe(false);
    });

    it("save-gate prompts stale together and match vault resume", () => {
        expect(isVaultWorkspaceActionPrompt("__FAMBRAIN_VAULT_SAVE_CONFIRM__")).toBe(
            true
        );
        expect(isVaultWorkspaceActionPrompt("__FAMBRAIN_VAULT_SAVE_CANCEL__")).toBe(
            true
        );
        const stale = new Set(["vault:save"]);
        expect(actionIsStale("__FAMBRAIN_VAULT_SAVE_CONFIRM__", stale)).toBe(true);
        expect(actionIsStale("__FAMBRAIN_VAULT_SAVE_CANCEL__", stale)).toBe(true);
        expect(actionIsStale("__FAMBRAIN_VAULT_WS_DONE__", stale)).toBe(false);
        expect(sanitizeClientVaultSaveBasename("notes/a.txt")).toBe("notesa");
        expect(sanitizeClientVaultSaveBasename("")).toBeNull();
    });
});
