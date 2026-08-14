import { describe, expect, it } from "vitest";
import {
    actionIsStale,
    chatActionStaleGroupKey,
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
});
