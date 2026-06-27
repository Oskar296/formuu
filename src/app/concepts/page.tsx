import Link from 'next/link';
import { TOPICS } from '@/lib/types';

export default function ConceptsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Key Concepts</h1>
        <p className="text-sm text-muted">Formulas, common mistakes, examiner tips & a worked example for each topic</p>
      </div>

      {/* Quick formula sheet — flat all-in-one reference */}
      <Link
        href="/formula-sheet"
        className="group mb-8 flex items-center gap-4 rounded-xl border border-border p-4 hover:border-accent/30 hover:bg-accent-light/30 transition-all"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-light text-base">📐</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">Quick formula sheet</h3>
          <p className="text-xs text-muted">Every formula on one page — tap any for a worked example</p>
        </div>
        <span className="text-muted opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</span>
      </Link>

      <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-2">By topic</h2>
      <div className="divide-y divide-border border-t border-b border-border">
        {TOPICS.map((topic) => (
          <Link
            key={topic.slug}
            href={`/concepts/${topic.slug}`}
            className="group flex items-center gap-4 py-4 hover:bg-surface -mx-4 px-4 rounded-lg transition-colors"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
              style={{ backgroundColor: topic.color + '12', color: topic.color }}
            >
              {topic.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                {topic.name}
              </h3>
              <p className="text-xs text-muted">Key formulas, worked examples, examiner tips</p>
            </div>
            <span className="text-muted opacity-0 group-hover:opacity-100 transition-opacity">
              &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
