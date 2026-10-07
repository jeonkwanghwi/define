-- CreateIndex
CREATE INDEX "entries_word_idx" ON "entries"("word");

-- CreateIndex
CREATE INDEX "entries_createdAt_idx" ON "entries"("createdAt");

-- CreateIndex
CREATE INDEX "likes_entryId_idx" ON "likes"("entryId");

-- CreateIndex
CREATE INDEX "likes_createdAt_idx" ON "likes"("createdAt");
