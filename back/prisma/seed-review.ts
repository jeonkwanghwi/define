/**
 * seed-review — App Store 심사용 데모 계정을 만든다(있으면 다시 맞춘다).
 *
 * 왜 필요한가: 회상은 **서로 다른 단어 20개 이상 + 잉크 30개**가 있어야 열린다.
 * 심사자가 빈 계정으로 그걸 채우려면 한참 걸리고, 그 전에 "기능이 안 열린다"로 리젝될 수 있다.
 * 그래서 조건을 이미 넘긴 계정을 미리 만들어 두고, 심사 노트에 이메일·비밀번호를 적는다.
 *
 * 실행 (운영: 일회성 ECS 태스크 — seed-showcase와 같은 방식):
 *   REVIEW_PASSWORD=... node dist-seed/seed-review.js
 * 로컬:
 *   REVIEW_PASSWORD=... npx ts-node prisma/seed-review.ts
 *
 * 멱등하다 — 여러 번 돌려도 계정 하나, 정의는 (userId, clientId) upsert라 중복이 안 생긴다.
 * 다시 돌리면 상태를 "처음 심사받는 모습"으로 되돌린다:
 *   비밀번호·잔액 300·**회상 동의 해제**(심사자가 동의 시트를 직접 보게).
 *
 * 정의는 광장에 올라가지 않게 hidden으로 심는다 — 실제 사용자의 광장에 "심사용 계정"이
 * 섞이면 안 된다. 단어장·회상은 hidden과 무관하게 그대로 보인다(광장 조회만 거른다).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const EMAIL = 'review@defineink.com';
const NICKNAME = '심사용 계정';
/** 이 접두사로 심은 것만 나중에 골라 지울 수 있다. */
const PREFIX = 'review-';

/**
 * 약 14개월에 걸쳐 흩어 둔다 — 회상의 "시기"는 기록 연도 − 출생연도(나이)로 나뉘므로
 * 해가 둘 이상 걸쳐야 고를 시기가 생긴다. 세 단어(어른·집·친구)는 두 번씩, 간격을 벌려
 * 넣어 같은 단어의 생각이 바뀐 타임라인이 보이게 했다.
 */
const ENTRIES: { word: string; text: string; daysAgo: number; changeNote?: string }[] = [
  { word: '어른', text: '혼자서 결정할 수 있는 사람. 누구 허락도 필요 없는 사람.', daysAgo: 420 },
  { word: '집', text: '월세 날짜가 돌아오는 곳. 잠만 자고 나오는 방.', daysAgo: 405 },
  { word: '친구', text: '매일 연락하는 사이. 연락이 끊기면 끝나는 사이.', daysAgo: 390 },
  { word: '월요일', text: '한 주의 무게가 한꺼번에 얹히는 날. 알람을 두 번 끄게 되는 날.', daysAgo: 372 },
  { word: '커피', text: '잠을 미루는 방법. 오후 세 시의 핑계.', daysAgo: 355 },
  { word: '비', text: '우산을 챙길지 말지 아침마다 내기하게 만드는 것.', daysAgo: 338 },
  { word: '산책', text: '목적지 없이 걷는 걸 허락받는 시간.', daysAgo: 320 },
  { word: '실수', text: '다음엔 안 하겠다고 다짐하게 되는 것. 그래도 또 하게 되는 것.', daysAgo: 300 },
  { word: '기다림', text: '시계를 자꾸 보게 되는 일. 오지 않을 수도 있다는 걸 알면서.', daysAgo: 282 },
  { word: '고향', text: '떠나고 나서야 이름이 생기는 곳.', daysAgo: 265 },
  { word: '편지', text: '말로는 못 하는 걸 대신 건네는 종이. 쓰는 동안 마음이 정리된다.', daysAgo: 247 },
  { word: '휴일', text: '아무것도 안 해도 죄책감이 덜 드는 날.', daysAgo: 230 },
  { word: '어른', text: '혼자 결정하고, 그 결과도 혼자 감당하는 사람. 자유보다 책임이 먼저 오는 것.', daysAgo: 210, changeNote: '자유인 줄 알았는데 책임이었다.' },
  { word: '용기', text: '떨리는 목소리로라도 끝까지 말하는 것.', daysAgo: 192 },
  { word: '습관', text: '생각하기 전에 이미 하고 있는 것. 좋은 것도 나쁜 것도.', daysAgo: 175 },
  { word: '이사', text: '물건을 버리면서 지난 시간을 한 번 훑어보는 일.', daysAgo: 160 },
  { word: '집', text: '불을 켜 두고 나와도 아깝지 않은 곳. 돌아가고 싶은 방향.', daysAgo: 145, changeNote: '이사하고 나서 처음으로 집이라는 말이 어울렸다.' },
  { word: '위로', text: '고쳐 주려 하지 않고 옆에 있어 주는 것.', daysAgo: 128 },
  { word: '계절', text: '옷장을 열 때 먼저 알아차리는 변화.', daysAgo: 110 },
  { word: '노래', text: '그때의 공기까지 데려오는 3분.', daysAgo: 92 },
  { word: '침묵', text: '말이 없어도 불편하지 않은 사이에서만 편한 것.', daysAgo: 75 },
  { word: '친구', text: '몇 달 만에 연락해도 어제 본 것처럼 이어지는 사이.', daysAgo: 58, changeNote: '자주 보는 게 친한 거라고 생각했었다.' },
  { word: '감사', text: '당연한 줄 알았던 게 당연하지 않다는 걸 알아차리는 순간.', daysAgo: 40 },
  { word: '쉼', text: '멈춰도 괜찮다고 스스로에게 말해 주는 것.', daysAgo: 22 },
  { word: '오늘', text: '어제의 내가 걱정하던 날. 생각보다 괜찮았던 날.', daysAgo: 6 },
];

