/**
 * seed-showcase — 스토어 스크린샷용 정의를 **특정 계정 하나**에 심는다.
 *
 * 왜 스크립트인가: RDS가 프라이빗 서브넷에 있어 밖에서 못 붙는다. 같은 이미지로 일회성
 * ECS 태스크를 띄워 컨테이너 안에서 돌린다. 원격에서 임의 코드를 돌리는 대신
 * **깃에 남는 파일**로 두는 이유는, 운영 DB를 건드리는 코드가 리뷰 가능해야 하기 때문이다.
 *
 * 두 가지 모드 — 환경변수로 가른다:
 *   SHOWCASE_LIST=1        계정 목록만 출력한다(아무것도 쓰지 않는다). 대상을 고르는 용도.
 *   SHOWCASE_USER_ID=<id>  그 계정에 정의를 심는다.
 *
 * 멱등하다: (userId, clientId) 유니크에 upsert하므로 여러 번 돌려도 중복이 안 생긴다.
 * clientId에 접두사를 붙여 두어 **나중에 골라 지울 수 있다**(아래 SHOWCASE_PREFIX).
 *
 * 🔴 심은 정의는 **광장에도 공개된다**. 단어장에만 있는 게 아니다.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 이 접두사로 심은 것만 나중에 골라낼 수 있다. */
const SHOWCASE_PREFIX = 'showcase-';

/**
 * 스크린샷에 쓸 정의들.
 *
 * `daysAgo`로 과거에 심는다 — 스크린샷 3번(같은 단어의 생각 변화 타임라인)은
 * **같은 단어가 서로 다른 시점에 두 번 이상** 있어야만 나온다. 그래서 '어른'과 '사랑'을
 * 두 번씩 넣되 간격을 벌려 뒀다. 날짜가 같으면 타임라인이 한 점으로 뭉쳐 아무것도 안 보인다.
 */
const ENTRIES: { word: string; text: string; daysAgo: number; changeNote?: string }[] = [
  // 변화가 보이는 두 단어 — 화면 3번의 주인공
  {
    word: '어른',
    text: '하고 싶은 걸 다 할 수 있게 된 사람. 그래서 빨리 되고 싶었다.',
    daysAgo: 180,
  },
  {
    word: '어른',
    text: '하고 싶은 걸 미룰 줄 알게 된 사람. 참는 게 손해가 아니라는 걸 아는 사람.',
    daysAgo: 12,
    changeNote: '반년 사이에 정반대가 됐다.',
  },
  {
    word: '사랑',
    text: '함께 있으면 심장이 빨리 뛰는 것.',
    daysAgo: 150,
  },
  {
    word: '사랑',
    text: '심장이 느려져도 곁에 있고 싶은 것. 설렘이 식은 자리에 남는 것이 진짜였다.',
    daysAgo: 5,
    changeNote: '설렘이 전부인 줄 알았다.',
  },

  // 단어장이 비어 보이지 않게 채우는 것들 — 화면 2번
  {
    word: '퇴근',
    text: '하루치의 나를 돌려받는 시간.',
    daysAgo: 60,
  },
  {
    word: '실패',
    text: '아직 안 끝났다는 뜻. 끝났으면 실패라고 부르지도 않는다.',
    daysAgo: 45,
  },
  {
    word: '시간',
    text: '흐르는 게 아니라 쌓이는 것. 바빴던 해일수록 짧게 기억된다.',
    daysAgo: 30,
  },
  {
    word: '위로',
    text: '해결해주는 게 아니라 옆에 앉아주는 일.',
    daysAgo: 20,
  },
  {
    word: '첫사랑',
    text: '그 사람이 아니라 그때의 내가 그리운 것.',
    daysAgo: 9,
  },
  {
    word: '용기',
    text: '무섭지 않은 게 아니라, 무서운데도 하는 것.',
    daysAgo: 2,
  },
];

async function list() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      nickname: true,
      createdAt: true,
      identities: { select: { provider: true } },
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`계정 ${users.length}개\n`);
  for (const u of users) {
    // 이메일은 앞 3글자만 — 로그에 남는 값이라 통째로 찍지 않는다.
    const mail = u.email ? `${u.email.slice(0, 3)}…@${u.email.split('@')[1] ?? ''}` : '(없음)';
    const prov = u.identities.map((i) => i.provider).join(',') || '이메일';
    console.log(
      `${u.id}  정의 ${String(u._count.entries).padStart(3)}개  ${prov.padEnd(6)}  ${mail.padEnd(22)}  ${u.nickname ?? '(닉네임 없음)'}`,
    );
  }
}

async function seed(userId: string) {
  const user = await prisma.user.findUnique({
    select: { id: true, nickname: true, _count: { select: { entries: true } } },
    where: { id: userId },
  });
  if (!user) throw new Error(`그런 계정이 없다: ${userId}`);
  console.log(`대상: ${user.nickname ?? '(닉네임 없음)'} — 현재 정의 ${user._count.entries}개`);

  const now = Date.now();
  for (const e of ENTRIES) {
    const savedAt = new Date(now - e.daysAgo * 86_400_000);
    // clientId를 단어+일수로 고정한다 → 여러 번 돌려도 같은 행을 덮어쓸 뿐이다.
    const clientId = `${SHOWCASE_PREFIX}${e.word}-${e.daysAgo}`;
    await prisma.entry.upsert({
      where: { userId_clientId: { userId, clientId } },
      create: { userId, clientId, word: e.word, text: e.text, changeNote: e.changeNote ?? null, savedAt },
      update: { word: e.word, text: e.text, changeNote: e.changeNote ?? null, savedAt },
    });
    console.log(`  ✓ ${e.word.padEnd(5)} ${savedAt.toISOString().slice(0, 10)}  ${e.text.slice(0, 28)}…`);
  }

  const after = await prisma.entry.count({ where: { userId } });
  console.log(`\n완료 — 정의 ${user._count.entries}개 → ${after}개`);
  console.log(`지우려면: clientId가 '${SHOWCASE_PREFIX}'로 시작하는 행을 지우면 된다.`);
}

async function main() {
  if (process.env.SHOWCASE_LIST === '1') return list();
  const userId = process.env.SHOWCASE_USER_ID;
  if (!userId) throw new Error('SHOWCASE_LIST=1 이나 SHOWCASE_USER_ID=<id> 중 하나가 필요하다.');
  return seed(userId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
