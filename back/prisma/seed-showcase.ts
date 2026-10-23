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
 *   SHOWCASE_DEMO_USERS=1  광장용 데모 유저(로그인 불가)를 만들고 정의를 심는다(아래 DEMO_USERS).
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
  // ── 2026-10-23: 단어장 53개를 채우려 더한 45개(위 8개 단어 + 45 = 53) ──
  { word: '행복', text: '큰일 없는 하루를 지루하다고 느끼지 않는 것.', daysAgo: 150 },
  { word: '외로움', text: '연락할 사람은 많은데 전화할 사람이 없는 밤.', daysAgo: 143 },
  { word: '불안', text: '아직 오지 않은 일을 미리 겪는 것.', daysAgo: 138 },
  { word: '그리움', text: '다시 가고 싶은 게 아니라, 그때 그 마음으로 한 번만 돌아가 보고 싶은 것.', daysAgo: 131 },
  { word: '후회', text: '그때의 내가 몰랐던 걸 지금의 내가 아는 것. 그러니 그때의 나를 조금 덜 미워해도 된다.', daysAgo: 127 },
  { word: '설렘', text: '아직 아무 일도 안 일어났는데 하루가 벌써 다르게 보이는 것.', daysAgo: 122 },
  { word: '가족', text: '제일 편해서 제일 함부로 대하게 되는 사람들. 그래서 제일 조심해야 하는 사람들.', daysAgo: 118 },
  { word: '친구', text: '몇 달 만에 만나도 어제 하던 얘기처럼 이어지는 사이.', daysAgo: 114 },
  { word: '약속', text: '미래의 나에게 미리 빚을 지는 일.', daysAgo: 110 },
  { word: '기다림', text: '상대를 믿는 시간이면서 나를 시험하는 시간.', daysAgo: 106 },
  { word: '자존감', text: '남이 나를 어떻게 보든, 내가 나를 버리지 않는 것.', daysAgo: 102 },
  { word: '습관', text: '내가 매일 고르는 나.', daysAgo: 98 },
  { word: '비밀', text: '말하는 순간 무게가 반으로 줄고, 나머지 반은 상대에게 넘어가는 것.', daysAgo: 95 },
  { word: '기억', text: '사실보다 그때의 기분이 더 오래 남는 기록.', daysAgo: 92 },
  { word: '청춘', text: '지나고 나서야 이름이 붙는 시절.', daysAgo: 89 },
  { word: '새벽', text: '하루 중 유일하게 아무도 나에게 뭘 바라지 않는 시간.', daysAgo: 86 },
  { word: '꿈', text: '이루면 끝나는 게 아니라, 가는 동안 나를 바꿔 놓는 것.', daysAgo: 83 },
  { word: '선택', text: '고르지 않은 쪽을 오래 궁금해하는 일.', daysAgo: 80 },
  { word: '돈', text: '있으면 잊고, 없으면 그것만 생각나는 것.', daysAgo: 77 },
  { word: '일', text: '나를 증명하는 곳인 줄 알았는데, 요즘은 나를 지키는 법을 배우는 곳.', daysAgo: 74 },
  { word: '휴식', text: '아무것도 안 해도 죄책감이 들지 않는 상태. 생각보다 연습이 필요하다.', daysAgo: 71 },
  { word: '월급', text: '한 달을 버틴 나에게 주는 영수증.', daysAgo: 68 },
  { word: '번아웃', text: '좋아하던 일이 숙제로 바뀌는 순간.', daysAgo: 65 },
  { word: '책', text: '다른 사람의 머릿속에 잠깐 세 들어 사는 일.', daysAgo: 62 },
  { word: '질문', text: '답보다 오래 남는 것.', daysAgo: 59 },
  { word: '경험', text: '그때는 실수였고 지금은 이야기가 된 것.', daysAgo: 56 },
  { word: '건강', text: '잃기 전까지는 목록에도 없던 것.', daysAgo: 53 },
  { word: '잠', text: '하루를 끝내는 가장 정직한 방법.', daysAgo: 50 },
  { word: '커피', text: '오늘을 시작해도 된다는 허락.', daysAgo: 47 },
  { word: '여행', text: '익숙한 나를 잠깐 두고 오는 일.', daysAgo: 44 },
  { word: '고향', text: '떠나고 나서야 생기는 곳.', daysAgo: 41 },
  { word: '바다', text: '아무 말 안 해도 다 들어줄 것 같은 곳.', daysAgo: 38 },
  { word: '음악', text: '그 노래를 듣던 시절로 가는 가장 빠른 길.', daysAgo: 35 },
  { word: '영화', text: '두 시간 동안 남의 인생을 빌려 사는 것.', daysAgo: 33 },
  { word: '사람', text: '알면 알수록 모르는 게 늘어나는 존재.', daysAgo: 31 },
  { word: '시선', text: '남의 것인 줄 알았는데, 사실은 내가 나를 보는 눈.', daysAgo: 28 },
  { word: '미련', text: '끝난 걸 알면서도 마지막 장을 다시 펼쳐 보는 것.', daysAgo: 25 },
  { word: '쓸쓸함', text: '외로움보다 조용하다. 사람이 그리운 게 아니라 계절이 지나가는 게 느껴지는 것.', daysAgo: 22 },
  { word: '다정', text: '상대가 말하지 않은 것까지 챙기는 일.', daysAgo: 19 },
  { word: '눈치', text: '사랑받고 싶어서 생긴 감각.', daysAgo: 16 },
  { word: '첫눈', text: '핑계 삼아 연락하고 싶은 사람이 떠오르는 날.', daysAgo: 14 },
  { word: '노을', text: '오늘도 끝났다고, 수고했다고 하늘이 대신 말해 주는 것.', daysAgo: 11 },
  { word: '마침표', text: '끝낼 수 있다는 것도 용기라는 표시.', daysAgo: 8 },
  { word: '낭만', text: '효율이 없어도 하고 싶은 걸 하는 것.', daysAgo: 6 },
  { word: '걱정', text: '사랑의 다른 말투.', daysAgo: 4 },
];

