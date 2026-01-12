import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GlobalBackground from "@/components/AppBackground";
import TechBackground from "@/components/TechBackground";
import ActiveRunBanner from "@/components/ActiveRunBanner";
import Index from "./pages/Index";
import Vision from "./pages/Vision";
import Contact from "./pages/Contact";
import Docs from "./pages/Docs";
import NotFound from "./pages/NotFound";
import Founders from "./pages/Founders";
import RunLog from "./pages/RunLog";
import Account from "./pages/Account";

// Product landing pages
import LiveBots from "./pages/products/LiveBots";
import TrainBot from "./pages/products/TrainBot";
import Backtest from "./pages/products/Backtest";
import GenerateData from "./pages/products/GenerateData";
import OptimizeLabeling from "./pages/products/OptimizeLabeling";
import LabelingOptimizerTechnical from "./pages/products/LabelingOptimizerTechnical";
import LabelingOptimizerRun from "./pages/products/LabelingOptimizerRun";
import LabelingOptimizerResults from "./pages/products/LabelingOptimizerResults";
import TrainerAdvancedVisuals from "./pages/products/TrainerAdvancedVisuals";

// Tool pages
import Generator from "./pages/Generator";
import Trainer from "./pages/Trainer";
import Backtester from "./pages/Backtester";
import BacktesterResults from "./pages/BacktesterResults";
import Optimizer from "./pages/tools/Optimizer";

const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-page-enter">
      {children}
    </div>
  );
}

const AppRoutes = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <GlobalBackground />
      <TechBackground />
      <ScrollToTop />
      <Header />
      <ActiveRunBanner />
      <main className="flex-grow pt-24">
        <Routes>
          {/* Main pages */}
          <Route path="/" element={<PageWrapper><Index /></PageWrapper>} />
          <Route path="/vision" element={<PageWrapper><Vision /></PageWrapper>} />
          <Route path="/founder" element={<PageWrapper><Founders /></PageWrapper>} />
          <Route path="/account" element={<PageWrapper><Account /></PageWrapper>} />
          <Route path="/contact" element={<PageWrapper><Contact /></PageWrapper>} />
          <Route path="/docs" element={<PageWrapper><Docs /></PageWrapper>} />

          {/* Product landing pages */}
          <Route path="/products/live-bots" element={<PageWrapper><LiveBots /></PageWrapper>} />
          <Route path="/products/train-bot" element={<PageWrapper><TrainBot /></PageWrapper>} />
          <Route path="/products/backtest" element={<PageWrapper><Backtest /></PageWrapper>} />
          <Route path="/products/generate-data" element={<PageWrapper><GenerateData /></PageWrapper>} />
          <Route path="/products/optimize-labeling" element={<PageWrapper><OptimizeLabeling /></PageWrapper>} />
          <Route path="/products/labeling-optimizer/technical" element={<PageWrapper><LabelingOptimizerTechnical /></PageWrapper>} />
          <Route path="/products/labeling-optimizer/run/:runId" element={<PageWrapper><LabelingOptimizerRun /></PageWrapper>} />
          <Route path="/products/labeling-optimizer/results/:runId" element={<PageWrapper><LabelingOptimizerResults /></PageWrapper>} />
          <Route path="/products/trainer/analysis/:runId/:analysisId" element={<PageWrapper><TrainerAdvancedVisuals /></PageWrapper>} />

          {/* Tool pages */}
          <Route path="/tools/generator" element={<PageWrapper><Generator /></PageWrapper>} />
          <Route path="/tools/trainer" element={<PageWrapper><Trainer /></PageWrapper>} />
          <Route path="/tools/backtester" element={<PageWrapper><Backtester /></PageWrapper>} />
          <Route path="/tools/backtester/runs/:runId" element={<PageWrapper><BacktesterResults /></PageWrapper>} />
          <Route path="/tools/optimizer" element={<PageWrapper><Optimizer /></PageWrapper>} />
          <Route path="/tools/run-log" element={<PageWrapper><RunLog /></PageWrapper>} />

          {/* Fallback */}
          <Route path="*" element={<PageWrapper><NotFound /></PageWrapper>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
