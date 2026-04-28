"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface Props {
  startDate: Date;
  endDate: Date;
  onStartChange: (date: Date) => void;
  onEndChange: (date: Date) => void;
  onSearch: () => void;
  isLoading: boolean;
  isConfigured: boolean;
}

const PRESETS = [
  { label: "오늘", days: 0 },
  { label: "최근 7일", days: 6 },
  { label: "최근 30일", days: 29 },
  { label: "최근 90일", days: 89 },
];

export default function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onSearch,
  isLoading,
  isConfigured,
}: Props) {
  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onStartChange(start);
    onEndChange(end);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* 프리셋 버튼 */}
        <div className="flex gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.days)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* 날짜 피커 */}
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-gray-400 flex-shrink-0" />
          <div className="relative">
            <DatePicker
              selected={startDate}
              onChange={(date) => date && onStartChange(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              maxDate={endDate}
              dateFormat="yyyy-MM-dd"
              className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
          </div>
          <span className="text-gray-400 text-sm">~</span>
          <div className="relative">
            <DatePicker
              selected={endDate}
              onChange={(date) => date && onEndChange(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              maxDate={new Date()}
              dateFormat="yyyy-MM-dd"
              className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 조회 버튼 */}
        <button
          onClick={onSearch}
          disabled={isLoading || !isConfigured}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              조회 중...
            </>
          ) : (
            <>
              <ChevronDown size={16} className="rotate-90" />
              조회
            </>
          )}
        </button>

        {!isConfigured && (
          <p className="text-xs text-amber-600">
            * 조회 전 Pexip 연결 설정이 필요합니다.
          </p>
        )}
      </div>
    </div>
  );
}
