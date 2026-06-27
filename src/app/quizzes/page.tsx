import Link from 'next/link';
import { TOPICS } from '@/lib/types';
import { questions } from '@/lib/questions';

export default function QuizzesPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Topic Quizzes</h1>
        <p className="text-sm text-muted">Pick a topic and test yourself with instant feedback</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TOPICS.map((topic) => {
          const count = questions.filter((q) => q.topic === topic.slug).length;
          return (
            <Link
              key={topic.slug}
              href={`/quizzes/${topic.slug}`}
              className="group relative overflow-hidden rounded-xl border border-border p-5 hover:border-transparent hover:shadow-lg hover:shadow-black/5 transition-all duration-200"
            >
              {/* Colored top edge */}
              <div
                className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: topic.color }}
              />
              <div className="flex items-start gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold transition-transform group-hover:scale-110"
                  style={{ backgroundColor: topic.color + '15', color: topic.color }}
                >
                  {topic.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors mb-1">
                    {topic.name}
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed line-clamp-2">
                    {topic.subtopics.slice(0, 4).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted">
                  <span className="font-semibold text-foreground">{count}</span> questions
                </span>
                <span className="text-xs font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  Start quiz →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
