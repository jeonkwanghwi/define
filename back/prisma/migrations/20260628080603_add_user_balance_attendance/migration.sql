-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "birthYear" INTEGER,
    "gender" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lastAttendanceDate" TEXT
);
INSERT INTO "new_users" ("birthYear", "createdAt", "email", "gender", "id", "nickname", "passwordHash") SELECT "birthYear", "createdAt", "email", "gender", "id", "nickname", "passwordHash" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
