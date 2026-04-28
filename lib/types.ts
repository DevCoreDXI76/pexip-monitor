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
// status 엔드포인트는 disconnect_time, duration 없음 (연결 중인 참여자)
export interface PexipParticipant {
  id: string;
  display_name: string;
  role: "chair" | "guest" | "unknown";
  protocol: "WebRTC" | "SIP" | "H.323" | "RTMP" | "Skype" | "API" | "Teams" | string;
  connect_time: string;         // ISO 8601
  disconnect_time?: string;     // history만 존재
  duration?: number;            // history만 존재
  conference: string;
  call_quality?: number | null;
  remote_address: string;
  bandwidth?: number;
  resource_uri: string;
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
  meetingCount: number;
  totalDuration: number;      // 초
  totalParticipants: number;
  conferences: EnrichedConference[];
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