/**
 * 광장 데모 유저 — 광장에 여러 사람이 보이게 하려는 계정들(2026-10-23).
 *
 * 실제 친구 계정에 글을 넣지 않는다(그 사람이 쓰지 않은 글이 그 이름으로 공개된다).
 * 대신 로그인할 수 없는 계정(비밀번호·소셜 없음)을 새로 만든다.
 *   - 찾는 열쇠는 전용 이메일(DEMO_EMAIL_DOMAIN). 닉네임으로 찾지 않는다 — 같은 닉네임의
 *     실제 사용자를 덮어쓰면 안 된다. 닉네임이 이미 쓰이고 있으면 unique 오류로 멈춘다.
 *   - 광장은 출생연도가 있는 계정만 보여 준다(plaza.repository) → 프로필을 채운다.
 * 지우려면: email이 DEMO_EMAIL_DOMAIN으로 끝나는 users 행을 지우면 정의도 함께 지워진다(cascade).
 */
const DEMO_EMAIL_DOMAIN = '@demo.defineink.com';

const DEMO_USERS: { nickname: string; birthYear: number; gender: 'male' | 'female'; entries: [string, string][] }[] = [
  { nickname: '조용한 솔바람', birthYear: 2003, gender: 'female', entries: [
    ['사랑', '좋아하는 노래를 그 사람한테 제일 먼저 보내고 싶은 마음.'],
    ['시간', '시험 기간엔 느리고 방학엔 빠른 것.'],
    ['친구', '내 흑역사를 다 알면서도 아무한테도 말 안 하는 사람.'],
    ['미련', '이미 읽은 메시지를 또 열어 보는 손가락.'],
    ['청춘', '돈은 없고 시간은 많은데, 그 시간이 아깝다고 느끼는 때.'],
  ]},
  { nickname: '담담한 조약돌', birthYear: 1991, gender: 'male', entries: [
    ['퇴근', '회사 문을 나서는 순간 이름을 되찾는 일.'],
    ['돈', '하기 싫은 일을 안 해도 되는 권리.'],
    ['어른', '힘든 걸 티 안 내는 사람인 줄 알았는데, 도와 달라고 말할 줄 아는 사람이었다.'],
    ['행복', '금요일 밤에 아무 약속이 없는 것.'],
    ['위로', '괜찮냐고 묻지 않고 밥 먹었냐고 묻는 것.'],
  ]},
  { nickname: '포근한 햇살', birthYear: 1979, gender: 'female', entries: [
    ['사랑', '내가 먹던 걸 덜어 주면서도 아깝지 않은 것.'],
    ['어른', '부모님 나이가 되어 보니 그분들도 처음이었다는 걸 아는 것.'],
    ['시간', '아이 키를 재는 문틀 위의 연필 자국.'],
    ['걱정', '잘 다녀오라는 말 속에 다 들어 있는 것.'],
    ['가족', '서로 서운한 게 제일 많은데 결국 제일 먼저 찾게 되는 사람들.'],
  ]},
  { nickname: '서성이는 나그네', birthYear: 1999, gender: 'male', entries: [
    ['실패', '이력서 한 줄로는 안 남지만 나한테는 제일 많이 남은 것.'],
    ['용기', '떨어질 걸 알면서 한 번 더 지원 버튼을 누르는 것.'],
    ['불안', '남들은 다 정해진 길을 가는 것 같을 때 드는 기분.'],
    ['꿈', '자기소개서에 쓰기엔 부끄럽고, 버리기엔 아까운 것.'],
    ['행복', '합격 문자가 아니어도 웃을 수 있는 날이 있다는 것.'],
  ]},
  { nickname: '잔잔한 물결', birthYear: 1995, gender: 'female', entries: [
    ['외로움', '혼자 있을 때보다 여럿 속에 있을 때 더 크게 들리는 것.'],
    ['쓸쓸함', '불 꺼진 방에 들어와서 내가 먼저 불을 켜야 하는 것.'],
    ['새벽', '생각이 제일 솔직해지는 시간. 그래서 문자는 보내지 않는다.'],
    ['위로', '내 얘기를 끝까지 들어 주는 것. 조언은 그다음 일이다.'],
    ['사랑', '내 기분보다 그 사람의 하루가 먼저 궁금해지는 것.'],
  ]},
  { nickname: '다정한 등불', birthYear: 1988, gender: 'female', entries: [
    ['다정', '받은 사람보다 준 사람이 더 오래 기억하는 것.'],
    ['친구', '서로의 바쁨을 서운해하지 않는 사이.'],
    ['행복', '따뜻한 컵을 두 손으로 감쌀 때의 그 온도.'],
    ['커피', '같이 마시자는 말의 다른 이름.'],
    ['첫눈', '올해도 이만큼 왔다는 표시.'],
  ]},
  { nickname: '단단한 여울', birthYear: 1985, gender: 'male', entries: [
    ['어른', '내 선택의 값을 남한테 미루지 않는 사람.'],
    ['실패', '다음엔 뭘 안 할지 알려 주는 선생님.'],
    ['돈', '많을수록 조용해져야 하는 것.'],
    ['일', '잘하고 싶은 마음과 그만두고 싶은 마음이 같이 사는 곳.'],
    ['용기', '틀렸다고 먼저 말하는 것.'],
  ]},
  { nickname: '환한 봄비', birthYear: 2001, gender: 'female', entries: [
    ['설렘', '답장 오기 전 화면이 켜질 때마다 숨을 참는 것.'],
    ['첫사랑', '이루어지지 않아서 끝까지 예쁜 것.'],
    ['사랑', '같이 있으면 시간이 부족하고, 떨어져 있으면 시간이 남는 것.'],
    ['첫눈', '같이 보자고 했던 사람이 생각나는 날.'],
    ['미련', '헤어지고 나서야 알게 된 그 사람의 좋은 점들.'],
  ]},
  { nickname: '깊은 호수', birthYear: 1972, gender: 'male', entries: [
    ['외로움', '나이 들수록 익숙해지는 줄 알았는데, 다루는 법만 늘었다.'],
    ['시간', '젊을 땐 쓰는 것이었고 지금은 아끼는 것.'],
    ['기억', '좋은 것만 남기려고 애쓰는 마음.'],
    ['그리움', '전화번호는 지웠는데 손이 기억하는 것.'],
    ['노을', '하루가 지는 게 아니라 하루를 내려놓는 것.'],
  ]},
  { nickname: '둥근 달무리', birthYear: 1997, gender: 'male', entries: [
    ['청춘', '실수해도 되는 나이라고 다들 말하는데, 정작 나는 실수가 제일 무서운 때.'],
    ['낭만', '굳이 돌아가는 길로 걷는 것.'],
    ['여행', '돌아올 곳이 있어서 떠날 수 있는 것.'],
    ['위로', '같은 노래를 듣고 있다는 것만으로 되는 것.'],
    ['쓸쓸함', '축제가 끝난 거리를 걸을 때의 기분.'],
  ]},
];

