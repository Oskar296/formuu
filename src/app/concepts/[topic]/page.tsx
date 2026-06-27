import { TOPICS, Topic } from '@/lib/types';
import ConceptClient from './ConceptClient';

// Pre-build a static page for every topic (required for `output: 'export'`).
export function generateStaticParams() {
  return TOPICS.map((t) => ({ topic: t.slug }));
}

export default async function ConceptPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  return <ConceptClient topicSlug={topic as Topic} />;
}
