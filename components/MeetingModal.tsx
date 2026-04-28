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
} from "lucide-react";
import { formatDuration, formatDateTime } from "@/lib/pexip";
import type { CompanyStat, PexipParticipant } from "@/lib/types";

interface Props {
  stat: CompanyStat;
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
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
      <ProtocolIcon protocol={participant.protocol} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">
          {participant.display_name || "Unknown"}
        </p>
        <p className="text-xs text-gray-400">
          {participant.protocol} · {participant.remote_address || "-"}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <RoleBadge role={participant.role} />
        <span className="text-xs text-gray-400">
          {formatDuration(participant.duration ?? 0)}
        </span>
      </div>
    </div>
  );
}

// 회의 1건 아코디언 행
function ConferenceRow({ conf, index }: { conf: CompanyStat["conferences"][0]; index: number }) {
  const [expanded, setExpanded] = useState(false);

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
            <span>
              시작: {formatDateTime(conf.start_time)}
            </span>
            <span>
              종료: {formatDateTime(conf.end_time)}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatDuration(conf.duration ?? 0)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Users size={12} />
            {conf.participants.length}명
          </span>
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
          {conf.participants.length > 0 ? (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                참여자 목록 ({conf.participants.length}명)
              </p>
              {conf.participants.map((p) => (
                <ParticipantRow key={p.id} participant={p} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-2 text-center">
              참여자 정보가 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MeetingModal({ stat, onClose }: Props) {
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
              .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
              .map((conf, i) => (
                <ConferenceRow key={conf.id} conf={conf} index={i} />
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
