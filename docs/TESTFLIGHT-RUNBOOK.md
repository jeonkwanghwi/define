# TestFlight 배포 런북 (iOS)

> 목적: **현재 앱을 팀(iOS 4명)에게 TestFlight로 배포해 QA 시작**.
> 소셜 로그인·광고는 아직 없어도 됨 — 지금 빌드부터 올리고, 그 기능들은 **다음 빌드**에 얹는다.
> 이 문서는 Apple 계정이 나오는 즉시 **위에서부터 순서대로 복붙 실행**하는 체크리스트다.

관련: 로드맵·수순 결정은 [DEVELOPMENT.md 작업 로그 2026-08-09](./DEVELOPMENT.md), 메모리 `launch-roadmap-2026`.

---

## 준비 상태 (2026-08-15 기준)

| 항목 | 상태 |
|------|------|
| EAS 프로젝트 연결 (projectId·owner·slug=define·번들ID `com.define.app`) | ✅ 완료 |
| `eas.json` `production` 프로필 (store 배포 빌드) | ✅ 준비됨 (손댈 것 없음) |
| 앱 아이콘 알파 채널 제거 (iOS 리젝 방지) | ✅ 처리함 (`define.png` RGBA→RGB, 겉모습 동일) |
| 권한 문구(infoPlist) 필요 네이티브 모듈 | ✅ 현재 없음 (카메라/위치/알림/추적 등 미사용) |
| **Apple Developer $99 계정** | ✅ **결제 완료 (2026-09-06, 129,000원)** |
| **살아있는 백엔드 API + `eas.json`에 API 주소 주입** | ✅ **완료 (2026-09-06)** — 아래 참조 |

> ✅ **2026-09-06 해소 — 백엔드가 AWS에서 살아있고 앱이 그 주소를 본다.**
> `eas.json`의 `production` 프로필에 `env`가 없어서 빌드하면 `api-client.ts`의 폴백 `http://localhost:3000/api`가
> 번들에 박히는 문제(2026-09-05 발견)를 AWS 이관으로 해결했다. 현재 값:
> ```jsonc
> // front/mobile/eas.json
> "production": {
>   "autoIncrement": true,
>   "env": { "EXPO_PUBLIC_API_URL": "https://d2kejc3sjm91mt.cloudfront.net/api" }
> }
> ```
> 경로: **CloudFront(HTTPS) → ALB → ECS Fargate → RDS PostgreSQL** (전부 ap-northeast-2).
> CloudFront를 쓴 이유는 커스텀 도메인 없이 **유효한 TLS 인증서**를 얻기 위해서다 — iOS ATS가 평문 HTTP를 막는다.
> ⚠️ `EXPO_PUBLIC_*`는 **빌드 타임에 번들에 박히는** 값이라, 주소가 바뀌면 반드시 재빌드해야 한다.
> 상세는 [AWS-MIGRATION-PLAN.md](./AWS-MIGRATION-PLAN.md)의 "실행 결과(2026-09-06)".

→ **두 관문 모두 해소됨. 아래 STEP 1부터 바로 실행 가능.**

---

## STEP 0 — Apple Developer 가입 (사용자, 실세계) ✅ 완료

- **Apple Developer Program 연 $99** 가입: https://developer.apple.com/programs/enroll/
- 개인(Individual) 등록이면 **D-U-N-S 불요**(법인/Organization만 필요). 개인 등록 권장 — 가장 빠름.
- 준비물: 본인 Apple ID(2단계 인증 켜져 있어야 함), 결제 카드, 신원 확인(가끔 사진 신분증 요청).
- **승인까지 1~며칠** 소요될 수 있음 → 다른 것보다 먼저 걸어둘 것.
- 승인되면 이 Apple ID로 아래 EAS 명령에 로그인해서 빌드/업로드.

---

## STEP 1 — App Store Connect에 앱 레코드 생성

1. https://appstoreconnect.apple.com → **My Apps → ＋ → New App**
2. 입력:
   - Platform: **iOS**
   - Name: **define** (스토어 표시명 — 중복 시 다른 이름 필요)
   - Primary Language: **Korean**
   - Bundle ID: **com.define.app** (드롭다운에 없으면 [Certificates, IDs & Profiles]에서 먼저 등록되어야 함 — EAS가 자동 생성하기도 함. STEP 2 빌드를 먼저 돌리면 EAS가 만들어줌)
   - SKU: 아무 고유 문자열 (예: `define-ios-001`)
3. 생성하면 **ascAppId**(숫자)가 생김 → STEP 3에서 씀.

