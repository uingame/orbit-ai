import { useEffect, useRef } from "react";

export function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let stars: Star[] = [];

    interface Star {
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      fadeDir: number; // 1 = fading in, -1 = fading out
      color: string;
      drift: number;
    }

    const STAR_COUNT = 100;

    const colors = [
      "255, 255, 255",    // white
      "255, 255, 255",    // white (more common)
      "0, 200, 255",      // cyan
      "180, 140, 255",    // purple
      "255, 220, 180",    // warm
    ];

    function createStar(startVisible = false): Star {
      return {
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.15 + 0.02,
        opacity: startVisible ? Math.random() * 0.7 + 0.1 : 0,
        fadeDir: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        drift: (Math.random() - 0.5) * 0.3,
      };
    }

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    function init() {
      resize();
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push(createStar(true));
      }
    }

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Move star slowly
        star.y -= star.speed;
        star.x += star.drift;

        // Fade in/out
        star.opacity += star.fadeDir * 0.003;
        if (star.opacity >= 0.8) {
          star.fadeDir = -1;
        }
        if (star.opacity <= 0) {
          // Respawn star at random position
          stars[i] = createStar(false);
          stars[i].fadeDir = 1;
          continue;
        }

        // Wrap around edges
        if (star.y < -5) star.y = canvas!.height + 5;
        if (star.x < -5) star.x = canvas!.width + 5;
        if (star.x > canvas!.width + 5) star.x = -5;

        // Draw star
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${star.color}, ${star.opacity})`;
        ctx!.fill();

        // Add glow for bigger/brighter stars
        if (star.size > 1.3 && star.opacity > 0.4) {
          ctx!.beginPath();
          ctx!.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${star.color}, ${star.opacity * 0.15})`;
          ctx!.fill();
        }
      }

      animationId = requestAnimationFrame(animate);
    }

    init();
    animate();

    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
