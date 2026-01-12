import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Play, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useRunsStore } from "@/state/runsStore";
import { backtesterApi } from "@/lib/api";
import ModelUploader from "@/components/ModelUploader";
import DatasetUploader from "@/components/DatasetUploader";
import TestDataGeneratorModal from "@/components/TestDataGeneratorModal";

interface UploadedModel {
  model_id: string;
  filename: string;
  size: number;
  uploaded_at: string;
}

interface UploadedDataset {
  dataset_id: string;
  extracted_path: string;
  summary: {
    total_images: number;
    label_distribution: Record<string, number>;
    example_filenames: string[];
  };
}

interface BacktesterConfig {
  modelId?: string;
  datasetId?: string;
  sampleSize: string | number;
  confidenceThreshold: number;
  tpPct: number;
  slPct: number;
  imgSize: number;
  // Trading parameters
  startingCapital: number;
  positionSizePct: number;
  commissionPct: number;
  slippagePct: number;
  // Risk management
  maxDrawdownPct: number;
  maxTradesPerDay: number;
}

export default function Backtester() {
  const navigate = useNavigate();
  const { registerRun } = useRunsStore();

  const [uploadedModel, setUploadedModel] = useState<UploadedModel | null>(null);
  const [uploadedDataset, setUploadedDataset] = useState<UploadedDataset | null>(null);
  const [isTestDataModalOpen, setIsTestDataModalOpen] = useState(false);
  const [showTestDataBanner, setShowTestDataBanner] = useState(false);
  const [testDataBannerMessage, setTestDataBannerMessage] = useState("");

  const [config, setConfig] = useState<BacktesterConfig>({
    sampleSize: "all",
    confidenceThreshold: 0.5,
    tpPct: 2.0,
    slPct: 2.0,
    imgSize: 224,
    // Trading parameters
    startingCapital: 10000,
    positionSizePct: 10.0,
    commissionPct: 0.1,
    slippagePct: 0.05,
    // Risk management
    maxDrawdownPct: 20.0,
    maxTradesPerDay: 10,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleModelUploaded = (model: UploadedModel) => {
    setUploadedModel(model);
    setConfig(prev => ({ ...prev, modelId: model.model_id }));
  };

  const handleModelRemoved = () => {
    setUploadedModel(null);
    setConfig(prev => ({ ...prev, modelId: undefined }));
  };

  const handleDatasetUploaded = (dataset: UploadedDataset) => {
    setUploadedDataset(dataset);
    setConfig(prev => ({ ...prev, datasetId: dataset.dataset_id }));
  };

  const handleDatasetRemoved = () => {
    setUploadedDataset(null);
    setConfig(prev => ({ ...prev, datasetId: undefined }));
  };

  const handleTestDataGenerationStarted = () => {
    setTestDataBannerMessage("Test data generation started - check the global banner to resume");
    setShowTestDataBanner(true);
    // Auto-hide banner after 5 seconds
    setTimeout(() => setShowTestDataBanner(false), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config.modelId) {
      setError("Please upload a Keras model first");
      return;
    }

    if (!config.datasetId) {
      setError("Please upload a test dataset first");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await backtesterApi.startRun({
        model_id: config.modelId,
        dataset_id: config.datasetId,
        sample_size: config.sampleSize,
        confidence_threshold: config.confidenceThreshold,
        tp_pct: config.tpPct,
        sl_pct: config.slPct,
        img_size: config.imgSize,
        // Trading parameters
        starting_capital: config.startingCapital,
        position_size_pct: config.positionSizePct,
        commission_pct: config.commissionPct,
        slippage_pct: config.slippagePct,
        // Risk management
        max_drawdown_pct: config.maxDrawdownPct,
        max_trades_per_day: config.maxTradesPerDay,
      });

      const runId = response.run_id;

      // Register the run in the global store
      registerRun({
        id: runId,
        tool: 'backtester',
        status: 'running',
        progress: 0,
        stage: 'starting',
        message: 'Initializing backtester...',
        route: `/tools/backtester/runs/${runId}`,
      });

      navigate(`/tools/backtester/runs/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start backtest");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070812] relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-96 h-96 bg-[rgba(59,130,246,0.18)] rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-20 w-80 h-80 bg-[rgba(139,92,246,0.18)] rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-[rgba(236,72,153,0.12)] rounded-full blur-3xl"></div>
      </div>

      <div className="relative pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to="/tools">
              <button className="p-2 bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg hover:border-[rgba(59,130,246,0.28)] transition-all duration-200">
                <ArrowLeft className="w-5 h-5 text-[#E9ECFF]" />
              </button>
            </Link>
        <div>
              <h1 className="text-2xl font-semibold text-[#E9ECFF]">Backtester</h1>
              <p className="text-[rgba(233,236,255,0.65)] text-sm">Test trained models against historical data</p>
        </div>
      </div>

          {/* Form */}
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-xl p-8">
            {/* Test Data Banner */}
            {showTestDataBanner && (
              <div className="mb-6 p-4 bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)] rounded-lg">
                <p className="text-sm text-[#3B82F6]">{testDataBannerMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Model Section */}
              <div>
                <h2 className="text-lg font-medium text-[#E9ECFF] mb-4">Model</h2>
                <ModelUploader
                  onModelUploaded={handleModelUploaded}
                  onModelRemoved={handleModelRemoved}
                  uploadedModel={uploadedModel}
                />
              </div>

              {/* Dataset Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-[#E9ECFF]">Test Dataset</h2>
      <button
                    type="button"
                    onClick={() => setIsTestDataModalOpen(true)}
                    className="px-4 py-2 border border-[rgba(139,92,246,0.18)] text-[#E9ECFF] font-medium rounded-lg hover:border-[rgba(59,130,246,0.28)] hover:bg-[rgba(59,130,246,0.08)] transition-all duration-200 flex items-center gap-2 text-sm"
                  >
                    <Zap className="w-4 h-4" />
                    Generate testdata now
      </button>
    </div>

                <DatasetUploader
                  onDatasetUploaded={handleDatasetUploaded}
                  onDatasetRemoved={handleDatasetRemoved}
                  uploadedDataset={uploadedDataset}
                />
          </div>

              {/* Backtest Settings */}
              <div>
                <h2 className="text-lg font-medium text-[#E9ECFF] mb-4">Backtest Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sample Size */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Sample Size
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="sampleSize"
                          value="all"
                          checked={config.sampleSize === "all"}
                          onChange={(e) => setConfig({ ...config, sampleSize: e.target.value })}
                          className="mr-2 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                        />
                        <span className="text-[#E9ECFF]">All</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="sampleSize"
                          value="custom"
                          checked={typeof config.sampleSize === 'number'}
                          onChange={() => setConfig({ ...config, sampleSize: 1000 })}
                          className="mr-2 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                        />
                        <span className="text-[#E9ECFF]">Custom</span>
                      </label>
        </div>
                    {typeof config.sampleSize === 'number' && (
                      <input
                        type="number"
                        value={config.sampleSize}
                        onChange={(e) => setConfig({ ...config, sampleSize: parseInt(e.target.value) || 1000 })}
                        min="100"
                        max="10000"
                        className="mt-2 w-full px-3 py-2 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded text-[#E9ECFF] focus:border-[rgba(59,130,246,0.28)] focus:outline-none"
                      />
      )}
    </div>

                  {/* Confidence Threshold */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Confidence Threshold: {config.confidenceThreshold.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.01"
                      value={config.confidenceThreshold}
                      onChange={(e) => setConfig({ ...config, confidenceThreshold: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-[rgba(139,92,246,0.18)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[rgba(233,236,255,0.5)] mt-1">
                      <span>0.1</span>
                      <span>0.5</span>
                      <span>0.9</span>
          </div>
        </div>

                  {/* TP % */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Take Profit %
                    </label>
                    <input
                      type="number"
                      value={config.tpPct}
                      onChange={(e) => setConfig({ ...config, tpPct: parseFloat(e.target.value) || 2.0 })}
                      step="0.1"
                      min="0.1"
                      max="10"
                      className="w-full px-4 py-3 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded-lg text-[#E9ECFF] focus:border-[rgba(59,130,246,0.28)] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* SL % */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Stop Loss %
                    </label>
                    <input
                      type="number"
                      value={config.slPct}
                      onChange={(e) => setConfig({ ...config, slPct: parseFloat(e.target.value) || 2.0 })}
                      step="0.1"
                      min="0.1"
                      max="10"
                      className="w-full px-4 py-3 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded-lg text-[#E9ECFF] focus:border-[rgba(59,130,246,0.28)] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Image Size */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Image Size
                    </label>
                    <select
                      value={config.imgSize}
                      onChange={(e) => setConfig({ ...config, imgSize: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded-lg text-[#E9ECFF] focus:border-[rgba(59,130,246,0.28)] focus:outline-none transition-colors"
                    >
                      <option value="224">224x224 (Default)</option>
                      <option value="128">128x128</option>
                      <option value="256">256x256</option>
                    </select>
                  </div>
          </div>
        </div>

              {/* Trading Parameters */}
              <div>
                <h2 className="text-lg font-medium text-[#E9ECFF] mb-4">Trading Parameters</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Starting Capital */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Starting Capital
                    </label>
                    <input
                      type="number"
                      value={config.startingCapital}
                      onChange={(e) => setConfig({ ...config, startingCapital: parseFloat(e.target.value) || 10000 })}
                      step="1000"
                      min="1000"
                      max="1000000"
                      className="w-full px-4 py-3 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded-lg text-[#E9ECFF] focus:border-[rgba(59,130,246,0.28)] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Position Size % */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Position Size % of Capital
                    </label>
                    <input
                      type="number"
                      value={config.positionSizePct}
                      onChange={(e) => setConfig({ ...config, positionSizePct: parseFloat(e.target.value) || 10.0 })}
                      step="1"
                      min="1"
                      max="100"
                      className="w-full px-4 py-3 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded-lg text-[#E9ECFF] focus:border-[rgba(59,130,246,0.28)] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Commission % */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Commission % per Trade
                    </label>
                    <input
                      type="number"
                      value={config.commissionPct}
                      onChange={(e) => setConfig({ ...config, commissionPct: parseFloat(e.target.value) || 0.1 })}
                      step="0.01"
                      min="0"
                      max="1"
                      className="w-full px-4 py-3 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded-lg text-[#E9ECFF] focus:border-[rgba(59,130,246,0.28)] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Slippage % */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Slippage % per Trade
                    </label>
                    <input
                      type="number"
                      value={config.slippagePct}
                      onChange={(e) => setConfig({ ...config, slippagePct: parseFloat(e.target.value) || 0.05 })}
                      step="0.01"
                      min="0"
                      max="1"
                      className="w-full px-4 py-3 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded-lg text-[#E9ECFF] focus:border-[rgba(59,130,246,0.28)] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Risk Management */}
              <div>
                <h2 className="text-lg font-medium text-[#E9ECFF] mb-4">Risk Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Max Drawdown % */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Max Drawdown % (Stop Trading)
                    </label>
                    <input
                      type="number"
                      value={config.maxDrawdownPct}
                      onChange={(e) => setConfig({ ...config, maxDrawdownPct: parseFloat(e.target.value) || 20.0 })}
                      step="1"
                      min="5"
                      max="50"
                      className="w-full px-4 py-3 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded-lg text-[#E9ECFF] focus:border-[rgba(59,130,246,0.28)] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Max Trades per Day */}
                  <div>
                    <label className="block text-sm text-[rgba(233,236,255,0.65)] mb-2">
                      Max Trades per Day
                    </label>
                    <input
                      type="number"
                      value={config.maxTradesPerDay}
                      onChange={(e) => setConfig({ ...config, maxTradesPerDay: parseInt(e.target.value) || 10 })}
                      step="1"
                      min="1"
                      max="100"
                      className="w-full px-4 py-3 bg-[rgba(0,0,0,0.18)] border border-[rgba(139,92,246,0.18)] rounded-lg text-[#E9ECFF] focus:border-[rgba(59,130,246,0.28)] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-[rgba(236,72,153,0.1)] border border-[rgba(236,72,153,0.2)] rounded-lg">
                  <p className="text-[rgba(236,72,153,0.8)]">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-4 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 text-lg"
                >
                  <Play className="w-5 h-5" />
                  {isSubmitting ? 'Starting Backtest...' : 'Run Backtest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Test Data Generator Modal */}
      <TestDataGeneratorModal
        isOpen={isTestDataModalOpen}
        onClose={() => setIsTestDataModalOpen(false)}
        onGenerationStarted={handleTestDataGenerationStarted}
      />
    </div>
  );
}