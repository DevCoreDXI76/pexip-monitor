// Pexip 접속 설정
export interface PexipConfig {
  url: string;              // e.g. https://pexip.example.com
  username: string;
  password: string;
  customApiBase?: string;   // 커스텀 API 기본 경로 (기본: /api/admin)
}

// Pexip /api/admin/history/conference/ 또는 /api/admin/status/conference/ 응답 항목
// status 엔드포인트는 end_time, duration 없음 (진행 중인 회의)
export interface PexipConference {
  id: string;
  name: string;
  tag: string;
  start_time: string;           // ISO 8601
  end_time?: string;            // history만 존재
  duration?: number;            // history만 존재 (초)
  participant_count: number;
  service_type: string;
  resource_uri: string;
}

export interface PexipConferenceListResponse {
  meta: {
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total_count: number;
  };
  objects: PexipConference[];
}

// Pexip /api/admin/history/participant/ 또는 /api/admin/status/participant/ 응답 항목
// history: connect_time/disconnect_time 또는 start_time/end_time 등 버전별 필드명 차이 가능
// status: 진행 중이면 종료 시각·duration 없을 수 있음
export interface PexipParticipant {
  id: string;
  display_name: string;
  role: "chair" | "guest" | "unknown";
  protocol: "WebRTC" | "SIP" | "H.323" | "RTMP" | "Skype" | "API" | "Teams" | string;
  /** 참가 시각 (일부 버전/응답은 start_time) */
  connect_time?: string;
  start_time?: string;
  /** 퇴장 시각 (history: disconnect_time 또는 end_time) */
  disconnect_time?: string;
  end_time?: string;
  duration?: number;            // history만 존재
  conference: string;
  call_quality?: number | null;
  remote_address: string;
  bandwidth?: number;
  resource_uri: string;
  /** 회의실 가동률 집계용 — 물리 장비 위치(예: "Posco_CVI_Zone") */
  system_location?: string;
  /** "ivr"/"conference"/"gateway" 등 — 노이즈 필터(IVR 제외)에 사용 */
  service_type?: string;
  service_name?: string;
}

export interface PexipParticipantListResponse {
  meta: {
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total_count: number;
  };
  objects: PexipParticipant[];
}

// 데이터 소스 구분
export type DataSource = "history" | "status";

// 가공된 회의 데이터 (참여자 포함)
export interface EnrichedConference extends PexipConference {
  participants: PexipParticipant[];
  company: string;
}

// 회사별 통계 집계 결과
export interface CompanyStat {
  company: string;
  /** 카스케이딩 병합 후 회의 수 (= mergedConferences.length) */
  meetingCount: number;
  /** 병합 회의 기준 총 진행 시간 합계 (초) */
  totalDuration: number;
  /** 중복 합산을 막은 참여자 수 합계 (병합 회의별 MAX participant_count의 합) */
  totalParticipants: number;
  /** Pexip이 보낸 원본 회의 (cascading으로 분할된 그대로) */
  conferences: EnrichedConference[];
  /** 카스케이딩 병합 결과 — UI 표시·정확한 카운트 산출에 사용 */
  mergedConferences: import("./merge").MergedConference[];
}

// 조회 결과 (데이터 소스 정보 포함)
export interface FetchResult {
  stats: CompanyStat[];
  dataSource: DataSource;
  endpointUsed: string;
}

// API Route로 전달하는 요청 바디
export interface PexipApiRequest {
  pexipUrl: string;
  username: string;
  password: string;
  endpoint: string;           // e.g. /api/admin/history/conference/
  params?: Record<string, string>;
}
