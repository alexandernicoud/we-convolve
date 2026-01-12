import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import CnnScrollStory from "@/components/vision/CnnScrollStory";

// Concept Animation Component - Three-Stage Visual Pipeline
function ConceptAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // Scroll-driven transformations
  const datasetOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.2, 0.8, 0.8, 0.2]);
  const datasetTranslateX = useTransform(scrollYProgress, [0, 0.5, 1], [0, 15, 30]);

  const featureOpacity = useTransform(scrollYProgress, [0, 0.4, 0.8, 1], [0.1, 0.3, 0.9, 0.3]);
  const featureScale = useTransform(scrollYProgress, [0, 0.6, 1], [0.8, 1, 1.1]);

  const candleBreath = useTransform(scrollYProgress, [0, 0.5, 1], [0.98, 1.02, 0.98]);

  return (
    <motion.div
      ref={containerRef}
      className="relative w-full max-w-6xl mx-auto h-[700px] flex items-center justify-center"
    >
      <svg viewBox="0 0 1000 400" className="w-full h-full">
        {/* 1. LEFT BLOCK - Visual Dataset Tiles (Training Samples) */}
        <motion.g style={{ opacity: datasetOpacity, x: datasetTranslateX }}>
          {/* 4x4 grid of dataset tiles */}
          {Array.from({ length: 16 }, (_, i) => {
            const row = Math.floor(i / 4);
            const col = i % 4;
            const baseHue = 240 + (i % 3) * 20; // Blue to violet variation
            return (
              <motion.rect
                key={`tile-${i}`}
                x={50 + col * 50}
                y={150 + row * 40}
                width="40"
                height="30"
                rx="4"
                fill={`hsl(${baseHue}, 60%, 55%)`}
                opacity="0.6"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: row * 0.2 + col * 0.1,
                  ease: "easeInOut"
                }}
              />
            );
          })}
        </motion.g>

        {/* 2. CENTER - Market Structure Source (Single Candlestick) */}
        <g>
          {/* Main candlestick - symbolic representation */}
          <motion.g style={{ scaleY: candleBreath }}>
            {/* Wick */}
            <line
              x1="475"
              y1="120"
              x2="475"
              y2="220"
              stroke="#F5F7FF"
              strokeWidth="1.5"
              opacity="0.5"
            />
            {/* Body */}
            <rect
              x="470"
              y="160"
              width="10"
              height="35"
              fill="#22D3EE"
              opacity="0.8"
              rx="1"
            />
          </motion.g>

          {/* Subtle breathing animation on wick ends */}
          <motion.circle
            cx="475"
            cy="145"
            r="2.5"
            fill="#7C5CFF"
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [0.8, 1.2, 0.8]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.circle
            cx="475"
            cy="195"
            r="2.5"
            fill="#FF4FD8"
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [0.8, 1.2, 0.8]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              delay: 1,
              ease: "easeInOut"
            }}
          />
        </g>

        {/* 3. RIGHT BLOCK - Learned Feature Space */}
        <motion.g style={{ opacity: featureOpacity, scale: featureScale }}>
          {/* Symmetric grid of feature nodes */}
          {Array.from({ length: 15 }, (_, i) => {
            const positions = [
              // Center cluster
              [750, 180], [780, 170], [810, 185],
              // Upper ring
              [735, 150], [765, 145], [795, 155], [825, 160],
              // Lower ring
              [735, 210], [765, 220], [795, 215], [825, 205],
              // Outer points
              [720, 130], [840, 175], [720, 230], [840, 225]
            ];

            const [x, y] = positions[i] || [750, 180];
            const hue = 270 + (i % 4) * 15; // Violet to magenta

            return (
              <motion.circle
                key={`feature-${i}`}
                cx={x}
                cy={y}
                r="7"
                fill={`hsl(${hue}, 70%, 60%)`}
                opacity="0.4"
                animate={{
                  opacity: [0.1, 0.8, 0.1],
                  scale: [0.9, 1.1, 0.9]
                }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut"
                }}
              />
            );
          })}
        </motion.g>

        {/* Very subtle flow hint (minimal visual connection) */}
        <motion.path
          d="M 320 200 Q 475 190 630 200"
          stroke="url(#flowGradient)"
          strokeWidth="1"
          fill="none"
          opacity="0.08"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />
        <defs>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#2E6BFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FF4FD8" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
}

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

