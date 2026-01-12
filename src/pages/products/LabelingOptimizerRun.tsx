import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";
import { labelingOptimizerApi, formatEta, formatDuration } from "@/lib/api";

export default function LabelingOptimizerRun() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!runId) return;

    const pollProgress = async () => {
      try {
        const progressData = await labelingOptimizerApi.getProgress(runId);
        setProgress(progressData);

        // Check completion conditions
        if (progressData.phase === "done" && progressData.percent >= 100) {
          setIsPolling(false);
          // Navigate to results after a short delay
          setTimeout(() => {
            navigate(`/products/labeling-optimizer/results/${runId}`);
          }, 1000);
        } else if (progressData.phase === "error") {
          setIsPolling(false);
          setError(progressData.error_message || "Optimization failed");
        }
      } catch (err) {
        console.error("Failed to fetch progress:", err);
        // Continue polling even on error
      }
    };

    // Initial poll
    pollProgress();

    // Set up polling interval
    const interval = setInterval(pollProgress, 1000);

    return () => clearInterval(interval);
  }, [runId, navigate]);

  if (!runId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Invalid Run ID</h1>
          <Link to="/products/labeling-optimizer/technical" className="px-6 py-2.5 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] hover:shadow-lg hover:shadow-[#7C5CFF]/25 transition-all duration-200 inline-block">
            Start New Run
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Clean gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-card" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative pt-32 pb-24">
        <div className="container-aligned">
          {/* Back link */}
          <Link
            to="/products/labeling-optimizer/technical"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to form
          </Link>

          <div className="max-w-2xl mx-auto">
            <div className="bg-card/80 backdrop-blur-sm border border-border/40 rounded-xl p-8 shadow-xl">
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                  Labeling Optimization
                </h1>
                <p className="text-muted-foreground">
                  Run ID: <code className="bg-secondary px-2 py-1 rounded text-sm">{runId}</code>
                </p>
              </div>

              {error ? (
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <XCircle className="w-16 h-16 text-red-500" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Optimization Failed</h2>
                  <p className="text-muted-foreground mb-6">{error}</p>
                  <Link to="/products/labeling-optimizer/technical" className="px-6 py-2.5 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] hover:shadow-lg hover:shadow-[#7C5CFF]/25 transition-all duration-200 inline-block">
                    Try Again
                  </Link>
                </div>
              ) : progress ? (
                <div className="space-y-6">
                  {/* Status indicator */}
                  <div className="flex items-center justify-center gap-2">
                    {progress.phase === "done" ? (
                      <CheckCircle className="w-6 h-6 text-[#22D3EE]" />
                    ) : progress.phase === "error" ? (
                      <XCircle className="w-6 h-6 text-red-500" />
                    ) : (
                      <Clock className="w-6 h-6 text-primary animate-pulse" />
                    )}
                    <span className="text-lg font-medium text-foreground capitalize">
                      {progress.phase}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.round(progress.percent)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-foreground">
                        {formatDuration(progress.elapsed_s)}
                      </div>
                      <div className="text-sm text-muted-foreground">Elapsed</div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-primary">
                        {formatEta(progress.elapsed_s, progress.percent)}
                      </div>
                      <div className="text-sm text-muted-foreground">ETA</div>
                    </div>
                  </div>

                  {/* Step info */}
                  {progress.step !== null && progress.total_steps && (
                    <div className="text-center text-sm text-muted-foreground">
                      Step {progress.step} of {progress.total_steps}
                    </div>
                  )}

                  {/* Completion message */}
                  {progress.phase === "done" && progress.percent >= 100 && (
                    <div className="text-center">
                      <div className="text-[#22D3EE] font-medium mb-2">
                        ✓ Optimization complete!
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Loading results...
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
                  <p className="text-muted-foreground">Connecting to optimization service...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
