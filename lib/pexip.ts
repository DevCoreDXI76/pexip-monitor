import { format } from "date-fns";
import type {
  PexipConference,
  PexipConferenceListResponse,
  PexipParticipant,
  PexipParticipantListResponse,
  EnrichedConference,
  CompanyStat,
} from "./types";

// 회의 이름에서 회사명을 추출하는 헬퍼
// Pexip 환경마다 네이밍 규칙이 다르므로 필요에 따라 커스터마이징
export function extractCompanyFromConference(conference: PexipConference): string {
  const name = conference.name || "";
  const tag = conference.tag || "";

  // 우선순위 1: tag 값이 있으면 사용
  if (tag && tag.trim()) return tag.trim();

  // 우선순위 2: 회의명에서 "@" 앞의 도메인이나 첫 번째 세그먼트 추출
  // 예: "meetingroom@company.com" -> "company.com"
  if (name.includes("@")) {
    const parts = name.split("@");
    return parts[parts.length - 1].split(".")[0] || name;
  }

  // 우선순위 3: 언더스코어나 하이픈으로 분리된 첫 번째 세그먼트
  // 예: "CompanyA_Weekly_Standup" -> "CompanyA"
  const separatorMatch = name.match(/^([^_\-]+)/);
  if (separatorMatch) return separatorMatch[1];

  return name || "Unknown";
}

// 초(seconds)를 "Xh Ym" 형식으로 변환
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ISO 날짜 문자열을 한국어 형식으로 포맷
export function formatDateTime(iso: string): string {
  if (!iso) return "-";
  try {
    return format(new Date(iso), "yyyy-MM-dd HH:mm");
  } catch {
    return iso;
  }
}

// 프록시 API를 통해 Pexip 데이터를 페이지네이션 처리하며 전량 조회
async function fetchAllPexip<T>(
  pexipUrl: string,
  username: string,
  password: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const allItems: T[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const queryParams = new URLSearchParams({
      ...params,
      limit: String(limit),
      offset: String(offset),
    });

    const res = await fetch("/api/pexip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pexipUrl,
        username,
        password,
        endpoint,
        params: Object.fromEntries(queryParams),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `API 오류: ${res.status}`);
    }

    const data = await res.json() as { meta: { next: string | null; total_count: number }; objects: T[] };
    allItems.push(...data.objects);

    if (!data.meta.next || allItems.length >= data.meta.total_count) break;
    offset += limit;
  }

  return allItems;
}

// 날짜 범위에 해당하는 회의 + 참여자 데이터를 조회하고 회사별 통계로 가공
export async function fetchCompanyStats(
  pexipUrl: string,
  username: string,
  password: string,
  startDate: Date,
  endDate: Date
): Promise<CompanyStat[]> {
  const startStr = format(startDate, "yyyy-MM-dd'T'00:00:00");
  const endStr = format(endDate, "yyyy-MM-dd'T'23:59:59");

  // 1. 기간 내 회의 목록 조회
  const conferences = await fetchAllPexip<PexipConference>(
    pexipUrl,
    username,
    password,
    "/api/admin/history/conference/",
    {
      start_time__gte: startStr,
      start_time__lte: endStr,
    }
  );

  if (conferences.length === 0) return [];

  // 2. 해당 기간의 참여자 목록 조회
  const participants = await fetchAllPexip<PexipParticipant>(
    pexipUrl,
    username,
    password,
    "/api/admin/history/participant/",
    {
      connect_time__gte: startStr,
      connect_time__lte: endStr,
    }
  );

  // 3. 참여자를 회의 이름 기준으로 그룹핑
  const participantsByConference = new Map<string, PexipParticipant[]>();
  for (const p of participants) {
    const key = p.conference;
    if (!participantsByConference.has(key)) {
      participantsByConference.set(key, []);
    }
    participantsByConference.get(key)!.push(p);
  }

  // 4. 회의에 참여자 및 회사명 부착
  const enriched: EnrichedConference[] = conferences.map((conf) => ({
    ...conf,
    participants: participantsByConference.get(conf.name) ?? [],
    company: extractCompanyFromConference(conf),
  }));

  // 5. 회사별 집계
  const companyMap = new Map<string, CompanyStat>();

  for (const conf of enriched) {
    const key = conf.company;
    if (!companyMap.has(key)) {
      companyMap.set(key, {
        company: key,
        meetingCount: 0,
        totalDuration: 0,
        totalParticipants: 0,
        conferences: [],
      });
    }
    const stat = companyMap.get(key)!;
    stat.meetingCount += 1;
    stat.totalDuration += conf.duration ?? 0;
    stat.totalParticipants += conf.participant_count ?? conf.participants.length;
    stat.conferences.push(conf);
  }

  // 회의 수 내림차순 정렬
  return Array.from(companyMap.values()).sort(
    (a, b) => b.meetingCount - a.meetingCount
  );
}