> TestFlight **내부 테스트**만 할 거면 여기까지가 대부분. 스크린샷·설명·개인정보 라벨 등 스토어 메타데이터는 **정식 출시 때** 채우면 됨.

---

## STEP 2 — iOS 빌드 (EAS)

```bash
cd front/mobile
# Apple 계정으로 로그인해서 인증서/프로파일을 EAS가 자동 관리하게 함
EXPO_TOKEN=<robot-token> eas build --profile production --platform ios
```

- 처음 실행 시 Apple 로그인 → EAS가 **배포 인증서 + 프로비저닝 프로파일 자동 생성**(직접 만들 필요 없음).
- `production` 프로필 = distribution 기본값 `store` → App Store Connect/TestFlight용 `.ipa` 산출.
- 빌드 번호는 `eas.json`의 `autoIncrement`+`appVersionSource: remote`로 **EAS가 자동 증가** — 수동 관리 불필요.
- 완료까지 EAS 클라우드에서 십수 분.

---

## STEP 3 — TestFlight에 업로드 (submit)

```bash
cd front/mobile
EXPO_TOKEN=<robot-token> eas submit --profile production --platform ios --latest
```

- `--latest` = 방금 STEP 2에서 만든 빌드를 올림.
- Apple ID / App Store Connect 앱 / 팀을 **대화형으로 물어봄** (ascAppId 등). 그대로 입력하면 됨.
  - (매번 자동화하고 싶으면 나중에 `eas.json`의 `submit.production`에 `appleId`·`ascAppId`·`appleTeamId`를 채워 넣으면 대화형 생략.)
- 업로드 후 App Store Connect에서 빌드가 **"처리 중(Processing)"** → 수 분~수십 분 뒤 TestFlight에 뜸.

---

## STEP 4 — 팀에게 배포 (내부 테스트)

1. App Store Connect → **TestFlight** 탭 → 방금 처리된 빌드 확인.
2. **내부 테스트(Internal Testing)**: **App Store Connect 사용자로 등록된 사람**(최대 100명)에게 배포.
   - 팀원 Apple ID를 **Users and Access**에 초대(역할 부여) → TestFlight 내부 그룹에 추가.
   - **베타 심사 불필요 · 즉시 배포** — 처리 끝나면 바로 받을 수 있음. ← 우리 팀(4명) 최적.
3. 팀원은 아이폰에 **TestFlight 앱** 설치 → 초대받은 계정으로 로그인하면 define이 뜸 → 설치·QA.

> **외부 테스트(External, 최대 10,000명·공개 링크)** 는 나중에 필요할 때만. **베타 앱 심사 1회 + 테스트 정보 입력** 필요. 지금은 내부로 충분.

---

## 반복 (다음 빌드 올릴 때)

코드 바뀔 때마다 **STEP 2 → STEP 3** 만 다시. 빌드 번호 자동 증가라 그냥 build→submit 반복. 내부 테스터는 심사 없이 새 버전 즉시 받음.

```bash
cd front/mobile
EXPO_TOKEN=<robot-token> eas build --profile production --platform ios
EXPO_TOKEN=<robot-token> eas submit --profile production --platform ios --latest
```

---

## 나중에 (소셜/광고 얹을 때) 추가될 것 — 지금은 불필요

- **카카오/Apple 로그인**: `app.json` iOS `infoPlist`에 URL scheme·`LSApplicationQueriesSchemes` 추가, expo plugin 설정. Apple 로그인은 카카오 넣으면 App Store 가이드 4.8로 **세트 강제**.
- **AdMob(보상형 광고)**: `react-native-google-mobile-ads` + iOS `NSUserTrackingUsageDescription`(ATT 문구) + `SKAdNetworkItems` + `GADApplicationIdentifier`. ATT 권한 문구 생기면 **개인정보 라벨**도 갱신 필요.
- **정식 출시**: 스크린샷(기기별), 앱 설명, 키워드, **개인정보 처리방침 URL**, 개인정보 라벨(App Privacy), 연령 등급, 카테고리. TestFlight 외부 테스트 시에도 일부 필요.

## 트러블슈팅

- **아이콘 리젝(ITMS-90717 "Invalid App Store Icon ... alpha channel")**: 소스 아이콘에 투명도가 있으면 발생. → `define.png`는 이미 알파 제거함(2026-08-15). 아이콘을 **재수출할 때 알파 다시 들어가지 않게** 주의(디자인 툴은 기본 RGBA로 저장하는 경우 많음).
- **번들 ID 불일치**: `app.json`(`com.define.app`)과 App Store Connect 앱 레코드의 Bundle ID가 같아야 함.
