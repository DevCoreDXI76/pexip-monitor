"use client";

import { useState, useEffect } from "react";
import { Server, User, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import type { PexipConfig } from "@/lib/types";

const STORAGE_KEY = "pexip_config";

interface Props {
  onConfigSaved: (config: PexipConfig) => void;
  currentConfig: PexipConfig | null;
}

export default function ConnectionForm({ onConfigSaved, currentConfig }: Props) {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // 로컬스토리지에서 URL/사용자명 복원 (비밀번호는 저장하지 않음)
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
    // URL과 사용자명만 로컬스토리지에 저장 (보안상 비밀번호 제외)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: config.url, username: config.username }));
    onConfigSaved(config);
    setTestResult(null);
    setIsOpen(false);
  };

  const handleTest = async () => {
    if (!url || !username || !password) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/pexip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pexipUrl: url.trim(),
          username: username.trim(),
          password,
          endpoint: "/api/admin/history/conference/",
          params: { limit: "1", offset: "0" },
        }),
      });
      if (res.ok) {
        setTestResult({ ok: true, message: "연결 성공! Pexip에 정상 접속되었습니다." });
      } else {
        const err = await res.json();
        setTestResult({ ok: false, message: err.error ?? `연결 실패 (${res.status})` });
      }
    } catch {
      setTestResult({ ok: false, message: "서버에 연결할 수 없습니다." });
    } finally {
      setIsTesting(false);
    }
  };

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
        {isConfigured ? `연결됨: ${currentConfig.url.replace(/https?:\/\//, "")}` : "Pexip 연결 설정"}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-11 z-50 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 p-5 animate-slide-up">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Server size={18} className="text-blue-600" />
              Pexip Management Node 연결 설정
            </h3>

            <div className="space-y-3">
              {/* URL */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Management Node URL
                </label>
                <div className="relative">
                  <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://pexip.example.com"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  관리자 계정 (Username)
                </label>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  비밀번호 (Password)
                </label>
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
                <p className="text-xs text-gray-400 mt-1">
                  * 비밀번호는 브라우저에 저장되지 않습니다.
                </p>
              </div>
            </div>

            {/* 테스트 결과 */}
            {testResult && (
              <div
                className={`mt-3 flex items-start gap-2 p-3 rounded-lg text-xs ${
                  testResult.ok
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                )}
                {testResult.message}
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleTest}
                disabled={!url || !username || !password || isTesting}
                className="flex-1 py-2 text-sm font-medium rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isTesting ? "테스트 중..." : "연결 테스트"}
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
