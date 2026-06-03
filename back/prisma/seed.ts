/**
 * DB 시드 — 빈 DB에 데모 단어를 넣는다. `npm run db:seed`로 실행.
 *
 * 지금은 프론트의 기존 6개만(데모). 50선 일괄 반영은 저장 형식(A/B) 팀 논의 후 별도.
 * upsert: 이미 있으면 건너뛰고 없으면 생성 → 여러 번 돌려도 안전(멱등).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_WORDS = ['행복', '사랑', '돈', '시간', '용기', '어른'];

async function main() {
  for (const text of DEMO_WORDS) {
    await prisma.word.upsert({
      where: { text },
      update: {},
      create: { text },
    });
  }
  console.log(`seeded ${DEMO_WORDS.length} words`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
