export type CorpusCategory = "experience" | "projects" | "personal";

export type CorpusScanRoot = {
    /** 其下直接包含 experience / projects / personal */
    root: string;
    layout: "corpus" | "user-flat" | "legacy-flat";
};

export type VaultFileEntry = {
    /** 相对 vault 根目录，如 `originals/uploads/report.pdf` */
    relativePath: string;
    name: string;
    sizeBytes: number;
    modifiedAt: string;
};
