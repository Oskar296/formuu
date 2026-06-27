import Link from 'next/link';
import { TOPICS } from '@/lib/types';
import { questions } from '@/lib/questions';

import StreakBadge from '@/components/StreakBadge';
import WeakTopics from '@/components/WeakTopics';
import HomeStats from '@/components/HomeStats';
import ReviewPrompt from '@/components/ReviewPrompt';

export default function HomePage() {
  const totalQuestions = questions.length;

  return (
    <div className="mx-auto max-w-4xl px-6">
      {/* Hero */}
      <section className="pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent-light px-4 py-1.5 text-xs font-medium text-accent mb-8">
          Edexcel IGCSE Further Pure Maths · 4PM1
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-foreground">
          Revision, simplified.
        </h1>
        <p className="mx-auto max-w-md text-muted mb-8 leading-relaxed">
          {totalQuestions}+ practice questions with worked solutions, mock exams, XP & achievements. Free forever.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link
            href="/questions"
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Start revising
          </Link>
          <Link
            href="/random"
            className="rounded-lg border border-accent/20 bg-accent-light px-6 py-2.5 text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
          >
            🎲 Random question
          </Link>
          <Link
            href="/mock-exam"
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-surface transition-colors"
          >
            Mock exam
          </Link>
        </div>
      </section>

      {/* XP + Streak + Achievements */}
      <section className="mb-12">
        <ReviewPrompt />
        <HomeStats />
        <StreakBadge />
        <WeakTopics />
      </section>

      {/* Features */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border mb-16">
        {[
          { title: 'Question Bank', desc: 'Filter, search & sort by difficulty', href: '/questions', count: `${totalQuestions}+` },
          { title: 'Topic Quizzes', desc: 'Self-marked with worked solutions', href: '/quizzes', count: '10' },
          { title: 'Smart Review', desc: 'Spaced repetition that sticks', href: '/review', count: '🔁' },
          { title: 'Mock Exams', desc: 'Timed papers with score breakdown', href: '/mock-exam', count: '3 types' },
          { title: 'Key Concepts', desc: 'Formulas & examiner tips', href: '/concepts', count: '10' },
          { title: 'Progress', desc: 'Track scores & coverage', href: '/progress', count: 'Live' },
        ].map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="bg-white p-5 hover:bg-surface transition-colors group"
          >
            <span className="text-2xl font-bold text-accent">{f.count}</span>
            <h3 className="text-sm font-semibold text-foreground mt-1 group-hover:text-accent transition-colors">{f.title}</h3>
            <p className="text-xs text-muted mt-0.5">{f.desc}</p>
          </Link>
        ))}
      </section>

      {/* Topics */}
      <section className="pb-20">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-5">All 10 topics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TOPICS.map((topic) => {
            const count = questions.filter(q => q.topic === topic.slug).length;
            return (
              <Link
                key={topic.slug}
                href={`/questions?topic=${topic.slug}`}
                className="group flex items-center gap-4 rounded-lg border border-border p-4 hover:border-accent/30 hover:bg-accent-light/30 transition-all"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                  style={{ backgroundColor: topic.color + '12', color: topic.color }}
                >
                  {topic.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
                    {topic.name}
                  </h3>
                  <p className="text-xs text-muted truncate">
                    {count} questions · {topic.subtopics.length} subtopics
                  </p>
                </div>
                <span className="ml-auto text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  &rarr;
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
