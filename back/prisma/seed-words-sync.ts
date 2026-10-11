/**
 * 단어 풀 동기화 — `seed-words.ts`의 SEED_WORDS를 words 테이블에 반영한다.
 * 실행: npm run db:seed:words
 *
 * **단어는 계속 추가·수정된다.** 그래서 "넣기"가 아니라 "맞추기"다:
 *   - 목록에 있는 단어 → 태그를 갱신하고 active: true (upsert)
 *   - 목록에 없는 기존 단어 → **지우지 않고 active: false**
 *     (사용자가 이미 그 단어로 쓴 정의가 있다. 지우면 그 정의의 뿌리가 사라진다.)
 * 여러 번 돌려도 DB 상태가 같다(멱등) → 단어를 고친 뒤 이것만 돌리면 끝.
 *
 * 데이터는 seed-words.ts에, 반영 로직은 여기에 둔다 — 단어를 고치는 사람이
 * 로직 파일을 열 일이 없게(그리고 로직을 고칠 때 252줄을 스크롤하지 않게).
 */
import { PrismaClient } from '@prisma/client';

import { SEED_WORDS } from './seed-words';

const prisma = new PrismaClient();

async function main() {
  // 신규/갱신을 구분해 세려면 "원래 있던 것"을 먼저 알아야 한다.
  const before = await prisma.word.findMany({ select: { text: true } });
  const existing = new Set(before.map((row) => row.text));

  let created = 0;
  let updated = 0;
  for (const { word, tags } of SEED_WORDS) {
    await prisma.word.upsert({
      where: { text: word },
      // 태그는 통째 교체 — 목록이 유일한 출처다(파일에서 뺀 태그가 DB에 남으면 안 된다).
      update: { tags: tags ?? [], active: true },
      create: { text: word, tags: tags ?? [] },
    });
    if (existing.has(word)) updated++;
    else created++;
  }

  const seedTexts = SEED_WORDS.map(({ word }) => word);
  const { count: deactivated } = await prisma.word.updateMany({
    where: { text: { notIn: seedTexts }, active: true },
    data: { active: false },
  });

  // deactivated는 "이번에 끈 개수"다 → 두 번째 실행엔 0이 된다(이미 꺼져 있으니).
  console.log(`단어 시드 — 추가 ${created} / 갱신 ${updated} / 비활성 ${deactivated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
