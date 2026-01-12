import { useEffect, useRef } from 'react';

export default function GlobalBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const parallax1 = scrollY * 0.02;
      const parallax2 = scrollY * -0.01;
      const parallax3 = scrollY * 0.015;

      if (containerRef.current) {
        const layers = containerRef.current.children;
        if (layers[1]) (layers[1] as HTMLElement).style.transform = `translate3d(${parallax1}px, ${parallax1 * 0.5}px, 0)`;
        if (layers[2]) (layers[2] as HTMLElement).style.transform = `translate3d(${parallax2}px, ${parallax2 * 0.3}px, 0)`;
        if (layers[3]) (layers[3] as HTMLElement).style.transform = `translate3d(${parallax3 * -1}px, ${parallax3}px, 0)`;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Base fill */}
      <div className="absolute inset-0" style={{ backgroundColor: '#05060B' }} />

      {/* Animated gradient blobs */}
      <div
        className="absolute top-10 right-10 w-80 h-80 rounded-full blur-3xl will-change-transform animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(124,92,255,0.15) 0%, transparent 70%)',
          animationDuration: '8s'
        }}
      />
      <div
        className="absolute top-1/3 left-20 w-96 h-96 rounded-full blur-3xl will-change-transform animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(46,107,255,0.12) 0%, transparent 70%)',
          animationDuration: '12s',
          animationDelay: '2s'
        }}
      />
      <div
        className="absolute bottom-20 right-1/3 w-72 h-72 rounded-full blur-3xl will-change-transform animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(255,79,216,0.10) 0%, transparent 70%)',
          animationDuration: '10s',
          animationDelay: '4s'
        }}
      />
    </div>
  );
}
