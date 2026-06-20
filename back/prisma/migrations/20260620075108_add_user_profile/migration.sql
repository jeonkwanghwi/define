-- AlterTable
ALTER TABLE "users" ADD COLUMN "birthYear" INTEGER;
ALTER TABLE "users" ADD COLUMN "gender" TEXT;

-- CreateTable
CREATE TABLE "user_interests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "interest" TEXT NOT NULL,
    CONSTRAINT "user_interests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_interests_userId_interest_key" ON "user_interests"("userId", "interest");
