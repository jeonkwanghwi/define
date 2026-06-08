/**
 * 광장 시드 — throwaway 로컬 데모용. 닉네임 붙은 시드 유저 + 단어별 큐레이션 정의.
 * 멱등(이메일 / (userId,clientId) upsert). 실행: npm run db:seed:plaza
 * dev.db는 로컬 전용이라 배포에 영향 없음(prod 시드는 본 범위 밖).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_USERS = ['나무', '들녘', '바다', '새벽', '가람', '윤슬', '노을', '잔디', '미리내'];

const SEED_DATA: { word: string; defs: string[] }[] = [
  { word: '행복', defs: ['잠깐 멈춰 지금 충분하다고 느끼는 순간', '불행이 잠시 비켜간 상태', '남과 비교를 멈췄을 때 오는 고요'] },
  { word: '사랑', defs: ['상대의 세계를 궁금해하는 마음', '내가 더 나은 사람이 되고 싶어지는 일', '곁에 있어도 가끔 그리운 것'] },
  { word: '시간', defs: ['되돌릴 수 없어 귀한 것', '흐르는 게 아니라 쌓이는 것', '누구에게나 공평한 유일한 자원'] },
  { word: '외로움', defs: ['혼자인 것과는 다른, 이해받지 못한 느낌', '곁에 사람이 있어도 찾아오는 것', '나를 돌아보게 하는 신호'] },
  { word: '자유', defs: ['선택할 수 있다는 감각', '책임과 한 쌍인 것', '남의 시선에서 풀려나는 것'] },
  { word: '꿈', defs: ['깨어 있을 때 꾸는 것', '이루지 못해도 방향이 되어주는 것', '조금 무서워야 진짜인 것'] },
  { word: '어른', defs: ['나이가 아니라 책임으로 되는 것', '기다릴 줄 알게 된 사람', '모른다고 말할 수 있는 용기'] },
  { word: '돈', defs: ['수단인데 자주 목적이 되는 것', '자유를 사는 도구', '많을수록 덜 보이는 것'] },
  { word: '친구', defs: ['오래 안 봐도 어색하지 않은 사이', '약한 모습을 보여도 되는 사람', '같이 침묵해도 편한 사람'] },
  { word: '위로', defs: ['해결이 아니라 곁에 있어주는 것', '말보다 들어주는 일', '괜찮지 않아도 된다고 말해주는 것'] },
  { word: '이별', defs: ['끝이 아니라 다른 시작', '사랑했던 만큼 아픈 것', '그 사람이 준 나를 남기고 가는 것'] },
  { word: '청춘', defs: ['서툴러서 빛나는 시절', '불안과 설렘이 같은 얼굴인 때', '지나봐야 알게 되는 것'] },
];

async function main() {
  const passwordHash = bcrypt.hashSync('seed-password', 10);

  // 시드 유저 (멱등: 이메일 기준)
  const users: { id: string }[] = [];
  for (let i = 0; i < SEED_USERS.length; i++) {
    const email = `seed${i + 1}@define.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { nickname: SEED_USERS[i] },
      create: { email, passwordHash, nickname: SEED_USERS[i] },
    });
    users.push(user);
  }

  // 정의 분배 (멱등: (userId, clientId). round-robin으로 유저 배정)
  let counter = 0;
  const base = new Date('2026-05-01T00:00:00.000Z').getTime();
  for (const { word, defs } of SEED_DATA) {
    for (let i = 0; i < defs.length; i++) {
      const user = users[counter % users.length];
      const clientId = `seed-${word}-${i}`;
      const savedAt = new Date(base + counter * 86_400_000); // 하루씩 벌려 다양성
      await prisma.entry.upsert({
        where: { userId_clientId: { userId: user.id, clientId } },
        update: { text: defs[i], word, savedAt },
        create: { userId: user.id, clientId, word, text: defs[i], savedAt },
      });
      counter++;
    }
  }

  console.log(`seeded ${users.length} users, ${counter} definitions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
