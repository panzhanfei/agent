-- CreateTable
CREATE TABLE "CorpusEditProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "corpusUserId" TEXT NOT NULL,
    "conversationId" TEXT,
    "turnId" TEXT,
    "threadId" TEXT NOT NULL,
    "repoPath" TEXT NOT NULL,
    "operation" TEXT NOT NULL DEFAULT 'UPDATE',
    "beforeContent" TEXT NOT NULL DEFAULT '',
    "afterContent" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CorpusEditProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CorpusFileVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "corpusUserId" TEXT NOT NULL,
    "repoPath" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceProposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CorpusEditProposal_userId_status_idx" ON "CorpusEditProposal"("userId", "status");

-- CreateIndex
CREATE INDEX "CorpusEditProposal_corpusUserId_status_idx" ON "CorpusEditProposal"("corpusUserId", "status");

-- CreateIndex
CREATE INDEX "CorpusEditProposal_threadId_idx" ON "CorpusEditProposal"("threadId");

-- CreateIndex
CREATE INDEX "CorpusFileVersion_corpusUserId_repoPath_createdAt_idx" ON "CorpusFileVersion"("corpusUserId", "repoPath", "createdAt");
