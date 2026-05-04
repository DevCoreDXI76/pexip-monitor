/**
 * Pexip 데이터 분석 로직 모듈.
 *
 * 본 파일에는 다음 두 가지 핵심 분석이 들어 있다.
 *  1) 라이선스 최적화용 동시 접속(Peak) 계산
 *     - 시간 단위(예: 10분, 1시간)로 "최대 동시 접속자 수"와 "동시 진행 회의 수"를 산출
 *     - 알고리즘: 스윕 라인(sweep line) — 모든 (참여 시작, +1) / (참여 종료, -1) 이벤트를 시간순으로 훑으며,
 *       각 시점의 동시 카운트가 어떤 버킷에 속하는지 따라가면서 버킷별 최대치를 갱신한다.
 *
 *  2) 회의실 가동률 계산
 *     - 참가자 중 SIP / H.323 프로토콜만을 "물리 회의실 화상장비"로 간주
 *     - `display_name` 또는 `system_location`을 장비 키로 사용, 일별/월별 사용 시간(duration 합)을 집계
 *
 * 모든 시각은 **KST 벽시계** 기준으로 버킷팅한다.
 * Pexip API의 시각은 UTC가 기본이므로, 본 모듈은 `parsePexipUtcDate`로 항상 UTC로 강제 파싱한 뒤
 * `+9h`를 더한 "KST instant"를 사용해 버킷 인덱스를 계산한다.
 */

import {
  parsePexipUtcDate,
  participantJoinIso,
  participantLeaveIso,
} from "./pexip";
import type { PexipParticipant, PexipConference } from "./types";

/** UTC → KST(+9h, 일광절 없음) */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "yyyy-MM-dd HH:mm" 표시용 zero-pad */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC 인스턴트(ms)를 KST 벽시계로 본 ms (수치 비교/버킷팅 전용) */
function toKstWallMs(utcMs: number): number {
  return utcMs + KST_OFFSET_MS;
}

/** KST 벽시계 ms를 `yyyy-MM-dd HH:mm`으로 포맷 */
export function formatKstWallMs(kstMs: number): string {
  const d = new Date(kstMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate()
  )} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** KST 벽시계 ms를 `yyyy-MM-dd`로 포맷 (일별 키) */
