import { TOPICS, Topic } from '@/lib/types';
import QuizClient from './QuizClient';

// Pre-build a static quiz page for every topic (required for `output: 'export'`).
export function generateStaticParams() {
  return TOPICS.map((t) => ({ topic: t.slug }));
}

export default async function TopicQuizPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  return <QuizClient topicSlug={topic as Topic} />;
}
