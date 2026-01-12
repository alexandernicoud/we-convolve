export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001';

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export interface RunRequest {
  symbol: str;
  start: str;
  end: str;
}

export interface RunResponse {
  run_id: string;
}

export interface ProgressResponse {
  phase: string;
  percent: number;
  elapsed_s: number;
  step: number | null;
  total_steps: number | null;
  error_message?: string;
}

export interface ArtifactsResponse {
  artifacts: string[];
}

export interface TrainingChartGeneratorConfig {
  symbols: string;
  chartsPerLabel: number;
  useCandles: boolean;
  timeframe: '1d' | '1wk' | '1mo';
  timespanUnit: string;
  timespanCount: number;
  horizonBars: number;
  takeProfitFraction: number;
  stopLossFraction: number;
  imageDimension: number;
  endOffset: number;
}

export interface DatasetStats {
  total_charts?: number;
  symbols_count?: number;
  timeframe?: string;
  chart_type?: string;
}

export interface TrainerRunRequest {
  use_standard_config: boolean;
  folder_name?: string;
  dataset_id?: string;
  model_name: string;
  image_height?: number;
  image_width?: number;
  batch_size?: number;
  epochs?: number;
  val_split?: number;
  random_seed?: number;
}

export interface TrainerProgressResponse {
  status: string;
  progress: {
    phase: string;
    percent: number;
    message?: string;
  };
  last_metrics?: {
    loss?: number;
    accuracy?: number;
    val_loss?: number;
    val_accuracy?: number;
  };
  history_preview?: Array<{
    epoch: number;
    loss: number;
    accuracy: number;
    val_loss?: number;
    val_accuracy?: number;
  }>;
  error_message?: string;
}

export interface AnalysisResponse {
  analysis_id: string;
}

export interface AnalysisStatusResponse {
  status: string;
  progress: {
    phase: string;
    percent: number;
    message?: string;
  };
  generated_files?: string[];
  error_message?: string;
}

export interface BacktesterStartRequest {
  model_path?: string;
  model_id?: string;
  dataset_id?: string;
  chart_folder?: string;
  sample_size: string | number;
  confidence_threshold: number;
  tp_pct: number;
  sl_pct: number;
  img_size: number;
}

export interface BacktesterStatusResponse {
  status: string;
  progress: number;
  stage: string;
  message: string;
  live_metrics?: Record<string, any>;
}

export interface BacktesterResultResponse {
  kpis: Record<string, any>;
  charts: Record<string, string>;
  download_zip_url: string;
  csv_urls?: Record<string, string>;
  summary_url?: string;
}

export interface GlobalRun {
  id: string;
  tool: string;
  status: string;
  progress: number;
  stage: string;
  message: string;
  created_at: number;
  updated_at: number;
  route?: string;
  parent_run_id?: string;
}

export interface RunsState {
  runsById: Record<string, GlobalRun>;
  activeRunIds: string[];
  isPolling: boolean;
}

export interface RunsStore extends RunsState {
  refreshActiveRuns: () => Promise<void>;
  refreshRun: (runId: string) => Promise<void>;
  registerRun: (run: Omit<GlobalRun, 'created_at' | 'updated_at'>) => void;
  getRunRoute: (run: GlobalRun) => string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, `API request failed: ${errorText}`);
  }

  return response.json();
}

