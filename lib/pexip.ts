import type {
  PexipConference,
  PexipParticipant,
  PexipConfig,
  EnrichedConference,
  CompanyStat,
  DataSource,
  FetchResult,
} from "./types";

function toUtcIsoRange(date: Date, kind: "start" | "end"): string {
  const d = new Date(date);
  if (kind === "start") {
    d.setUTCHours(0, 0, 0, 0);
  } else {
    d.setUTCHours(23, 59, 59, 999);
  }
  // Pexip 예시처럼 Z(UTC) 포함 형식으로 전송
  return d.toISOString().replace(".999Z", "Z");
}

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

const DISPLAY_TZ = "Asia/Seoul";

/**
 * ISO 시각을 한국 표준시(KST) 기준 `yyyy-MM-dd HH:mm`으로 표시.
 * Pexip API는 UTC 기준이 많아, 로컬 PC 타임존에 맡기면 오전/새벽으로 잘못 보일 수 있음.
 */
export function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: DISPLAY_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = f.formatToParts(date);
    const map = Object.fromEntries(
      parts.filter((x) => x.type !== "literal").map((x) => [x.type, x.value])
    ) as Record<string, string>;
    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
  } catch {
    return iso;
  }
}

export function participantJoinIso(p: PexipParticipant): string | undefined {
  const v = p.connect_time || p.start_time;
  return v?.trim() ? v : undefined;
}

export function participantLeaveIso(p: PexipParticipant): string | undefined {
  const v = p.disconnect_time || p.end_time;
  return v?.trim() ? v : undefined;
}

const PEXIP_PAGE_LIMIT = 1000;
/** 추가 페이지를 한꺼번에 요청할 때 동시 요청 수 (서버 부하와 속도 균형) */
const PEXIP_PAGE_CONCURRENCY = 5;

async function fetchPexipPage<T>(
  pexipUrl: string,
  username: string,
  password: string,
  endpoint: string,
  params: Record<string, string>,
  offset: number,
  limit: number
): Promise<{
  meta: { next: string | null; total_count: number };
  objects: T[];
}> {
  const queryParams = new URLSearchParams({
    format: "json",
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

  return res.json() as Promise<{
    meta: { next: string | null; total_count: number };
    objects: T[];
  }>;
}

// Pexip API를 통해 모든 페이지 데이터를 가져오는 공통 함수 (1페이지 이후 병렬 페이징)
async function fetchAllPexip<T>(
  pexipUrl: string,
  username: string,
  password: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const limit = PEXIP_PAGE_LIMIT;
  const first = await fetchPexipPage<T>(pexipUrl, username, password, endpoint, params, 0, limit);
  const allItems: T[] = [...first.objects];
  const total = first.meta.total_count;

  if (!first.meta.next || allItems.length >= total) {
    return allItems;
  }

  const offsets: number[] = [];
  for (let o = limit; o < total; o += limit) {
    offsets.push(o);
  }

  for (let i = 0; i < offsets.length; i += PEXIP_PAGE_CONCURRENCY) {
    const slice = offsets.slice(i, i + PEXIP_PAGE_CONCURRENCY);
    const pages = await Promise.all(
      slice.map((off) => fetchPexipPage<T>(pexipUrl, username, password, endpoint, params, off, limit))
    );
    for (const data of pages) {
      allItems.push(...data.objects);
    }
  }

  return allItems;
}

// 회의 목록만 조회하여 회사별 통계로 집계 (참여자 상세 API는 데이터량이 커 지연의 주원인이라 생략, participant_count 사용)
async function buildStats(
  pexipUrl: string,
  username: string,
  password: string,
  conferenceEndpoint: string,
  conferenceParams: Record<string, string>
): Promise<CompanyStat[]> {
  const conferences = await fetchAllPexip<PexipConference>(
    pexipUrl,
    username,
    password,
    conferenceEndpoint,
    conferenceParams
  );

  if (conferences.length === 0) return [];

  const enriched: EnrichedConference[] = conferences.map((conf) => ({
    ...conf,
    participants: [],
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

/** `.../conference/` 목록 엔드포인트 → 동일 버전의 `.../participant/` 목록 엔드포인트 */
export function participantListEndpointFromConferenceEndpoint(conferenceListEndpoint: string): string {
  const trimmed = conferenceListEndpoint.replace(/\/?$/, "/");
  if (trimmed.endsWith("/conference/")) {
    return `${trimmed.slice(0, -"/conference/".length)}/participant/`;
  }
  return trimmed.replace(/\/conference\/$/, "/participant/");
}

/**
 * 특정 회의의 참가자 목록만 조회 (Pexip 문서: GET .../participant/?conference=<회의 id>)
 */
export async function fetchParticipantsForConference(
  config: PexipConfig,
  conferenceListEndpointUsed: string,
  conferenceId: string
): Promise<PexipParticipant[]> {
  const endpoint = participantListEndpointFromConferenceEndpoint(conferenceListEndpointUsed);
  return fetchAllPexip<PexipParticipant>(config.url, config.username, config.password, endpoint, {
    conference: conferenceId,
  });
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
  // history API는 UTC ISO(Z) 형식이 가장 호환성이 좋음
  const startStr = toUtcIsoRange(startDate, "start");
  const endStr = toUtcIsoRange(endDate, "end");

  // API 기본 경로 결정 (커스텀 우선, 기본은 /api/admin)
  const apiBase = (customApiBase ?? "/api/admin").replace(/\/$/, "");

  // 1차 시도: history v1 엔드포인트 (최신 경로)
  try {
    const stats = await buildStats(pexipUrl, username, password, `${apiBase}/history/v1/conference/`, {
      start_time__gte: startStr,
      start_time__lte: endStr,
    });
    return { stats, dataSource: "history", endpointUsed: `${apiBase}/history/v1/conference/` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is404 = msg.includes("404") || msg.includes("찾을 수 없습니다");
    if (!is404) throw err;
  }

  // 2차 시도: history (구버전 경로)
  try {
    const stats = await buildStats(pexipUrl, username, password, `${apiBase}/history/conference/`, {
      start_time__gte: startStr,
      start_time__lte: endStr,
    });
    return { stats, dataSource: "history", endpointUsed: `${apiBase}/history/conference/` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is404 = msg.includes("404") || msg.includes("찾을 수 없습니다");
    if (!is404) throw err;
  }

  // 3차 시도: status 엔드포인트 (현재 활성 회의)
  try {
    const stats = await buildStats(pexipUrl, username, password, `${apiBase}/status/conference/`, {});
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
