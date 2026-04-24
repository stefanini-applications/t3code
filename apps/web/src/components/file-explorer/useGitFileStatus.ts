import { useCallback, useEffect, useRef, useState } from "react";
import type { EnvironmentId, GitFileStatus } from "@t3tools/contracts";
import { readEnvironmentApi } from "../../environmentApi";

const POLL_INTERVAL_MS = 3_000;

interface UseGitFileStatusOptions {
  environmentId: EnvironmentId;
  cwd: string;
  enabled: boolean;
}

export function useGitFileStatus({ environmentId, cwd, enabled }: UseGitFileStatusOptions) {
  const [statusMap, setStatusMap] = useState<ReadonlyMap<string, GitFileStatus>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    const api = readEnvironmentApi(environmentId);
    if (!api) return;

    try {
      const result = await api.git.fileStatus({ cwd });
      const next = new Map<string, GitFileStatus>();
      for (const file of result.files) {
        next.set(file.relativePath, file.status);
      }
      setStatusMap(next);
    } catch {
      // Silently ignore — git status polling is best-effort
    }
  }, [environmentId, cwd]);

  useEffect(() => {
    if (!enabled) return;

    void fetchStatus();
    timerRef.current = setInterval(() => void fetchStatus(), POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, fetchStatus]);

  return { statusMap, refresh: fetchStatus };
}
