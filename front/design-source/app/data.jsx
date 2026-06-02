// data.jsx — sample content for the define prototype
window.DEFINE_DATA = {
  user: { name: "지우", ruby: 1240, streak: 7, joinedAge: 28 },

  // today's recommended words (server-picked); not-yet-defined today
  todayWords: ["행복", "사랑", "돈", "시간", "용기", "어른"],

  // my journal — words I've defined, with time-ordered entries
  journal: [
    {
      word: "행복", entries: [
        { date: "2025.05.30", rel: "오늘", text: "멀리 있지 않은 것. 오늘 아침 창으로 들어온 햇살, 따뜻한 커피 한 잔처럼 사소한 순간들이 모여 만들어지는 것." },
        { date: "2024.05.12", rel: "1년 전", text: "목표를 이뤘을 때 비로소 찾아오는 보상 같은 것. 노력의 끝에 있는 무엇." },
        { date: "2023.04.28", rel: "2년 전", text: "남들이 부러워할 만한 삶을 사는 것. SNS에 올릴 만한 순간들." },
      ], changed: true, changeNote: "1년 전보다 '소유'에서 '순간'으로 생각이 옮겨갔어요"
    },
    {
      word: "사랑", entries: [
        { date: "2025.04.18", rel: "지난달", text: "익숙함을 견디는 일. 설렘이 가라앉은 자리에 남는 단단한 신뢰." },
        { date: "2024.02.14", rel: "작년", text: "심장이 뛰는 일. 그 사람 생각에 잠 못 드는 밤." },
      ], changed: true, changeNote: "'설렘'에서 '신뢰'로 무게 중심이 바뀌었어요"
    },
    { word: "어른", entries: [{ date: "2025.03.02", rel: "올해", text: "책임의 무게를 알면서도 도망치지 않는 사람." }], changed: false },
    { word: "용기", entries: [{ date: "2025.01.21", rel: "올해", text: "두렵지 않은 게 아니라, 두려워도 한 발 내딛는 것." }], changed: false },
    { word: "시간", entries: [{ date: "2024.11.09", rel: "작년", text: "공평하게 주어지지만 누구에게나 다르게 흐르는 것." }], changed: false },
  ],

  // 광장 — others' definitions, grouped by word
  plaza: [
    {
      word: "행복", count: 1248, defs: [
        { author: "느린산책", text: "퇴근길 버스 창에 머리를 기대고 듣는 노래 한 곡." },
        { author: "유월", text: "엄마가 끓여준 된장찌개 냄새. 별것 아닌데 코끝이 찡한 것." },
        { author: "익명의 정원사", text: "내가 심은 화분에서 새 잎이 돋는 걸 발견한 아침." },
      ]
    },
    {
      word: "사랑", count: 982, defs: [
        { author: "겨울나무", text: "굳이 말하지 않아도 내 컵에 물을 채워두는 사람." },
        { author: "파랑", text: "그 사람의 단점까지 외워버린 상태." },
      ]
    },
    {
      word: "돈", count: 640, defs: [
        { author: "현실주의자", text: "자유를 사는 도구. 많아서가 아니라, 선택할 수 있게 해주니까." },
      ]
    },
  ],
};
