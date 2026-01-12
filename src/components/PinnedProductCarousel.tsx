import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface PinnedProduct {
  title: string;
  description: string;
  href: string;
  image?: string | null;
}

// Extend window interface for TradingView
declare global {
  interface Window {
    TradingView: {
      widget: new (config: any) => any;
    };
  }
}

// TradingView Widget Component
function TradingViewWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": "NASDAQ:SPY",
      "interval": "D",
      "timezone": "America/New_York",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "enable_publishing": false,
      "withdateranges": true,
      "hide_side_toolbar": false,
      "allow_symbol_change": true,
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650",
      "container_id": "tradingview-widget"
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current && containerRef.current.contains(script)) {
        containerRef.current.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="tradingview-widget-container w-full h-full" ref={containerRef}>
      <div className="tradingview-widget-container__widget w-full h-full"></div>
            </div>
  );
}

// Bot Metrics Component
function BotMetrics() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
      <div className="bg-[#070815]/80 backdrop-blur-sm border border-white/8 rounded-lg p-2 text-center">
        <div className="text-[#22D3EE] font-semibold text-sm">74%</div>
        <div className="text-[#F5F7FF]/62">Confidence</div>
      </div>
      <div className="bg-[#070815]/80 backdrop-blur-sm border border-white/8 rounded-lg p-2 text-center">
        <div className="text-[#2E6BFF] font-semibold text-sm">61%</div>
        <div className="text-[#F5F7FF]/62">Accuracy</div>
      </div>
      <div className="bg-[#070815]/80 backdrop-blur-sm border border-white/8 rounded-lg p-2 text-center">
        <div className="text-[#7C5CFF] font-semibold text-sm">TREND</div>
        <div className="text-[#F5F7FF]/62">Regime</div>
            </div>
      <div className="bg-[#070815]/80 backdrop-blur-sm border border-white/8 rounded-lg p-2 text-center">
        <div className="text-[#FF4FD8] font-semibold text-sm">LONG</div>
        <div className="text-[#F5F7FF]/62">Signal</div>
          </div>
      <div className="col-span-2 bg-[#070815]/80 backdrop-blur-sm border border-white/8 rounded-lg p-2 text-center">
        <div className="text-[#FF4FD8] font-semibold text-sm">LOW</div>
        <div className="text-[#F5F7FF]/62">Risk Level</div>
        </div>
    </div>
  );
}

export default function PinnedProductCarousel({
  title,
  products,
}: {
  title: string;
  products: PinnedProduct[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const nextProduct = () => {
    setActiveIndex((prev) => (prev + 1) % products.length);
  };

  const prevProduct = () => {
    setActiveIndex((prev) => (prev - 1 + products.length) % products.length);
  };

  // Animation variants
  const cardVariants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  const transition = {
    duration: 0.4,
    ease: [0.25, 0.46, 0.45, 0.94],
  };

  return (
    <section className="relative min-h-screen flex items-center py-12">
      <div className="container-aligned w-full">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight bg-gradient-to-r from-[#F5F7FF] via-[#7C5CFF] via-[#2E6BFF] to-[#FF4FD8] bg-clip-text text-transparent mb-8">
          {title}
        </h2>

        <div className="relative flex items-center justify-center min-h-[600px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transition}
              className="w-full max-w-5xl mx-auto"
            >
              <article className="bg-[#070815]/60 backdrop-blur-sm border border-white/8 rounded-xl p-5 md:p-8 shadow-2xl">
                <div className="flex flex-col md:flex-row gap-5 md:gap-8">
                  {/* Visual Area */}
                  <div className="md:w-2/5 aspect-[4/3] bg-[#070815]/40 rounded-lg flex flex-col border border-white/8 flex-shrink-0 overflow-hidden">
                    {activeIndex === 0 ? (
                      // First card gets TradingView widget + bot metrics
                      <>
                        <div className="flex-1 relative">
                          <TradingViewWidget />
                        </div>
                        <BotMetrics />
                      </>
                    ) : products[activeIndex].image ? (
                      <img
                        src={products[activeIndex].image}
                        alt={`${products[activeIndex].title} visual`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[#F5F7FF]/40">Visual</span>
                      </div>
                    )}
        </div>

                  {/* Content */}
                  <div className="flex flex-col justify-center flex-grow">
                    <h3 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-semibold text-[#F5F7FF] mb-2 md:mb-3 leading-tight">
                      {products[activeIndex].title}
                    </h3>
                    <p className="text-[#F5F7FF]/62 mb-4 md:mb-5 leading-relaxed text-sm md:text-base">
                      {products[activeIndex].description}
                    </p>
                    <Link to={products[activeIndex].href}>
                      <button className="px-4 py-2 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] hover:shadow-lg hover:shadow-[#7C5CFF]/25 transition-all duration-200 inline-flex items-center gap-2">
                        <span className="text-white">Try now</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                </div>
              </article>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrows */}
          <button
            onClick={prevProduct}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 w-12 h-12 bg-[#070815]/80 backdrop-blur-sm border border-white/8 rounded-full flex items-center justify-center text-[#F5F7FF] hover:bg-[#7C5CFF]/20 hover:border-[#7C5CFF]/50 transition-all duration-200 z-10"
            aria-label="Previous product"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={nextProduct}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 w-12 h-12 bg-[#070815]/80 backdrop-blur-sm border border-white/8 rounded-full flex items-center justify-center text-[#F5F7FF] hover:bg-[#7C5CFF]/20 hover:border-[#7C5CFF]/50 transition-all duration-200 z-10"
            aria-label="Next product"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Dots Indicator */}
          <div className="flex justify-center mt-8 gap-2">
          {products.map((_, i) => (
              <button
              key={i}
                onClick={() => setActiveIndex(i)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                i === activeIndex
                    ? "bg-[#22D3EE] scale-125"
                    : "bg-[#F5F7FF]/30 hover:bg-[#F5F7FF]/50"
              }`}
                aria-label={`Go to product ${i + 1}`}
            />
          ))}
        </div>
      </div>
      </div>
    </section>
  );
}
