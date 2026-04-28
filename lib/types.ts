// Pexip 접속 설정
export interface PexipConfig {
  url: string;        // e.g. https://pexip.example.com
  username: string;
  password: string;
}

// Pexip /api/admin/history/conference/ 응답 항목
export interface PexipConference {
  id: string;
  name: string;
  tag: string;
  start_time: string;       // ISO 8601
  end_time: string;         // ISO 8601
  duration: number;         // 초(seconds)
  participant_count: number;
  service_type: string;     // "conference" | "gateway" | "lecture" | "two_stage_dialing"
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

// Pexip /api/admin/history/participant/ 응답 항목
export interface PexipParticipant {
  id: string;
  display_name: string;
  role: "chair" | "guest" | "unknown";
  protocol: "WebRTC" | "SIP" | "H.323" | "RTMP" | "Skype" | "API" | "Teams" | string;
  connect_time: string;     // ISO 8601
  disconnect_time: string;  // ISO 8601
  duration: number;
  conference: string;       // conference name
  call_quality: number | null;
  remote_address: string;
  bandwidth: number;
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

// API Route로 전달하는 요청 바디
export interface PexipApiRequest {
  pexipUrl: string;
  username: string;
  password: string;
  endpoint: string;           // e.g. /api/admin/history/conference/
  params?: Record<string, string>;
}
