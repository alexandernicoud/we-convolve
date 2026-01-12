import { useEffect, useRef, useState } from "react";

interface TypewriterTextProps {
  text: string;
  className?: string;
  charDelayMs?: number;
}

function TypewriterAnimation({
  text,
  charDelayMs,
  key: animationKey
}: {
  text: string;
  charDelayMs: number;
  key: number;
}) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText(""); // Reset on new animation
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setDisplayedText(text.slice(0, index));
      if (index >= text.length) window.clearInterval(interval);
    }, charDelayMs);

    return () => window.clearInterval(interval);
  }, [animationKey, text, charDelayMs]);

  return <>{displayedText}</>;
}

export default function TypewriterText({
  text,
  className,
  charDelayMs = 50,
}: TypewriterTextProps) {
  const [replayKey, setReplayKey] = useState(0);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasIntersecting = isIntersecting;
        const nowIntersecting = entry.isIntersecting;

        setIsIntersecting(nowIntersecting);

        // Trigger replay when entering viewport
        if (!wasIntersecting && nowIntersecting) {
          setReplayKey(prev => prev + 1);
        }
      },
      { threshold: 0.65 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isIntersecting]);

  return (
    <h2
      ref={ref}
      className={
        className ??
          "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-tight bg-gradient-to-r from-[#F5F7FF] via-[#7C5CFF] via-[#2E6BFF] to-[#FF4FD8] bg-clip-text text-transparent"
      }
    >
      <TypewriterAnimation
        text={text}
        charDelayMs={charDelayMs}
        animationKey={replayKey}
      />
    </h2>
  );
}
