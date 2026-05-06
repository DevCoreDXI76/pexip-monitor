# Pexip Monitor

Pexip Infinity Management Node API를 사용해 **Microsoft Teams CVI 회의**를 회사 단위로 집계·시각화하고, **라이선스(Peak 동시 접속)** 와 **회의실(SIP/H.323) 가동률**을 분석하는 웹 대시보드입니다.

> 라이브 배포: [pexip-monitor.vercel.app](https://pexip-monitor.vercel.app)

---

## 주요 기능

### 1. Pexip 연결 설정
- Management Node URL · 계정 · 커스텀 API 기본 경로(`/api/admin` 외 사용 환경 대응)를 입력해 저장(localStorage).
- **연결 진단**: `/admin/`, `/api/`, `/api/admin/`, `/admin/api/`, `/api/client/v2/status` 등 여러 엔드포인트로 어떤 경로가 살아 있는지 확인.
- 자체 서명 SSL 인증서를 신뢰하도록 서버 라우트(`/api/pexip`)에서 `rejectUnauthorized: false`로 프록시 호출.

### 2. 기간별 회의 조회
- DateRangePicker로 시작/종료 일자 선택, 빠른 범위 버튼(오늘 · 최근 7/30/90일).
- 조회 시 `start_time__gte` / `start_time__lte`(UTC ISO)로 Pexip API에 전달.
- 자동 폴백: `history/v1/conference/` → `history/conference/` → `status/conference/`(현재 활성 회의).

### 3. 회사별 통계 카드
- **MS Teams IVR Service for …** 회의는 통계에서 **제외** (대기실 진입 잡음 제거).
- **Microsoft Teams CVI Call for …** 회의만 회사별 카운터로 집계.
- **카스케이딩 병합 적용**: 같은 baseName + 시간 겹침 회의를 1건으로 묶어 회의 수 / 참여자 수를 산출
  (참여자 수는 그룹 내 MAX → 노드별 중복 합산 방지).
- 카드에 회의 건수, 총 참여자 수, 평균 회의 시간 표시.
- 회사명 검색, 상위 회사 3곳에 메달 색상 배지(금/은/동).

### 4. 회의 상세 모달
- 클릭한 회사의 **카스케이딩 병합 결과(`mergedConferences`)** 를 시작 시간 내림차순으로 표시 — raw 회의를 직접 노출하지 않으므로 같은 회의가 hex ID만 다른 채 여러 건으로 보이지 않습니다.
- 분산된 회의에는 보라색 **"N개 노드 병합"** 배지 표시, 행 안에서 "병합된 원본 레코드 N건 보기"로 원본 hex ID·시각·인원 확인 가능.
- **회의 시각은 한국 표준시(KST)** 로 통일 표기 (`yyyy-MM-dd HH:mm`).
- 회의 행 펼치기 → **참가자 목록**(이름·프로토콜·역할·**참여/종료 시각**·통화 시간) 표시.
- **참가자 상세 보기 버튼**: 카스케이딩된 모든 source 회의 ID에 대해 `participant/?conference=<id>` API를 병렬 호출(온디맨드)한 뒤, **백플레인 가상 참가자를 제외**하고 `id`(없으면 `display_name`+참여시각) 기준으로 dedup.

### 5. 운영 분석 모달
회사별 카드 화면의 **「운영 분석」** 버튼으로 진입합니다. 같은 기간(상단 날짜 범위)을 그대로 사용해, 한 번의 API 호출로 받은 **기간 내 전체 참가자 데이터**를 KST 기준으로 분석합니다.

#### 5-1. 동시 접속(Peak) 분석 — 라이선스 최적화
- 시간 단위 선택: **10분 / 30분 / 1시간** 버킷.
- 각 버킷별 **「최대 동시 접속자 수」** 와 **「동시 진행 회의 수」** 산출.
- 기간 전체의 **글로벌 피크**(언제 몇 명/몇 건이 동시 발생했는지) 카드 표시.
- 알고리즘: 모든 참가자의 (참여 +1, 종료 -1) 이벤트를 KST 시간순으로 정렬해 **스윕 라인(sweep line)**. 이벤트 사이의 구간이 걸치는 모든 버킷에 현재 동시 카운트의 max를 갱신.

#### 5-2. 회의실 가동률 — SIP / H.323 장비 한정
- 프로토콜이 **SIP** 또는 **H.323**인 참가자만 "물리 회의실 화상장비"로 간주.
- 장비 키 = `display_name` 우선, 비어 있으면 `system_location`.
- **일별 / 월별** 토글로 사용 시간(`duration` 합)을 KST 기준 키(`yyyy-MM-dd` / `yyyy-MM`)로 분배.
- 결과는 총 사용 시간 내림차순 정렬.

#### 5-3. 병합 회의 (NEW) — 카스케이딩 분산 회의 정리
- Pexip은 참여자가 많은 회의를 여러 Conferencing Node로 분산(Cascading)하므로, 같은 회의가 여러 hex ID로 쪼개져 들어옵니다.
- **「병합 회의」** 탭에서 카스케이드된 레코드를 하나로 통합한 결과를 카드 그리드로 보여 줍니다.
  - 회의명 검색 / "분산 회의만" 토글
  - 카드에 시작·종료(KST) · 진행 시간 · 참여자 수(MAX) · 병합된 노드 개수 표시
  - 카드 하단의 “병합된 원본 레코드 N건 보기”를 펼치면 원본 hex ID·시각·인원이 함께 노출됩니다.
- 동일 로직(`mergeCascadedConferences`)이 회사별 통계의 회의 수 / 참여자 수에도 적용되어, 카드 화면 카운트 또한 분산 회의에 의해 부풀려지지 않습니다.

#### 5-4. 노이즈 필터 (IVR + 카스케이딩 백플레인 제외)
- **IVR 제외**: 참가자의 `service_type` / `service_name`에 "ivr"이 들어가거나, `MS Teams IVR Service for …` 회의의 `resource_uri`에 매칭되면 제외.
- **백플레인 제외**: Pexip 카스케이딩 시 Conferencing Node 사이를 잇는 가상 connection(사람이 아님)을 다음 패턴으로 식별해 제외.
  - `display_name` / `service_name`에 `backplane` / `cascade` 키워드 포함
  - `service_type`이 `backplane` / `cascade`로 시작
  - `protocol` = `API`이면서 `display_name`이 비어 있거나 순수 SIP URI(`a@b`) 형태만 있는 경우
- 즉 분석은 **CVI 회의 + 실제 사람 참여자** 기준의 순수 회의 시간만 사용 → Peak 동시 접속이 시스템 link로 부풀려지지 않습니다.

---

## 기술 스택

### 프레임워크 & 언어
- **Next.js 16.x (App Router)**
- **React 18**
- **TypeScript 5**

### UI / 스타일링
- **Tailwind CSS 3.4**
- **PostCSS / Autoprefixer**
- **Lucide React** — 아이콘 세트 (Building2, Video, Users, Activity 등)

### 입력 / 유틸
- **react-datepicker** — 시작/종료 날짜 선택
- **date-fns** — 날짜 보조 (예: `subDays`)

### 서버 (Next.js API Route)
- **node:https / node:http** — Pexip 서버에 자체 서명 인증서로 직접 요청
- 사내망 / 자체 서명 인증서를 갖춘 Pexip Management Node도 동작

### 배포
- **GitHub** ([DevCoreDXI76/pexip-monitor](https://github.com/DevCoreDXI76/pexip-monitor))
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
│  ├─ StatsDashboard.tsx        # 요약 카드/검색/회사별 카드 그리드 + "운영 분석" 트리거
│  ├─ CompanyCard.tsx           # 회사 1개 카드
│  ├─ MeetingModal.tsx          # 회의 상세 + 참가자 상세 보기 (온디맨드)
│  ├─ AnalyticsModal.tsx        # 동시 접속 Peak / 회의실 가동률 / 병합 회의 분석
│  └─ MergedConferencesList.tsx # 카스케이딩 병합 회의 카드 그리드 (NEW)
├─ hooks/
│  └─ usePexipData.ts           # 조회 상태/에러/loading 관리, endpointUsed 노출
├─ lib/
│  ├─ pexip.ts                  # API 호출/페이징/집계/시간 포맷 (KST)
│  ├─ analytics.ts              # KST 변환·IVR 필터·Peak·회의실 가동률 계산
│  ├─ merge.ts                  # 카스케이딩 회의 병합 유틸 + MergedConference 타입 (NEW)
│  └─ types.ts                  # PexipConference / Participant / CompanyStat 등 타입
├─ next.config.ts
├─ tailwind.config.ts
├─ tsconfig.json
└─ package.json
```

---

## 핵심 데이터 처리 로직

### 1) Timezone (UTC → KST)
- Pexip API는 시각을 **UTC**로 주거나 타임존 표기 없이 주는 경우가 있어, 브라우저 로컬 타임존에 의존하면 화면 시각이 어긋날 수 있습니다.
- `lib/pexip.ts`의 `parsePexipUtcDate`가 ISO를 **항상 UTC로 강제 파싱**(`Z`/오프셋이 없으면 `Z`를 자동 부착)한 뒤, `formatDateTime`이 `+9h`를 더해 `getUTC*`로 `yyyy-MM-dd HH:mm`을 만듭니다.
- 분석 모듈(`lib/analytics.ts`)도 동일한 변환을 사용하므로, 화면 시각·버킷 라벨·일별/월별 키가 모두 KST로 일관됩니다.
- 조회 쿼리 파라미터(`start_time__gte`/`__lte`, `connect_time__gte`/`__lte`)는 그대로 **UTC**로 보냅니다 — Pexip 서버가 UTC를 기대하기 때문입니다.

### 2) 노이즈 데이터 필터링 (IVR + 백플레인 제외)
회사 통계 / 운영 분석 모두에서 **IVR**과 **카스케이딩 백플레인**을 제외합니다.

- 회의 단위(`shouldIncludeConferenceInCompanyCounter`)
  - `MS Teams IVR Service for …` 매칭 시 제외
  - `Microsoft Teams CVI Call for …` 매칭 시만 회사별 카운터에 포함
- 참가자 단위 — IVR(`isIvrParticipant`)
  - `service_type` 또는 `service_name`에 "ivr" 포함 시 제외
  - IVR 회의의 `resource_uri`에 매칭되는 참가자도 제외
- 참가자 단위 — Backplane(`isBackplaneParticipant`)
  - `display_name` / `service_name`에 `backplane` / `cascade` 키워드 포함 시 제외
  - `service_type`이 `backplane` / `cascade`로 시작 시 제외
  - `protocol = API`이면서 `display_name`이 비어 있거나 SIP URI(`a@b`) 형태만 있을 때 제외
  - 보수적 패턴 매칭만 사용 — false positive 방지

### 3) 동시 접속(Peak) 알고리즘
참가자 시각을 KST 벽시계 ms로 정규화한 뒤, (참여 +1)·(종료 -1) 이벤트를 시간순으로 정렬해 스윕합니다.

```
let participants = 0
let activeConfs: Map<conferenceUri, count> = {}
for each event in sorted(events):
    apply current (participants, activeConfs.size) as max to all buckets
    overlapping segment [lastTime, event.time)
    update participants, activeConfs by event.delta
```

- 같은 시각에 종료(`-1`)를 시작(`+1`)보다 먼저 처리해 "끝나자마자 다음 회의가 시작"하는 경우의 중복 카운팅을 막습니다.
- 종료 시각이 비어 있으면(진행 중) `connect_time + duration`, 그것도 없으면 분석 종료 시각까지로 캡합니다.
- 출력: 각 버킷의 `maxConcurrentParticipants` / `maxConcurrentMeetings` + 기간 전체 글로벌 피크.

### 4) 회의실(SIP/H.323) 가동률
- `protocol`이 SIP / H.323 / H323(대소문자 무시)인 참가자만 사용.
- 장비 키 = `display_name`이 있으면 그 값, 없으면 `system_location`, 둘 다 없으면 "Unknown".
- 일별 키: `KST yyyy-MM-dd` (참여 시각 기준), 월별 키: `KST yyyy-MM`.
- `duration`이 없으면 `connect_time` ~ `disconnect_time` 차이로 보정.
- 결과는 장비별 총 사용 시간 내림차순.

> 한 세션이 자정을 넘어가는 경우 본 구현은 단순히 `connect_time` 기준 한 키에 합산합니다. 더 정밀히 일자별로 쪼개려면 `lib/analytics.ts`의 `computeRoomUtilization`을 확장하면 됩니다(주석 참고).

### 5) 카스케이딩(분산 회의) 병합 — `lib/merge.ts`
Pexip이 큰 회의를 여러 노드에 분산해 동일 회의가 hex ID만 다른 여러 레코드로 들어오는 문제를 해소합니다.

```ts
// lib/merge.ts
export function splitConferenceName(name: string): { baseName: string; suffix: string };
export function mergeCascadedConferences(conferences: PexipConference[]): MergedConference[];

export interface MergedConference {
  service_name: string;       // 콜론 앞 baseName (정제된 이름)
  start_time: string;         // MIN
  end_time?: string;          // MAX
  duration?: number;          // end-start 우선, 없으면 그룹 MAX(duration)
  participant_count: number;  // MAX (중복 합산 방지)
  service_type: string;
  sources: PexipConference[]; // 병합된 원본 레코드
  cascadeCount: number;       // = sources.length
}
```

**알고리즘 요약 — 강한 키 → 약한 키 순서 + 인터벌 cluster**

1. **1차 그룹화 — `tag` 우선, 없으면 `baseName`**
   - `tag`(Pexip 관리자가 회의 템플릿/태그로 부여)가 비어 있지 않으면 `tag:<value>`를 그룹 키로 사용 (가장 강한 식별자)
   - `tag`가 없으면 `name`의 콜론(`:`) 앞 `baseName`으로 그룹화
2. 그룹 내에서 `start_time` 오름차순 정렬
3. 누적 cluster의 `[clusterStart, clusterMaxEnd]`와 다음 항목 `[s, e]`가 겹치면 cluster에 추가, 아니면 새 cluster 시작
   - 겹침 판정: `aStart < bEnd && bStart < aEnd`
   - 누적된 max-end로 비교하므로 체인형 cascade도 한 그룹으로 묶임
   - 같은 tag/baseName이라도 인터벌이 떨어져 있으면 별개 회의로 분리 → 태그 재사용 시 잘못된 병합 방지
4. cluster마다 **MIN(start) / MAX(end) / MAX(participant_count)** 로 `MergedConference` 생성
   - **참여자 수는 SUM이 아닌 MAX** — Pexip 카스케이딩에서는 모든 노드 레코드가 전체 참여자 수를 동일하게 보유하므로 단순 합산은 중복임

**적용 위치**
- `buildStats` (`lib/pexip.ts`) — 회사별 통계의 회의 수 / 총 참여자 수 / 총 진행 시간이 모두 병합 결과 기준
- `MeetingModal` — 회사 카드 클릭 시 보이는 회의 상세 목록에 그대로 사용
- `AnalyticsModal`의 "병합 회의" 탭 — 카드 그리드로 시각화

**고유 참여자 수 산출(MeetingModal)**

회의 행 펼치기 → 참가자 상세 보기를 누르면, 카스케이딩된 모든 source 회의 ID에 대해 `participant/?conference=<id>`를 병렬 호출한 뒤 다음 순서로 정제합니다.
1. `isBackplaneParticipant`로 시스템 link(가상 참가자) 제외
2. `id`(없으면 `display_name + 참여시각`) 기준 dedup
3. 표시 인원 수 = 실제 사람 참여자의 고유 수

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
2. 상단 날짜 범위(또는 빠른 범위)를 선택하고 **조회** — 회사별 카드가 표시됩니다.
3. 회사 카드 클릭 → 회의·참가자 상세, 모달 안에서 **참가자 상세 보기**로 참가자 목록 가져오기.
4. 검색창 옆 **운영 분석** 버튼 → 동시 접속 Peak / 회의실 가동률 확인.

---

## 환경 / 호환성 메모

- **Management Node API**가 활성화되어 있어야 합니다. Conferencing Node에는 `api/admin/...`이 없으므로 동작하지 않습니다.
- 일부 환경은 `/api/admin` 대신 `/admin/api` 등을 쓰기 때문에 **고급 설정 → 커스텀 API 경로**로 우회 가능합니다.
- 회사별 통계의 **「총 참여자 수」** 는 회의 메타(`participant_count`)를 사용합니다 — 첫 조회 속도를 위해 회의 단위만 받습니다.
- 운영 분석 모달은 별도로 **기간 내 전체 참가자**를 한 번에 받아옵니다(연결 시각 필터 사용). 기간이 길면 호출량이 늘어 다소 시간이 걸릴 수 있습니다.

---

## 개발 히스토리(요약)

- 회의 + 참가자 페이지를 모두 **순차 호출**하던 구조 → **회의 목록만 선조회 + 페이징 병렬화**로 응답 속도 개선.
- 참가자 상세는 **회의별 온디맨드(`/participant/?conference=<id>`)** 호출로 분리.
- Pexip 시각을 **항상 UTC로 강제 파싱 → +9h KST 표시**하도록 변경 (Pexip 웹 UI와 일치).
- **MS Teams IVR Service for …** 회의는 회사 통계에서 제외, **Microsoft Teams CVI Call for …**만 회사 단위로 집계.
- **운영 분석 모달 추가** — 동시 접속 Peak(스윕 라인) / SIP·H.323 회의실 가동률(KST 일별·월별).
- **카스케이딩 회의 병합** — Cascading으로 분산된 동일 회의를 baseName + 시간 겹침 기준으로 병합해 회의 수·참여자 수의 중복 카운팅 제거. 분석 모달의 "병합 회의" 탭에서 결과 확인.
- **회의 상세 모달도 병합 결과 기준으로 표시** — 같은 회의가 hex ID만 다른 채 여러 건으로 노출되던 문제 해소. 분산 시 "N개 노드 병합" 배지로 안내.
- **병합 알고리즘 강화** — 1차 그룹 키를 `tag` 우선(없으면 `baseName`)으로 변경. 같은 tag 안에서도 인터벌 cluster를 다시 적용해 태그 재사용에 의한 오병합 방지.
- **카스케이딩 백플레인 참가자 제외** — `isBackplaneParticipant`로 Conferencing Node 사이의 가상 connection을 식별, 운영 분석(Peak / 회의실 가동률)과 회의 상세 참가자 카운트에서 제외.
- GitHub `main` 푸시 시 Vercel 자동 배포.

---

## 라이선스

내부/사내 운영을 전제로 한 비공개 프로젝트(`"private": true`)입니다. 외부 공개·재배포 시에는 사내 보안/계정 정보가 노출되지 않도록 주의하세요.
