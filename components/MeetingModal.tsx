"use client";

import { useState } from "react";
import {
  X,
  Building2,
  Video,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  Monitor,
  Smartphone,
  Globe,
  User,
  Shield,
  Wifi,
  List,
} from "lucide-react";
import {
  formatDuration,
  formatDateTime,
  fetchParticipantsForConference,
  participantJoinIso,
  participantLeaveIso,
  parsePexipUtcDate,
} from "@/lib/pexip";
import type { CompanyStat, PexipConfig, PexipParticipant } from "@/lib/types";

interface Props {
  stat: CompanyStat;
  pexipConfig: PexipConfig;
  conferenceListEndpointUsed: string;
  onClose: () => void;
}

// 프로토콜 아이콘 매핑
function ProtocolIcon({ protocol }: { protocol: string }) {
  const p = protocol?.toLowerCase() ?? "";
  if (p.includes("webrtc") || p.includes("web")) return <Globe size={13} className="text-blue-400" />;
  if (p.includes("teams") || p.includes("skype")) return <Monitor size={13} className="text-purple-400" />;
  if (p.includes("sip") || p.includes("h.323")) return <Wifi size={13} className="text-green-400" />;
  return <Smartphone size={13} className="text-gray-400" />;
}

// 역할 배지
function RoleBadge({ role }: { role: string }) {
  const isChair = role === "chair";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isChair
          ? "bg-amber-100 text-amber-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {isChair ? <Shield size={10} /> : <User size={10} />}
      {isChair ? "호스트" : "게스트"}
    </span>
  );
}

// 참여자 목록 행
function ParticipantRow({ participant }: { participant: PexipParticipant }) {
  const joinIso = participantJoinIso(participant);
  const leaveIso = participantLeaveIso(participant);

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50">
      <ProtocolIcon protocol={participant.protocol} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">
          {participant.display_name || "Unknown"}
        </p>
        <p className="text-xs text-gray-400">
          {participant.protocol} · {participant.remote_address || "-"}
        </p>
        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
          <span className="text-gray-500">참여 </span>
          {joinIso ? formatDateTime(joinIso) : "—"}
          <span className="text-gray-300 mx-1.5">|</span>
          <span className="text-gray-500">종료 </span>
          {leaveIso ? formatDateTime(leaveIso) : "진행 중"}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
        <RoleBadge role={participant.role} />
        <span className="text-xs text-gray-400 tabular-nums">
          {formatDuration(participant.duration ?? 0)}
        </span>
      </div>
    </div>
  );
}

// 회의 1건 아코디언 행
function ConferenceRow({
  conf,
  index,
  pexipConfig,
  conferenceListEndpointUsed,
}: {
  conf: CompanyStat["conferences"][0];
  index: number;
  pexipConfig: PexipConfig;
  conferenceListEndpointUsed: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadedParticipants, setLoadedParticipants] = useState<PexipParticipant[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const mergedParticipants =
    conf.participants.length > 0 ? conf.participants : (loadedParticipants ?? []);
  const canLoadDetail = Boolean(conf.id);
  const hasNoParticipantRows = conf.participants.length === 0 && mergedParticipants.length === 0;
  const showLoadDetailUi = hasNoParticipantRows && canLoadDetail;

  async function handleLoadParticipants() {
    setDetailError(null);
    setDetailLoading(true);
    try {
      const list = await fetchParticipantsForConference(
        pexipConfig,
        conferenceListEndpointUsed,
        conf.id
      );
      setLoadedParticipants(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "참가자 조회에 실패했습니다.";
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{index + 1}</span>
        <Video size={14} className="text-blue-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{conf.name}</p>
          <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-0.5">
            <span>시작: {formatDateTime(conf.start_time)}</span>
            <span>종료: {formatDateTime(conf.end_time)}</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatDuration(conf.duration ?? 0)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Users size={12} />
            {(conf.participants.length || conf.participant_count)}명
          </span>
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-3">
          {mergedParticipants.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                참여자 목록 ({mergedParticipants.length}명)
              </p>
              {mergedParticipants.map((p) => (
                <ParticipantRow key={p.id} participant={p} />
              ))}
            </div>
          )}

          {showLoadDetailUi && (
            <div className="space-y-2">
              {loadedParticipants === null && conf.participant_count > 0 && (
                <p className="text-xs text-gray-500 text-center leading-relaxed">
                  참여 인원 {conf.participant_count}명(회의 메타데이터 기준)입니다.
                  <br />
                  아래 버튼을 누르면 이 회의의 참가자 상세를 불러옵니다.
                </p>
              )}
              {loadedParticipants !== null && loadedParticipants.length === 0 && !detailLoading && (
                <p className="text-xs text-gray-500 text-center leading-relaxed">
                  상세 조회 결과가 없습니다. Pexip 버전에 따라 필터가 다를 수 있습니다.
                  <br />
                  필요하면 다시 시도해 보세요.
                </p>
              )}
              <button
                type="button"
                disabled={detailLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleLoadParticipants();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {detailLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    불러오는 중…
                  </>
                ) : (
                  <>
                    <List size={16} />
                    {loadedParticipants === null ? "참가자 상세 보기" : "다시 조회"}
                  </>
                )}
              </button>
            </div>
          )}

          {detailError && (
            <p className="text-xs text-red-600 text-center whitespace-pre-wrap break-words px-1">
              {detailError}
            </p>
          )}

          {!showLoadDetailUi && hasNoParticipantRows && (
            <p className="text-xs text-gray-400 py-2 text-center">
              참여자 정보가 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MeetingModal({
  stat,
  pexipConfig,
  conferenceListEndpointUsed,
  onClose,
}: Props) {
  const totalMeetings = stat.conferences.length;
  const avgDuration = totalMeetings > 0
    ? Math.round(stat.totalDuration / totalMeetings)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* 헤더 */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Building2 size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{stat.company}</h2>
              <p className="text-sm text-gray-400">회의 상세 내역</p>
              <p className="text-xs text-gray-400 mt-0.5">시각은 한국 표준시(KST) 기준입니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 요약 통계 */}
        <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stat.meetingCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">총 회의 수</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stat.totalParticipants}</p>
            <p className="text-xs text-gray-500 mt-0.5">총 참여자 수</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{formatDuration(avgDuration)}</p>
            <p className="text-xs text-gray-500 mt-0.5">평균 회의 시간</p>
          </div>
        </div>

        {/* 회의 목록 (스크롤 영역) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {stat.conferences.length > 0 ? (
            stat.conferences
              .sort(
                (a, b) =>
                  parsePexipUtcDate(b.start_time).getTime() -
                  parsePexipUtcDate(a.start_time).getTime()
              )
              .map((conf, i) => (
                <ConferenceRow
                  key={conf.id}
                  conf={conf}
                  index={i}
                  pexipConfig={pexipConfig}
                  conferenceListEndpointUsed={conferenceListEndpointUsed}
                />
              ))
          ) : (
            <div className="text-center py-10 text-gray-400">
              <Video size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">회의 내역이 없습니다.</p>
            </div>
          )}
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
