-- AlterTable
ALTER TABLE "entries" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_entryId_idx" ON "reports"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporterId_entryId_key" ON "reports"("reporterId", "entryId");

-- CreateIndex
CREATE INDEX "blocks_blockerId_idx" ON "blocks"("blockerId");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blockerId_blockedId_key" ON "blocks"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "entries_hidden_idx" ON "entries"("hidden");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
