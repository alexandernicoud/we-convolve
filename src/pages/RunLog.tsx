import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, CheckCircle, XCircle, Clock, Eye, ArrowLeft } from "lucide-react";
import { useRunsStore } from "@/state/runsStore";

interface RunGroup {
  tool: string;
  label: string;
  runs: any[];
  route: string;
}

export default function RunLog() {
  const { runsById } = useRunsStore();
  const [runGroups, setRunGroups] = useState<RunGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Group runs by tool type
    const groups: { [key: string]: RunGroup } = {
      'backtester': {
        tool: 'backtester',
        label: 'Backtester',
        runs: [],
        route: '/tools/backtester/runs/'
      },
      'labeling-optimizer': {
        tool: 'labeling-optimizer',
        label: 'Labeling Optimizer',
        runs: [],
        route: '/products/labeling-optimizer/results/'
      },
      'training-chart-generator': {
        tool: 'training-chart-generator',
        label: 'Chart Generator',
        runs: [],
        route: '/tools/generator/runs/'
      },
      'trainer': {
        tool: 'trainer',
        label: 'CNN Trainer',
        runs: [],
        route: '/tools/trainer/runs/'
      },
      'analysis': {
        tool: 'analysis',
        label: 'CNN Analysis',
        runs: [],
        route: '/tools/trainer/runs/'
      }
    };

    // Sort runs by updated_at (most recent first) and group them
    const sortedRuns = Object.values(runsById)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    sortedRuns.forEach(run => {
      if (groups[run.tool]) {
        groups[run.tool].runs.push(run);
      }
    });

    // Convert to array and filter out empty groups
    const activeGroups = Object.values(groups).filter(group => group.runs.length > 0);
    setRunGroups(activeGroups);
    setLoading(false);
  }, [runsById]);

  // Auto-refresh run statuses every 10 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      useRunsStore.getState().refreshActiveRuns();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(refreshInterval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'succeeded':
        return <CheckCircle className="w-4 h-4 text-[#22D3EE]" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'Running';
      case 'succeeded':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'queued':
        return 'Queued';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070812] relative overflow-hidden">
        <div className="relative pt-24 pb-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-white">Loading run history...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070812] relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-96 h-96 bg-[rgba(59,130,246,0.18)] rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-20 w-80 h-80 bg-[rgba(139,92,246,0.18)] rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-[rgba(236,72,153,0.12)] rounded-full blur-3xl"></div>
      </div>

      <div className="relative pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link to="/tools">
                <button className="p-2 bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg hover:border-[rgba(59,130,246,0.28)] transition-all duration-200">
                  <ArrowLeft className="w-5 h-5 text-[#E9ECFF]" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-[#E9ECFF]">Run History</h1>
                <p className="text-[rgba(233,236,255,0.65)] text-sm">Access your previous runs and results</p>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => {
                useRunsStore.getState().refreshActiveRuns();
                // Also refresh individual runs
                Object.keys(useRunsStore.getState().runsById).forEach(runId => {
                  useRunsStore.getState().refreshRun(runId);
                });
              }}
              className="px-4 py-2 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Run Groups */}
          {runGroups.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-[#F5F7FF]/60">No runs found. Start your first analysis to see it here.</div>
              <Link to="/tools" className="inline-block mt-4 px-6 py-2 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] transition-all duration-200">
                Explore Tools
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {runGroups.map((group) => (
                <div key={group.tool} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-xl p-6">
                  <h2 className="text-lg font-medium text-[#F5F7FF] mb-4 flex items-center gap-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] rounded-full"></div>
                    {group.label}
                    <span className="text-sm text-[#F5F7FF]/60">({group.runs.length} runs)</span>
                  </h2>

                  <div className="space-y-3">
                    {group.runs.map((run) => (
                      <div key={run.id} className="flex items-center justify-between p-4 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded-lg hover:border-[rgba(59,130,246,0.28)] transition-all duration-200">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(run.status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[#F5F7FF]">{getStatusText(run.status)}</span>
                              <span className="text-[#F5F7FF]/50 text-sm">•</span>
                              <span className="text-[#F5F7FF]/50 text-sm">ID: {run.id.slice(-8)}</span>
                            </div>
                            <div className="text-[#F5F7FF]/60 text-sm">
                              Started: {formatDate(run.created_at)}
                            </div>
                            {run.stage && (
                              <div className="text-[#F5F7FF]/50 text-xs mt-1">
                                {run.stage}: {run.message || ''}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {run.status === 'running' && (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#22D3EE] rounded-full transition-all duration-300"
                                  style={{ width: `${Math.max(5, run.progress * 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium min-w-[3ch] text-[#F5F7FF]">
                                {Math.round(run.progress * 100)}%
                              </span>
                            </div>
                          )}

                          {(run.status === 'succeeded' || run.status === 'failed') && (
                            <Link
                              to={`${group.route}${run.id}`}
                              className="px-4 py-2 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] transition-all duration-200 flex items-center gap-2 text-sm"
                            >
                              <Eye className="w-4 h-4" />
                              View Results
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
