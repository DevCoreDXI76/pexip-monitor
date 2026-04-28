"use client";

import { Building2, Video, Users, Clock, ChevronRight } from "lucide-react";
import { formatDuration } from "@/lib/pexip";
import type { CompanyStat } from "@/lib/types";

interface Props {
  stat: CompanyStat;
  rank: number;
  onClick: () => void;
}

// 순위별 배지 색상
const RANK_COLORS = [
  "bg-yellow-400 text-yellow-900",
  "bg-gray-300 text-gray-700",
  "bg-amber-600 text-amber-100",
];

export default function CompanyCard({ stat, rank, onClick }: Props) {
  const rankColor = RANK_COLORS[rank - 1] ?? "bg-blue-100 text-blue-700";
  const avgDuration =
    stat.meetingCount > 0
      ? Math.round(stat.totalDuration / stat.meetingCount)
      : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 p-5 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* 순위 배지 */}
          <span
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${rankColor}`}
          >
            {rank}
          </span>

          {/* 회사 정보 */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={16} className="text-blue-500 flex-shrink-0" />
              <h3 className="text-base font-semibold text-gray-800 truncate">
                {stat.company}
              </h3>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Video size={13} className="text-blue-400" />
                회의 <strong className="text-gray-700">{stat.meetingCount}</strong>건
              </span>
              <span className="flex items-center gap-1">
                <Users size={13} className="text-green-400" />
                총 참여 <strong className="text-gray-700">{stat.totalParticipants}</strong>명
              </span>
              <span className="flex items-center gap-1">
                <Clock size={13} className="text-purple-400" />
                평균 <strong className="text-gray-700">{formatDuration(avgDuration)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* 화살표 */}
        <ChevronRight
          size={18}
          className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1"
        />
      </div>

      {/* 회의 수 시각화 바 */}
      <div className="mt-3">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
            style={{ width: `${Math.min(100, (stat.meetingCount / 20) * 100)}%` }}
          />
        </div>
      </div>
    </button>
  );
}
