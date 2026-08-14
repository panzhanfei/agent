import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getUserVaultRoot } from "./doc-paths";
import type { VaultFileEntry } from "./interface";

export type { VaultFileEntry };
const walkVaultDir = async (dir: string, vaultRoot: string, out: VaultFileEntry[]): Promise<void> => {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walkVaultDir(abs, vaultRoot, out);
            continue;
        }
        if (!entry.isFile())
            continue;
        const st = await stat(abs).catch(() => null);
        if (!st)
            continue;
        out.push({
            relativePath: path.relative(vaultRoot, abs).replace(/\\/g, "/"),
            name: entry.name,
            sizeBytes: st.size,
            modifiedAt: st.mtime.toISOString(),
        });
    }
};
export const listVaultFiles = async (userId: string): Promise<VaultFileEntry[]> => {
    const vaultRoot = getUserVaultRoot(userId);
    const out: VaultFileEntry[] = [];
    await walkVaultDir(vaultRoot, vaultRoot, out);
    out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    return out;
};
