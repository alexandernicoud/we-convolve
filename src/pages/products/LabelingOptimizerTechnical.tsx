import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { labelingOptimizerApi } from "@/lib/api";
import { useRunsStore } from "@/state/runsStore";

const formSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").toUpperCase(),
  start: z.string().min(1, "Start date is required"),
  end: z.string().min(1, "End date is required"),
}).refine((data) => {
  const startDate = new Date(data.start);
  const endDate = new Date(data.end);
  return startDate < endDate;
}, {
  message: "Start date must be before end date",
  path: ["end"],
});

type FormData = z.infer<typeof formSchema>;

export default function LabelingOptimizerTechnical() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      symbol: "INTC",
      start: "2020-01-01",
      end: "2025-01-01",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await labelingOptimizerApi.startRun({
        symbol: data.symbol,
        start: data.start,
        end: data.end,
      });

      // Register the run in the global store
      useRunsStore.getState().registerRun({
        id: response.run_id,
        tool: 'labeling-optimizer',
        status: 'running',
        progress: 0,
        stage: 'starting',
        message: 'Initializing labeling optimizer...',
        route: `/products/labeling-optimizer/runs/${response.run_id}`,
      });

      navigate(`/products/labeling-optimizer/run/${response.run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start optimization");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            to="/products/optimize-labeling"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to product
          </Link>

          <div className="max-w-2xl mx-auto">
            <div className="bg-card/80 backdrop-blur-sm border border-border/40 rounded-xl p-8 shadow-xl">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                Technical Parameters
              </h1>
              <p className="text-muted-foreground mb-8">
                Configure the labeling optimization parameters for your analysis.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Symbol
                  </label>
                  <input
                    {...register("symbol")}
                    type="text"
                    placeholder="INTC"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  {errors.symbol && (
                    <p className="text-sm text-red-500 mt-1">{errors.symbol.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Start Date
                    </label>
                    <input
                      {...register("start")}
                      type="date"
                      className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                    {errors.start && (
                      <p className="text-sm text-red-500 mt-1">{errors.start.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      End Date
                    </label>
                    <input
                      {...register("end")}
                      type="date"
                      className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                    {errors.end && (
                      <p className="text-sm text-red-500 mt-1">{errors.end.message}</p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-6 py-2.5 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] hover:shadow-lg hover:shadow-[#7C5CFF]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Starting optimization...
                    </>
                  ) : (
                    <>
                      Run Labeling Optimizer
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-border/40">
                <p className="text-xs text-muted-foreground">
                  This will run the optimization algorithm on historical data for the specified symbol and date range.
                  The process may take several minutes to complete.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
