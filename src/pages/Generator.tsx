import { useState, useEffect, useRef } from "react";
import { Download, RotateCcw, ArrowRight, X, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import ToolLayout from "@/components/ToolLayout";
import StatusPanel, { Status } from "@/components/StatusPanel";

type GeneratorStatus = Status;
import { trainingChartGeneratorApi } from "@/lib/api";
import { useRunsStore } from "@/state/runsStore";

interface GeneratorConfig {
  symbols: string;
  chartsPerLabel: number; // x: charts per symbol per label
  useCandles: boolean; // use_candles: yes/no for candlestick charts
  timeframe: '1d' | '1wk' | '1mo'; // t: timeframe
  timespanUnit: string; // u: unit of timespan (e.g. 'months')
  timespanCount: number; // o: how many units for the timespan
  horizonBars: number; // w: future horizon in bars
  takeProfitFraction: number; // f: take profit as fraction
  stopLossFraction: number; // s: stop loss as fraction
  imageDimension: number; // img_dim: image dimensions (square)
  endOffset: number; // i1: last chart ends n time frame units ago
}

const defaultConfig: GeneratorConfig = {
  symbols: "AAPL,MSFT,GOOGL,AMZN",
  chartsPerLabel: 1000,
  useCandles: true,
  timeframe: '1d',
  timespanUnit: 'months',
  timespanCount: 6,
  horizonBars: 7,
  takeProfitFraction: 0.02,
  stopLossFraction: 0.01,
  imageDimension: 224,
  endOffset: 1,
};

export default function Generator() {
  const [config, setConfig] = useState<GeneratorConfig>(defaultConfig);
  const [status, setStatus] = useState<GeneratorStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressKey, setProgressKey] = useState(0); // Force re-render key
  const [currentPhase, setCurrentPhase] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [datasetStats, setDatasetStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showForceReset, setShowForceReset] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false); // Flag to prevent status changes after completion
  const startTimeRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cancelFlagRef = useRef(false);
  const testIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to avoid stale closure issues
  const statusRef = useRef<Status>('idle');
  const runIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    runIdRef.current = runId;
  }, [runId]);

  // Failsafe: show force reset button after 2 minutes of no progress
  useEffect(() => {
    if (status === 'running' && startTimeRef.current) {
      const checkStuck = () => {
        const elapsed = Date.now() - startTimeRef.current!;
        if (elapsed > 120000 && progress === 0) { // 2 minutes, still at 0%
          setShowForceReset(true);
        }
      };

      const timeout = setTimeout(checkStuck, 120000); // Check after 2 minutes
      return () => clearTimeout(timeout);
    } else {
      setShowForceReset(false);
    }
  }, [status, progress]);

  // Keep refs in sync with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    runIdRef.current = runId;
  }, [runId]);

  // Validation
  const validateConfig = (): string | null => {
    if (!config.symbols.trim()) return "Symbols are required";
    if (config.chartsPerLabel < 1) return "Charts per label must be at least 1";
    if (config.timespanCount < 1) return "Timespan count must be at least 1";
    if (config.horizonBars < 1) return "Horizon bars must be at least 1";
    if (config.takeProfitFraction <= 0 || config.takeProfitFraction > 1) return "Take profit fraction must be between 0 and 1";
    if (config.stopLossFraction <= 0 || config.stopLossFraction > 1) return "Stop loss fraction must be between 0 and 1";
    if (config.imageDimension < 64 || config.imageDimension > 1024) return "Image dimension must be between 64 and 1024";
    if (config.endOffset < 0) return "End offset must be non-negative";
    return null;
  };

  const handleGenerate = async () => {
    const validationError = validateConfig();
    if (validationError) {
      setError(validationError);
      setErrorDetails(null);
      return;
    }

    // Prevent starting multiple runs - only block if currently running
    if (status === 'running') {
      setError('A generation is already in progress');
      return;
    }

    setStatus('running');
    setProgress(5); // Start at 5% - more visible progress
    setProgressKey(prev => prev + 1);
    setCurrentPhase('Starting...');
    setElapsedTime(0);
    setRunId(null);
    setDatasetStats(null);
    setError(null);
    setErrorDetails(null);
    setIsCancelling(false);
    setShowForceReset(false);
    setIsCompleted(false); // Reset completion flag for new run
    cancelFlagRef.current = false;

    // Set start time for elapsed time tracking
    startTimeRef.current = Date.now();

    // Clear any existing intervals
    stopAllIntervals();

    startTimeRef.current = Date.now();
    startElapsedTimer(); // Start dedicated elapsed time updater

    try {
      // Start the generation
      const response = await trainingChartGeneratorApi.run(config);
      const newRunId = response.run_id;
      setRunId(newRunId);

      // Update refs immediately
      runIdRef.current = newRunId;
      statusRef.current = 'running';

      // Register the run in the global store
      useRunsStore.getState().registerRun({
        id: newRunId,
        tool: 'training-chart-generator',
        status: 'running',
        progress: 0.01,
        stage: 'starting',
        message: 'Initializing chart generator...',
        route: `/tools/generator/runs/${newRunId}`,
      });

      // Update status to running immediately
      console.log('Setting status to running for run:', newRunId);
      setStatus('running');
      setCurrentPhase('Starting...');

      // Start polling for progress immediately
      console.log('Starting progress polling for run:', newRunId);
      pollProgress(newRunId);

      // Also start animation immediately for responsive UI feedback
      console.log('Starting immediate progress animation for responsive feedback');
      startProgressAnimation();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to start generation');
      setErrorDetails({
        type: 'network_error',
        message: 'Failed to communicate with backend',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  };

  const handleCancel = async () => {
    // Allow cancel if there's any indication of an active run
    if (!runId && statusRef.current !== 'running') {
      console.log('Cancel called but no active run to cancel');
      return;
    }

    console.log('Starting cancel process for run:', runId, 'status:', statusRef.current);
    setIsCancelling(true);

    // IMMEDIATELY stop all polling and set flags
    cancelFlagRef.current = true;
    stopAllIntervals();

    // IMMEDIATELY reset UI state for responsive UX
    setStatus('idle');
    setProgress(0);
    setProgressKey(prev => prev + 1);
    setCurrentPhase('');
    setElapsedTime(0);
    setRunId(null);
    setDatasetStats(null);
    setIsCancelling(false);
    setIsCompleted(false); // Reset completion flag

    // Update refs immediately
    statusRef.current = 'idle';
    runIdRef.current = null;
    cancelFlagRef.current = false;

    // Update global run store if we have a runId
    if (runId) {
      useRunsStore.getState().registerRun(runId, 'training-chart-generator', 'cancelled');
    }

    // Try to cancel on backend (best effort)
    if (runId) {
      try {
        console.log('Calling backend cancel API...');
        await trainingChartGeneratorApi.cancel(runId);
        console.log('Successfully cancelled run on backend');
      } catch (cancelErr) {
        console.error('Backend cancel failed, but UI has been reset:', cancelErr);
        // Don't show error - UI is already reset and responsive
        // Backend cancel failure doesn't block the user
      }
    }

    // Clear any error state
    setError(null);
    setErrorDetails(null);
  };

  const stopAllIntervals = () => {
    console.log('Stopping all intervals');
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  };

  // Dedicated elapsed time updater that runs every second
  const startElapsedTimer = () => {
    try {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
      }

      elapsedIntervalRef.current = setInterval(() => {
        try {
          if (startTimeRef.current && statusRef.current === 'running') {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setElapsedTime(elapsed);
          }
        } catch (timerError) {
          console.error('Error in elapsed timer:', timerError);
        }
      }, 1000);
    } catch (initError) {
      console.error('Error initializing elapsed timer:', initError);
    }
  };

  const startProgressAnimation = () => {
    console.log('Starting progress animation as fallback');
    let animationProgress = Math.max(5, progress); // Start from current progress or minimum 5%

    animationIntervalRef.current = setInterval(() => {
      // Only increment if we haven't received real progress yet and we're still running
      if (animationProgress < 90 && statusRef.current === 'running') { // Cap at 90% as fallback
        animationProgress = Math.min(90, animationProgress + 2); // 2% per second - much more visible
        setProgress(animationProgress);
        setProgressKey(prev => prev + 1);
        setCurrentPhase(`Processing charts... (${Math.round(animationProgress)}%)`);
        console.log(`Animation: ${animationProgress}%`);
      }
    }, 1000); // Update every 1 second for responsive feedback
  };

  const pollProgress = async (runId: string) => {
    console.log('Starting progress polling for run:', runId);

    // Clear any existing polling interval first
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    let pollCount = 0;
    const maxPolls = 60; // Allow more time (2 minutes)
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    pollIntervalRef.current = setInterval(async () => {
      pollCount++;

      // Failsafe: if too many polls or consecutive errors, assume stuck
      if (pollCount > maxPolls) {
        console.error('Polling timeout reached, forcing error state');
        stopAllIntervals();
        if (statusRef.current === 'running') {
          setStatus('error');
          setError('Process timeout - may still be running on server');
          setRunId(null);
          runIdRef.current = null;
        }
        return;
      }

      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error('Too many consecutive errors, assuming network issues');
        stopAllIntervals();
        if (statusRef.current === 'running') {
          setStatus('error');
          setError(`Network connectivity issues in ${navigator.userAgent.includes('Chrome') ? 'Chrome' : 'browser'}`);
          setRunId(null);
          runIdRef.current = null;
        }
        return;
      }

      // Failsafe: ensure progress keeps moving even if backend fails
      if (pollCount > 5 && statusRef.current === 'running' && !animationIntervalRef.current) {
        console.log('Backend polling seems stuck, starting animation as fallback');
        startProgressAnimation();
      }
      // Check current state using refs to avoid stale closures
      if (cancelFlagRef.current || isCompleted || statusRef.current === 'done' || statusRef.current === 'error' || statusRef.current === 'idle') {
        console.log('Polling stopped - cancelled or completed:', {
          cancelled: cancelFlagRef.current,
          completed: isCompleted,
          status: statusRef.current,
          runId: runIdRef.current
        });
        stopAllIntervals();
        return;
      }

      // Don't poll if we don't have a run ID
      if (!runIdRef.current) {
        console.log('Polling stopped - no run ID');
        stopAllIntervals();
        return;
      }

      try {
        if (!runIdRef.current) {
          console.log('Polling stopped - runIdRef is null');
          stopAllIntervals();
          return;
        }

        console.log('Polling progress for run:', runIdRef.current, 'at', new Date().toISOString());
        console.log('Browser environment:', {
          userAgent: navigator.userAgent,
          isChrome: navigator.userAgent.includes('Chrome'),
          url: window.location.href
        });

        const progressData = await trainingChartGeneratorApi.getProgress(runIdRef.current);
        console.log('Progress API call succeeded');
        consecutiveErrors = 0; // Reset error counter on success

        // Log progressData keys once to verify backend response shape
        console.log('progressData keys', Object.keys(progressData), progressData);

        // Support multiple possible field names robustly
        const progressDataAny = progressData as any;
        const pct = progressData.percent ?? progressDataAny.progress ?? progressDataAny.pct ?? progressDataAny.percentage;
        const phase = progressData.phase ?? progressDataAny.stage ?? progressDataAny.status;
        const elapsed = progressData.elapsed_s ?? progressDataAny.elapsed ?? progressDataAny.elapsedSeconds;

        // Only update progress if we're still running (check current status from ref)
        // IMPORTANT: Never update progress if status is already 'done' - prevents flickering
        if (statusRef.current === 'running') {
          // Check if we have valid real progress data from backend
          if (progressData && typeof pct === 'number' && !isNaN(pct)) {
            const realProgress = Math.max(0, Math.min(100, pct));
            console.log(`Using REAL backend progress: ${realProgress}% (was ${progress}%), phase: ${phase}`);

            // Stop animation since we have real data
            if (animationIntervalRef.current) {
              clearInterval(animationIntervalRef.current);
              animationIntervalRef.current = null;
              console.log('Stopped progress animation, using real backend data');
            }

            // Only update if the real progress is actually different from current
            if (Math.abs(realProgress - progress) > 1) { // Only update if difference > 1%
              setProgress(realProgress);
              setProgressKey(prev => prev + 1);
              console.log(`Updated progress to ${realProgress}% from backend`);
            }

            setProgress(realProgress);
            setProgressKey(prev => prev + 1);
            setCurrentPhase(phase || 'Processing...');

            // Use backend elapsed time if available, but only if significantly different
            if (typeof elapsed === 'number' && elapsed > 0) {
              const currentElapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
              // Only update if backend time is significantly different (>5 seconds)
              if (Math.abs(elapsed - currentElapsed) > 5) {
                console.log(`Updating elapsed time from backend: ${elapsed}s (was ${currentElapsed}s)`);
                setElapsedTime(Math.floor(elapsed));
                // Reset startTime to maintain consistency
                if (startTimeRef.current) {
                  startTimeRef.current = Date.now() - (elapsed * 1000);
                }
              }
            }

            console.log('Applied real backend progress data');
          } else {
            console.log('No valid backend progress data, ensuring animation is running');
            // Start animation if it's not already running and we're still processing
            if (!animationIntervalRef.current && statusRef.current === 'running') {
              startProgressAnimation();
            }
          }

          // Additional failsafe: if progress hasn't moved in a while and we're still running, restart animation
          if (statusRef.current === 'running' && progress < 10 && !animationIntervalRef.current) {
            console.log('Progress stuck below 10%, restarting animation as failsafe');
            startProgressAnimation();
          }
        } else if (statusRef.current === 'done') {
          // If we're already done, don't update progress even if backend sends data
          console.log('Ignoring progress update - status is already done');
        }

        if (phase === 'done' && statusRef.current !== 'done') {
          console.log('Generation completed - stopping all intervals and updating UI');

          // Store the runId before clearing it
          const completedRunId = runIdRef.current;

          // IMMEDIATELY stop ALL intervals and animations
          stopAllIntervals();

          // IMMEDIATELY update UI state to completion
          setProgress(100);
          setProgressKey(prev => prev + 1);
          setCurrentPhase('Generation completed!');
          setStatus('done');
          setRunId(null); // Clear runId to allow new runs
          setIsCompleted(true); // Prevent any further status changes

          // Update refs immediately to prevent race conditions
          statusRef.current = 'done';
          runIdRef.current = null;

          console.log('UI state updated to completed, status:', statusRef.current);

          // Fetch final stats once using the stored runId
          if (completedRunId) {
            try {
              const artifacts = await trainingChartGeneratorApi.getArtifacts(completedRunId);
              setDatasetStats(artifacts);
              console.log('Successfully loaded dataset stats:', artifacts);
            } catch (statsErr) {
              console.warn('Could not fetch dataset stats:', statsErr);
              // Don't set error state - artifacts are optional, generation succeeded
              // Just log the warning and continue with download availability
              console.log('Continuing without dataset stats - download still available');
              setDatasetStats({ total_charts: 'Unknown', symbols_count: 'Unknown' }); // Fallback
            }
          }

          return; // Stop polling immediately
        } else if (phase === 'error' && statusRef.current !== 'error') {
          console.log('Generation failed:', progressData.error_message);
          stopAllIntervals();
          setStatus('error');
          setRunId(null); // Clear runId to allow new runs

          // Update refs immediately
          statusRef.current = 'error';
          runIdRef.current = null;

          setError(progressData.error_message || 'Generation failed');
          setErrorDetails({
            type: 'generation_error',
            message: 'Chart generation process failed',
            details: progressData.error_message || 'Unknown error during generation',
            phase: phase,
            progress: pct
          });

          return; // Stop polling immediately
        }
      } catch (err) {
        consecutiveErrors++; // Increment error counter
        console.warn('Progress polling error:', err);
        console.warn('Consecutive errors:', consecutiveErrors, 'of', maxConsecutiveErrors);
        console.warn('Error occurred in browser:', navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other');

        // Check if it's a network/CORS error that happens in Chrome but not Cursor
        const isNetworkError = err instanceof Error &&
          (err.message.includes('fetch') ||
           err.message.includes('network') ||
           err.message.includes('CORS') ||
           err.message.includes('Failed to fetch'));

        if (isNetworkError) {
          console.warn('Network error detected - this may be browser-specific (Chrome vs Cursor)');
          // Don't fail immediately on network errors - they might be temporary
          return;
        }

        // Only set error if we're still in a running state and it's not a network issue
        if ((status as Status) === 'running') {
          stopAllIntervals();
          setStatus('error');
          setError('Lost connection to generation process');
          setErrorDetails({
            type: 'connection_error',
            message: 'Lost connection to backend during generation',
            details: err instanceof Error ? err.message : String(err),
            browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'
          });
        }
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleDownload = async () => {
    if (!runId) return;

    try {
      await trainingChartGeneratorApi.download(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleRunAgain = () => {
    handleGenerate();
  };

  const handleForceReset = () => {
    console.log('Force resetting stuck run');
    cancelFlagRef.current = true;
    stopAllIntervals();

    setStatus('idle');
    setProgress(0);
    setProgressKey(prev => prev + 1);
    setCurrentPhase('');
    setElapsedTime(0);
    setRunId(null);
    setDatasetStats(null);
    setError(null);
    setErrorDetails(null);
    setIsCancelling(false);
    setShowForceReset(false);
    setIsCompleted(false); // Reset completion flag

    // Update refs immediately
    statusRef.current = 'idle';
    runIdRef.current = null;
    cancelFlagRef.current = false;

    if (runId) {
      useRunsStore.getState().registerRun(runId, 'training-chart-generator', 'cancelled');
    }
  };

  // Check for existing active runs on page load
  useEffect(() => {
    const checkExistingRuns = () => {
      try {
      const activeRuns = useRunsStore.getState().activeRunIds;
      const runsById = useRunsStore.getState().runsById;

      // Find any active training-chart-generator runs
      const activeGeneratorRun = activeRuns.find(runId => {
        const run = runsById[runId];
        return run && run.tool === 'training-chart-generator';
      });

      if (activeGeneratorRun && runsById[activeGeneratorRun]) {
        const run = runsById[activeGeneratorRun];

        // Defensive checks for run object properties
        if (!run || typeof run !== 'object') {
          console.error('Invalid run object:', run);
          return;
        }

        const runStatus = run.status === 'running' ? 'running' :
                          run.status === 'succeeded' ? 'done' :
                          run.status === 'failed' ? 'error' : 'idle';

        // Only update if status has actually changed or if we're initializing
        if (status !== runStatus || !runId) {
          setRunId(run.id || null);
          setStatus(runStatus);
          setProgress((run.progress || 0) * 100);

        // Validate run with backend before resuming polling
        if (run.status === 'running' && !pollIntervalRef.current) {
          console.log('Found running run in localStorage:', run.id, '- validating with backend');

          // Check if this run actually exists and is still running on the backend
          trainingChartGeneratorApi.getProgress(run.id)
            .then(progressData => {
              console.log('Backend validation successful for run:', run.id, progressData);

              // Check if backend shows it's still running
              const backendPhase = progressData.phase || progressData.status;
              if (backendPhase === 'done' || backendPhase === 'error' || backendPhase === 'cancelled') {
                console.log('Backend shows run is completed, clearing local state:', run.id);
                useRunsStore.getState().registerRun({
                  id: run.id,
                  tool: 'training-chart-generator',
                  status: backendPhase === 'done' ? 'succeeded' : 'failed',
                  progress: 100,
                  stage: backendPhase,
                  message: `Run ${backendPhase} on backend`,
                });
                return;
              }

              // Run is still active on backend, resume polling
              console.log('Backend confirms run is still active, resuming polling:', run.id);
              startTimeRef.current = Date.now() - ((run.progress || 0) * 100 * 1000);
              pollProgress(run.id);
              startElapsedTimer();
            })
            .catch(error => {
              console.warn('Backend validation failed for run:', run.id, error);

              // If backend doesn't recognize the run, assume it's stale and clear it
              console.log('Clearing stale run from localStorage:', run.id);
              useRunsStore.getState().registerRun({
                id: run.id,
                tool: 'training-chart-generator',
                status: 'failed',
                progress: 0,
                stage: 'stale',
                message: 'Run not found on backend - cleared stale state',
              });
            });
        }
        }
      } else if (runId && !activeGeneratorRun) {
        // No active run found, reset state
        console.log('No active generator run found, resetting state');
        stopAllIntervals();
        setStatus('idle');
        setProgress(0);
        setRunId(null);
        setDatasetStats(null);
      }
      } catch (error) {
        console.error('Error checking existing runs:', error);
      }
    };

    // Check immediately and also listen for changes
    checkExistingRuns();

    // Check immediately and also listen for changes
    checkExistingRuns();

    // Listen for run updates
    const unsubscribe = useRunsStore.subscribe((state) => {
      checkExistingRuns();
    });

    return unsubscribe;
  }, []);

  // Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      stopAllIntervals();
    };
  }, []);

  const InputPanel = (
    <div className="space-y-5">
      <div>
        <label className="block text-sm text-[#F5F7FF]/62 mb-2">
          Symbols <span className="text-[#22D3EE]">*</span>
        </label>
        <input
          type="text"
          value={config?.symbols || ''}
          onChange={(e) => setConfig({ ...config, symbols: e.target.value.toUpperCase() })}
          className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] placeholder-[#F5F7FF]/40 focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
          placeholder="AAPL,MSFT,GOOGL,AMZN"
        />
        <p className="text-xs text-[#F5F7FF]/50 mt-1">Comma-separated stock symbols</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#F5F7FF]/62 mb-2">
            Charts per Label <span className="text-[#22D3EE]">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={config?.chartsPerLabel || 1000}
            onChange={(e) => setConfig({ ...config, chartsPerLabel: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] placeholder-[#F5F7FF]/40 focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
          />
          <p className="text-xs text-[#F5F7FF]/50 mt-1">Per symbol, per label (0/1)</p>
        </div>
        <div>
          <label className="block text-sm text-[#F5F7FF]/62 mb-2">
            Chart Type <span className="text-[#22D3EE]">*</span>
          </label>
          <select
            value={config.useCandles ? 'candles' : 'line'}
            onChange={(e) => setConfig({ ...config, useCandles: e.target.value === 'candles' })}
            className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
          >
            <option value="candles">Candlestick</option>
            <option value="line">Line Chart</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#F5F7FF]/62 mb-2">
            Timeframe <span className="text-[#22D3EE]">*</span>
          </label>
          <select
            value={config.timeframe}
            onChange={(e) => setConfig({ ...config, timeframe: e.target.value as '1d' | '1wk' | '1mo' })}
            className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
          >
            <option value="1d">Daily (1d)</option>
            <option value="1wk">Weekly (1wk)</option>
            <option value="1mo">Monthly (1mo)</option>
          </select>
        </div>
      <div>
          <label className="block text-sm text-[#F5F7FF]/62 mb-2">
            Timespan Unit <span className="text-[#22D3EE]">*</span>
          </label>
        <input
          type="text"
            value={config.timespanUnit}
            onChange={(e) => setConfig({ ...config, timespanUnit: e.target.value })}
            className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] placeholder-[#F5F7FF]/40 focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
            placeholder="months"
          />
          <p className="text-xs text-[#F5F7FF]/50 mt-1">e.g., months, weeks, days</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#F5F7FF]/62 mb-2">
            Timespan Count <span className="text-[#22D3EE]">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={config.timespanCount}
            onChange={(e) => setConfig({ ...config, timespanCount: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] placeholder-[#F5F7FF]/40 focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
          />
          <p className="text-xs text-[#F5F7FF]/50 mt-1">How many units for chart window</p>
        </div>
        <div>
          <label className="block text-sm text-[#F5F7FF]/62 mb-2">
            Future Horizon (bars) <span className="text-[#22D3EE]">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={config.horizonBars}
            onChange={(e) => setConfig({ ...config, horizonBars: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] placeholder-[#F5F7FF]/40 focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
          />
          <p className="text-xs text-[#F5F7FF]/50 mt-1">Trading bars to look forward (7 recommended)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#F5F7FF]/62 mb-2">
            Take Profit (fraction) <span className="text-[#22D3EE]">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.001"
            max="1"
            value={config.takeProfitFraction}
            onChange={(e) => setConfig({ ...config, takeProfitFraction: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] placeholder-[#F5F7FF]/40 focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
            placeholder="0.02"
          />
          <p className="text-xs text-[#F5F7FF]/50 mt-1">Profit target as fraction (0.02 = 2%)</p>
        </div>
        <div>
          <label className="block text-sm text-[#F5F7FF]/62 mb-2">
            Stop Loss (fraction) <span className="text-[#22D3EE]">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.001"
            max="1"
            value={config.stopLossFraction}
            onChange={(e) => setConfig({ ...config, stopLossFraction: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] placeholder-[#F5F7FF]/40 focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
            placeholder="0.01"
          />
          <p className="text-xs text-[#F5F7FF]/50 mt-1">Loss limit as fraction (0.01 = 1%)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
      <div>
          <label className="block text-sm text-[#F5F7FF]/62 mb-2">
            Image Dimension <span className="text-[#22D3EE]">*</span>
          </label>
        <select
            value={config.imageDimension}
            onChange={(e) => setConfig({ ...config, imageDimension: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
          >
            <option value="128">128x128</option>
            <option value="224">224x224 (CNN standard)</option>
            <option value="256">256x256</option>
            <option value="512">512x512</option>
        </select>
          <p className="text-xs text-[#F5F7FF]/50 mt-1">Square image size for CNN input</p>
        </div>
        <div>
          <label className="block text-sm text-[#F5F7FF]/62 mb-2">
            End Offset <span className="text-[#22D3EE]">*</span>
          </label>
          <input
            type="number"
            min="0"
            value={config.endOffset}
            onChange={(e) => setConfig({ ...config, endOffset: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-[#070815]/60 border border-white/8 rounded-lg text-[#F5F7FF] placeholder-[#F5F7FF]/40 focus:border-[#7C5CFF]/50 focus:ring-1 focus:ring-[#7C5CFF]/50"
            placeholder="1"
          />
          <p className="text-xs text-[#F5F7FF]/50 mt-1">Charts end N timeframe units ago</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#FF4FD8]/10 border border-[#FF4FD8]/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#FF4FD8] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-[#FF4FD8] mb-2">
                {errorDetails?.type === 'network_error' ? 'Connection Error' :
                 errorDetails?.type === 'stats_error' ? 'Statistics Error' :
                 errorDetails?.type === 'generation_error' ? 'Generation Error' :
                 errorDetails?.type === 'connection_error' ? 'Connection Lost' :
                 'Error'}
              </h4>
              <p className="text-sm text-[#F5F7FF]/80 mb-2">{error}</p>
              {errorDetails && (
                <details className="text-xs text-[#F5F7FF]/60">
                  <summary className="cursor-pointer hover:text-[#F5F7FF]/80">Show technical details</summary>
                  <div className="mt-2 p-2 bg-[#070815]/60 rounded border border-white/5 font-mono">
                    {errorDetails.type && <div>Type: {errorDetails.type}</div>}
                    {errorDetails.phase && <div>Phase: {errorDetails.phase}</div>}
                    {errorDetails.progress !== undefined && <div>Progress: {errorDetails.progress}%</div>}
                    {errorDetails.details && (
                      <div className="mt-1 whitespace-pre-wrap break-all">
                        Details: {errorDetails.details}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
      <button
        onClick={handleGenerate}
          disabled={status === 'running' || isCancelling}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] hover:shadow-lg hover:shadow-[#7C5CFF]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'running' ? 'Generating Dataset...' : isCancelling ? 'Cancelling...' : 'Generate Dataset'}
        </button>

        {status === 'running' && !isCancelling && (
          <>
            <button
              onClick={() => {
                console.log('Cancel button clicked, status:', status, 'runId:', runId, 'isCancelling:', isCancelling);
                if (runId && status === 'running') {
                  handleCancel();
                } else {
                  console.log('Cancel conditions not met');
                }
              }}
              className="px-6 py-3 bg-transparent border border-[#FF4FD8]/50 text-[#FF4FD8] font-medium rounded-lg hover:bg-[#FF4FD8]/10 hover:border-[#FF4FD8] transition-all duration-200 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            {showForceReset && (
              <button
                onClick={handleForceReset}
                className="px-4 py-2 bg-transparent border border-orange-500/50 text-orange-400 text-sm font-medium rounded-lg hover:bg-orange-500/10 hover:border-orange-500 transition-all duration-200"
                title="Force reset UI if stuck"
              >
                Force Reset
              </button>
            )}
          </>
        )}

        {isCancelling && (
          <div className="px-6 py-3 bg-[#FF4FD8]/20 border border-[#FF4FD8]/50 text-[#FF4FD8] font-medium rounded-lg flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#FF4FD8] border-t-transparent rounded-full animate-spin" />
            Cancelling...
          </div>
        )}

        {/* Clear Stale Runs button - shows when there's a runId but status is not running */}
        {runId && status !== 'running' && status !== 'idle' && (
          <button
            onClick={() => {
              console.log('Clearing stale run:', runId);
              useRunsStore.getState().registerRun({
                id: runId,
                tool: 'training-chart-generator',
                status: 'failed',
                progress: 0,
                stage: 'cleared',
                message: 'Manually cleared stale run state',
              });
              setRunId(null);
              setStatus('idle');
              setProgress(0);
              setCurrentPhase('');
              setElapsedTime(0);
              setDatasetStats(null);
              setError(null);
              setErrorDetails(null);
              setIsCancelling(false);
              setShowForceReset(false);
            }}
            className="px-4 py-2 bg-transparent border border-red-500/50 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500/10 hover:border-red-500 transition-all duration-200"
            title="Clear stuck run state"
          >
            Clear Stale Run
          </button>
        )}
      </div>
    </div>
  );

  const OutputPanel = (
    <div className="space-y-6">
      {/* Status Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === 'idle' ? 'bg-[#070815] text-[#F5F7FF]/62' :
            status === 'running' ? 'bg-[#7C5CFF]/20 text-[#7C5CFF]' :
            status === 'done' ? 'bg-[#22D3EE]/20 text-[#22D3EE]' :
            'bg-[#FF4FD8]/20 text-[#FF4FD8]'
          }`}>
            {status === 'idle' ? 'Ready' :
             status === 'running' ? 'Running' :
             status === 'done' ? 'Complete' : 'Failed'}
          </div>
          {status === 'running' && (
            <span className="text-sm text-[#F5F7FF]/62">
              {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')} elapsed
            </span>
          )}
        </div>
      </div>

      {status === 'idle' && (
        <div className="text-center py-12">
          <div className="text-[#F5F7FF]/62 text-sm">
            Configure parameters and run the tool to see output here.
          </div>
        </div>
      )}

      {status === 'running' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[#F5F7FF]/80 text-sm font-medium">
              {currentPhase || 'Initializing...'}
            </div>
            <div className="text-[#F5F7FF]/62 text-xs">
              {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
            </div>
          </div>

          <div className="w-full bg-[#070815]/60 rounded-full h-3">
            <div
              key={progressKey}
              className="bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-[#F5F7FF]/62">
              {Math.round(progress)}% complete
            </div>
            {runId && (
              <div className="text-[#F5F7FF]/40 text-xs font-mono">
                ID: {runId.slice(-8)}
              </div>
            )}
          </div>

          {progress === 0 && elapsedTime > 10 && (
            <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[#F5F7FF]/80">
                  <div className="font-medium text-[#F59E0B] mb-1">Still starting up...</div>
                  <div>This may take a moment. The backend is initializing the chart generation process.</div>
                </div>
              </div>
            </div>
          )}

          {progress > 0 && progress < 5 && elapsedTime > 30 && (
            <div className="p-3 bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-[#3B82F6] border-t-transparent animate-spin flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[#F5F7FF]/80">
                  <div className="font-medium text-[#3B82F6] mb-1">Processing data...</div>
                  <div>Downloading market data and preparing chart generation. This step can take several minutes.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'done' && datasetStats && (
        <div className="space-y-6">
          {/* Dataset Summary */}
          <div className="bg-[#070815]/60 border border-white/8 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[#F5F7FF] mb-3">Dataset Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[#F5F7FF]/62">Symbols:</span>
                <span className="text-[#F5F7FF] ml-2">{config?.symbols?.split(',').length || 0}</span>
              </div>
              <div>
                <span className="text-[#F5F7FF]/62">Timeframe:</span>
                <span className="text-[#F5F7FF] ml-2">{config.timeframe}</span>
              </div>
              <div>
                <span className="text-[#F5F7FF]/62">Total Charts:</span>
                <span className="text-[#F5F7FF] ml-2">{datasetStats?.total_charts || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-[#F5F7FF]/62">Chart Type:</span>
                <span className="text-[#F5F7FF] ml-2">{config.useCandles ? 'Candlestick' : 'Line'}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
          <button
            onClick={handleDownload}
              className="w-full px-4 py-3 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] hover:shadow-lg hover:shadow-[#7C5CFF]/25 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download ZIP
          </button>

            <button
              onClick={handleRunAgain}
              className="w-full px-4 py-3 bg-transparent border border-white/18 text-[#F5F7FF] font-medium rounded-lg hover:border-[#7C5CFF]/55 hover:bg-[#7C5CFF]/8 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Run Another Iteration
            </button>

            <Link to="/tools/trainer" className="block">
              <button className="w-full px-4 py-3 bg-transparent border border-white/18 text-[#F5F7FF] font-medium rounded-lg hover:border-[#7C5CFF]/55 hover:bg-[#7C5CFF]/8 transition-all duration-200 flex items-center justify-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Continue to Trainer
              </button>
            </Link>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="bg-[#FF4FD8]/10 border border-[#FF4FD8]/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#FF4FD8] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#FF4FD8] mb-2">Generation Failed</h3>
                <p className="text-sm text-[#F5F7FF]/80 mb-2">{error}</p>
                {errorDetails && (
                  <details className="text-xs text-[#F5F7FF]/60">
                    <summary className="cursor-pointer hover:text-[#F5F7FF]/80">Show technical details</summary>
                    <div className="mt-2 p-2 bg-[#070815]/60 rounded border border-white/5 font-mono">
                      {errorDetails.type && <div>Error Type: {errorDetails.type}</div>}
                      {errorDetails.phase && <div>Last Phase: {errorDetails.phase}</div>}
                      {errorDetails.progress !== undefined && <div>Progress: {errorDetails.progress}%</div>}
                      {errorDetails.details && (
                        <div className="mt-1 whitespace-pre-wrap break-all">
                          Details: {errorDetails.details}
                        </div>
                      )}
                      {runId && <div>Run ID: {runId}</div>}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setStatus('idle');
                setError(null);
                setErrorDetails(null);
              }}
              className="flex-1 px-4 py-3 bg-transparent border border-white/18 text-[#F5F7FF] font-medium rounded-lg hover:border-[#7C5CFF]/55 hover:bg-[#7C5CFF]/8 transition-all duration-200"
            >
              Try Again
            </button>
            {runId && (
              <button
                onClick={() => {
                  // Reset everything
                  setStatus('idle');
                  setProgress(0);
                  setCurrentPhase('');
                  setElapsedTime(0);
                  setRunId(null);
                  setDatasetStats(null);
                  setError(null);
                  setErrorDetails(null);
                  setIsCancelling(false);
                  cancelFlagRef.current = false;
                  if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                  }
                }}
                className="px-4 py-3 bg-transparent border border-white/18 text-[#F5F7FF]/60 font-medium rounded-lg hover:border-[#F5F7FF]/40 hover:text-[#F5F7FF]/80 transition-all duration-200"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="Generator"
      description="Create labeled candlestick chart datasets at scale for training visual market models."
      inputPanel={InputPanel}
      outputPanel={OutputPanel}
    />
  );
}