async function main() {
  const password = process.env.REVIEW_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('REVIEW_PASSWORD(8자 이상)가 필요하다 — 심사 노트에 적을 비밀번호.');
  }
  // 앱 가입과 같은 방식(auth.service: bcrypt cost 10) — 그래야 앱 로그인이 그대로 통한다.
  const passwordHash = await bcrypt.hash(password, 10);

  // 닉네임은 전역 unique. 다른 사람이 이미 쓰고 있으면 덮어쓰지 말고 멈춘다.
  const holder = await prisma.user.findUnique({ where: { nickname: NICKNAME }, select: { email: true } });
  if (holder && holder.email !== EMAIL) {
    throw new Error(`닉네임 '${NICKNAME}'을 다른 계정이 쓰고 있다 — NICKNAME을 바꿔서 다시 돌릴 것.`);
  }

  // 출생연도·성별·관심사를 채워 프로필 완성 상태로 — 심사자가 프로필 화면에 막히지 않게.
  const profile = { passwordHash, nickname: NICKNAME, birthYear: 1995, gender: 'female', balance: 300, recallConsentAt: null };
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: { email: EMAIL, ...profile },
    update: profile,
    select: { id: true },
  });
  await prisma.userInterest.createMany({
    data: ['글쓰기', '심리·마음'].map((interest) => ({ userId: user.id, interest })),
    skipDuplicates: true,
  });

  const now = Date.now();
  for (const e of ENTRIES) {
    const savedAt = new Date(now - e.daysAgo * 86_400_000);
    // clientId를 단어+일수로 고정 → 다시 돌려도 같은 행을 덮어쓸 뿐이다.
    const clientId = `${PREFIX}${e.word}-${e.daysAgo}`;
    const data = { word: e.word, text: e.text, changeNote: e.changeNote ?? null, savedAt, hidden: true };
    await prisma.entry.upsert({
      where: { userId_clientId: { userId: user.id, clientId } },
      create: { userId: user.id, clientId, ...data },
      update: data,
    });
  }

  const words = new Set(ENTRIES.map((e) => e.word)).size;
  console.log(`완료 — ${EMAIL} (id ${user.id}) · 정의 ${ENTRIES.length}개 · 단어 ${words}개 · 잉크 300 · 회상 동의 해제`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
