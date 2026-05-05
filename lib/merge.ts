/**
 * Pexip 카스케이딩(분산 회의) 병합 모듈.
 *
 * 배경
 *  Pexip은 참여자가 많은 회의를 여러 Conferencing Node에 분산(Cascading)한다.
 *  그 결과 history API에서 같은 회의가 서로 다른 hex ID를 가진 여러 레코드로 쪼개져 들어와
 *  단순 카운트하면 회의 수와 참여자 수가 부풀려진다.
 *
 *  예) "Microsoft Teams CVI Call for Posco DX:6766e801…"  (08:17 ~ 09:58, 21명)
 *      "Microsoft Teams CVI Call for Posco DX:4cb8dae7…"  (08:15 ~ 09:58, 21명)
 *      → 실제로는 1건 / 21명 (양쪽 모두 동일 21명을 본 동일 회의)
 *
 * 본 모듈은 원본 PexipConference 배열을 받아, 다음 규칙으로 동일 회의끼리 묶어
 * MergedConference[]로 반환한다.
 *
 *  1) 동일 회의 판단 기준 (강한 키 → 약한 키 순서로 우선 적용)
 *     a) `tag` 우선: 동일한 비어 있지 않은 `tag`를 공유하는 레코드는 1차 그룹으로 묶는다.
 *        (Pexip 관리자가 회의 템플릿/태그를 재사용하면 cascade 노드 전반에서 같은 tag가 부여된다)
 *     b) `tag`가 없으면 회의명에서 콜론(`:`) 앞부분(`baseName`)이 동일한지로 그룹화.
 *     c) 1차 그룹 내에서 [start_time, end_time] 인터벌이 서로 겹치는(overlap) 항목들을 한 cluster로 모은다.
 *        (같은 tag/baseName이라도 서로 다른 시점의 별개 회의는 분리된다)
 *
 *  2) 병합 시 데이터 처리 기준
 *     - start_time         : MIN
 *     - end_time           : MAX
 *     - participant_count  : MAX (중복 합산 방지)
 *     - service_name       : 콜론 앞 baseName만 남김(hex ID 제거)
 */

import { parsePexipUtcDate } from "./pexip";
import type { PexipConference } from "./types";

// ─────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────

/** Pexip API 원본 회의 레코드 (lib/types.ts의 PexipConference 별칭) */
export type RawPexipConference = PexipConference;

/** 카스케이딩 병합으로 통합된 회의 1건 */
export interface MergedConference {
  /** 콜론 앞부분만 남긴 정제된 회의명 — 예: "Microsoft Teams CVI Call for Posco DX" */
  service_name: string;
  /** 그룹 내 가장 빠른 시작 시각 (Pexip 원본 ISO, UTC) */
  start_time: string;
  /** 그룹 내 가장 늦은 종료 시각 (Pexip 원본 ISO, UTC). 진행 중 등으로 없을 수 있음 */
  end_time?: string;
  /** end_time - start_time 기준 환산(초). 원본 duration MAX로 폴백 */
  duration?: number;
  /** 그룹 내 MAX participant_count (중복 합산 방지) */
  participant_count: number;
  /** 원본 service_type 중 첫 번째 값 (그룹 내에서 동일) */
  service_type: string;
  /** 병합 전 원본 회의 레코드들 — 디버깅·상세 보기용 */
  sources: RawPexipConference[];
  /** 병합된 노드 수(`sources.length`)의 단축 표기 */
  cascadeCount: number;
}

// ─────────────────────────────────────────────────────────────
// 회의명 분해
// ─────────────────────────────────────────────────────────────

export interface SplitConferenceName {
  /** 콜론 앞 — 그룹 키이자 정제된 회의명 */
  baseName: string;
  /** 콜론 뒤 — Pexip 내부 hex ID 등 */
  suffix: string;
}

