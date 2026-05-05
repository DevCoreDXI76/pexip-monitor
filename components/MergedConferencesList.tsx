"use client";

/**
 * 카스케이딩 병합된 회의 목록을 카드 그리드로 보여주는 컴포넌트.
 *
 * - 입력: `MergedConference[]` (이미 `mergeCascadedConferences`로 처리된 결과)
 * - 회의명 검색 / 병합된(노드 ≥2) 회의만 보기 토글 제공
 * - 시각은 `lib/pexip.ts`의 `formatDateTime`(KST 기준 표시) 사용
 * - 스타일: Tailwind CSS, 깔끔한 카드 형태
 */

import { useMemo, useState } from "react";
import {
  Video,
  Users,
  Clock,
  Layers,
  Search,
  Filter,
  CalendarRange,
} from "lucide-react";
import { formatDateTime, formatDuration } from "@/lib/pexip";
import type { MergedConference } from "@/lib/merge";

interface Props {
  items: MergedConference[];
}

export default function MergedConferencesList({ items }: Props) {
  const [search, setSearch] = useState("");
  const [onlyCascaded, setOnlyCascaded] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => {
      if (onlyCascaded && m.cascadeCount < 2) return false;
      if (!q) return true;
      return m.service_name.toLowerCase().includes(q);
    });
  }, [items, search, onlyCascaded]);

  const totalCascaded = items.filter((m) => m.cascadeCount > 1).length;

  return (
    <div className="space-y-4">
      {/* 상단 컨트롤 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="회의명 검색…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyCascaded((v) => !v)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
            onlyCascaded
              ? "bg-purple-50 text-purple-700 border-purple-300"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
          title="2개 이상의 노드 레코드가 병합된 회의만 표시"
        >
          <Filter size={12} />
          분산(cascade) 회의만
        </button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <SummaryPill
          label="병합된 회의 총합"
          value={items.length.toLocaleString()}
          tone="blue"
        />
        <SummaryPill
          label="노드 분산(cascade) 발생"
          value={`${totalCascaded.toLocaleString()}건`}
          tone="purple"
        />
        <SummaryPill
          label="현재 표시"
          value={`${filtered.length.toLocaleString()}건`}
          tone="gray"
        />
      </div>

      {/* 카드 그리드 */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {items.length === 0 ? "병합된 회의가 없습니다." : "검색 결과가 없습니다."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((m, i) => (
            <MergedCard key={`${m.service_name}-${m.start_time}-${i}`} item={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "purple" | "gray";
}) {
  const cls =
    tone === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-100"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700 border-purple-100"
      : "bg-gray-50 text-gray-600 border-gray-100";
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${cls}`}>
      <span className="text-[11px] uppercase tracking-wide opacity-80">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function MergedCard({ item }: { item: MergedConference }) {
  const isCascade = item.cascadeCount > 1;
  return (
    <article className="group bg-white border border-gray-200 hover:border-purple-300 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
      <header className="flex items-start gap-2 mb-2">
        <Video size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <h3 className="text-sm font-semibold text-gray-800 leading-snug truncate flex-1">
          {item.service_name || "(이름 없음)"}
        </h3>
        {isCascade && (
          <span
            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700"
            title={`${item.cascadeCount}개의 Conferencing Node 레코드가 하나의 회의로 병합되었습니다`}
          >
            <Layers size={10} />
            {item.cascadeCount}개 노드 병합
          </span>
        )}
      </header>

      <div className="flex items-start gap-1.5 text-xs text-gray-500">
        <CalendarRange size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 leading-relaxed">
          <p>
            <span className="text-gray-400">시작 </span>
            <span className="text-gray-700 tabular-nums">{formatDateTime(item.start_time)}</span>
          </p>
          <p>
            <span className="text-gray-400">종료 </span>
            <span className="text-gray-700 tabular-nums">
              {item.end_time ? formatDateTime(item.end_time) : "진행 중"}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Clock size={12} className="text-purple-400" />
          <span className="tabular-nums">{formatDuration(item.duration ?? 0)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} className="text-green-400" />
          <span className="tabular-nums">{item.participant_count}명</span>
          <span className="text-gray-300">(MAX)</span>
        </span>
        {item.service_type && (
          <span className="ml-auto text-[11px] text-gray-400">{item.service_type}</span>
        )}
      </div>

      {isCascade && (
        <details className="mt-3 group/details">
          <summary className="text-[11px] text-gray-400 hover:text-purple-600 cursor-pointer select-none">
            병합된 원본 레코드 {item.cascadeCount}건 보기
          </summary>
          <ul className="mt-2 space-y-1">
            {item.sources.map((s) => (
              <li
                key={s.id}
                className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2 py-1 flex items-center justify-between gap-2"
              >
                <span className="truncate" title={s.name}>
                  {s.name}
                </span>
                <span className="tabular-nums text-gray-400 flex-shrink-0">
                  {formatDateTime(s.start_time)} · {s.participant_count}명
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
