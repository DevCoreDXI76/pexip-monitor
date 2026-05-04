# Pexip Monitor

Pexip Infinity Management Node API를 사용해 **Microsoft Teams CVI 회의**를 회사 단위로 집계·시각화하는 웹 대시보드입니다.

> 라이브 배포: [pexip-monitor.vercel.app](https://pexip-monitor.vercel.app)

---

## 주요 기능

### 1. Pexip 연결 설정
- Management Node URL · 계정 · 커스텀 API 기본 경로(`/api/admin` 외 사용 환경 대응)를 입력해 저장(localStorage).
- **연결 진단**: `/admin/`, `/api/`, `/api/admin/`, `/admin/api/`, `/api/client/v2/status` 등 여러 엔드포인트를 확인해 어떤 경로가 살아 있는지 진단합니다.
- 자체 서명 SSL 인증서를 신뢰하도록 서버 라우트(`/api/pexip`)에서 `rejectUnauthorized: false`로 프록시 호출.

### 2. 기간별 회의 조회
- DateRangePicker로 시작/종료 일자 선택, 빠른 범위 버튼(오늘 · 최근 7/30/90일).
- 조회 시 `start_time__gte` / `start_time__lte`(UTC ISO)로 Pexip API에 전달.
- 자동 폴백: `history/v1/conference/` → `history/conference/` → `status/conference/`(현재 활성 회의).

### 3. 회사별 통계 카드
- **MS Teams IVR Service for …** 회의는 통계에서 **제외**.
- **Microsoft Teams CVI Call for …** 회의만 회사별 카운터로 집계.
- 카드에 회의 건수, 총 참여자 수, 평균 회의 시간 표시.
- 회사명 검색, 상위 회사 3곳에 메달 색상 배지(금/은/동).

### 4. 회의 상세 모달
- 클릭한 회사의 회의 목록을 시작 시간 내림차순으로 표시.
- **회의 시각은 한국 표준시(KST) 기준**으로 통일 표기 (`yyyy-MM-dd HH:mm`).
  - Pexip이 타임존 표기 없이 시각을 주는 경우(`2026-05-04T00:03:47`)도 대응하기 위해 ISO를 **UTC로 강제 파싱한 뒤 +9h**를 더해 포맷.
- 회의 행 펼치기 → **참가자 목록**(이름·프로토콜·역할·참여 시각·종료 시각·통화 시간) 표시.
- **참가자 상세 보기 버튼**: 첫 조회 속도를 위해 회의 단위로만 메타데이터를 받고, 사용자가 버튼을 누른 회의에 한해서만 `participant/?conference=<id>` API를 호출(온디맨드).

### 5. 성능 최적화
- 회의 목록 페이징을 첫 페이지 응답의 `total_count`로 계산해 **추가 페이지를 병렬 호출**(최대 5개 동시).
- 첫 조회 시에는 참가자 API를 호출하지 않고 회의의 `participant_count`만으로 집계해 응답 속도 향상.
- 화면에서 펼치는 회의에 한해서만 참가자 상세 호출 → 큰 기간을 조회해도 일관되게 빠릅니다.

---

## 기술 스택

### 프레임워크 & 언어
- **Next.js 16.x (App Router)**
- **React 18**
- **TypeScript 5**

### UI / 스타일링
- **Tailwind CSS 3.4**
- **PostCSS / Autoprefixer**
- **Lucide React** — 아이콘 세트 (Building2, Video, Users 등)

### 입력/유틸
- **react-datepicker** — 시작/종료 날짜 선택
- **date-fns** — 날짜 보조 (예: `subDays`)

### 서버 (Next.js API Route)
- **node:https / node:http** — Pexip 서버에 자체 서명 인증서로 직접 요청
- 사내망 / 자체 서명 인증서를 갖춘 Pexip Management Node도 동작

### 배포
- **GitHub** (`https://github.com/DevCoreDXI76/pexip-monitor`)
- **Vercel** (자동 배포, App Router + API Route 지원)

---

## 디렉터리 구조

```
.
├─ app/
│  ├─ api/pexip/route.ts        # Pexip 서버에 인증/프록시 호출 (자체 서명 SSL 허용)
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx                  # 메인 페이지 (조회 흐름 컨테이너)
├─ components/
│  ├─ ConnectionForm.tsx        # Pexip 연결 설정 + 연결 진단
│  ├─ DateRangePicker.tsx       # 날짜 선택 + 빠른 범위 + 조회 버튼
│  ├─ StatsDashboard.tsx        # 요약 카드/검색/회사별 카드 그리드
│  ├─ CompanyCard.tsx           # 회사 1개 카드
│  └─ MeetingModal.tsx          # 회의 상세 + 참가자 상세 보기 (온디맨드)
├─ hooks/
│  └─ usePexipData.ts           # 조회 상태/에러/loading 관리, endpointUsed 노출
├─ lib/
│  ├─ pexip.ts                  # API 호출/페이징/집계/시간 포맷 (KST)
│  └─ types.ts                  # PexipConference / Participant / CompanyStat 등 타입
├─ next.config.ts
├─ tailwind.config.ts
├─ tsconfig.json
└─ package.json
```

---

## 시간(KST) 처리 메모

- Pexip API는 시각을 **UTC**로 주거나 타임존 표기 없이 주는 경우가 있어, 브라우저 로컬 타임존에 의존하면 화면 시각이 어긋날 수 있습니다.
- `lib/pexip.ts`의 `parsePexipUtcDate`가 ISO를 **항상 UTC로 강제 파싱**한 뒤 `formatDateTime`에서 `+9h`를 더해 `getUTC*`로 `yyyy-MM-dd HH:mm`을 만듭니다.
- 그 결과 Pexip 플랫폼 화면(JST/KST 표시)과 본 대시보드의 시각이 일치합니다.
- 조회 쿼리 파라미터(`start_time__gte`/`__lte`)는 그대로 **UTC**로 보냅니다 — Pexip 서버가 UTC를 기대하기 때문입니다.

---

## 로컬 실행

### 사전 조건
- Node.js 20 LTS 이상
- Pexip Management Node에 접근 가능한 네트워크 (사내망/VPN)

### 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

### 빌드

```bash
npm run build
npm run start
```

### 사용 흐름
1. 우측 상단 **Pexip 연결 설정** → URL/계정 입력 후 저장 (필요 시 **연결 진단**으로 동작 가능한 API 경로 확인).
2. 상단 날짜 범위(또는 빠른 범위)를 선택하고 **조회**.
3. 회사 카드를 클릭해 모달에서 회의별 상세를 확인. 펼친 회의에서 **참가자 상세 보기**로 참가자 목록 조회.

---

## 주요 환경 / 호환성 메모

- **Management Node API**가 활성화되어 있어야 합니다. Conferencing Node에는 `api/admin/...`이 없으므로 동작하지 않습니다.
- 일부 환경은 `/api/admin` 대신 `/admin/api` 등을 쓰기 때문에 **고급 설정 → 커스텀 API 경로**로 우회 가능합니다.
- `participant_count`는 회의 메타데이터에 들어 있는 값으로 회사별 집계의 **「총 참여자 수」**가 됩니다. 참가자별 상세는 모달의 버튼으로만 호출합니다(서버 부하/지연 절감).

---

## 개발 히스토리(요약)

- 회의 + 참가자 페이지를 모두 **순차 호출**하던 구조를 → **회의 목록만 선조회 + 페이징 병렬화**로 전환해 응답 속도 개선.
- 참가자 상세는 **회의별 온디맨드(`/participant/?conference=<id>`)** 호출로 분리.
- Pexip의 시각을 **항상 UTC로 강제 파싱 → +9h KST 표시**하도록 변경 (Pexip 웹 UI 표시와 일치).
- **MS Teams IVR Service for …** 회의는 회사 통계에서 제외, **Microsoft Teams CVI Call for …**만 회사 단위로 집계.
- GitHub `main` 푸시 시 Vercel 자동 배포.

---

## 라이선스

내부/사내 운영을 전제로 한 비공개 프로젝트(`"private": true`)입니다. 외부 공개·재배포 시에는 사내 보안/계정 정보가 노출되지 않도록 주의하세요.
