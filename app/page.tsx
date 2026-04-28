"use client";

import { useState, useEffect, useCallback } from "react";
import { subDays } from "date-fns";
import { AlertCircle, RefreshCw, Video } from "lucide-react";
import ConnectionForm from "@/components/ConnectionForm";
import DateRangePicker from "@/components/DateRangePicker";
import StatsDashboard from "@/components/StatsDashboard";
import { usePexipData } from "@/hooks/usePexipData";
import type { PexipConfig } from "@/lib/types";

export default function HomePage() {
  const [config, setConfig] = useState<PexipConfig | null>(null);
  const [startDate, setStartDate] = useState<Date>(() => subDays(new Date(), 6));
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  const { stats, isLoading, error, fetchData, clearError } = usePexipData();

  // 설정이 저장되면 자동으로 첫 조회
  const handleConfigSaved = useCallback(
    (newConfig: PexipConfig) => {
      setConfig(newConfig);
      fetchData(newConfig, startDate, endDate);
    },
    [startDate, endDate, fetchData]
  );

  const handleSearch = useCallback(() => {
    if (!config) return;
    fetchData(config, startDate, endDate);
  }, [config, startDate, endDate, fetchData]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 로고 */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                <Video size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-none">
                  Pexip Monitor
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">Teams 회의 통계 대시보드</p>
              </div>
            </div>

            {/* 연결 설정 버튼 */}
            <ConnectionForm
              onConfigSaved={handleConfigSaved}
              currentConfig={config}
            />
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* 날짜 필터 */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onSearch={handleSearch}
          isLoading={isLoading}
          isConfigured={!!config}
        />

        {/* 에러 배너 */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 animate-fade-in">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">데이터 조회 실패</p>
              <pre className="text-sm mt-0.5 whitespace-pre-wrap break-words font-sans">{error}</pre>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleSearch}
                disabled={isLoading || !config}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
              >
                <RefreshCw size={12} />
                재시도
              </button>
              <button
                onClick={clearError}
                className="px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 안내 메시지 (미설정 상태) */}
        {!config && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
              <Video size={32} className="text-blue-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              Pexip 연결 설정이 필요합니다
            </h2>
            <p className="text-sm text-gray-400 max-w-sm">
              우측 상단의 <strong>Pexip 연결 설정</strong> 버튼을 클릭하여
              Management Node의 URL, 계정 정보를 입력하세요.
            </p>
          </div>
        )}

        {/* 통계 대시보드 */}
        {(config || isLoading) && (
          <StatsDashboard stats={stats} isLoading={isLoading} />
        )}
      </main>

      {/* 푸터 */}
      <footer className="mt-12 pb-6 text-center text-xs text-gray-300">
        Pexip Monitor · Powered by Next.js &amp; Pexip REST API
      </footer>
    </div>
  );
}