async function seedDemoUsers() {
  const now = Date.now();
  let made = 0;
  for (let i = 0; i < DEMO_USERS.length; i++) {
    const d = DEMO_USERS[i];
    const email = `plaza${i + 1}${DEMO_EMAIL_DOMAIN}`;
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, nickname: d.nickname, birthYear: d.birthYear, gender: d.gender },
      update: { nickname: d.nickname, birthYear: d.birthYear, gender: d.gender },
    });
    for (let j = 0; j < d.entries.length; j++) {
      const [word, text] = d.entries[j];
      // 날짜를 흩어 둔다 — 한날한시에 쓴 글이면 광장이 가짜처럼 보인다.
      const savedAt = new Date(now - ((i * 7 + j * 11) % 60 + 1) * 86_400_000);
      const clientId = `${SHOWCASE_PREFIX}demo-${word}`;
      await prisma.entry.upsert({
        where: { userId_clientId: { userId: user.id, clientId } },
        create: { userId: user.id, clientId, word, text, savedAt },
        update: { word, text, savedAt },
      });
      made++;
    }
    console.log(`  ✓ ${d.nickname} — ${d.entries.map((e) => e[0]).join(', ')}`);
  }
  console.log(`\n완료 — 데모 유저 ${DEMO_USERS.length}명, 정의 ${made}개`);
  console.log(`지우려면: email이 '${DEMO_EMAIL_DOMAIN}'로 끝나는 users 행을 지우면 된다(정의도 함께).`);
}

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
  if (process.env.SHOWCASE_DEMO_USERS === '1') return seedDemoUsers();
  const userId = process.env.SHOWCASE_USER_ID;
  if (!userId) throw new Error('SHOWCASE_LIST=1, SHOWCASE_DEMO_USERS=1, SHOWCASE_USER_ID=<id> 중 하나가 필요하다.');
  return seed(userId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
