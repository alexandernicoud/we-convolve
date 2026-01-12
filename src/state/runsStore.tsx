import { create } from 'zustand';
import { runsApi } from '@/lib/api';
import { GlobalRun } from '@/lib/api';

interface RunsState {
  runsById: Record<string, GlobalRun>;
  activeRunIds: string[];
  isPolling: boolean;
}

interface RunsActions {
  refreshActiveRuns: () => Promise<void>;
  refreshRun: (runId: string) => Promise<void>;
  registerRun: (run: Omit<GlobalRun, 'created_at' | 'updated_at'>) => void;
  getRunRoute: (run: GlobalRun) => string;
  clearRunHistory: () => void;
}

type RunsStore = RunsState & RunsActions;

// Load persisted runs from localStorage
const loadPersistedRuns = () => {
  try {
    const persisted = localStorage.getItem('convolve_runs');
    return persisted ? JSON.parse(persisted) : { runsById: {}, activeRunIds: [] };
  } catch {
    return { runsById: {}, activeRunIds: [] };
  }
};

// Save runs to localStorage
const savePersistedRuns = (runsById: Record<string, GlobalRun>, activeRunIds: string[]) => {
  try {
    localStorage.setItem('convolve_runs', JSON.stringify({ runsById, activeRunIds }));
  } catch (error) {
    console.warn('Failed to save runs to localStorage:', error);
  }
};

export const useRunsStore = create<RunsStore>((set, get) => ({
  ...loadPersistedRuns(),
  isPolling: false,

  getRunRoute: (run: GlobalRun): string => {
    switch (run.tool) {
      case 'labeling-optimizer':
        // Always go to results page for completed runs, run page for in-progress
        if (run.status === 'succeeded' || run.status === 'failed') {
          return `/products/labeling-optimizer/results/${run.id}`;
        } else if (run.status === 'running' || run.status === 'queued') {
          return `/products/labeling-optimizer/run/${run.id}`;
        }
        // Default to results for unknown status
        return `/products/labeling-optimizer/results/${run.id}`;
      case 'training-chart-generator':
        // Shows progress inline on main tool page
        return '/tools/generator';
      case 'trainer':
        // Shows progress inline on main tool page
        return '/tools/trainer';
      case 'analysis':
        return run.parent_run_id
          ? `/tools/trainer/runs/${run.parent_run_id}/analysis`
          : `/tools/trainer/runs/${run.id}`;
      case 'backtester':
        // Has dedicated run/results page
        return `/tools/backtester/runs/${run.id}`;
      default:
        return '/';
    }
  },

  refreshActiveRuns: async () => {
    try {
      set({ isPolling: true });
      const response = await runsApi.getActiveRuns();
      const newRunsById: Record<string, GlobalRun> = {};
      const newActiveRunIds: string[] = [];

      response.runs.forEach(run => {
        newRunsById[run.id] = run;
        newActiveRunIds.push(run.id);
      });

      // Merge with existing persisted runs
      set(state => {
        const mergedRunsById = { ...state.runsById, ...newRunsById };
        const mergedActiveRunIds = [...state.activeRunIds.filter(id => !newActiveRunIds.includes(id)), ...newActiveRunIds];

        // Save to localStorage
        savePersistedRuns(mergedRunsById, mergedActiveRunIds);

        return {
          runsById: mergedRunsById,
          activeRunIds: mergedActiveRunIds,
          isPolling: false
        };
      });
    } catch (error) {
      console.error('Failed to fetch active runs:', error);
      set({ isPolling: false });
    }
  },

  refreshRun: async (runId: string) => {
    try {
      const run = await runsApi.getRun(runId);
      set(state => {
        const newRunsById = {
          ...state.runsById,
          [runId]: run,
        };
        const newActiveRunIds = run.status === 'running' || run.status === 'queued'
          ? [...state.activeRunIds.filter(id => id !== runId), runId]
          : state.activeRunIds.filter(id => id !== runId);

        // Save to localStorage
        savePersistedRuns(newRunsById, newActiveRunIds);

        return {
          runsById: newRunsById,
          activeRunIds: newActiveRunIds
        };
      });
    } catch (error) {
      console.error(`Failed to fetch run ${runId}:`, error);
    }
  },

  registerRun: (runData: Omit<GlobalRun, 'created_at' | 'updated_at'>) => {
    const now = Date.now() / 1000; // Unix timestamp
    const run: GlobalRun = {
      ...runData,
      created_at: now,
      updated_at: now,
    };

    set(state => {
      const newRunsById = {
        ...state.runsById,
        [run.id]: run,
      };
      const newActiveRunIds = run.status === 'running' || run.status === 'queued'
        ? [...state.activeRunIds.filter(id => id !== run.id), run.id]
        : state.activeRunIds.filter(id => id !== run.id);

      // Save to localStorage
      savePersistedRuns(newRunsById, newActiveRunIds);

      return {
        runsById: newRunsById,
        activeRunIds: newActiveRunIds
      };
    });
  },

  clearRunHistory: () => {
    set({ runsById: {}, activeRunIds: [] });
    savePersistedRuns({}, []);
  },

  // Clear only stale/running runs that might be stuck
  clearStaleRuns: () => {
    set(state => {
      const newRunsById = { ...state.runsById };
      const newActiveRunIds = [...state.activeRunIds];

      // Remove running/queued runs from both collections
      Object.keys(newRunsById).forEach(runId => {
        const run = newRunsById[runId];
        if (run && (run.status === 'running' || run.status === 'queued')) {
          delete newRunsById[runId];
          const index = newActiveRunIds.indexOf(runId);
          if (index > -1) {
            newActiveRunIds.splice(index, 1);
          }
          console.log('Cleared stale run:', runId);
        }
      });

      savePersistedRuns(newRunsById, newActiveRunIds);
      return { runsById: newRunsById, activeRunIds: newActiveRunIds };
    });
  },
}));

// Auto-polling setup - runs when the store is first accessed
if (typeof window !== 'undefined') {
  let pollInterval: NodeJS.Timeout | null = null;

  const startPolling = () => {
    if (pollInterval) return;

    // Initial fetch
    useRunsStore.getState().refreshActiveRuns();

    // Set up polling - faster when there are active runs, slower when none
    pollInterval = setInterval(async () => {
      await useRunsStore.getState().refreshActiveRuns();
    }, 2000); // Start with 2-second interval
  };

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  // Handle page visibility changes to pause polling when tab is hidden
  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Start polling
  startPolling();

  // Adjust polling frequency based on active runs
  const adjustPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);

      const activeRunsCount = useRunsStore.getState().activeRunIds.length;
      const interval = activeRunsCount > 0 ? 2000 : 10000;
      pollInterval = setInterval(async () => {
        await useRunsStore.getState().refreshActiveRuns();
      }, interval);
    }
  };

  // Subscribe to store changes to adjust polling
  useRunsStore.subscribe((state) => {
    adjustPolling();
  });
}
