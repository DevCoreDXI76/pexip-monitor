"use client";

import { useState, useCallback } from "react";
import { fetchCompanyStats } from "@/lib/pexip";
import type { CompanyStat, PexipConfig } from "@/lib/types";

interface UsePexipDataReturn {
  stats: CompanyStat[];
  isLoading: boolean;
  error: string | null;
  fetchData: (config: PexipConfig, startDate: Date, endDate: Date) => Promise<void>;
  clearError: () => void;
}

export function usePexipData(): UsePexipDataReturn {
  const [stats, setStats] = useState<CompanyStat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (config: PexipConfig, startDate: Date, endDate: Date) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchCompanyStats(
          config.url,
          config.username,
          config.password,
          startDate,
          endDate
        );
        setStats(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "데이터 조회 중 오류가 발생했습니다.";
        setError(message);
        setStats([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return { stats, isLoading, error, fetchData, clearError };
}