export function formatKstDate(kstMs: number): string {
  const d = new Date(kstMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** KST 벽시계 ms를 `yyyy-MM`으로 포맷 (월별 키) */
export function formatKstMonth(kstMs: number): string {
  const d = new Date(kstMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

// ─────────────────────────────────────────────────────────────
// 1) 노이즈 데이터 필터링 (IVR 제외)
// ─────────────────────────────────────────────────────────────

/** "ivr"이 service_type/service_name/회의명 중 어디에라도 들어가면 제외 */
export function isIvrParticipant(p: PexipParticipant, ivrConferenceUris?: Set<string>): boolean {
  const st = (p.service_type || "").toLowerCase();
  const sn = (p.service_name || "").toLowerCase();
  if (st.includes("ivr") || sn.includes("ivr")) return true;
  if (ivrConferenceUris && p.conference && ivrConferenceUris.has(p.conference)) return true;
  return false;
}

/** 회의 목록을 IVR/CVI로 분류해 conference resource_uri 집합 반환 */
export function partitionConferencesByKind(conferences: PexipConference[]): {
  cviUris: Set<string>;
  ivrUris: Set<string>;
} {
  const cviUris = new Set<string>();
  const ivrUris = new Set<string>();
  const cviRe = /Microsoft\s+Teams\s+CVI\s+Call\s+for/i;
  const ivrRe = /MS\s+Teams\s+IVR\s+Service\s+for/i;

  for (const c of conferences) {
    const name = (c.name || "").trim();
    if (ivrRe.test(name)) ivrUris.add(c.resource_uri);
    else if (cviRe.test(name)) cviUris.add(c.resource_uri);
  }
  return { cviUris, ivrUris };
}

// ─────────────────────────────────────────────────────────────
// 2) 동시 접속(Peak) 계산
// ─────────────────────────────────────────────────────────────

export interface ConcurrencyBucket {
  /** 버킷 시작 (KST 벽시계 ms) */
  bucketStartKstMs: number;
  /** 버킷 끝 (KST 벽시계 ms, 미포함) */
  bucketEndKstMs: number;
  /** "yyyy-MM-dd HH:mm" 표시용 라벨 (KST) */
  label: string;
  /** 해당 버킷 동안 관측된 최대 동시 참여자 수 */
  maxConcurrentParticipants: number;
  /** 해당 버킷 동안 관측된 최대 동시 회의 수 (참여자가 1명 이상 있는 conference 수) */
  maxConcurrentMeetings: number;
}

export interface ConcurrencyResult {
  /** 시간 버킷별 결과 */
  buckets: ConcurrencyBucket[];
  /** 기간 전체에서 관측된 글로벌 피크 */
  peakParticipants: { value: number; bucket: ConcurrencyBucket | null };
  peakMeetings: { value: number; bucket: ConcurrencyBucket | null };
  /** 분석에 실제로 사용된 참가자(IVR/시각 누락 제외) 수 */
  usedParticipants: number;
}

interface NormalizedInterval {
  /** KST 벽시계 ms */
  startKstMs: number;
  /** KST 벽시계 ms (참여 진행 중이면 분석 종료 시각으로 캡) */
  endKstMs: number;
  conferenceUri: string;
}

/**
 * 참가자 데이터를 KST 벽시계 기준 [start, end] 인터벌로 정규화.
 * - connect/disconnect 또는 start/end 필드 모두 지원
 * - 종료 시각이 없으면(진행 중) 분석 범위 끝(`rangeEndKstMs`)으로 클램프
 * - 시작 시각이 없거나 [start >= end]인 항목은 제외
 */
function normalizeIntervals(
  participants: PexipParticipant[],
  rangeStartKstMs: number,
  rangeEndKstMs: number
): NormalizedInterval[] {
  const out: NormalizedInterval[] = [];
  for (const p of participants) {
    const sIso = participantJoinIso(p);
    if (!sIso) continue;
    const sUtc = parsePexipUtcDate(sIso).getTime();
    if (Number.isNaN(sUtc)) continue;

    const eIso = participantLeaveIso(p);
    let eUtc: number;
    if (eIso) {
      const v = parsePexipUtcDate(eIso).getTime();
      eUtc = Number.isNaN(v) ? sUtc + (p.duration ?? 0) * 1000 : v;
    } else if (typeof p.duration === "number" && p.duration > 0) {
      eUtc = sUtc + p.duration * 1000;
    } else {
      // 진행 중 — 분석 종료 시각까지로 캡
      eUtc = rangeEndKstMs - KST_OFFSET_MS;
    }

    const startKstMs = Math.max(toKstWallMs(sUtc), rangeStartKstMs);
    const endKstMs = Math.min(toKstWallMs(eUtc), rangeEndKstMs);
    if (endKstMs <= startKstMs) continue;

    out.push({ startKstMs, endKstMs, conferenceUri: p.conference || "" });
  }
  return out;
}

/**
 * 시간 버킷별 동시 접속 통계 산출 (스윕 라인).
 *
 * 입력 파라미터
 *  - participants: IVR 등 사전 필터링이 끝난 참가자 목록
 *  - rangeStart/End(KST 기준 Date): 분석 기간 (포함/미포함)
 *  - bucketMinutes: 버킷 간격 (예: 10, 60)
 *
 * 알고리즘 개요
 *  1) 모든 참가자 인터벌을 KST 벽시계 ms로 정규화
 *  2) (시작, +1) / (종료, -1) 이벤트로 풀어 시간순 정렬
 *  3) 이벤트 사이의 각 "구간"에서는 동시 카운트가 일정 — 그 구간이 걸치는 모든 버킷에
 *     "현재 동시 참여자 수 / 동시 회의 수"의 최대치를 갱신
 *  4) 마지막에 글로벌 피크 추출
 */
export function computeConcurrency(
  participants: PexipParticipant[],
  rangeStartKstMs: number,
  rangeEndKstMs: number,
  bucketMinutes: number
): ConcurrencyResult {
  const bucketMs = bucketMinutes * 60 * 1000;
  const numBuckets = Math.max(1, Math.ceil((rangeEndKstMs - rangeStartKstMs) / bucketMs));

  const buckets: ConcurrencyBucket[] = Array.from({ length: numBuckets }, (_, i) => {
    const start = rangeStartKstMs + i * bucketMs;
    const end = Math.min(rangeStartKstMs + (i + 1) * bucketMs, rangeEndKstMs);
    return {
      bucketStartKstMs: start,
      bucketEndKstMs: end,
      label: formatKstWallMs(start),
      maxConcurrentParticipants: 0,
      maxConcurrentMeetings: 0,
    };
  });

  const intervals = normalizeIntervals(participants, rangeStartKstMs, rangeEndKstMs);

  type Event = { time: number; delta: number; conferenceUri: string };
  const events: Event[] = [];
  for (const it of intervals) {
    events.push({ time: it.startKstMs, delta: 1, conferenceUri: it.conferenceUri });
    events.push({ time: it.endKstMs, delta: -1, conferenceUri: it.conferenceUri });
  }
  // 같은 시각에 종료(-1)를 시작(+1)보다 먼저 처리해야 "끝나자마자 다음 회의가 시작"하는 경우의
  // 중복 카운팅을 막는다.
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);

  // 현재 활성 카운트
  let participantCount = 0;
  /** conference resource_uri → 현재 참여 중 인원수 */
  const activeConfCount = new Map<string, number>();

  /** 구간 [segStart, segEnd) 동안의 현재 카운트로 걸치는 버킷의 max 갱신 */
  function applySegment(segStart: number, segEnd: number) {
    if (segEnd <= segStart) return;
    if (participantCount === 0 && activeConfCount.size === 0) return;

    const firstIdx = Math.max(0, Math.floor((segStart - rangeStartKstMs) / bucketMs));
    const lastIdx = Math.min(
      numBuckets - 1,
      Math.floor((Math.max(segStart, segEnd - 1) - rangeStartKstMs) / bucketMs)
    );
    for (let b = firstIdx; b <= lastIdx; b++) {
      if (participantCount > buckets[b].maxConcurrentParticipants) {
        buckets[b].maxConcurrentParticipants = participantCount;
      }
      if (activeConfCount.size > buckets[b].maxConcurrentMeetings) {
        buckets[b].maxConcurrentMeetings = activeConfCount.size;
      }
    }
  }

  let lastTime = rangeStartKstMs;
  for (const e of events) {
    applySegment(lastTime, e.time);

    // 이벤트 적용
    participantCount += e.delta;
    if (e.conferenceUri) {
      const next = (activeConfCount.get(e.conferenceUri) || 0) + e.delta;
      if (next <= 0) activeConfCount.delete(e.conferenceUri);
      else activeConfCount.set(e.conferenceUri, next);
    }
    lastTime = e.time;
  }
  applySegment(lastTime, rangeEndKstMs);

  // 글로벌 피크
  let peakP = 0;
  let peakPBucket: ConcurrencyBucket | null = null;
  let peakM = 0;
  let peakMBucket: ConcurrencyBucket | null = null;
  for (const b of buckets) {
    if (b.maxConcurrentParticipants > peakP) {
      peakP = b.maxConcurrentParticipants;
      peakPBucket = b;
    }
    if (b.maxConcurrentMeetings > peakM) {
      peakM = b.maxConcurrentMeetings;
      peakMBucket = b;
    }
  }

  return {
    buckets,
    peakParticipants: { value: peakP, bucket: peakPBucket },
    peakMeetings: { value: peakM, bucket: peakMBucket },
    usedParticipants: intervals.length,
  };
}

/**
 * 사용자가 선택한 Date(브라우저 로컬 자정 등)를 분석에 쓸 KST 벽시계 ms로 환산.
 * - "그 날(KST) 00:00:00" / "그 날(KST) 23:59:59.999"에 해당하는 KST 벽시계 ms를 반환.
 * - KST 벽시계 ms는 `Date.UTC(y,m,d)`로 표현 (이 모듈 전체가 `getUTC*`로 이를 해석).
 */
export function toKstRangeMs(date: Date, kind: "start" | "end"): number {
  // DateRangePicker가 보내는 Date는 사용자의 로컬 시간 자정. 사용자는 한국에 있다고 가정해
  // 로컬 연/월/일을 그대로 KST 일자로 사용한다.
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const startMs = Date.UTC(y, m, d);
  return kind === "start" ? startMs : startMs + 24 * 60 * 60 * 1000 - 1;
}

// ─────────────────────────────────────────────────────────────
// 3) 회의실 가동률 (SIP / H.323 장비 한정)
// ─────────────────────────────────────────────────────────────

export type RoomGranularity = "daily" | "monthly";

export interface RoomBucket {
  /** "yyyy-MM-dd" 또는 "yyyy-MM" */
  key: string;
  durationSec: number;
  sessionCount: number;
}

export interface RoomUtilization {
  /** display_name 우선, 없으면 system_location, 둘 다 없으면 "Unknown" */
  device: string;
  systemLocation?: string;
  protocols: string[];
  totalDurationSec: number;
  sessionCount: number;
  /** 키별 합계(가독성을 위해 정렬된 배열로 노출) */
  buckets: RoomBucket[];
}

/** 프로토콜이 SIP / H.323인지 판정 (대문자 무시, 마침표 유무 허용) */
export function isPhysicalRoomProtocol(protocol?: string): boolean {
  if (!protocol) return false;
  const p = protocol.toLowerCase();
  return p === "sip" || p === "h.323" || p === "h323";
}

function deviceKey(p: PexipParticipant): { key: string; systemLocation?: string } {
  const dn = (p.display_name || "").trim();
  const sl = (p.system_location || "").trim();
  if (dn) return { key: dn, systemLocation: sl || undefined };
  if (sl) return { key: sl, systemLocation: sl };
  return { key: "Unknown" };
}

/** participant.duration이 비어 있으면 connect/disconnect 차로 보정 */
function participantDurationSec(p: PexipParticipant): number {
  if (typeof p.duration === "number" && p.duration > 0) return p.duration;
  const sIso = participantJoinIso(p);
  const eIso = participantLeaveIso(p);
  if (!sIso || !eIso) return 0;
  const s = parsePexipUtcDate(sIso).getTime();
  const e = parsePexipUtcDate(eIso).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 0;
  return Math.round((e - s) / 1000);
}

/**
 * 회의실(SIP/H.323) 사용 시간 집계.
 *
 *  - 장비 단위로 합계(sessionCount, totalDurationSec) 산출
 *  - 일별/월별 키(KST 기준)로 사용 시간을 분배
 *  - 결과는 totalDurationSec 내림차순 정렬
 *
 * 주의: 한 세션이 자정을 넘어가는 경우, 본 함수는 단순 connect_time 기준의 한 키에 합산한다.
 * (필요하면 세션을 "일자별로 쪼개서" 분배하도록 확장 가능)
 */
export function computeRoomUtilization(
  participants: PexipParticipant[],
  granularity: RoomGranularity
): RoomUtilization[] {
  const map = new Map<
    string,
    {
      device: string;
      systemLocation?: string;
      protocols: Set<string>;
      totalDurationSec: number;
      sessionCount: number;
      perKey: Map<string, RoomBucket>;
    }
  >();

  for (const p of participants) {
    if (!isPhysicalRoomProtocol(p.protocol)) continue;
    const { key, systemLocation } = deviceKey(p);
    const dur = participantDurationSec(p);
    if (dur <= 0) continue;

    const sIso = participantJoinIso(p);
    if (!sIso) continue;
    const sUtcMs = parsePexipUtcDate(sIso).getTime();
    if (Number.isNaN(sUtcMs)) continue;
    const kstMs = toKstWallMs(sUtcMs);
    const bucketKey = granularity === "daily" ? formatKstDate(kstMs) : formatKstMonth(kstMs);

    let entry = map.get(key);
    if (!entry) {
      entry = {
        device: key,
        systemLocation,
        protocols: new Set<string>(),
        totalDurationSec: 0,
        sessionCount: 0,
        perKey: new Map(),
      };
      map.set(key, entry);
    }
    entry.protocols.add(p.protocol);
    entry.totalDurationSec += dur;
    entry.sessionCount += 1;

    const b = entry.perKey.get(bucketKey) ?? { key: bucketKey, durationSec: 0, sessionCount: 0 };
    b.durationSec += dur;
    b.sessionCount += 1;
    entry.perKey.set(bucketKey, b);
  }

  return Array.from(map.values())
    .map((e) => ({
      device: e.device,
      systemLocation: e.systemLocation,
      protocols: Array.from(e.protocols),
      totalDurationSec: e.totalDurationSec,
      sessionCount: e.sessionCount,
      buckets: Array.from(e.perKey.values()).sort((a, b) => a.key.localeCompare(b.key)),
    }))
    .sort((a, b) => b.totalDurationSec - a.totalDurationSec);
}

/** seconds → "HH:MM" / "HHh MMm" 형식의 사람이 읽기 좋은 문자열 (분 단위 반올림) */
export function formatHoursMinutes(totalSec: number): string {
  if (!totalSec || totalSec < 0) return "0m";
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${pad2(m)}m`;
}
