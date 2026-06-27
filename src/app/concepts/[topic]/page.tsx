'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { TOPICS, Topic } from '@/lib/types';
import { conceptsData } from '@/lib/concepts-data';
import Math from '@/components/Math';

export default function ConceptPage() {
  const params = useParams();
  const topicSlug = params.topic as Topic;
  const topic = TOPICS.find((t) => t.slug === topicSlug);
  const data = conceptsData[topicSlug];

  if (!topic || !data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-muted">Topic not found.</p>
        <Link href="/concepts" className="text-accent hover:underline mt-2 inline-block text-sm">Back to concepts</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/concepts" className="text-xs text-muted hover:text-accent mb-6 inline-block">&larr; All concepts</Link>

      <div className="flex items-center gap-3 mb-10">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold"
          style={{ backgroundColor: topic.color + '12', color: topic.color }}
        >
          {topic.icon}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
      </div>

      {/* Key Formulas */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-accent uppercase tracking-widest mb-4">Key Formulas</h2>
        <div className="space-y-1.5">
          {data.formulas.map((f, i) => (
            <div key={i} className="rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs font-medium text-muted shrink-0 sm:w-44">{f.name}</span>
              <Math text={f.formula} className="flex-1" />
            </div>
          ))}
        </div>
      </section>

      {/* Common Mistakes */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4">Common Mistakes</h2>
        <div className="rounded-lg bg-red-50/50 border border-red-100 p-5">
          <ul className="space-y-2.5">
            {data.commonMistakes.map((m, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-red-400 shrink-0">✗</span>
                <Math text={m} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Examiner Tips */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4">Examiner Tips</h2>
        <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 p-5">
          <ul className="space-y-2.5">
            {data.examinerTips.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-emerald-500 shrink-0">&#10003;</span>
                <Math text={t} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Worked Example */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-accent uppercase tracking-widest mb-4">Worked Example</h2>
        <div className="rounded-lg bg-accent-light/40 border border-accent/10 p-5">
          <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Question</p>
          <Math text={data.workedExample.question} className="mb-5" />
          <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Solution</p>
          <Math text={data.workedExample.solution} />
        </div>
      </section>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6 border-t border-border">
        <Link href="/concepts" className="text-xs text-muted hover:text-accent">&larr; All concepts</Link>
        <Link href={`/questions?topic=${topicSlug}`} className="text-xs text-accent hover:underline">
          Practice questions &rarr;
        </Link>
      </div>
    </div>
  );
}
