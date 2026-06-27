'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthButton from './AuthButton';
import XPBar from './XPBar';
import { getDueCount } from '@/lib/review';

const NAV_ITEMS = [
  { href: '/questions', label: 'Questions', icon: '📝' },
  { href: '/quizzes', label: 'Quizzes', icon: '⚡' },
  { href: '/review', label: 'Review', icon: '🔁' },
  { href: '/mock-exam', label: 'Mock Exam', icon: '📄' },
  { href: '/concepts', label: 'Concepts', icon: '💡' },
  { href: '/progress', label: 'Progress', icon: '📊' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    const refresh = () => setDueCount(getDueCount());
    refresh();
    window.addEventListener('formu-xp-update', refresh);
    return () => window.removeEventListener('formu-xp-update', refresh);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-border/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-1.5 shrink-0 group">
          <span className="text-lg font-bold tracking-tight text-accent group-hover:text-accent-hover transition-colors">formu</span>
          <span className="text-[10px] text-muted/60 font-medium hidden sm:inline">4PM1</span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-accent font-semibold bg-accent-light/80'
                    : 'text-muted/70 hover:text-foreground hover:bg-surface/80'
                }`}
              >
                <span className="text-[11px] hidden lg:inline">{item.icon}</span>
                {item.label}
                {item.href === '/review' && dueCount > 0 && (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                    {dueCount > 99 ? '99+' : dueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <XPBar />
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
