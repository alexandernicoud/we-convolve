import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, ZoomIn, X, ExternalLink } from "lucide-react";
import { trainerApi, ApiError, API_BASE, AnalysisStatusResponse } from "@/lib/api";

type AnalysisResult = AnalysisStatusResponse;

interface SectionHeaderProps {
  title: string;
  className?: string;
}

function SectionHeader({ title, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-center gap-3 mb-8 ${className}`}>
      <span className="text-sm font-medium text-[rgba(233,236,255,0.65)] uppercase tracking-wider">
        {title}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-[rgba(59,130,246,0.18)] to-[rgba(139,92,246,0.18)] to-[rgba(236,72,153,0.12)]"></div>
    </div>
  );
}

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

function Panel({ children, className = "" }: PanelProps) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_30px_80px_rgba(0,0,0,0.35)] p-6 ${className}`}>
      {children}
    </div>
  );
}

interface ImageModalProps {
  src: string;
  alt: string;
  title: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

function ImageModal({ src, alt, title, onClose, onPrev, onNext, hasPrev, hasNext }: ImageModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-[85vw] max-h-[85vh] p-4" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 p-2 bg-[#070812] border border-[rgba(139,92,246,0.18)] rounded-full hover:border-[rgba(59,130,246,0.28)] transition-all duration-200 shadow-lg"
        >
          <X className="w-4 h-4 text-[#E9ECFF]" />
        </button>

        {/* Navigation buttons */}
        {hasPrev && (
          <button
            onClick={onPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-[#070812]/80 border border-[rgba(139,92,246,0.18)] rounded-full hover:border-[rgba(59,130,246,0.28)] transition-all duration-200 shadow-lg"
          >
            <ArrowLeft className="w-5 h-5 text-[#E9ECFF]" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-[#070812]/80 border border-[rgba(139,92,246,0.18)] rounded-full hover:border-[rgba(59,130,246,0.28)] transition-all duration-200 shadow-lg"
          >
            <ArrowLeft className="w-5 h-5 text-[#E9ECFF] rotate-180" />
          </button>
        )}

        <div className="bg-[#070812] border border-[rgba(139,92,246,0.18)] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[rgba(139,92,246,0.18)]">
            <h3 className="text-lg font-medium text-[#E9ECFF] text-center">{title}</h3>
          </div>
          <div className="p-4">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[70vh] object-contain mx-auto"
            />
          </div>
          <div className="p-4 border-t border-[rgba(139,92,246,0.18)] flex justify-center gap-3">
            <a
              href={src}
              download
              className="px-4 py-2 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] transition-all duration-200 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PNG
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[rgba(139,92,246,0.18)] text-[#E9ECFF] font-medium rounded-lg hover:border-[rgba(59,130,246,0.28)] hover:bg-[rgba(59,130,246,0.08)] transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PlotViewportProps {
  children: React.ReactNode;
  className?: string;
}

function PlotViewport({ children, className = "" }: PlotViewportProps) {
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-black/30 border border-white/5 ${className}`}>
      {children}
      {/* Unifying overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(139,92,246,0.06)] via-[rgba(59,130,246,0.04)] to-[rgba(236,72,153,0.03)] mix-blend-screen pointer-events-none"></div>
    </div>
  );
}

interface ImageCardProps {
  src: string;
  alt: string;
  title: string;
  containerHeight: string;
  className?: string;
}

function ImageCard({ src, alt, title, containerHeight, className = "" }: ImageCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Panel className={`${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#E9ECFF]">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="p-1.5 text-[rgba(233,236,255,0.65)] hover:text-[#E9ECFF] hover:bg-white/5 rounded-lg transition-all duration-200"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <a
              href={src}
              download
              className="p-1.5 text-[rgba(233,236,255,0.65)] hover:text-[#E9ECFF] hover:bg-white/5 rounded-lg transition-all duration-200"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Image Container */}
        <PlotViewport className={containerHeight}>
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-contain"
            draggable={false}
            loading="lazy"
          />
        </PlotViewport>
      </Panel>

      {modalOpen && (
        <ImageModal
          src={src}
          alt={alt}
          title={title}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

export default function TrainerAdvancedVisuals() {
  const { runId, analysisId } = useParams<{ runId: string; analysisId: string }>();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId || !analysisId) return;
    fetchAnalysisResult();
  }, [runId, analysisId]);

  const fetchAnalysisResult = async () => {
    try {
      setLoading(true);
      const result = await trainerApi.getAnalysisStatus(runId!, analysisId!);
      setAnalysisResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis results');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = () => {
    if (!runId || !analysisId) return;
    trainerApi.downloadAnalysis(runId, analysisId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070812] relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-96 h-96 bg-[rgba(59,130,246,0.18)] rounded-full blur-3xl"></div>
          <div className="absolute top-40 right-20 w-80 h-80 bg-[rgba(139,92,246,0.18)] rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-[rgba(236,72,153,0.12)] rounded-full blur-3xl"></div>
        </div>

        <div className="relative pt-24 pb-16">
          <div className="container-wide">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[rgba(139,92,246,0.18)] border-t-[rgba(59,130,246,0.28)] rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-[rgba(233,236,255,0.65)]">Loading analysis results...</p>
              </div>
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
          <div className="container-wide">
            <div className="max-w-4xl mx-auto">
              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-xl p-8">
                <h1 className="text-xl font-semibold text-[#E9ECFF] mb-4">Analysis Error</h1>
                <p className="text-[rgba(233,236,255,0.65)] mb-6">{error}</p>
                <Link to={`/tools/trainer`}>
                  <button className="px-6 py-3 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] transition-all duration-200">
                    Back to Trainer
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysisResult) return null;

  const generatedFiles = analysisResult.generated_files || [];
  const gradcamOverlay = generatedFiles.find(f => f.includes('gradcam_overlay'));
  const saliency = generatedFiles.find(f => f.includes('saliency'));
  const gradcamRaw = generatedFiles.find(f => f.includes('gradcam_raw'));
  const filterFiles = generatedFiles.filter(f => f.startsWith('filter_'));
  const activationFiles = generatedFiles.filter(f => f.includes('activation') || f.includes('activations'));

  return (
    <div className="min-h-screen bg-[#070812] relative overflow-hidden">
      {/* Enhanced Background gradients */}
      <div className="absolute inset-0 opacity-25">
        <div className="absolute top-20 left-10 w-96 h-96 bg-[rgba(59,130,246,0.18)] rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-20 w-80 h-80 bg-[rgba(139,92,246,0.18)] rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-[rgba(236,72,153,0.12)] rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[rgba(139,92,246,0.08)] rounded-full blur-3xl"></div>
      </div>

      <div className="relative pt-24 pb-20">
        <div className="max-w-[1400px] mx-auto px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <Link to={`/tools/trainer`}>
                <button className="p-2 bg-[rgba(255,255,255,0.03)] border border-[rgba(139,92,246,0.18)] rounded-lg hover:border-[rgba(59,130,246,0.28)] transition-all duration-200">
                  <ArrowLeft className="w-5 h-5 text-[#E9ECFF]" />
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-[#E9ECFF]">CNN Analysis Results</h1>
                <p className="text-[rgba(233,236,255,0.65)] text-sm">Advanced visualization of model internals</p>
              </div>
            </div>

            <button
              onClick={handleDownloadZip}
              className="px-4 py-2 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] transition-all duration-200 flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Download All ({generatedFiles.length})
            </button>
          </div>

          {/* Hero Section - Model Attention */}
          {(gradcamOverlay || saliency || gradcamRaw) && (
            <div className="mb-16">
              <SectionHeader title="Model Attention" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Large attention overlay */}
                <div className="lg:col-span-2">
                  {gradcamOverlay && (
                    <ImageCard
                      src={`${API_BASE}/trainer/runs/${runId}/analysis/${analysisId}/images/${gradcamOverlay}`}
                      alt="Grad-CAM overlay showing model attention on the original chart"
                      title="Attention Overlay"
                      containerHeight="h-[480px]"
                    />
                  )}
                </div>

                {/* Right: Stacked saliency and gradcam raw */}
                <div className="space-y-8">
                  {saliency && (
                    <ImageCard
                      src={`${API_BASE}/trainer/runs/${runId}/analysis/${analysisId}/images/${saliency}`}
                      alt="Saliency map showing pixel-wise importance"
                      title="Saliency Map"
                      containerHeight="h-[220px]"
                    />
                  )}
                  {gradcamRaw && (
                    <ImageCard
                      src={`${API_BASE}/trainer/runs/${runId}/analysis/${analysisId}/images/${gradcamRaw}`}
                      alt="Raw Grad-CAM heatmap data"
                      title="Grad-CAM Raw"
                      containerHeight="h-[220px]"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Filters Section */}
          {filterFiles.length > 0 && (
            <div className="mb-16">
              <SectionHeader title="Learned Filters" />
              <div className="space-y-6">
                {filterFiles.map((file, index) => (
                  <ImageCard
                    key={file}
                    src={`${API_BASE}/trainer/runs/${runId}/analysis/${analysisId}/images/${file}`}
                    alt={`Learned convolutional filter ${index + 1}`}
                    title={`Filter ${index + 1}`}
                    containerHeight="h-[280px]"
                    className="max-w-sm mx-auto"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Activations Section */}
          {activationFiles.length > 0 && (
            <div className="mb-16">
              <SectionHeader title="Feature Activations" />
              <div className="space-y-8">
                {/* Group activation files by layer */}
                {Array.from(new Set(activationFiles.map(f => {
                  const match = f.match(/activations?_(.+?)(?=\.png|$)/);
                  return match ? match[1] : 'unknown';
                }))).map(layerName => {
                  const layerFiles = activationFiles.filter(f =>
                    f.includes(`activations_${layerName}`) || f.includes(`activation_${layerName}`)
                  );
                  const meanActivation = layerFiles.find(f => f.includes('mean'));
                  const featureMaps = layerFiles.filter(f => !f.includes('mean'));

                  return (
                    <Panel key={layerName} className="p-8">
                      <h3 className="text-sm font-medium text-[rgba(233,236,255,0.65)] mb-6 uppercase tracking-wider">
                        {layerName.replace(/_/g, ' ')}
                      </h3>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {meanActivation && (
                          <ImageCard
                            src={`${API_BASE}/trainer/runs/${runId}/analysis/${analysisId}/images/${meanActivation}`}
                            alt={`Mean activation for ${layerName}`}
                            title="Mean Activation"
                            containerHeight="h-[320px]"
                          />
                        )}
                        {featureMaps.length > 0 && (
                          <ImageCard
                            src={`${API_BASE}/trainer/runs/${runId}/analysis/${analysisId}/images/${featureMaps[0]}`}
                            alt={`Feature maps for ${layerName}`}
                            title="Feature Maps"
                            containerHeight="h-[320px]"
                          />
                        )}
                      </div>
                    </Panel>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-12 border-t border-[rgba(139,92,246,0.18)]">
            <div className="flex justify-center">
              <Link to={`/tools/trainer`}>
                <button className="px-6 py-3 border border-[rgba(139,92,246,0.18)] text-[#E9ECFF] font-medium rounded-lg hover:border-[rgba(59,130,246,0.28)] hover:bg-[rgba(59,130,246,0.08)] transition-all duration-200">
                  Back to Trainer
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
