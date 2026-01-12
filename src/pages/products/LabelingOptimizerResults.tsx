import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Plot from "react-plotly.js";
import { labelingOptimizerApi } from "@/lib/api";

// Helper function to resolve metrics filename
function resolveMetricsFilename(artifacts: string[]): string | null {
  const candidates = ['metrics.json', 'metrics'];
  for (const candidate of candidates) {
    if (artifacts.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

// Helper function to resolve timeseries filename
function resolveTimeseriesFilename(artifacts: string[], symbol?: string): string | null {
  const candidates = [
    `${symbol}_best_timeseries.json`,
    `${symbol}_best_timeseries`,
    'best_timeseries.json',
    'best_timeseries',
    'best_system_timeseries.json',
    'best_system_timeseries'
  ];
  for (const candidate of candidates) {
    if (artifacts.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

// Helper function to resolve voxel cube filename
function resolveVoxelFilename(artifacts: string[], symbol?: string): string | null {
  const candidates = [
    `${symbol}_voxel_cube_cagr.json`,
    `${symbol}_voxel_cube_cagr`,
    'voxel_cube_cagr.json',
    'voxel_cube_cagr',
    'voxel_points.json',
    'voxel_points',
    'voxel_points_top.json',
    'voxel_points_top'
  ];
  for (const candidate of candidates) {
    if (artifacts.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

// Helper function to resolve yearly returns filename
function resolveYearlyReturnsFilename(artifacts: string[], symbol?: string): string | null {
  const candidates = [
    `${symbol}_yearly_returns.json`,
    `${symbol}_yearly_returns`,
    'yearly_returns.json',
    'yearly_returns',
    'yearly_compounded.json',
    'yearly_compounded'
  ];
  for (const candidate of candidates) {
    if (artifacts.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

// Helper function to resolve heatmaps filename
function resolveHeatmapsFilename(artifacts: string[]): string | null {
  const candidates = [
    'heatmaps_cagr.json',
    'heatmaps_cagr',
    'tp_sl_heatmap_grid_cagr.json',
    'tp_sl_heatmap_grid_cagr'
  ];
  for (const candidate of candidates) {
    if (artifacts.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

// Data normalization functions
function normalizeVoxelCube(data: any): { tp: number[]; sl: number[]; h: number[]; metric: number[] } | null {
  if (!data) return null;

  console.log("Normalizing voxel cube data:", data);

  // Handle different voxel cube formats
  if (Array.isArray(data)) {
    // Array of objects format - common from Python scripts
    if (data.length > 0 && typeof data[0] === 'object') {
      console.log("Detected array of objects format");
      const tp = data.map(d => d.tp || d.take_profit || d.TP).filter(x => typeof x === 'number');
      const sl = data.map(d => d.sl || d.stop_loss || d.SL).filter(x => typeof x === 'number');
      const h = data.map(d => d.h || d.horizon || d.H).filter(x => typeof x === 'number');
      const metric = data.map(d => d.metric || d.cagr || d.CAGR || d.value || 0).filter(x => typeof x === 'number');

      if (tp.length === sl.length && sl.length === h.length && h.length === metric.length && tp.length > 0) {
        return { tp, sl, h, metric };
      }
    }
  } else if (typeof data === 'object') {
    // Object with arrays format
    console.log("Detected object with arrays format");
    const tp = Array.isArray(data.tp) ? data.tp : Array.isArray(data.TP) ? data.TP : [];
    const sl = Array.isArray(data.sl) ? data.sl : Array.isArray(data.SL) ? data.SL : [];
    const h = Array.isArray(data.h) ? data.h : Array.isArray(data.H) ? data.H : [];
    const metric = Array.isArray(data.metric) ? data.metric : Array.isArray(data.cagr) ? data.cagr : Array.isArray(data.CAGR) ? data.CAGR : [];

    if (tp.length === sl.length && sl.length === h.length && h.length === metric.length && tp.length > 0) {
      return { tp, sl, h, metric };
    }
  }

  console.log("Could not normalize voxel cube data");
  return null;
}

function normalizeTimeseries(data: any): { dates: any[]; strategy: number[]; price: number[] } | null {
  if (!data) return null;

  console.log("Normalizing timeseries data:", data);

  // Handle different timeseries formats
  const dates = data.dates || data.Date || data.date || [];
  const strategy = data.strategy || data.strategy_cum_compounded || data.strategy_compounded_pct || data.Strategy || [];
  const price = data.price || data.price_norm || data.price_normalized_pct || data.asset || data.Price || [];

  console.log("Extracted arrays - dates:", dates?.length, "strategy:", strategy?.length, "price:", price?.length);

  if (!Array.isArray(dates) || !Array.isArray(strategy) || !Array.isArray(price)) {
    console.log("One or more arrays are not arrays");
    return null;
  }

  if (dates.length === 0 || strategy.length === 0 || price.length === 0) {
    console.log("One or more arrays are empty");
    return null;
  }

  // Ensure all arrays have the same length
  const minLength = Math.min(dates.length, strategy.length, price.length);
  return {
    dates: dates.slice(0, minLength),
    strategy: strategy.slice(0, minLength),
    price: price.slice(0, minLength)
  };
}

function normalizeYearlyReturns(data: any): { years: any[]; strategy: number[]; price: number[] } | null {
  if (!data) return null;

  console.log("Normalizing yearly returns data:", data);

  // Handle different yearly returns formats
  const years = data.years || data.Year || data.year || [];
  const strategy = data.strategy || data.strategy_yearly_compounded || data.strategy_compounded_pct || data.Strategy || [];
  const price = data.price || data.asset_yearly || data.price_compounded_pct || data.asset || data.Price || [];

  console.log("Extracted arrays - years:", years?.length, "strategy:", strategy?.length, "price:", price?.length);

  if (!Array.isArray(years) || !Array.isArray(strategy) || !Array.isArray(price)) {
    console.log("One or more arrays are not arrays");
    return null;
  }

  if (years.length === 0 || strategy.length === 0 || price.length === 0) {
    console.log("One or more arrays are empty");
    return null;
  }

  // Ensure all arrays have the same length
  const minLength = Math.min(years.length, strategy.length, price.length);
  return {
    years: years.slice(0, minLength),
    strategy: strategy.slice(0, minLength),
    price: price.slice(0, minLength)
  };
}

// KPI Card component
function KPICard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-black/40 border border-gray-700/30 rounded-lg p-2 h-14 flex flex-col items-center justify-center text-center">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-xs font-normal text-gray-400">{title}</div>
    </div>
  );
}

export default function LabelingOptimizerResults() {
  const { runId } = useParams<{ runId: string }>();
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any>(null);
  const [voxelCube, setVoxelCube] = useState<any>(null);
  const [yearlyReturns, setYearlyReturns] = useState<any>(null);
  const [heatmaps, setHeatmaps] = useState<any>(null);
  const [currentHeatmapIndex, setCurrentHeatmapIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Load artifacts list
        const artifactsResponse = await labelingOptimizerApi.listArtifacts(runId);
        const availableArtifacts = artifactsResponse.artifacts;
        setArtifacts(availableArtifacts);

        // Load metrics if available
        const metricsFilename = resolveMetricsFilename(availableArtifacts);
        if (metricsFilename) {
          try {
            const metricsData = await labelingOptimizerApi.getArtifact(runId, metricsFilename);
            // Validate that we got actual data
            if (metricsData && typeof metricsData === 'object') {
              setMetrics(metricsData);
            } else {
              console.warn("Invalid metrics data received");
            }
          } catch (metricsErr) {
            console.warn("Failed to load metrics:", metricsErr);
            // Don't set error for metrics - it's optional
          }
        }

        // Load timeseries if available
        const timeseriesFilename = resolveTimeseriesFilename(availableArtifacts, metrics?.symbol);
        if (timeseriesFilename) {
          try {
            const timeseriesData = await labelingOptimizerApi.getArtifact(runId, timeseriesFilename);
            console.log("Raw timeseries data:", timeseriesData);
            const normalizedTimeseriesData = normalizeTimeseries(timeseriesData);
            console.log("Normalized timeseries data:", normalizedTimeseriesData);
            setTimeseries(normalizedTimeseriesData);
          } catch (timeseriesErr) {
            console.warn("Failed to load timeseries:", timeseriesErr);
            // Don't set error for timeseries - it's optional
          }
        }

        // Load voxel cube if available
        const voxelFilename = resolveVoxelFilename(availableArtifacts, metrics?.symbol);
        if (voxelFilename) {
          try {
            const voxelData = await labelingOptimizerApi.getArtifact(runId, voxelFilename);
            console.log("Raw voxel cube data:", voxelData);
            const normalizedVoxelData = normalizeVoxelCube(voxelData);
            console.log("Normalized voxel cube data:", normalizedVoxelData);
            setVoxelCube(normalizedVoxelData);
          } catch (voxelErr) {
            console.warn("Failed to load voxel cube:", voxelErr);
            // Don't set error for voxel cube - it's optional
          }
        }

        // Load yearly returns if available
        const yearlyReturnsFilename = resolveYearlyReturnsFilename(availableArtifacts, metrics?.symbol);
        if (yearlyReturnsFilename) {
          try {
            const yearlyData = await labelingOptimizerApi.getArtifact(runId, yearlyReturnsFilename);
            console.log("Raw yearly returns data:", yearlyData);
            const normalizedYearlyData = normalizeYearlyReturns(yearlyData);
            console.log("Normalized yearly returns data:", normalizedYearlyData);
            setYearlyReturns(normalizedYearlyData);
          } catch (yearlyErr) {
            console.warn("Failed to load yearly returns:", yearlyErr);
            // Don't set error for yearly returns - it's optional
          }
        }

        // Load heatmaps if available
        const heatmapsFilename = resolveHeatmapsFilename(availableArtifacts);
        if (heatmapsFilename) {
          try {
            const heatmapsData = await labelingOptimizerApi.getArtifact(runId, heatmapsFilename);
            setHeatmaps(heatmapsData);
          } catch (heatmapsErr) {
            console.warn("Failed to load heatmaps:", heatmapsErr);
            // Don't set error for heatmaps - it's optional
          }
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [runId]);

  if (!runId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Invalid Run ID</h1>
          <p className="text-white/90">No run ID provided in URL</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24">
      <div className="container mx-auto px-4 py-0">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">Advanced Analytics Dashboard</h1>
            {metrics && metrics.symbol && (
              <p className="text-sm text-gray-400">
                {metrics.symbol}: {metrics.start_date || '2020-01-01'} → {metrics.end_date || '2025-01-01'}
              </p>
            )}
          </div>
          <Link
            to={`/products/labeling-optimizer/run/${runId}`}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition-colors"
          >
            Back to Run
          </Link>
        </div>

        {loading && (
          <div className="text-gray-400">Loading data...</div>
        )}

        {error && (
          <div className="text-red-400 bg-red-900/30 border border-red-800/50 p-3 rounded mb-4">
            <div className="text-sm">Error: {error}</div>
          </div>
        )}

        {!loading && !error && (
          <div>
            {/* KPI Cards */}
            {metrics && (
              <div className="mb-2">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <KPICard
                    title="Best TP"
                    value={metrics.best_tp ? `${(metrics.best_tp * 100).toFixed(1)}%` : "—"}
                  />
                  <KPICard
                    title="Best SL"
                    value={metrics.best_sl ? `${(metrics.best_sl * 100).toFixed(1)}%` : "—"}
                  />
                  <KPICard
                    title="Best Horizon"
                    value={metrics.best_h || metrics.best_horizon ? `${metrics.best_h || metrics.best_horizon}d` : "—"}
                  />
                  <KPICard
                    title="Best CAGR"
                    value={metrics.best_cagr ? `${metrics.best_cagr.toFixed(2)}%` : "—"}
                  />
                  <KPICard
                    title="Best Linear P/L"
                    value={metrics.best_linear_annual_pl || metrics.best_linear_per_year_pct ? `${(metrics.best_linear_annual_pl || metrics.best_linear_per_year_pct).toFixed(2)}%` : "—"}
                  />
                </div>
              </div>
            )}

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
              {/* Voxel Cube - Left Column (Dominant) */}
              <div>
                {voxelCube ? (
                  <div className="bg-black/40 border border-gray-700/30 rounded-lg p-4" style={{ height: '520px' }}>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">TP–SL–H 3D Search Space</h3>
                    <Plot
                      data={[{
                        type: 'scatter3d',
                        mode: 'markers',
                        x: voxelCube.tp,
                        y: voxelCube.sl,
                        z: voxelCube.h,
                        marker: {
                          size: 2,
                          color: voxelCube.metric,
                          colorscale: voxelCube.colorscale || 'Viridis',
                          showscale: true,
                          colorbar: {
                            title: { text: 'CAGR (%)', font: { size: 10 } },
                            thickness: 15,
                            len: 0.6,
                          },
                        },
                      }]}
                      layout={{
                        margin: { l: 0, r: 0, t: 0, b: 0 },
                        scene: {
                          xaxis: { title: { text: 'Take Profit (%)', font: { size: 10 } } },
                          yaxis: { title: { text: 'Stop Loss (%)', font: { size: 10 } } },
                          zaxis: { title: { text: 'Horizon', font: { size: 10 } } },
                          camera: {
                            eye: { x: 1.5, y: 1.5, z: 1.5 }
                          }
                        },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                      }}
                      config={{
                        displayModeBar: false,
                        responsive: true,
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                ) : (
                  <div className="bg-black/40 border border-gray-700/30 rounded-lg p-4" style={{ height: '500px' }}>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">TP–SL–H 3D Search Space</h3>
                    <div className="text-center text-gray-400 py-8" style={{ height: 'calc(100% - 2rem)' }}>
                      No voxel cube data available
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Stacked Charts */}
              <div className="space-y-4">
                {/* Timeseries Chart */}
                {timeseries ? (
                  <div className="bg-black/40 border border-gray-700/30 rounded-lg p-3" style={{ height: '250px' }}>
                    <h4 className="text-xs font-medium text-gray-300 mb-1">Compounded Equity Curve vs Price</h4>
                    <div style={{ height: 'calc(100% - 1.5rem)' }}>
                      <Plot
                        data={[
                          {
                            type: 'scatter',
                            mode: 'lines',
                            name: 'Strategy',
                            x: timeseries.dates,
                            y: timeseries.strategy,
                            line: { color: '#10b981', width: 1.5 },
                          },
                          {
                            type: 'scatter',
                            mode: 'lines',
                            name: 'Price',
                            x: timeseries.price_dates || timeseries.dates,
                            y: timeseries.price,
                            line: { color: '#8b5cf6', width: 1, dash: 'dot' },
                            yaxis: 'y2',
                          },
                        ]}
                        layout={{
                          margin: { l: 35, r: 35, t: 5, b: 60 },
                          xaxis: {
                            title: { text: 'Date', font: { size: 9 } },
                            tickfont: { size: 8 },
                            gridcolor: 'rgba(255,255,255,0.1)'
                          },
                          yaxis: {
                            title: { text: 'Strategy ($)', font: { size: 9 } },
                            side: 'left',
                            tickfont: { size: 8 },
                            gridcolor: 'rgba(255,255,255,0.1)'
                          },
                          yaxis2: {
                            title: { text: 'Price ($)', font: { size: 9 } },
                            side: 'right',
                            overlaying: 'y',
                            showgrid: false,
                            tickfont: { size: 8 }
                          },
                          showlegend: true,
                            legend: {
                              orientation: 'h',
                              x: 0.5,
                              xanchor: 'center',
                              y: -0.2,
                              yanchor: 'top',
                              font: { size: 10, color: 'rgba(245,247,255,0.8)' },
                              bgcolor: 'rgba(0,0,0,0.7)',
                              bordercolor: 'rgba(255,255,255,0.08)',
                              borderwidth: 1
                            },
                          paper_bgcolor: 'transparent',
                          plot_bgcolor: 'transparent',
                        }}
                        config={{
                          displayModeBar: false,
                          responsive: true,
                          toImageButtonOptions: { format: 'svg' },
                        }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/40 border border-gray-700/30 rounded-lg p-3" style={{ height: '250px' }}>
                    <h4 className="text-xs font-medium text-gray-300 mb-1">Compounded Equity Curve vs Price</h4>
                    <div className="text-center text-gray-400 flex items-center justify-center" style={{ height: 'calc(100% - 1.5rem)' }}>
                      No timeseries data available
                    </div>
                  </div>
                )}

                {/* Yearly Returns Chart */}
                {yearlyReturns ? (
                  <div className="bg-black/40 border border-gray-700/30 rounded-lg p-3" style={{ height: '250px' }}>
                    <h4 className="text-xs font-medium text-gray-300 mb-1">Yearly Compounded Returns</h4>
                    <div style={{ height: 'calc(100% - 1.5rem)' }}>
                      <Plot
                        data={[
                          {
                            type: 'bar',
                            name: 'Strategy',
                            x: yearlyReturns.years,
                            y: yearlyReturns.strategy,
                            marker: { color: '#10b981' },
                          },
                          {
                            type: 'bar',
                            name: 'Price',
                            x: yearlyReturns.years,
                            y: yearlyReturns.price,
                            marker: { color: '#8b5cf6' },
                          },
                        ]}
                        layout={{
                          margin: { l: 35, r: 35, t: 5, b: 60 },
                          xaxis: {
                            title: { text: 'Year', font: { size: 9 } },
                            tickfont: { size: 8 },
                            gridcolor: 'rgba(255,255,255,0.1)'
                          },
                          yaxis: {
                            title: { text: 'Return (%)', font: { size: 9 } },
                            tickfont: { size: 8 },
                            gridcolor: 'rgba(255,255,255,0.1)'
                          },
                          barmode: 'group',
                          showlegend: true,
                            legend: {
                              orientation: 'h',
                              x: 0.5,
                              xanchor: 'center',
                              y: -0.2,
                              yanchor: 'top',
                              font: { size: 10, color: 'rgba(245,247,255,0.8)' },
                              bgcolor: 'rgba(0,0,0,0.7)',
                              bordercolor: 'rgba(255,255,255,0.08)',
                              borderwidth: 1
                            },
                          paper_bgcolor: 'transparent',
                          plot_bgcolor: 'transparent',
                        }}
                        config={{
                          displayModeBar: false,
                          responsive: true,
                          toImageButtonOptions: { format: 'svg' },
                        }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/40 border border-gray-700/30 rounded-lg p-3" style={{ height: '250px' }}>
                    <h4 className="text-xs font-medium text-gray-300 mb-1">Yearly Compounded Returns</h4>
                    <div className="text-center text-gray-400 flex items-center justify-center" style={{ height: 'calc(100% - 1.5rem)' }}>
                      No yearly returns data available
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Additional Charts - Individual Layout */}
            <div className="space-y-6 mt-8">
              {/* P/L vs Max DD Scatter */}
              {metrics && metrics.scatter_data && (
                <div className="bg-black/40 border border-gray-700/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Risk-Return Analysis: CAGR vs Max Drawdown</h3>
                  <div style={{ height: '400px' }}>
                    <Plot
                      data={[{
                        type: 'scatter',
                        mode: 'markers',
                        x: metrics.scatter_data.max_dd,
                        y: metrics.scatter_data.cagr,
                        marker: {
                          size: 6,
                          color: '#10b981',
                          opacity: 0.7
                        }
                      }]}
                      layout={{
                        margin: { l: 60, r: 30, t: 20, b: 60 },
                        xaxis: {
                          title: { text: 'Max Drawdown (%)', font: { size: 12, color: '#F5F7FF' } },
                          gridcolor: 'rgba(255,255,255,0.1)',
                          tickfont: { color: '#F5F7FF' }
                        },
                        yaxis: {
                          title: { text: 'CAGR (%)', font: { size: 12, color: '#F5F7FF' } },
                          gridcolor: 'rgba(255,255,255,0.1)',
                          tickfont: { color: '#F5F7FF' }
                        },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                      }}
                      config={{
                        displayModeBar: false,
                        responsive: true,
                        toImageButtonOptions: { format: 'svg' },
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                </div>
              )}

              {/* Annual Linear P/L Distribution */}
              {metrics && metrics.hist_data && (
                <div className="bg-black/40 border border-gray-700/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Annual Linear P/L Distribution</h3>
                  <div style={{ height: '400px' }}>
                    <Plot
                      data={[{
                        type: 'bar',
                        x: metrics.hist_data.bins,
                        y: metrics.hist_data.counts,
                        marker: {
                          color: '#8b5cf6',
                          line: { width: 0 }
                        },
                        width: 0.8
                      }]}
                      layout={{
                        margin: { l: 60, r: 30, t: 20, b: 60 },
                        xaxis: {
                          title: { text: 'Annual P/L (%)', font: { size: 12, color: '#F5F7FF' } },
                          gridcolor: 'rgba(255,255,255,0.1)',
                          tickfont: { color: '#F5F7FF' }
                        },
                        yaxis: {
                          title: { text: 'Count', font: { size: 12, color: '#F5F7FF' } },
                          gridcolor: 'rgba(255,255,255,0.1)',
                          tickfont: { color: '#F5F7FF' }
                        },
                        bargap: 0,
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                      }}
                      config={{
                        displayModeBar: false,
                        responsive: true,
                        toImageButtonOptions: { format: 'svg' },
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                </div>
              )}

              {/* P/L vs L1 Prediction Rate */}
              {metrics && metrics.prediction_data && (
                <div className="bg-black/40 border border-gray-700/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Prediction Accuracy: P/L vs L1 Prediction Rate</h3>
                  <div style={{ height: '400px' }}>
                    <Plot
                      data={[{
                        type: 'scatter',
                        mode: 'markers',
                        x: metrics.prediction_data.l1_rate,
                        y: metrics.prediction_data.pnl,
                        marker: {
                          size: 6,
                          color: '#22D3EE',
                          opacity: 0.7
                        }
                      }]}
                      layout={{
                        margin: { l: 60, r: 30, t: 20, b: 60 },
                        xaxis: {
                          title: { text: 'L1 Prediction Rate', font: { size: 12, color: '#F5F7FF' } },
                          gridcolor: 'rgba(255,255,255,0.1)',
                          tickfont: { color: '#F5F7FF' }
                        },
                        yaxis: {
                          title: { text: 'P/L ($)', font: { size: 12, color: '#F5F7FF' } },
                          gridcolor: 'rgba(255,255,255,0.1)',
                          tickfont: { color: '#F5F7FF' }
                        },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                      }}
                      config={{
                        displayModeBar: false,
                        responsive: true,
                        toImageButtonOptions: { format: 'svg' },
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                </div>
              )}

              {/* Best System vs Benchmark */}
              {metrics && metrics.benchmark_data && (
                <div className="bg-black/40 border border-gray-700/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Performance Comparison: Best System vs Benchmarks</h3>
                  <div style={{ height: '400px' }}>
                    <Plot
                      data={[{
                        type: 'bar',
                        x: metrics.benchmark_data.names,
                        y: metrics.benchmark_data.values,
                        marker: {
                          color: ['#10b981', '#8b5cf6', '#22D3EE', '#F59E0B', '#EF4444'],
                          line: { width: 0 }
                        }
                      }]}
                      layout={{
                        margin: { l: 60, r: 30, t: 20, b: 100 },
                        xaxis: {
                          tickangle: -45,
                          gridcolor: 'rgba(255,255,255,0.1)',
                          tickfont: { color: '#F5F7FF' }
                        },
                        yaxis: {
                          title: { text: 'CAGR (%)', font: { size: 12, color: '#F5F7FF' } },
                          gridcolor: 'rgba(255,255,255,0.1)',
                          tickfont: { color: '#F5F7FF' }
                        },
                        bargap: 0.2,
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                      }}
                      config={{
                        displayModeBar: false,
                        responsive: true,
                        toImageButtonOptions: { format: 'svg' },
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                </div>
              )}

              {/* Correlation Matrix */}
              {metrics && metrics.correlation_data && (
                <div className="bg-black/40 border border-gray-700/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Parameter Correlation Matrix</h3>
                  <div style={{ height: '500px' }}>
                    <Plot
                      data={[{
                        type: 'heatmap',
                        z: metrics.correlation_data.matrix,
                        x: metrics.correlation_data.labels,
                        y: metrics.correlation_data.labels,
                        colorscale: [
                          [0, '#8b5cf6'],
                          [0.5, '#22D3EE'],
                          [1, '#10b981']
                        ],
                        showscale: true,
                        colorbar: {
                          title: { text: 'Correlation', font: { size: 12, color: '#F5F7FF' } },
                          thickness: 20,
                          len: 0.8,
                          tickfont: { color: '#F5F7FF' }
                        }
                      }]}
                      layout={{
                        margin: { l: 120, r: 120, t: 50, b: 120 },
                        xaxis: {
                          tickangle: -45,
                          side: 'bottom',
                          tickfont: { color: '#F5F7FF', size: 10 }
                        },
                        yaxis: {
                          autorange: 'reversed',
                          tickfont: { color: '#F5F7FF', size: 10 }
                        },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                      }}
                      config={{
                        displayModeBar: false,
                        responsive: true,
                        toImageButtonOptions: { format: 'svg' },
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Heatmap Section with Download - Below the Fold */}
            <div className="mt-16 mb-4">
              <h2 className="text-lg font-medium text-white mb-4">Heatmaps</h2>
              {heatmaps && heatmaps.horizons && heatmaps.tp_values && heatmaps.sl_values ? (() => {
                const availableHorizons = Object.keys(heatmaps.horizons).map(Number).sort((a, b) => a - b);
                const currentHorizon = availableHorizons[currentHeatmapIndex];
                const matrix = heatmaps.horizons[currentHorizon];

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Heatmap Card */}
                    <div className="lg:col-span-2 bg-black/40 border border-gray-700/30 rounded-lg p-4" style={{ height: '350px' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm text-gray-300">
                          TP–SL Heatmaps (CAGR %) • Horizon: {currentHorizon} candle{currentHorizon > 1 ? 's' : ''}
                        </h3>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCurrentHeatmapIndex((prev) => (prev - 1 + availableHorizons.length) % availableHorizons.length)}
                            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                            disabled={availableHorizons.length <= 1}
                          >
                            ‹
                          </button>
                          <span className="text-xs text-gray-500 min-w-[40px] text-center">
                            {currentHeatmapIndex + 1} / {availableHorizons.length}
                          </span>
                          <button
                            onClick={() => setCurrentHeatmapIndex((prev) => (prev + 1) % availableHorizons.length)}
                            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                            disabled={availableHorizons.length <= 1}
                          >
                            ›
                          </button>
                        </div>
                      </div>

                      {matrix ? (
                        <div style={{ width: '100%', height: '280px' }}>
                          <Plot
                            data={[{
                              type: 'heatmap',
                              z: matrix,
                              x: heatmaps.tp_values,
                              y: heatmaps.sl_values,
                              colorscale: 'Viridis',
                              zmin: heatmaps.vmin,
                              zmax: heatmaps.vmax,
                              showscale: true,
                              colorbar: {
                                title: { text: 'CAGR %', font: { size: 9, color: 'rgba(255,255,255,0.65)' } },
                                thickness: 12,
                                len: 0.8,
                              },
                            }]}
                            layout={{
                              margin: { l: 50, r: 50, t: 20, b: 50 },
                              xaxis: {
                                title: { text: 'Take Profit (%)', font: { size: 8 } },
                                tickfont: { size: 7 },
                                gridcolor: 'rgba(255,255,255,0.08)',
                              tickcolor: 'rgba(245,247,255,0.62)'
                              },
                              yaxis: {
                                title: { text: 'Stop Loss (%)', font: { size: 8 } },
                                tickfont: { size: 7 },
                                gridcolor: 'rgba(255,255,255,0.08)',
                              tickcolor: 'rgba(245,247,255,0.62)'
                              },
                              paper_bgcolor: 'transparent',
                              plot_bgcolor: 'transparent',
                            }}
                            config={{
                              displayModeBar: false,
                              responsive: true,
                              toImageButtonOptions: { format: 'svg' },
                            }}
                            style={{ width: '100%', height: '100%' }}
                            useResizeHandler={true}
                          />
                        </div>
                      ) : (
                        <div style={{ width: '100%', aspectRatio: '1' }} className="bg-gray-900 border border-gray-700 rounded flex items-center justify-center">
                          <span className="text-gray-500 text-sm">No data</span>
                        </div>
                      )}
                    </div>

                    {/* Download Card */}
                    <div className="bg-black/40 border border-gray-700/30 rounded-lg p-4" style={{ height: '350px' }}>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Export Visuals</h4>
                      <button
                        className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition-colors flex items-center justify-center gap-2"
                        onClick={async () => {
                          try {
                            // Trigger download of all visuals as ZIP
                            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001'}/api/labeling-optimizer/download-visuals/${runId}`, {
                              method: 'GET',
                            });

                            if (response.ok) {
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `labeling_optimizer_visuals_${runId}.zip`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            } else {
                              alert('Failed to download visuals. Please try again.');
                            }
                          } catch (error) {
                            console.error('Download error:', error);
                            alert('Error downloading visuals. Check console for details.');
                          }
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download All as ZIP
                      </button>
                      <p className="text-xs text-gray-500 mt-2">
                        Downloads all charts as PNG files in a ZIP archive.
                      </p>
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-black/40 border border-gray-700/30 rounded-lg p-4">
                  <div className="text-center text-gray-400 py-6">
                    No heatmap data available
                  </div>
                </div>
              )}
            </div>

            {/* Artifacts List - Compact */}
            <div className="border-t border-gray-700/30 pt-4">
              <div className="flex flex-wrap gap-2">
                {artifacts.map((artifact, index) => (
                  <code key={index} className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300 border border-gray-600">
                    {artifact}
                  </code>
                ))}
              </div>
              {artifacts.length === 0 && (
                <div className="text-gray-500 text-sm">No artifacts found for this run.</div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="h-32" />
    </div>
  );
}