export default function Vision() {
  return (
    <div className="relative">
      {/* New CNN Scroll Story Section */}
      <CnnScrollStory />

      {/* Legacy Vision Content */}
      <div className="relative">
        <div className="text-center py-16 border-t border-white/10">
          <h2 className="text-2xl md:text-3xl font-light text-[#F5F7FF]/60 mb-2">
            Legacy Vision Content
          </h2>
          <p className="text-sm text-[#F5F7FF]/40">
            Original vision sections below - preserved for reference
          </p>
        </div>

        {/* Hero Section */}
        <section className="relative min-h-[150vh] flex flex-col items-center justify-center px-6 pt-24 pb-32">
        <div className="container-aligned text-center max-w-7xl">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="mb-16"
          >
            <h1 className="text-6xl md:text-7xl lg:text-8xl xl:text-9xl 2xl:text-[12rem] font-light tracking-tight bg-gradient-to-r from-[#F5F7FF] via-[#7C5CFF] via-[#2E6BFF] to-[#FF4FD8] bg-clip-text text-transparent leading-none mb-12">
                We Build Visual Intelligence for Markets
              </h1>
            <p className="text-2xl md:text-3xl lg:text-4xl text-[#F5F7FF]/62 leading-relaxed">
                Infrastructure for discovering structure in price.
              </p>
          </motion.div>

          {/* Concept Animation */}
          <ConceptAnimation />
            </div>
      </section>

      {/* The Idea Section */}
      <ScrollFade className="relative min-h-screen flex items-center px-6 py-32">
        <div className="container-aligned max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              viewport={{ once: false, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] bg-clip-text text-transparent mb-8">
                The Idea
              </h2>
              <div className="space-y-6 text-[#F5F7FF]/70 text-lg leading-relaxed">
                <p>
                  Markets encode information <span className="text-[#22D3EE]">visually</span>.
                  Price, time, and volume form structures that repeat across instruments and timeframes.
                </p>
                <p>
                  Traders rely on charts because patterns are spatial and contextual — not purely numerical.
                </p>
              </div>
            </motion.div>

            {/* Faint candlestick silhouettes */}
            <div className="relative h-64 opacity-[0.03]">
              <motion.div
                animate={{
                  y: [-20, 20, -20],
                  opacity: [0.02, 0.05, 0.02]
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0"
              >
                <svg viewBox="0 0 200 100" className="w-full h-full">
                  <rect x="85" y="30" width="2" height="25" fill="#10B981" />
                  <rect x="95" y="40" width="2" height="20" fill="#EF4444" />
                  <rect x="105" y="25" width="2" height="30" fill="#10B981" />
                </svg>
              </motion.div>
            </div>
          </div>
        </div>
      </ScrollFade>

      {/* Why Visual AI Section */}
      <ScrollFade className="relative min-h-screen flex items-center px-6 py-32">
        <div className="container-aligned max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              viewport={{ once: false, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] bg-clip-text text-transparent mb-8">
                Why Visual AI
              </h2>
              <div className="space-y-6 text-[#F5F7FF]/70 text-lg leading-relaxed">
                <p>
                  Computer vision transformed fields where structure is implicit.
                </p>
                <p>
                  Markets share this property — yet visual learning remains largely inaccessible in trading research.
                </p>
                <p>
                  We built infrastructure to change that.
                </p>
              </div>
            </motion.div>

            {/* Abstract comparison visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              viewport={{ once: false, margin: "-100px" }}
              className="relative h-64"
            >
              <svg viewBox="0 0 300 200" className="w-full h-full">
                {/* Numeric streams dissolving */}
                <motion.g
                  animate={{
                    opacity: [0.8, 0.3, 0.8],
                    scale: [1, 0.9, 1]
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <text x="50" y="80" fill="#F5F7FF" opacity="0.3" fontSize="12">1.234</text>
                  <text x="80" y="100" fill="#F5F7FF" opacity="0.2" fontSize="12">5.678</text>
                  <text x="60" y="120" fill="#F5F7FF" opacity="0.25" fontSize="12">9.012</text>
                </motion.g>

                {/* Chart structure retaining */}
                <motion.g
                  animate={{
                    opacity: [0.2, 0.8, 0.2],
                    scale: [0.8, 1.1, 0.8]
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    delay: 2,
                    ease: "easeInOut"
                  }}
                >
                  <rect x="180" y="60" width="80" height="40" fill="none" stroke="#2E6BFF" strokeWidth="2" opacity="0.6" />
                  <line x1="200" y1="70" x2="240" y2="90" stroke="#7C5CFF" strokeWidth="3" opacity="0.7" />
                  <circle cx="220" cy="80" r="4" fill="#FF4FD8" opacity="0.8" />
                </motion.g>
              </svg>
            </motion.div>
          </div>
        </div>
      </ScrollFade>

      {/* Our Thesis Section */}
      <ScrollFade className="relative min-h-screen flex items-center px-6 py-32">
        <div className="container-aligned max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            viewport={{ once: false, margin: "-100px" }}
          >
            <h2 className="text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] bg-clip-text text-transparent mb-12">
                Our Thesis
              </h2>
            <div className="space-y-6 text-[#F5F7FF]/70 text-lg leading-relaxed">
              <p>
                The future of systematic trading lies at the intersection of computer vision and market microstructure.
              </p>
              <p>
                Visual representations of price action contain information numerical abstractions discard.
              </p>
              <p className="font-medium">
                This is not about prediction.
                <br />
                It is about <span className="text-[#FF4FD8]">perception</span>.
                </p>
              </div>
          </motion.div>

          {/* Feature map overlays */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            viewport={{ once: false, margin: "-100px" }}
            className="mt-16 relative h-48"
          >
            <svg viewBox="0 0 400 150" className="w-full h-full opacity-20">
              {Array.from({ length: 8 }, (_, i) => (
                <motion.rect
                  key={i}
                  x={50 + i * 35}
                  y={40 + Math.sin(i) * 20}
                  width="25"
                  height="25"
                  fill="none"
                  stroke={`hsl(${260 + i * 20}, 70%, 60%)`}
                  strokeWidth="1"
                  opacity="0.4"
                  animate={{
                    opacity: [0.1, 0.6, 0.1],
                    scale: [0.9, 1.1, 0.9]
                  }}
                  transition={{
                    duration: 4 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.3,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </svg>
          </motion.div>
        </div>
      </ScrollFade>

      {/* The Method Section */}
      <ScrollFade className="relative min-h-screen flex items-center px-6 py-32">
        <div className="container-aligned max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              viewport={{ once: false, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] bg-clip-text text-transparent mb-8">
                The Method
              </h2>
              <div className="space-y-6 text-[#F5F7FF]/70 text-lg leading-relaxed">
                <p>
                  We generate large-scale labeled datasets from historical candlestick data.
                </p>
                <p>
                  Each image captures a window of price action.
                  <br />
                  Each label describes what followed.
                </p>
                <p>
                  Models learn visual fingerprints of market behavior.
                </p>
              </div>
            </motion.div>

            {/* Tiled images animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              viewport={{ once: false, margin: "-100px" }}
              className="relative h-64"
            >
              <svg viewBox="0 0 250 150" className="w-full h-full opacity-30">
                {Array.from({ length: 12 }, (_, i) => {
                  const row = Math.floor(i / 4);
                  const col = i % 4;
                  return (
                    <motion.rect
                      key={i}
                      x={20 + col * 50}
                      y={20 + row * 30}
                      width="40"
                      height="25"
                      fill={`hsl(${240 + i * 15}, 60%, 50%)`}
                      opacity="0.5"
                      rx="2"
                      animate={{
                        opacity: [0.2, 0.7, 0.2],
                        scale: [0.9, 1.1, 0.9]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: i * 0.2,
                        ease: "easeInOut"
                      }}
                    />
                  );
                })}
                {/* Label dots */}
                {Array.from({ length: 4 }, (_, i) => (
                  <motion.circle
                    key={`label-${i}`}
                    cx={180 + i * 15}
                    cy={80 + Math.sin(i) * 10}
                    r="3"
                    fill={i % 2 === 0 ? "#22D3EE" : "#FF4FD8"}
                    animate={{
                      opacity: [0.3, 1, 0.3],
                      scale: [0.8, 1.2, 0.8]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.5,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </svg>
            </motion.div>
          </div>
        </div>
      </ScrollFade>

      {/* What We're Building Section */}
      <ScrollFade className="relative min-h-screen flex items-center px-6 py-32">
        <div className="container-aligned max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            viewport={{ once: false, margin: "-100px" }}
            className="text-center"
          >
            <h2 className="text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] bg-clip-text text-transparent mb-12">
              What We're Building
            </h2>

            <div className="space-y-4 text-[#F5F7FF]/70 text-lg leading-relaxed mb-12">
              <p>• Dataset generators for visual research</p>
              <p>• Labeling and optimization tools</p>
              <p>• CNN training infrastructure</p>
              <p>• Visualization-first analytics</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/products/train-bot">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white font-medium rounded-lg hover:from-[#8B6CFF] hover:to-[#3D7BFF] hover:shadow-lg hover:shadow-[#7C5CFF]/25 transition-all duration-200"
                >
                  Build your own bot
                </motion.button>
              </Link>

              <Link to="/tools">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 border border-[#7C5CFF]/55 text-[#F5F7FF] font-medium rounded-lg hover:bg-[#7C5CFF]/8 transition-all duration-200"
                >
                  Explore the tools
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </ScrollFade>

      {/* Who This Is For Section */}
      <ScrollFade className="relative min-h-screen flex items-center px-6 py-32">
        <div className="container-aligned max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            viewport={{ once: false, margin: "-100px" }}
          >
            <div className="space-y-6 text-[#F5F7FF]/70 text-lg leading-relaxed mb-8">
              <p>
                For hobby quants.
                <br />
                For independent researchers.
                <br />
                For those exploring a new field.
              </p>
              <p className="font-medium">
                This is a lab — not a black box.
              </p>
            </div>

            <p className="text-sm text-[#F5F7FF]/50">
              Research infrastructure. Not financial advice.
            </p>
          </motion.div>
      </div>
      </ScrollFade>

        {/* Bottom spacing for footer */}
        <div className="h-32" />
      </div>
    </div>
  );
}
