"use client";

import { useState, useCallback } from "react";
import { subDays } from "date-fns";
import { AlertCircle, RefreshCw, Video, Clock, History, Terminal, Network } from "lucide-react";
import ConnectionForm from "@/components/ConnectionForm";
import DateRangePicker from "@/components/DateRangePicker";
import StatsDashboard from "@/components/StatsDashboard";
import { usePexipData } from "@/hooks/usePexipData";
import type { PexipConfig } from "@/lib/types";

export default function HomePage() {
  const [config, setConfig] = useState<PexipConfig | null>(null);
  const [startDate, setStartDate] = useState<Date>(() => subDays(new Date(), 6));
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  const { stats, dataSource, conferenceEndpointUsed, isLoading, error, fetchData, clearError } =
    usePexipData();

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
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                <Video size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-none">Pexip Monitor</h1>
                <p className="text-xs text-gray-400 mt-0.5">Teams 회의 통계 대시보드</p>
              </div>
            </div>
            <ConnectionForm onConfigSaved={handleConfigSaved} currentConfig={config} />
          </div>
        </div>
      </header>

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

        {/* 데이터 소스 배너 */}
        {dataSource && !isLoading && stats.length > 0 && (
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${
              dataSource === "history"
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}
          >
            {dataSource === "history" ? (
              <History size={15} className="flex-shrink-0" />
            ) : (
              <Clock size={15} className="flex-shrink-0" />
            )}
            {dataSource === "history"
              ? "이력 데이터 (history API) 기준으로 조회했습니다."
              : "history API 미지원 서버 → 현재 활성 회의 (status API) 기준으로 조회했습니다. 날짜 필터는 적용되지 않습니다."}
          </div>
        )}

        {/* 에러 배너 */}
        {error && (
          <div className="space-y-3 animate-fade-in">
            {/* 에러 메시지 */}
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">데이터 조회 실패</p>
                <pre className="text-sm mt-1 whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {error}
                </pre>
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

            {/* 해결 방법 안내 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Step 1: 연결 진단 */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
                  <p className="text-sm font-semibold text-gray-800">연결 진단 실행</p>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  우측 상단 <strong>연결 설정 버튼</strong> → <strong>연결 진단</strong> 클릭
                </p>
                <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600 space-y-1">
                  <p>✓ Web Admin 접근 가능 → Management Node</p>
                  <p>✓ Client API만 가능 → Conferencing Node</p>
                  <p>✗ 전부 실패 → 내부망 전용 서버</p>
                </div>
              </div>

              {/* Step 2: 로컬 실행 */}
              <div className="bg-white border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
                  <p className="text-sm font-semibold text-gray-800">내부망이면 로컬 실행</p>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Pexip Management Node가 내부망에 있다면 이 앱을 같은 네트워크에서 실행하세요.
                </p>
                <div className="bg-gray-900 rounded-lg p-2 space-y-1">
                  <p className="text-xs text-gray-400 font-mono"># 프로젝트 폴더에서:</p>
                  <p className="text-xs text-green-400 font-mono">npm run dev</p>
                  <p className="text-xs text-gray-400 font-mono"># → http://localhost:3000</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 미설정 안내 */}
        {!config && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
              <Video size={32} className="text-blue-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Pexip 연결 설정이 필요합니다</h2>
            <p className="text-sm text-gray-400 max-w-sm">
              우측 상단의 <strong>Pexip 연결 설정</strong> 버튼을 클릭하여
              Management Node URL과 계정 정보를 입력하세요.
            </p>
          </div>
        )}

        {/* 통계 대시보드 */}
        {(config || isLoading) && (
          <StatsDashboard
            stats={stats}
            isLoading={isLoading}
            pexipConfig={config}
            conferenceListEndpointUsed={conferenceEndpointUsed}
          />
        )}
      </main>

      <footer className="mt-12 pb-6 text-center text-xs text-gray-300">
        Pexip Monitor · Powered by Next.js &amp; Pexip REST API
      </footer>
    </div>
  );
}
