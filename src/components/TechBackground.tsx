import { useEffect, useRef } from 'react';

export default function TechBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Draw visible grid
    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(124, 92, 255, 0.15)'; // Much more visible purple
      ctx.lineWidth = 1;

      const gridSize = 50;

      // Vertical lines
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    // Draw radial gradient accents
    const drawAccents = () => {
      // Top-right gradient
      const gradient1 = ctx.createRadialGradient(
        canvas.width * 0.8, canvas.height * 0.2, 0,
        canvas.width * 0.8, canvas.height * 0.2, canvas.width * 0.3
      );
      gradient1.addColorStop(0, 'rgba(46, 107, 255, 0.12)');
      gradient1.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Bottom-left gradient
      const gradient2 = ctx.createRadialGradient(
        canvas.width * 0.2, canvas.height * 0.8, 0,
        canvas.width * 0.2, canvas.height * 0.8, canvas.width * 0.25
      );
      gradient2.addColorStop(0, 'rgba(255, 79, 216, 0.08)');
      gradient2.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    // Draw visible scanlines
    const drawScanlines = () => {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)'; // Much more visible cyan
      ctx.lineWidth = 1;

      const scanlineSpacing = 8;
      for (let y = 0; y < canvas.height; y += scanlineSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    // Draw subtle geometric shapes
    const drawGeometricShapes = () => {
      // Large background circles
      ctx.strokeStyle = 'rgba(124, 92, 255, 0.008)';
      ctx.lineWidth = 2;

      // Circle 1
      ctx.beginPath();
      ctx.arc(canvas.width * 0.1, canvas.height * 0.3, canvas.width * 0.15, 0, 2 * Math.PI);
      ctx.stroke();

      // Circle 2
      ctx.beginPath();
      ctx.arc(canvas.width * 0.9, canvas.height * 0.7, canvas.width * 0.12, 0, 2 * Math.PI);
      ctx.stroke();

      // Triangle
      ctx.beginPath();
      ctx.moveTo(canvas.width * 0.6, canvas.height * 0.1);
      ctx.lineTo(canvas.width * 0.65, canvas.height * 0.2);
      ctx.lineTo(canvas.width * 0.55, canvas.height * 0.2);
      ctx.closePath();
      ctx.stroke();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid();
      drawAccents();
      drawScanlines();
      drawGeometricShapes();
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
