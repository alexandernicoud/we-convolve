import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, RotateCcw, Zap, TrendingUp, Target, Award, BarChart3 } from "lucide-react";
import { backtesterApi, API_BASE } from "@/lib/api";

interface BacktesterKPI {
  trades: number;
  pnl: number;
  accuracy: number;
  precision: number;
  recall: number;
  sample_size: number;
  buy_and_hold?: number;
}

interface BacktesterResult {
  kpis: BacktesterKPI;
  charts: Record<string, string>;
  download_zip_url: string;
}

export default function BacktesterResults() {
  const { runId } = useParams<{ runId: string }>();

  const [result, setResult] = useState<BacktesterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    status: string;
    progress: number;
    stage: string;
    message: string;
  } | null>(null);

    // Force a simple render first to test if component mounts
    console.log('BacktesterResults: About to render, state:', { loading, error, result: !!result, status: !!status, runId });

  // If we have results, show the normal component
  if (result && status && !loading) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#F5F7FF]">Backtester Results</h1>
            <p className="text-[#F5F7FF]/70">Analysis of trading strategy performance</p>
          </div>

          {/* Download Button */}
          <button
            onClick={() => backtesterApi.downloadZip(runId!)}
            className="px-4 py-2 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Full Report
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#0A0B14]/80 border border-[#7C5CFF]/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#F5F7FF]/60 text-sm">Total Trades</p>
                <p className="text-2xl font-bold text-[#F5F7FF]">{result.kpis?.trades || 0}</p>
              </div>
              <Target className="w-8 h-8 text-[#7C5CFF]" />
            </div>
          </div>

          <div className="bg-[#0A0B14]/80 border border-[#7C5CFF]/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#F5F7FF]/60 text-sm">Total P&L</p>
                <p className={`text-2xl font-bold ${result.kpis?.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${result.kpis?.pnl?.toFixed(2) || '0.00'}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-[#7C5CFF]" />
            </div>
          </div>

          <div className="bg-[#0A0B14]/80 border border-[#7C5CFF]/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#F5F7FF]/60 text-sm">Win Rate</p>
                <p className="text-2xl font-bold text-[#F5F7FF]">{result.kpis?.win_rate?.toFixed(1) || 0}%</p>
              </div>
              <Award className="w-8 h-8 text-[#7C5CFF]" />
            </div>
          </div>

          <div className="bg-[#0A0B14]/80 border border-[#7C5CFF]/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#F5F7FF]/60 text-sm">Sharpe Ratio</p>
                <p className={`text-2xl font-bold ${result.kpis?.sharpe_ratio >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {result.kpis?.sharpe_ratio?.toFixed(2) || '0.00'}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-[#7C5CFF]" />
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {result.charts && Object.keys(result.charts).length > 0 && (
          <div className="bg-[#0A0B14]/80 border border-[#7C5CFF]/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-[#F5F7FF] mb-6">Performance Charts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(result.charts).map(([chartName, chartUrl]) => (
                <div key={chartName} className="bg-[#070815] rounded-lg p-4">
                  <h3 className="text-[#F5F7FF] font-medium mb-2 capitalize">
                    {chartName.replace(/_/g, ' ')}
                  </h3>
                  <img
                    src={backtesterApi.getChart(runId!, `${chartName}.png`)}
                    alt={`${chartName} chart`}
                    className="w-full h-64 object-contain rounded"
                    onError={(e) => {
                      console.error(`Failed to load chart: ${chartName}`);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Run Another Test Button */}
        <div className="flex justify-center gap-4">
          <Link to="/tools/backtester">
            <button className="px-6 py-3 border border-[rgba(139,92,246,0.18)] text-[#E9ECFF] font-medium rounded-lg hover:border-[rgba(59,130,246,0.28)] hover:bg-[rgba(59,130,246,0.08)] transition-all duration-200 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Run Another Backtest
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C5CFF] mx-auto mb-4"></div>
          <p className="text-[#F5F7FF]/70">Loading backtester results...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-red-400 mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-[#F5F7FF] mb-2">Error Loading Results</h2>
          <p className="text-[#F5F7FF]/70">{error}</p>
        </div>
      </div>
    );
  }

  // Show no data state
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="text-red-400 mb-4">📊</div>
        <h2 className="text-xl font-semibold text-[#F5F7FF] mb-2">No Results Available</h2>
        <p className="text-[#F5F7FF]/70">Backtester results could not be loaded.</p>
      </div>
    </div>
  );

  useEffect(() => {
    if (!runId) return;

    // Start polling for status
    const pollStatus = async () => {
      try {
        const statusData = await backtesterApi.getStatus(runId);
        setStatus(statusData);

        if (statusData.status === 'done') {
          // Load results
          const resultData = await backtesterApi.getResult(runId);
          setResult(resultData);
          hasResultsRef.current = true;
          setLoading(false);
        }
      } catch (err) {
        setError(`Failed to fetch status: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    let pollCount = 0;
    const maxPolls = 30; // Stop polling after 30 attempts (60 seconds)
    const hasResultsRef = useRef(false);

    const doPoll = async () => {
      pollCount++;

      if (pollCount > maxPolls) {
        setError('Timeout: Could not load backtester results after 60 seconds');
        setLoading(false);
        return;
      }

      if (hasResultsRef.current) {
        return;
      }

      await pollStatus();
    };

    // Initial poll
    doPoll();

    // Set up polling interval
    const pollInterval = setInterval(doPoll, 2000);

    return () => clearInterval(pollInterval);
  }, [runId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading && !status) {
    return (
      <div className="min-h-screen bg-[#070812] relative overflow-hidden">
        <div className="relative pt-24 pb-16">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[rgba(139,92,246,0.18)] border-t-[rgba(59,130,246,0.28)] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[rgba(233,236,255,0.65)]">Loading backtest results...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#070812] relative overflow-hidden">
        <div className="relative pt-24 pb-16">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-xl p-8">
              <h1 className="text-xl font-semibold text-[#E9ECFF] mb-4">Backtest Error</h1>
              <p className="text-[rgba(233,236,255,0.65)] mb-6">{error}</p>
              <Link to="/tools/backtester">
                <button className="px-6 py-3 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] transition-all duration-200">
                  Back to Backtester
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status && status.status !== 'done') {
    return (
      <div className="min-h-screen bg-[#070812] relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-96 h-96 bg-[rgba(59,130,246,0.18)] rounded-full blur-3xl"></div>
          <div className="absolute top-40 right-20 w-80 h-80 bg-[rgba(139,92,246,0.18)] rounded-full blur-3xl"></div>
        </div>

        <div className="relative pt-24 pb-16">
          <div className="max-w-4xl mx-auto px-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <Link to="/tools/backtester">
                <button className="p-2 bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg hover:border-[rgba(59,130,246,0.28)] transition-all duration-200">
                  <ArrowLeft className="w-5 h-5 text-[#E9ECFF]" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-[#E9ECFF]">Backtest Results</h1>
                <p className="text-[rgba(233,236,255,0.65)] text-sm">Running backtest analysis...</p>
              </div>
            </div>

            {/* Progress Card */}
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-xl p-8">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-[rgba(139,92,246,0.18)] border-t-[rgba(59,130,246,0.28)] rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-medium text-[#E9ECFF] mb-2">{status.stage}</h2>
                <p className="text-[rgba(233,236,255,0.65)] mb-4">{status.message}</p>
                <div className="w-full bg-[rgba(0,0,0,0.18)] rounded-full h-2 mb-2">
                  <div
                    className="bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${status.progress * 100}%` }}
                  />
                </div>
                <p className="text-sm text-[rgba(233,236,255,0.5)]">{Math.round(status.progress * 100)}% complete</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-[#070812] relative overflow-hidden">
        <div className="relative pt-24 pb-16">
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-[rgba(233,236,255,0.65)]">Results not available yet...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070812] relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 opacity-25">
        <div className="absolute top-20 left-10 w-96 h-96 bg-[rgba(59,130,246,0.18)] rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-20 w-80 h-80 bg-[rgba(139,92,246,0.18)] rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-[rgba(236,72,153,0.12)] rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[rgba(139,92,246,0.08)] rounded-full blur-3xl"></div>
      </div>

      <div className="relative pt-24 pb-20">
        <div className="max-w-[1400px] mx-auto px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link to="/tools/backtester">
                <button className="p-2 bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg hover:border-[rgba(59,130,246,0.28)] transition-all duration-200">
                  <ArrowLeft className="w-5 h-5 text-[#E9ECFF]" />
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-[#E9ECFF]">Backtest Results</h1>
                <p className="text-[rgba(233,236,255,0.65)] text-sm">Analysis complete • {result.kpis?.sample_size || 0} samples tested</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Link to="/tools/backtester">
                <button className="px-4 py-2 border border-[rgba(139,92,246,0.18)] text-[#E9ECFF] font-medium rounded-lg hover:border-[rgba(59,130,246,0.28)] hover:bg-[rgba(59,130,246,0.08)] transition-all duration-200 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Re-run
                </button>
              </Link>
              <button
                onClick={() => backtesterApi.downloadZip(runId)}
                className="px-4 py-2 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] transition-all duration-200 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download All
              </button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-12">
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-[#3B82F6]" />
                <span className="text-xs text-[rgba(233,236,255,0.65)] uppercase tracking-wider">Trades</span>
              </div>
              <div className="text-lg font-semibold text-[#E9ECFF]">{result.kpis?.trades || 0}</div>
            </div>

            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-xs text-[rgba(233,236,255,0.65)] uppercase tracking-wider">PnL</span>
              </div>
              <div className="text-lg font-semibold text-[#E9ECFF]">{formatCurrency(result.kpis?.pnl || 0)}</div>
            </div>

            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-[#EC4899]" />
                <span className="text-xs text-[rgba(233,236,255,0.65)] uppercase tracking-wider">Accuracy</span>
              </div>
              <div className="text-lg font-semibold text-[#E9ECFF]">{formatPercent(result.kpis?.accuracy || 0)}</div>
            </div>

            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-[#3B82F6]" />
                <span className="text-xs text-[rgba(233,236,255,0.65)] uppercase tracking-wider">Precision</span>
              </div>
              <div className="text-lg font-semibold text-[#E9ECFF]">{formatPercent(result.kpis?.precision || 0)}</div>
            </div>

            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-xs text-[rgba(233,236,255,0.65)] uppercase tracking-wider">Recall</span>
              </div>
              <div className="text-lg font-semibold text-[#E9ECFF]">{formatPercent(result.kpis?.recall || 0)}</div>
            </div>

            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 rounded bg-[rgba(236,72,153,0.2)]"></div>
                <span className="text-xs text-[rgba(233,236,255,0.65)] uppercase tracking-wider">Sample Size</span>
              </div>
              <div className="text-lg font-semibold text-[#E9ECFF]">{(result.kpis?.sample_size || 0).toLocaleString()}</div>
            </div>

            {result.kpis?.buy_and_hold && (
              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-[#EC4899]" />
                  <span className="text-xs text-[rgba(233,236,255,0.65)] uppercase tracking-wider">Buy & Hold</span>
                </div>
                <div className="text-lg font-semibold text-[#E9ECFF]">{formatCurrency(result.kpis?.buy_and_hold || 0)}</div>
              </div>
            )}

            {result.kpis?.win_rate !== undefined && (
              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-[#10B981]" />
                  <span className="text-xs text-[rgba(233,236,255,0.65)] uppercase tracking-wider">Win Rate</span>
                </div>
                <div className="text-lg font-semibold text-[#E9ECFF]">{formatPercent(result.kpis.win_rate)}</div>
              </div>
            )}

            {result.kpis?.profit_factor !== undefined && (
              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-xs text-[rgba(233,236,255,0.65)] uppercase tracking-wider">Profit Factor</span>
                </div>
                <div className="text-lg font-semibold text-[#E9ECFF]">{result.kpis.profit_factor === 0 ? 'N/A' : result.kpis.profit_factor.toFixed(2)}</div>
              </div>
            )}

            {result.kpis?.max_drawdown !== undefined && (
              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                  <span className="text-xs text-[rgba(233,236,255,0.65)] uppercase tracking-wider">Max Drawdown</span>
                </div>
                <div className="text-lg font-semibold text-[#E9ECFF]">{formatCurrency(result.kpis.max_drawdown)}</div>
              </div>
            )}
          </div>

          {/* Charts Dashboard */}
          <div className="space-y-8">
            {Object.keys(result.charts).map((chartName) => {
              const chartUrl = backtesterApi.getChart(runId, `${chartName}.svg`);
              return (
                <div key={chartName} className="bg-[rgba(255,255,255,0.02)] backdrop-blur-md border border-white/5 rounded-2xl shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_30px_80px_rgba(0,0,0,0.35)] p-6">
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-[rgba(233,236,255,0.65)] uppercase tracking-wider">
                      {chartName.replace(/_/g, ' ')}
                    </h3>
                  </div>
                  <div className="relative rounded-2xl overflow-hidden bg-black/30 border border-white/5">
                    <img
                      src={chartUrl}
                      alt={chartName}
                      className="w-full h-auto object-contain"
                      loading="lazy"
                    />
                    {/* Unifying overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[rgba(139,92,246,0.04)] via-[rgba(59,130,246,0.03)] to-[rgba(236,72,153,0.02)] mix-blend-screen pointer-events-none"></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="mt-16 pt-8 border-t border-[rgba(139,92,246,0.18)]">
            <div className="flex justify-center gap-4">
              <Link to="/tools/backtester">
                <button className="px-6 py-3 border border-[rgba(139,92,246,0.18)] text-[#E9ECFF] font-medium rounded-lg hover:border-[rgba(59,130,246,0.28)] hover:bg-[rgba(59,130,246,0.08)] transition-all duration-200 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Run Another Backtest
                </button>
              </Link>
              <Link to="/tools/trainer">
                <button className="px-6 py-3 border border-[rgba(139,92,246,0.18)] text-[#E9ECFF] font-medium rounded-lg hover:border-[rgba(59,130,246,0.28)] hover:bg-[rgba(59,130,246,0.08)] transition-all duration-200 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Train New Model
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
