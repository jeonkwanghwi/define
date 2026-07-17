/**
 * 디폴트 닉네임 생성 — "형용사 명사" 랜덤 조합 (예: "산뜻한 밤바람").
 * 가입 시 자동 배정용. 브랜드 톤(따뜻한 페이퍼·자연어)에 맞춘 단어 풀.
 * 조합 최장 9자(공백 포함) — DTO/프론트 제한 16자 안쪽.
 */
const ADJECTIVES = [
  '산뜻한', '고요한', '느긋한', '다정한', '잔잔한',
  '포근한', '담담한', '맑은', '깊은', '환한',
  '은은한', '조용한', '너른', '순한', '둥근',
  '흘러가는', '반짝이는', '서성이는', '유연한', '단단한',
];

const NOUNS = [
  '밤바람', '나그네', '이슬', '여울', '별빛',
  '햇살', '물결', '소나기', '달무리', '봄비',
  '단풍', '구름', '연못', '등불', '호수',
  '조약돌', '솔바람', '시냇물', '은하수', '달빛',
  '새벽숲', '모래섬', '풀잎', '함박눈', '저녁놀',
];

export function generateNickname(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}