/** "…:hex" 형태의 회의명을 baseName과 suffix로 분리 */
export function splitConferenceName(name: string): SplitConferenceName {
  const raw = (name ?? "").trim();
  const idx = raw.indexOf(":");
  if (idx < 0) return { baseName: raw, suffix: "" };
  return { baseName: raw.slice(0, idx).trim(), suffix: raw.slice(idx + 1).trim() };
}

// ─────────────────────────────────────────────────────────────
// 시간 인터벌 유틸
// ─────────────────────────────────────────────────────────────

/** Pexip ISO → UTC ms (실패 시 null) */
function utcMs(iso?: string): number | null {
  if (!iso) return null;
  const v = parsePexipUtcDate(iso).getTime();
  return Number.isNaN(v) ? null : v;
}

/**
 * 두 인터벌 [aStart, aEnd) / [bStart, bEnd)이 겹치는지 판정.
 * 표준 정의: max(aStart, bStart) < min(aEnd, bEnd)
 *  → `aStart < bEnd && bStart < aEnd` 와 동치 (코드 가독성을 위해 후자 사용)
 */
function intervalsOverlap(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number
): boolean {
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/** 회의의 [startMs, endMs] 산출 — end가 없으면 duration으로 보정, 그것도 없으면 null */
function conferenceInterval(c: RawPexipConference): { startMs: number; endMs: number } | null {
  const sMs = utcMs(c.start_time);
  if (sMs === null) return null;
  const eFromIso = utcMs(c.end_time);
  if (eFromIso !== null) return { startMs: sMs, endMs: eFromIso };
  if (typeof c.duration === "number" && c.duration > 0) {
    return { startMs: sMs, endMs: sMs + c.duration * 1000 };
  }
  return null; // end 정보 자체가 없는 진행 중 회의 — 호출 측에서 단독 그룹 처리
}

// ─────────────────────────────────────────────────────────────
// 병합 핵심 로직
// ─────────────────────────────────────────────────────────────

/**
 * 1차 그룹 키를 결정.
 * - 비어 있지 않은 `tag`가 있으면 `tag:<value>` 형태를 사용 (가장 강한 식별자)
 * - 그렇지 않으면 `name:<baseName>`을 사용
 *
 * 같은 키여도 시간대가 겹치지 않으면 2차 단계(인터벌 cluster)에서 분리된다.
 */
function primaryGroupKey(c: RawPexipConference): { key: string; baseName: string } {
  const { baseName } = splitConferenceName(c.name || "");
  const tag = (c.tag ?? "").trim();
  if (tag) return { key: `tag:${tag}`, baseName: baseName || tag };
  return { key: `name:${baseName || "Unknown"}`, baseName: baseName || "Unknown" };
}

/**
 * 분산된 회의 레코드 배열을 동일 회의끼리 병합.
 *
 * 알고리즘
 *  1) 1차 그룹화 — `tag`가 있으면 tag, 없으면 baseName(콜론 앞) 기준
 *  2) 그룹 내에서 start_time 오름차순 정렬
 *  3) 누적 cluster의 [clusterStart, clusterMaxEnd]와 다음 항목의 [s, e]가
 *     겹치면(`intervalsOverlap`) cluster에 추가, 아니면 새 cluster 시작
 *     (전체 cluster 범위와 비교하므로 "체인 형태로 이어지는 cascade"도 한 그룹으로 묶임)
 *     같은 tag/baseName이라도 인터벌이 떨어져 있으면 별개 회의로 분리됨.
 *  4) cluster마다 MIN(start)/MAX(end)/MAX(participant_count)로 MergedConference 생성
 *  5) 시작 시각 내림차순(최근 회의 먼저)으로 정렬해 반환
 */
export function mergeCascadedConferences(
  conferences: RawPexipConference[]
): MergedConference[] {
  if (!conferences || conferences.length === 0) return [];

  // 1) 1차 그룹화 (tag 우선, 없으면 baseName)
  const byKey = new Map<string, { baseName: string; items: RawPexipConference[] }>();
  for (const c of conferences) {
    const { key, baseName } = primaryGroupKey(c);
    const entry = byKey.get(key);
    if (entry) entry.items.push(c);
    else byKey.set(key, { baseName, items: [c] });
  }

  const merged: MergedConference[] = [];

  for (const { baseName, items: group } of byKey.values()) {
    // 2) 시작 시각 오름차순
    const sorted = [...group].sort((a, b) => {
      const sa = utcMs(a.start_time) ?? 0;
      const sb = utcMs(b.start_time) ?? 0;
      return sa - sb;
    });

    // 3) 인터벌 cluster
    let cluster: RawPexipConference[] = [];
    let clusterStart = Number.POSITIVE_INFINITY;
    let clusterMaxEnd = Number.NEGATIVE_INFINITY;

    const flushCluster = () => {
      if (cluster.length > 0) {
        merged.push(buildMergedConference(baseName, cluster));
        cluster = [];
        clusterStart = Number.POSITIVE_INFINITY;
        clusterMaxEnd = Number.NEGATIVE_INFINITY;
      }
    };

    for (const c of sorted) {
      const itv = conferenceInterval(c);
      if (!itv) {
        // 시간 정보가 부족한 항목은 단독 1건으로 처리
        flushCluster();
        merged.push(buildMergedConference(baseName, [c]));
        continue;
      }
      const { startMs, endMs } = itv;

      if (cluster.length === 0) {
        cluster = [c];
        clusterStart = startMs;
        clusterMaxEnd = endMs;
        continue;
      }

      if (intervalsOverlap(clusterStart, clusterMaxEnd, startMs, endMs)) {
        cluster.push(c);
        if (startMs < clusterStart) clusterStart = startMs;
        if (endMs > clusterMaxEnd) clusterMaxEnd = endMs;
      } else {
        flushCluster();
        cluster = [c];
        clusterStart = startMs;
        clusterMaxEnd = endMs;
      }
    }
    flushCluster();
  }

  // 5) 최신 회의 먼저
  return merged.sort(
    (a, b) => (utcMs(b.start_time) ?? 0) - (utcMs(a.start_time) ?? 0)
  );
}

/** cluster 내 회의들로부터 1건의 MergedConference 생성 */
function buildMergedConference(
  baseName: string,
  group: RawPexipConference[]
): MergedConference {
  let minStartMs: number | null = null;
  let minStartIso = "";
  let maxEndMs: number | null = null;
  let maxEndIso: string | undefined = undefined;
  let maxParticipants = 0;
  let maxDurationSec = 0;

  for (const c of group) {
    const sMs = utcMs(c.start_time);
    if (sMs !== null && (minStartMs === null || sMs < minStartMs)) {
      minStartMs = sMs;
      minStartIso = c.start_time;
    }
    const eMs = utcMs(c.end_time);
    if (eMs !== null && (maxEndMs === null || eMs > maxEndMs)) {
      maxEndMs = eMs;
      maxEndIso = c.end_time;
    }
    if (typeof c.participant_count === "number" && c.participant_count > maxParticipants) {
      maxParticipants = c.participant_count;
    }
    if (typeof c.duration === "number" && c.duration > maxDurationSec) {
      maxDurationSec = c.duration;
    }
  }

  // duration: end-start 우선, 없으면 그룹 내 MAX(duration)
  let duration: number | undefined;
  if (minStartMs !== null && maxEndMs !== null && maxEndMs > minStartMs) {
    duration = Math.round((maxEndMs - minStartMs) / 1000);
  } else if (maxDurationSec > 0) {
    duration = maxDurationSec;
  }

  return {
    service_name: baseName,
    start_time: minStartIso || group[0].start_time,
    end_time: maxEndIso,
    duration,
    participant_count: maxParticipants,
    service_type: group[0].service_type ?? "",
    sources: group,
    cascadeCount: group.length,
  };
}
