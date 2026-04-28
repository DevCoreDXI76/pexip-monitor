"use client";

import { useState, useEffect } from "react";
import { Server, User, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import type { PexipConfig } from "@/lib/types";

const STORAGE_KEY = "pexip_config";

interface DiagResult {
  label: string;
  endpoint: string;
  ok: boolean;
  status: number;
  message: string;
}

interface Props {
  onConfigSaved: (config: PexipConfig) => void;
  currentConfig: PexipConfig | null;
}

async function testEndpoint(
  url: string,
  username: string,
  password: string,
  endpoint: string,
  label: string
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
      label,
      endpoint,
      ok: res.ok,
      status: res.status,
      message: res.ok
        ? `정상 (${data?.meta?.total_count ?? "?"} 건)`
        : (data?.error ?? `오류 ${res.status}`),
    };
  } catch {
    return { label, endpoint, ok: false, status: 0, message: "연결 실패" };
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PexipConfig>;
        setUrl(parsed.url ?? "");
        setUsername(parsed.username ?? "");
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSave = () => {
    if (!url || !username || !password) return;
    const config: PexipConfig = { url: url.trim(), username: username.trim(), password };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: config.url, username: config.username }));
    onConfigSaved(config);
    setDiagResults([]);
    setIsOpen(false);
  };

  const handleTest = async () => {
    if (!url || !username || !password) return;
    setIsTesting(true);
    setDiagResults([]);

    const endpoints = [
      { endpoint: "/api/admin/", label: "API 루트" },
      { endpoint: "/api/admin/history/conference/", label: "회의 이력 (history)" },
      { endpoint: "/api/admin/status/conference/", label: "현재 회의 (status)" },
      { endpoint: "/api/admin/configuration/conference/", label: "VMR 설정" },
    ];

    const results: DiagResult[] = [];
    for (const ep of endpoints) {
      const r = await testEndpoint(url, username, password, ep.endpoint, ep.label);
      results.push(r);
    }
    setDiagResults(results);
    setIsTesting(false);
  };

  const isConfigured = !!currentConfig;
  const allFail = diagResults.length > 0 && diagResults.every((r) => !r.ok);
  const apiRootOk = diagResults.find((r) => r.endpoint === "/api/admin/")?.ok;

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
          <div className="absolute right-0 top-11 z-50 w-[420px] bg-white rounded-xl shadow-2xl border border-gray-200 p-5 animate-slide-up">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Server size={18} className="text-blue-600" />
              Pexip Management Node 연결 설정
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Management Node URL
                </label>
                <div className="relative">
                  <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://pexip.example.com 또는 IP"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  ⚠ Conferencing Node가 아닌 <strong>Management Node</strong> URL을 입력하세요.
                </p>
              </div>

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
            </div>

            {/* 진단 결과 */}
            {isTesting && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                <Loader2 size={14} className="animate-spin text-blue-500" />
                API 엔드포인트 진단 중...
              </div>
            )}

            {diagResults.length > 0 && !isTesting && (
              <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-600">API 엔드포인트 진단 결과</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {diagResults.map((r) => (
                    <div key={r.endpoint} className="flex items-start gap-2 px-3 py-2">
                      {r.ok ? (
                        <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700">{r.label}</p>
                        <p className="text-xs text-gray-400 truncate">{r.endpoint}</p>
                      </div>
                      <span
                        className={`text-xs flex-shrink-0 ${r.ok ? "text-green-600" : "text-red-500"}`}
                      >
                        {r.message}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 진단 안내 메시지 */}
                {allFail && (
                  <div className="px-3 py-2 bg-red-50 border-t border-red-100">
                    <p className="text-xs text-red-700 font-medium flex items-start gap-1">
                      <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                      Management Node URL이 맞는지 확인하세요. Conferencing Node에는 관리 API가 없습니다.
                    </p>
                  </div>
                )}
                {!allFail && apiRootOk && diagResults.some((r) => !r.ok && r.endpoint.includes("history")) && (
                  <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                    <p className="text-xs text-amber-700 flex items-start gap-1">
                      <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                      history API 없음 → status(현재 활성 회의) 기반으로 자동 전환됩니다.
                    </p>
                  </div>
                )}
              </div>
            )}

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