export const labelingOptimizerApi = {
  // Start a new labeling optimizer run
  async startRun(request: RunRequest): Promise<RunResponse> {
    return apiRequest<RunResponse>('/api/labeling-optimizer/run', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Get progress for a run
  async getProgress(runId: string): Promise<ProgressResponse> {
    return apiRequest<ProgressResponse>(`/api/labeling-optimizer/progress/${runId}`);
  },

  // List available artifacts for a run
  async listArtifacts(runId: string): Promise<ArtifactsResponse> {
    return apiRequest<ArtifactsResponse>(`/api/labeling-optimizer/runs/${runId}`);
  },

  // Get a specific artifact
  async getArtifact(runId: string, name: string): Promise<any> {
    return apiRequest<any>(`/api/labeling-optimizer/artifacts/${runId}/${name}`);
  },
};

export const trainerApi = {
  // Start a new trainer run
  async run(config: TrainerRunRequest): Promise<RunResponse> {
    return apiRequest<RunResponse>('/trainer/runs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  // Get progress for a run
  async getProgress(runId: string): Promise<TrainerProgressResponse> {
    return apiRequest<TrainerProgressResponse>(`/trainer/runs/${runId}`);
  },

  // Start analysis on a trained model
  async startAnalysis(runId: string, imgPath?: string): Promise<AnalysisResponse> {
    return apiRequest<AnalysisResponse>(`/trainer/runs/${runId}/analysis`, {
      method: 'POST',
      body: JSON.stringify({ img_path: imgPath }),
    });
  },

  // Get analysis status
  async getAnalysisStatus(runId: string, analysisId: string): Promise<AnalysisStatusResponse> {
    return apiRequest<AnalysisStatusResponse>(`/trainer/runs/${runId}/analysis/${analysisId}`);
  },

  // Download trained model
  downloadModel(runId: string): void {
    window.open(`${API_BASE}/trainer/runs/${runId}/download/model`, '_blank');
  },

  // Download analysis results
  downloadAnalysis(runId: string, analysisId: string): void {
    window.open(`${API_BASE}/trainer/runs/${runId}/analysis/${analysisId}/download`, '_blank');
  },
};

// Global runs API
export const runsApi = {
  getActiveRuns(): Promise<{ runs: GlobalRun[] }> {
    return apiRequest<{ runs: GlobalRun[] }>('/runs/active');
  },

  getRun(runId: string): Promise<GlobalRun> {
    return apiRequest<GlobalRun>(`/runs/${runId}`);
  },
};

// Backtester API
export const backtesterApi = {
  startRun(request: BacktesterStartRequest): Promise<{ run_id: string }> {
    return apiRequest<{ run_id: string }>('/runs/backtester/start', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  getStatus(runId: string): Promise<BacktesterStatusResponse> {
    return apiRequest<BacktesterStatusResponse>(`/runs/backtester/${runId}/status`);
  },

  getResult(runId: string): Promise<BacktesterResultResponse> {
    return apiRequest<BacktesterResultResponse>(`/runs/backtester/${runId}/result`);
  },

  getChart(runId: string, filename: string): string {
    return `${API_BASE}/runs/backtester/${runId}/charts/${filename}`;
  },

  downloadZip(runId: string): void {
    window.open(`${API_BASE}/runs/backtester/${runId}/download.zip`, '_blank');
  },
};

// Test Data Generator API
export interface TestDataGeneratorRequest {
  symbols: string;
  dataset_name: string;
  use_candles: boolean;
  timeframe: string;
  span_unit: string;
  span_units_count: number;
  future_horizon_bars: number;
  tp_frac: number;
  sl_frac: number;
  img_dim: number;
  period_length_units: number;
  end_offset_units: number;
  use_sma: boolean;
  sma_length: number;
  training_period_start?: string;
  training_period_end?: string;
  test_period_start?: string;
  test_period_end?: string;
}

export interface TestDataGeneratorStatusResponse {
  status: string;
  progress: number;
  stage: string;
  message: string;
  live_metrics?: Record<string, any>;
}

export interface TestDataGeneratorResultResponse {
  dataset_id: string;
  download_zip_url: string;
  summary: {
    total_images: number;
    label_distribution: Record<string, number>;
    start_date?: string;
    end_date?: string;
  };
}

export const testDataGeneratorApi = {
  startRun(request: TestDataGeneratorRequest): Promise<{ run_id: string }> {
    return apiRequest<{ run_id: string }>('/runs/testdata/start', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  getStatus(runId: string): Promise<TestDataGeneratorStatusResponse> {
    return apiRequest<TestDataGeneratorStatusResponse>(`/runs/testdata/${runId}/status`);
  },

  getResult(runId: string): Promise<TestDataGeneratorResultResponse> {
    return apiRequest<TestDataGeneratorResultResponse>(`/runs/testdata/${runId}/result`);
  },

  downloadZip(runId: string): void {
    window.open(`${API_BASE}/runs/testdata/${runId}/download.zip`, '_blank');
  },
};

export const trainingChartGeneratorApi = {
  // Start a new training chart generator run
  async run(config: TrainingChartGeneratorConfig): Promise<RunResponse> {
    return apiRequest<RunResponse>('/api/training-chart-generator/run', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  // Get progress for a run
  async getProgress(runId: string): Promise<ProgressResponse> {
    return apiRequest<ProgressResponse>(`/api/training-chart-generator/progress/${runId}`);
  },

  // List available artifacts for a run
  async getArtifacts(runId: string): Promise<DatasetStats> {
    return apiRequest<DatasetStats>(`/api/training-chart-generator/artifacts/${runId}`);
  },

  // Cancel a running generation
  async cancel(runId: string): Promise<{status: string, run_id: string}> {
    return apiRequest<{status: string, run_id: string}>(`/api/training-chart-generator/cancel/${runId}`, {
      method: 'POST',
    });
  },

  // Download the generated dataset ZIP
  async download(runId: string): Promise<void> {
    const url = `${API_BASE}/api/training-chart-generator/download/${runId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new ApiError(response.status, 'Download failed');
    }

    // Create download link
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `training-dataset-${runId}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};

// Utility functions
export function formatEta(elapsedSeconds: number, percentComplete: number): string {
  if (percentComplete <= 0) return 'Calculating...';

  const remainingPercent = Math.max(0, 100 - percentComplete);
  const etaSeconds = (elapsedSeconds * remainingPercent) / percentComplete;

  if (etaSeconds < 60) {
    return `${Math.ceil(etaSeconds)}s remaining`;
  } else if (etaSeconds < 3600) {
    const minutes = Math.floor(etaSeconds / 60);
    const seconds = Math.ceil(etaSeconds % 60);
    return `${minutes}m ${seconds}s remaining`;
  } else {
    const hours = Math.floor(etaSeconds / 3600);
    const minutes = Math.floor((etaSeconds % 3600) / 60);
    return `${hours}h ${minutes}m remaining`;
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secondsRemain = Math.floor(seconds % 60);
    return `${minutes}m ${secondsRemain}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}
