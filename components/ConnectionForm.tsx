"use client";

import { useState, useEffect } from "react";
import {
  Server, User, Lock, Eye, EyeOff,
  CheckCircle2, XCircle, Loader2, AlertCircle,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";
import type { PexipConfig } from "@/lib/types";

const STORAGE_KEY = "pexip_config";

interface DiagResult {
  label: string;
  endpoint: string;
  ok: boolean;
  status: number;
  message: string;
  hint?: string;
}

interface Props {
  onConfigSaved: (config: PexipConfig) => void;
  currentConfig: PexipConfig | null;
}

// 진단할 엔드포인트 목록
const DIAG_ENDPOINTS = [
  {
    endpoint: "/api/admin/",
    label: "Management API 루트",
    hint: "200이면 Management Node 확인됨",
  },
  {
    endpoint: "/api/admin/history/conference/",
    label: "회의 이력 API (history)",
    hint: "200이면 기간별 통계 조회 가능",
  },
  {
    endpoint: "/api/admin/status/conference/",
    label: "현재 회의 API (status)",
    hint: "200이면 실시간 데이터 조회 가능",
  },
  {
    endpoint: "/api/admin/configuration/conference/",
    label: "VMR 설정 API",
    hint: "200이면 VMR 목록 조회 가능",
  },
  {
    endpoint: "/api/client/v2/",
    label: "Client API (v2)",
    hint: "200이면 Conferencing Node (관리 API 없음)",
  },
];

async function testEndpoint(
  url: string,
  username: string,
  password: string,
  endpoint: string,
  label: string,
  hint?: string
): Promise<DiagResult> {
  try {
    const res = await fetch("/api/pexip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pexipUrl: url.trim(),
        username: username.trim(),
        password,
        endpoint,
        params: { limit: "1", offset: "0" },
      }),
    });
    const data = await res.json();
    return {
      label, endpoint, hint,
      ok: res.ok,
      status: res.status,
      message: res.ok
        ? `정상 (총 ${data?.meta?.total_count ?? "?"}건)`
        : (data?.error?.split("\n")[0] ?? `오류 ${res.status}`),
    };
  } catch {
    return { label, endpoint, hint, ok: false, status: 0, message: "연결 실패" };
  }
}

