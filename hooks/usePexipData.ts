"use client";

import { useState, useCallback } from "react";
import { fetchCompanyStats } from "@/lib/pexip";
import type { CompanyStat, DataSource, PexipConfig } from "@/lib/types";

interface UsePexipDataReturn {
  stats: CompanyStat[];
  dataSource: DataSource | null;
  isLoading: boolean;
  error: string | null;
  fetchData: (config: PexipConfig, startDate: Date, endDate: Date) => Promise<void>;
  clearError: () => void;
}

export function usePexipData(): UsePexipDataReturn {
  const [stats, setStats] = useState<CompanyStat[]>([]);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
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
          endDate,
          config.customApiBase
        );
        setStats(result.stats);
        setDataSource(result.dataSource);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "데이터 조회 중 오류가 발생했습니다.";
        setError(message);
        setStats([]);
        setDataSource(null);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return { stats, dataSource, isLoading, error, fetchData, clearError };
}
