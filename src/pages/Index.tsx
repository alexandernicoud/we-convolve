import { Link } from "react-router-dom";
import { ArrowRight, ArrowDown } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import trainBotVisual from "@/assets/train-bot-visual.png";
import TypewriterText from "@/components/TypewriterText";
import PinnedProductCarousel, {
  type PinnedProduct,
} from "@/components/PinnedProductCarousel";

// Scroll-based fade component
function ScrollFade({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ opacity }}
    >
      {children}
    </motion.div>
  );
}
import MetricsCards from "@/components/MetricsCards";
import Button from "@/components/ui/Button";

const products: PinnedProduct[] = [
  {
    title: "Access live trading bots",
    description:
      "Observe live automated systems with professional dashboards for execution quality, positions, and regime-aware performance monitoring.",
    href: "/products/live-bots",
    image: null,
  },
  {
    title: "Train your own bot",
    description:
      "Train convolutional models on your labeled charts, iterate on architecture and hyperparameters, and track learning curves as your dataset evolves.",
    href: "/products/train-bot",
    image: trainBotVisual,
  },
  {
    title: "Backtest your bot",
    description:
      "Run controlled historical simulations to understand stability across regimes, quantify drawdowns, and compare variants under identical assumptions.",
    href: "/products/backtest",
    image: null,
  },
  {
    title: "Generate training data",
    description:
      "Generate labeled chart sets at scale with configurable parameters, holding periods, and labeling rules that match your research workflow.",
    href: "/products/generate-data",
    image: null,
  },
  {
    title: "Optimize labeling systems",
    description:
      "Search labeling parameter space systematically to identify configurations that improve downstream model generalization and consistency.",
    href: "/products/optimize-labeling",
    image: null,
  },
];

const metrics = [
  {
    value: "+1000",
    subtitle: "Train Bots on +1000 assets",
  },
  {
    value: "50y+",
    subtitle: "Backtest on over 50y of data",
  },
  {
    value: "125’000",
    subtitle: "Analyze 125'000 different parameter constellations in one run.",
  },
  {
    value: ">50",
    subtitle: ">50 clicks to generate your own trading bot",
  },
];

export default function Index() {
  return (
    <main className="min-h-screen relative overflow-hidden pt-2">

      {/* Hero Section (align with header container) */}
      <section className="relative pt-8 pb-16 flex items-center">
        <div className="container-aligned w-full relative">
          <div className="max-w-5xl">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[0.95] mb-8 opacity-0 animate-fade-up">
              <span className="block bg-gradient-to-r from-[#F5F7FF] via-[#7C5CFF] to-[#2E6BFF] bg-clip-text text-transparent">TRADE</span>
              <span className="block bg-gradient-to-r from-[#7C5CFF] via-[#2E6BFF] to-[#FF4FD8] bg-clip-text text-transparent">DIFFERENTLY.</span>
              <span className="block bg-gradient-to-r from-[#F5F7FF] via-[#7C5CFF] to-[#2E6BFF] bg-clip-text text-transparent">TRADE</span>
              <span className="block bg-gradient-to-r from-[#7C5CFF] via-[#2E6BFF] to-[#FF4FD8] bg-clip-text text-transparent">VISUALLY.</span>
              <span className="block bg-gradient-to-r from-[#F5F7FF] via-[#7C5CFF] to-[#2E6BFF] bg-clip-text text-transparent">TRADE</span>
              <span className="block bg-gradient-to-r from-[#7C5CFF] via-[#2E6BFF] to-[#FF4FD8] bg-clip-text text-transparent">CONVOLUTIONAL.</span>
            </h1>

            <p
              className="text-lg md:text-xl text-[#F5F7FF]/62 mb-10 opacity-0 animate-fade-up"
              style={{ animationDelay: "100ms" }}
            >
              Perceive the markets through the <span className="text-[#22D3EE]">AI-lense</span>.
            </p>

            <div
              className="flex flex-wrap items-center gap-3 opacity-0 animate-fade-up"
              style={{ animationDelay: "200ms" }}
            >
              <Link to="/products/live-bots">
                <Button variant="primary" size="lg">
                  Try the Bot
                </Button>
              </Link>
              <Link to="/products/train-bot">
                <Button variant="secondary" size="lg">
                  Build Your Bot
                </Button>
              </Link>
              <Link to="/vision">
                <Button variant="secondary" size="lg" className="inline-flex items-center gap-2">
                  Learn More
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#quote">
                <Button variant="secondary" size="lg" className="inline-flex items-center gap-2">
                  View what we build
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <ScrollFade className="relative min-h-screen flex items-center justify-center py-32">
        <div className="container-aligned relative z-10">
          <div className="block cursor-pointer">
            <TypewriterText text="markets manifest visually" />
          </div>
        </div>
      </ScrollFade>

      {/* Products Section - pinned scroll-driven showcase */}
      <PinnedProductCarousel title="What We Built:" products={products} />

      {/* Metrics page */}
            <MetricsCards items={metrics} />

            <div className="h-32" />
    </main>
  );
}