export default function ConnectionForm({ onConfigSaved, currentConfig }: Props) {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [diagResults, setDiagResults] = useState<DiagResult[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customApiBase, setCustomApiBase] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PexipConfig & { customApiBase?: string }>;
        setUrl(parsed.url ?? "");
        setUsername(parsed.username ?? "");
        setCustomApiBase(parsed.customApiBase ?? "");
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSave = () => {
    if (!url || !username || !password) return;
    const config: PexipConfig = {
      url: url.trim(),
      username: username.trim(),
      password,
      customApiBase: customApiBase.trim() || undefined,
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ url: config.url, username: config.username, customApiBase: config.customApiBase })
    );
    onConfigSaved(config);
    setDiagResults([]);
    setIsOpen(false);
  };

  const handleTest = async () => {
    if (!url || !username || !password) return;
    setIsTesting(true);
    setDiagResults([]);

    const results: DiagResult[] = [];
    for (const ep of DIAG_ENDPOINTS) {
      const r = await testEndpoint(url, username, password, ep.endpoint, ep.label, ep.hint);
      results.push(r);
    }
    setDiagResults(results);
    setIsTesting(false);
  };

  // 진단 결과 해석
  const apiRootOk = diagResults.find((r) => r.endpoint === "/api/admin/")?.ok;
  const historyOk = diagResults.find((r) => r.endpoint.includes("history"))?.ok;
  const statusOk = diagResults.find((r) => r.endpoint.includes("status/conference"))?.ok;
  const clientApiOk = diagResults.find((r) => r.endpoint.includes("client"))?.ok;
  const allFail = diagResults.length > 0 && diagResults.every((r) => !r.ok);

  let serverTypeMsg = "";
  let serverTypeColor = "";
  if (diagResults.length > 0) {
    if (apiRootOk) {
      serverTypeMsg = "✓ Management Node 확인됨";
      serverTypeColor = "text-green-700 bg-green-50 border-green-200";
    } else if (clientApiOk) {
      serverTypeMsg = "⚠ Conferencing Node로 보임 → Management Node URL이 필요합니다";
      serverTypeColor = "text-amber-700 bg-amber-50 border-amber-200";
    } else if (allFail) {
      serverTypeMsg = "✗ API 접근 불가 → URL·계정·네트워크를 확인하세요";
      serverTypeColor = "text-red-700 bg-red-50 border-red-200";
    }
  }

  const isConfigured = !!currentConfig;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isConfigured
            ? "bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
            : "bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
        }`}
      >
        <Server size={16} />
        {isConfigured
          ? `연결됨: ${currentConfig.url.replace(/https?:\/\//, "")}`
          : "Pexip 연결 설정"}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-[440px] bg-white rounded-xl shadow-2xl border border-gray-200 p-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Server size={18} className="text-blue-600" />
              Pexip 연결 설정
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              반드시 <strong>Management Node</strong> URL을 입력하세요 (Conferencing Node는 관리 API 없음)
            </p>

            <div className="space-y-3">
              {/* URL */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Management Node URL</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://pexip-mgmt.example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">관리자 계정</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">비밀번호</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">* 비밀번호는 브라우저에 저장되지 않습니다.</p>
              </div>

              {/* 고급 설정 */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  고급 설정 (커스텀 API 경로)
                </button>
                {showAdvanced && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      커스텀 API 기본 경로 <span className="text-gray-400">(기본: /api/admin)</span>
                    </label>
                    <input
                      type="text"
                      value={customApiBase}
                      onChange={(e) => setCustomApiBase(e.target.value)}
                      placeholder="/api/admin"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1 flex items-start gap-1">
                      <Info size={11} className="mt-0.5 flex-shrink-0" />
                      진단 결과를 보고 정상 동작하는 경로로 변경하세요.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 진단 중 */}
            {isTesting && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                <Loader2 size={14} className="animate-spin text-blue-500" />
                API 엔드포인트 진단 중... ({DIAG_ENDPOINTS.length}개 테스트)
              </div>
            )}

            {/* 진단 결과 */}
            {diagResults.length > 0 && !isTesting && (
              <div className="mt-4 space-y-2">
                {/* 서버 타입 요약 */}
                {serverTypeMsg && (
                  <div className={`px-3 py-2 rounded-lg border text-xs font-medium ${serverTypeColor}`}>
                    {serverTypeMsg}
                  </div>
                )}

                {/* 상세 결과 테이블 */}
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      엔드포인트 진단 결과
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {diagResults.map((r) => (
                      <div key={r.endpoint} className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {r.ok ? (
                            <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle size={13} className="text-red-400 flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium text-gray-700 flex-1">{r.label}</span>
                          <span className={`text-xs font-semibold flex-shrink-0 ${r.ok ? "text-green-600" : "text-red-500"}`}>
                            {r.status > 0 ? `${r.status}` : "ERR"}
                          </span>
                        </div>
                        <div className="ml-5 mt-0.5">
                          <p className="text-xs text-gray-400 font-mono truncate">{r.endpoint}</p>
                          <p className={`text-xs mt-0.5 ${r.ok ? "text-green-600" : "text-gray-500"}`}>
                            {r.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 안내 메시지 */}
                {clientApiOk && !apiRootOk && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 font-semibold mb-1">Conferencing Node 감지됨</p>
                    <p className="text-xs text-amber-700">
                      이 서버는 회의 처리용 서버입니다. Pexip 관리자에게 문의하여
                      <strong> Management Node의 URL</strong>을 확인하세요.
                      (일반적으로 별도의 호스트명/IP를 가집니다.)
                    </p>
                  </div>
                )}
                {historyOk && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-700">
                      ✓ 회의 이력 API 정상 확인. 저장 및 적용 후 조회하세요.
                    </p>
                  </div>
                )}
                {!historyOk && statusOk && apiRootOk && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                      history API 없음 → status API(실시간 회의)로 자동 전환됩니다.
                      저장 및 적용 후 조회하세요.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleTest}
                disabled={!url || !username || !password || isTesting}
                className="flex-1 py-2 text-sm font-medium rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isTesting ? "진단 중..." : "연결 진단"}
              </button>
              <button
                onClick={handleSave}
                disabled={!url || !username || !password}
                className="flex-1 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                저장 및 적용
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
