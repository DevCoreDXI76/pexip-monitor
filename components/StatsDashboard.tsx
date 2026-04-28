"use client";

import { useState } from "react";
import { BarChart2, Search } from "lucide-react";
import CompanyCard from "./CompanyCard";
import MeetingModal from "./MeetingModal";
import type { CompanyStat } from "@/lib/types";

interface Props {
  stats: CompanyStat[];
  isLoading: boolean;
}

export default function StatsDashboard({ stats, isLoading }: Props) {
  const [selectedStat, setSelectedStat] = useState<CompanyStat | null>(null);
  const [search, setSearch] = useState("");

  const filtered = stats.filter((s) =>
    s.company.toLowerCase().includes(search.toLowerCase())
  );

  const totalMeetings = stats.reduce((sum, s) => sum + s.meetingCount, 0);
  const totalParticipants = stats.reduce((sum, s) => sum + s.totalParticipants, 0);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-sm">Pexip 데이터를 조회하는 중입니다...</p>
        <p className="text-xs mt-1 text-gray-300">데이터 양에 따라 수 초 이상 소요될 수 있습니다.</p>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-300">
        <BarChart2 size={48} className="mb-4 opacity-30" />
        <p className="text-base text-gray-400 font-medium">조회된 데이터가 없습니다</p>
        <p className="text-sm mt-1 text-gray-300">
          날짜 범위를 선택하고 조회 버튼을 누르세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* 요약 배너 */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-blue-600 text-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-blue-200 mb-1">참여 회사 수</p>
          <p className="text-3xl font-bold">{stats.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-400 mb-1">총 회의 건수</p>
          <p className="text-3xl font-bold text-gray-800">{totalMeetings}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-400 mb-1">총 참여자 수</p>
          <p className="text-3xl font-bold text-gray-800">{totalParticipants}</p>
        </div>
      </div>

      {/* 검색창 */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="회사명 검색..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* 회사별 카드 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((stat, i) => (
          <CompanyCard
            key={stat.company}
            stat={stat}
            rank={i + 1}
            onClick={() => setSelectedStat(stat)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          &ldquo;{search}&rdquo;에 해당하는 회사가 없습니다.
        </div>
      )}

      {/* 모달 */}
      {selectedStat && (
        <MeetingModal stat={selectedStat} onClose={() => setSelectedStat(null)} />
      )}
    </div>
  );
}
