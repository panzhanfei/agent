-- CreateTable
CREATE TABLE "FileJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "corpusUserId" TEXT NOT NULL,
    "fileThreadId" TEXT NOT NULL,
    "fileGeneration" INTEGER NOT NULL,
    "sourceTurnId" TEXT,
    "sourceMessageId" TEXT,
    "followupMessageId" TEXT,
    "task" TEXT NOT NULL,
    "envelope" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "pausedAnswer" TEXT,
    "pausedBlocks" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FileJob_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FileJob_conversationId_status_idx" ON "FileJob"("conversationId", "status");

-- CreateIndex
CREATE INDEX "FileJob_conversationId_createdAt_idx" ON "FileJob"("conversationId", "createdAt");
