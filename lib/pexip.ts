import { format } from "date-fns";
import type {
  PexipConference,
  PexipParticipant,
  EnrichedConference,
  CompanyStat,
  DataSource,
  FetchResult,
} from "./types";

export function extractCompanyFromConference(conference: PexipConference): string {
  const name = conference.name || "";
  const tag = conference.tag || "";

  if (tag && tag.trim()) return tag.trim();

  if (name.includes("@")) {
    const parts = name.split("@");
    return parts[parts.length - 1].split(".")[0] || name;
  }

  const separatorMatch = name.match(/^([^_\-]+)/);
  if (separatorMatch) return separatorMatch[1];

  return name || "Unknown";
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "-";
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  try {
    return format(new Date(iso), "yyyy-MM-dd HH:mm");
  } catch {
    return iso;
  }
}

// Pexip API를 통해 모든 페이지 데이터를 가져오는 공통 함수
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

    const data = await res.json() as {
      meta: { next: string | null; total_count: number };
      objects: T[];
    };
    allItems.push(...data.objects);

    if (!data.meta.next || allItems.length >= data.meta.total_count) break;
    offset += limit;
  }

  return allItems;
}

// 회의 + 참여자를 조회하여 회사별 통계로 집계
async function buildStats(
  pexipUrl: string,
  username: string,
  password: string,
  conferenceEndpoint: string,
  participantEndpoint: string,
  conferenceParams: Record<string, string>,
  participantParams: Record<string, string>
): Promise<CompanyStat[]> {
  const [conferences, participants] = await Promise.all([
    fetchAllPexip<PexipConference>(pexipUrl, username, password, conferenceEndpoint, conferenceParams),
    fetchAllPexip<PexipParticipant>(pexipUrl, username, password, participantEndpoint, participantParams).catch(() => [] as PexipParticipant[]),
  ]);

  if (conferences.length === 0) return [];

  const participantsByConference = new Map<string, PexipParticipant[]>();
  for (const p of participants) {
    const key = p.conference;
    if (!participantsByConference.has(key)) {
      participantsByConference.set(key, []);
    }
    participantsByConference.get(key)!.push(p);
  }

  const enriched: EnrichedConference[] = conferences.map((conf) => ({
    ...conf,
    participants: participantsByConference.get(conf.name) ?? [],
    company: extractCompanyFromConference(conf),
  }));

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

  return Array.from(companyMap.values()).sort((a, b) => b.meetingCount - a.meetingCount);
}

// 메인 함수: history → status 순으로 자동 폴백, 커스텀 API 기본 경로 지원
export async function fetchCompanyStats(
  pexipUrl: string,
  username: string,
  password: string,
  startDate: Date,
  endDate: Date,
  customApiBase?: string
): Promise<FetchResult> {
  const startStr = format(startDate, "yyyy-MM-dd") + "T00:00:00";
  const endStr = format(endDate, "yyyy-MM-dd") + "T23:59:59";

  // API 기본 경로 결정 (커스텀 우선, 기본은 /api/admin)
  const apiBase = (customApiBase ?? "/api/admin").replace(/\/$/, "");

  // 1차 시도: history 엔드포인트
  try {
    const stats = await buildStats(
      pexipUrl, username, password,
      `${apiBase}/history/conference/`,
      `${apiBase}/history/participant/`,
      { start_time__gte: startStr, start_time__lte: endStr },
      { connect_time__gte: startStr, connect_time__lte: endStr }
    );
    return { stats, dataSource: "history", endpointUsed: `${apiBase}/history/conference/` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is404 = msg.includes("404") || msg.includes("찾을 수 없습니다");
    if (!is404) throw err;
  }

  // 2차 시도: status 엔드포인트 (현재 활성 회의)
  try {
    const stats = await buildStats(
      pexipUrl, username, password,
      `${apiBase}/status/conference/`,
      `${apiBase}/status/participant/`,
      {},
      {}
    );
    return { stats, dataSource: "status", endpointUsed: `${apiBase}/status/conference/` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is404 = msg.includes("404") || msg.includes("찾을 수 없습니다");

    if (is404) {
      throw new Error(
        `Pexip REST API에 접근할 수 없습니다 (API 경로: ${apiBase}).\n\n` +
        "확인 사항:\n" +
        "① 연결 설정 → '연결 진단'을 눌러 어떤 엔드포인트가 동작하는지 확인하세요\n" +
        "② 입력한 URL이 Management Node인지 확인 (Conferencing Node는 관리 API 없음)\n" +
        "③ Pexip 관리자 계정(super-admin) 권한 확인\n" +
        "④ API 경로가 다른 경우 '고급 설정 > 커스텀 API 경로'를 사용하세요"
      );
    }
    throw err;
  }
}
