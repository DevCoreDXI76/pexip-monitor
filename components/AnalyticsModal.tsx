"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Activity,
  Users,
  Video,
  MonitorSmartphone,
  Loader2,
  AlertCircle,
  BarChart3,
  Building2,
  Layers,
} from "lucide-react";
import { fetchAllParticipantsInRange } from "@/lib/pexip";
import {
  computeConcurrency,
  computeRoomUtilization,
  formatHoursMinutes,
  isBackplaneParticipant,
  isIvrParticipant,
  partitionConferencesByKind,
  toKstRangeMs,
  type ConcurrencyResult,
  type RoomUtilization,
  type RoomGranularity,
} from "@/lib/analytics";
import MergedConferencesList from "./MergedConferencesList";
import type { CompanyStat, PexipConfig, PexipParticipant } from "@/lib/types";
import type { MergedConference } from "@/lib/merge";

interface Props {
  pexipConfig: PexipConfig;
  conferenceListEndpointUsed: string;
  /** 동일 기간으로 이미 조회된 회사별 통계 — IVR 매칭에 활용 */
  stats: CompanyStat[];
  startDate: Date;
  endDate: Date;
  onClose: () => void;
}

type Tab = "peak" | "rooms" | "merged";

const BUCKET_OPTIONS: { label: string; minutes: number }[] = [
  { label: "10분", minutes: 10 },
  { label: "30분", minutes: 30 },
  { label: "1시간", minutes: 60 },
];

