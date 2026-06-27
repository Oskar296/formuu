'use client';

import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
  speedX: number;
  speedY: number;
  opacity: number;
}

const COLORS = ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#fd79a8', '#00cec9', '#e84393'];

export default function Confetti({ trigger, duration = 3000 }: { trigger: boolean; duration?: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setActive(true);

    const newParticles: Particle[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: 50 + (globalThis.Math.random() - 0.5) * 20,
      y: -5,
      color: COLORS[globalThis.Math.floor(globalThis.Math.random() * COLORS.length)],
      rotation: globalThis.Math.random() * 360,
      scale: 0.5 + globalThis.Math.random() * 0.8,
      speedX: (globalThis.Math.random() - 0.5) * 4,
      speedY: 2 + globalThis.Math.random() * 4,
      opacity: 1,
    }));

    setParticles(newParticles);

    const timeout = setTimeout(() => {
      setActive(false);
      setParticles([]);
    }, duration);

    return () => clearTimeout(timeout);
  }, [trigger, duration]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            '--speed-x': `${p.speedX}vw`,
            '--speed-y': `${p.speedY * 20}vh`,
            '--rotation': `${p.rotation}deg`,
            '--delay': `${p.id * 30}ms`,
            animationDelay: `${p.id * 30}ms`,
          } as React.CSSProperties}
        >
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{
              backgroundColor: p.color,
              transform: `scale(${p.scale}) rotate(${p.rotation}deg)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

// Lightweight toast for XP gains and achievements
export function XPToast({ amount, reason, visible }: { amount: number; reason: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9998] animate-slide-up">
      <div className="rounded-xl bg-white shadow-lg border border-accent/20 px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-light text-accent font-bold text-sm">
          +{amount}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">XP earned!</p>
          <p className="text-xs text-muted">{reason}</p>
        </div>
      </div>
    </div>
  );
}

export function AchievementToast({ name, icon, visible }: { name: string; icon: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-slide-up">
      <div className="rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 shadow-lg border border-amber-200 px-5 py-4 flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Achievement Unlocked!</p>
          <p className="text-sm font-semibold text-foreground">{name}</p>
        </div>
      </div>
    </div>
  );
}