export default function AnalyticsModal({
  pexipConfig,
  conferenceListEndpointUsed,
  stats,
  startDate,
  endDate,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("peak");
  const [bucketMinutes, setBucketMinutes] = useState<number>(60);
  const [granularity, setGranularity] = useState<RoomGranularity>("daily");

  const [participants, setParticipants] = useState<PexipParticipant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 회의 분류 — stats.conferences는 이미 CVI만 들어있음. IVR URI는 별도 매칭 풀이 필요해 비워둠.
  const allConferences = useMemo(
    () => stats.flatMap((s) => s.conferences),
    [stats]
  );
  const { ivrUris } = useMemo(
    () => partitionConferencesByKind(allConferences),
    [allConferences]
  );

  // 카스케이딩 병합 결과 (회사별 stats에서 모아서 시작 시각 내림차순 정렬)
  const mergedConferences = useMemo<MergedConference[]>(() => {
    const all = stats.flatMap((s) => s.mergedConferences);
    return all.sort((a, b) => {
      const ta = new Date(a.start_time).getTime() || 0;
      const tb = new Date(b.start_time).getTime() || 0;
      return tb - ta;
    });
  }, [stats]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchAllParticipantsInRange(
          pexipConfig,
          conferenceListEndpointUsed,
          startDate,
          endDate
        );
        if (!cancelled) setParticipants(list);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "참가자 데이터를 불러오지 못했습니다.";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [pexipConfig, conferenceListEndpointUsed, startDate, endDate]);

  // IVR + 카스케이딩 백플레인 제외 (시스템 노이즈 정제)
  const filteredParticipants = useMemo<PexipParticipant[]>(() => {
    if (!participants) return [];
    return participants.filter((p) => !isIvrParticipant(p, ivrUris) && !isBackplaneParticipant(p));
  }, [participants, ivrUris]);

  const rangeStartKstMs = useMemo(() => toKstRangeMs(startDate, "start"), [startDate]);
  const rangeEndKstMs = useMemo(() => toKstRangeMs(endDate, "end"), [endDate]);

  const concurrency: ConcurrencyResult | null = useMemo(() => {
    if (!filteredParticipants.length) return null;
    return computeConcurrency(filteredParticipants, rangeStartKstMs, rangeEndKstMs, bucketMinutes);
  }, [filteredParticipants, rangeStartKstMs, rangeEndKstMs, bucketMinutes]);

  const rooms: RoomUtilization[] = useMemo(() => {
    if (!filteredParticipants.length) return [];
    return computeRoomUtilization(filteredParticipants, granularity);
  }, [filteredParticipants, granularity]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* 헤더 */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Activity size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">운영 분석</h2>
              <p className="text-sm text-gray-400">
                동시 접속(Peak) · 회의실(SIP/H.323) 가동률 — KST 기준 · IVR / 카스케이딩 백플레인 제외
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex flex-wrap gap-1 px-6 pt-4">
          <TabButton active={tab === "peak"} onClick={() => setTab("peak")} icon={<BarChart3 size={14} />}>
            동시 접속 분석
          </TabButton>
          <TabButton active={tab === "rooms"} onClick={() => setTab("rooms")} icon={<MonitorSmartphone size={14} />}>
            회의실 가동률
          </TabButton>
          <TabButton active={tab === "merged"} onClick={() => setTab("merged")} icon={<Layers size={14} />}>
            병합 회의 ({mergedConferences.length})
          </TabButton>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 space-y-4">
          {/* 분석(Peak/Rooms) 탭은 참가자 데이터가 필요하므로 로딩/에러를 표시.
              병합 회의 탭은 stats(이미 로드됨)만 사용하므로 별도 로딩 없이 바로 렌더. */}
          {tab !== "merged" && loading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 size={28} className="animate-spin mb-3 text-purple-500" />
              <p className="text-sm">참가자 데이터를 불러오는 중입니다…</p>
              <p className="text-xs text-gray-300 mt-1">기간이 길수록 다소 시간이 걸립니다.</p>
            </div>
          )}

          {tab !== "merged" && error && !loading && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">분석 데이터 조회 실패</p>
                <pre className="text-xs mt-1 whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {error}
                </pre>
              </div>
            </div>
          )}

          {!loading && !error && participants !== null && tab === "peak" && (
            <PeakSection
              concurrency={concurrency}
              bucketMinutes={bucketMinutes}
              setBucketMinutes={setBucketMinutes}
              participantsConsidered={filteredParticipants.length}
              participantsTotal={participants.length}
            />
          )}

          {!loading && !error && participants !== null && tab === "rooms" && (
            <RoomsSection
              rooms={rooms}
              granularity={granularity}
              setGranularity={setGranularity}
              participantsConsidered={filteredParticipants.length}
            />
          )}

          {tab === "merged" && <MergedConferencesList items={mergedConferences} />}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
        active
          ? "bg-purple-600 text-white border-purple-600 shadow-sm"
          : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function PeakSection({
  concurrency,
  bucketMinutes,
  setBucketMinutes,
  participantsConsidered,
  participantsTotal,
}: {
  concurrency: ReturnType<typeof computeConcurrency> | null;
  bucketMinutes: number;
  setBucketMinutes: (n: number) => void;
  participantsConsidered: number;
  participantsTotal: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">시간 단위</span>
        {BUCKET_OPTIONS.map((o) => (
          <button
            key={o.minutes}
            onClick={() => setBucketMinutes(o.minutes)}
            className={`px-2.5 py-1 text-xs rounded-md border ${
              o.minutes === bucketMinutes
                ? "bg-purple-50 text-purple-700 border-purple-300"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {o.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">
          분석 대상 참가자 {participantsConsidered.toLocaleString()}명 (IVR 제외, 전체{" "}
          {participantsTotal.toLocaleString()}명)
        </span>
      </div>

      {/* 글로벌 피크 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PeakCard
          icon={<Users size={18} className="text-blue-600" />}
          title="최대 동시 접속자 수"
          value={concurrency?.peakParticipants.value ?? 0}
          unit="명"
          when={concurrency?.peakParticipants.bucket?.label}
        />
        <PeakCard
          icon={<Video size={18} className="text-green-600" />}
          title="최대 동시 회의 수"
          value={concurrency?.peakMeetings.value ?? 0}
          unit="건"
          when={concurrency?.peakMeetings.bucket?.label}
        />
      </div>

      {/* 버킷 테이블 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">시작 (KST)</th>
              <th className="text-right px-3 py-2 font-medium">동시 접속자</th>
              <th className="text-right px-3 py-2 font-medium">동시 회의</th>
            </tr>
          </thead>
          <tbody>
            {(concurrency?.buckets ?? [])
              .filter((b) => b.maxConcurrentParticipants > 0 || b.maxConcurrentMeetings > 0)
              .map((b) => (
                <tr key={b.bucketStartKstMs} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-700 tabular-nums">{b.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-blue-700 font-medium">
                    {b.maxConcurrentParticipants}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-700 font-medium">
                    {b.maxConcurrentMeetings}
                  </td>
                </tr>
              ))}
            {!concurrency?.buckets.some(
              (b) => b.maxConcurrentParticipants > 0 || b.maxConcurrentMeetings > 0
            ) && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-gray-400 text-sm">
                  해당 기간에 분석 가능한 활동이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PeakCard({
  icon,
  title,
  value,
  unit,
  when,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  unit: string;
  when?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        {icon}
        {title}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-gray-800 tabular-nums">{value}</span>
        <span className="text-sm text-gray-400">{unit}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {when ? `발생 구간: ${when}` : "—"}
      </p>
    </div>
  );
}

function RoomsSection({
  rooms,
  granularity,
  setGranularity,
  participantsConsidered,
}: {
  rooms: RoomUtilization[];
  granularity: RoomGranularity;
  setGranularity: (g: RoomGranularity) => void;
  participantsConsidered: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">집계 단위</span>
        <button
          onClick={() => setGranularity("daily")}
          className={`px-2.5 py-1 text-xs rounded-md border ${
            granularity === "daily"
              ? "bg-purple-50 text-purple-700 border-purple-300"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
        >
          일별
        </button>
        <button
          onClick={() => setGranularity("monthly")}
          className={`px-2.5 py-1 text-xs rounded-md border ${
            granularity === "monthly"
              ? "bg-purple-50 text-purple-700 border-purple-300"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
        >
          월별
        </button>
        <span className="ml-auto text-xs text-gray-400">
          SIP/H.323 참가자 {rooms.reduce((s, r) => s + r.sessionCount, 0).toLocaleString()}건 (전체 IVR 제외 {participantsConsidered.toLocaleString()}명 중)
        </span>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          기간 내 SIP / H.323 프로토콜 사용 이력이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((r) => (
            <div key={r.device} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-gray-400" />
                    <p className="text-sm font-semibold text-gray-800 truncate">{r.device}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.systemLocation && r.systemLocation !== r.device ? `위치: ${r.systemLocation} · ` : ""}
                    프로토콜: {r.protocols.join(", ") || "-"}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-gray-800 tabular-nums">
                    {formatHoursMinutes(r.totalDurationSec)}
                  </p>
                  <p className="text-xs text-gray-400">{r.sessionCount}회</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {r.buckets.map((b) => (
                  <div
                    key={b.key}
                    className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 flex items-baseline justify-between gap-2"
                  >
                    <span className="text-gray-500 truncate">{b.key}</span>
                    <span className="text-gray-800 font-medium tabular-nums">
                      {formatHoursMinutes(b.durationSec)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
