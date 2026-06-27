export type Topic =
  | 'logarithmic-functions-and-indices'
  | 'the-quadratic-function'
  | 'identities-and-inequalities'
  | 'graphs'
  | 'series'
  | 'the-binomial-series'
  | 'scalar-and-vector-quantities'
  | 'rectangular-cartesian-coordinates'
  | 'calculus'
  | 'trigonometry';

export type Difficulty = 'foundation' | 'intermediate' | 'hard' | 'exam-hard';

export type QuestionType =
  | 'short-answer'
  | 'multi-part'
  | 'proof'
  | 'applied'
  | 'unfamiliar';

export interface Question {
  id: string;
  topic: Topic;
  subtopic: string;
  difficulty: Difficulty;
  type: QuestionType;
  marks: number;
  body: string;
  markScheme: string;
  workedSolution: string;
  paper?: 1 | 2;
}

export interface TopicInfo {
  slug: Topic;
  name: string;
  icon: string;
  subtopics: string[];
  color: string;
}

export interface QuizAttempt {
  questionId: string;
  userAnswer: string;
  correct: boolean;
  timeTaken: number;
}

export const TOPICS: TopicInfo[] = [
  {
    slug: 'logarithmic-functions-and-indices',
    name: 'Logarithmic Functions & Indices',
    icon: 'log',
    subtopics: ['Laws of indices', 'Laws of logarithms', 'Change of base', 'Solving exponential equations', 'Logarithmic equations'],
    color: '#7c6bc4',
  },
  {
    slug: 'the-quadratic-function',
    name: 'The Quadratic Function',
    icon: 'x²',
    subtopics: ['Completing the square', 'Quadratic formula', 'Discriminant', 'Quadratic graphs', 'Simultaneous equations'],
    color: '#9b59b6',
  },
  {
    slug: 'identities-and-inequalities',
    name: 'Identities & Inequalities',
    icon: '≥',
    subtopics: ['Factor theorem', 'Remainder theorem', 'Polynomial division', 'Linear inequalities', 'Quadratic inequalities'],
    color: '#c0609b',
  },
  {
    slug: 'graphs',
    name: 'Graphs',
    icon: '~',
    subtopics: ['Graph transformations', 'Modulus function', 'Reciprocal graphs', 'Intersection of graphs', 'Sketching curves'],
    color: '#d4616a',
  },
  {
    slug: 'series',
    name: 'Series',
    icon: 'Σ',
    subtopics: ['Arithmetic sequences', 'Arithmetic series', 'Geometric sequences', 'Geometric series', 'Sum to infinity'],
    color: '#d48a3c',
  },
  {
    slug: 'the-binomial-series',
    name: 'The Binomial Series',
    icon: 'C',
    subtopics: ['Binomial expansion (positive integer)', 'Binomial coefficients', 'Binomial expansion (rational)', 'Approximations', 'Validity of expansion'],
    color: '#b5960f',
  },
  {
    slug: 'scalar-and-vector-quantities',
    name: 'Scalar & Vector Quantities',
    icon: '→',
    subtopics: ['Vector addition', 'Position vectors', 'Magnitude and direction', 'Scalar product', 'Geometric proofs with vectors'],
    color: '#2e9e5a',
  },
  {
    slug: 'rectangular-cartesian-coordinates',
    name: 'Rectangular Cartesian Coordinates',
    icon: '⊥',
    subtopics: ['Distance between points', 'Midpoints', 'Gradient', 'Equation of a line', 'Perpendicular and parallel lines', 'Circle equations'],
    color: '#1a9e8f',
  },
  {
    slug: 'calculus',
    name: 'Calculus',
    icon: '∫',
    subtopics: ['Differentiation from first principles', 'Differentiation rules', 'Tangents and normals', 'Stationary points', 'Integration', 'Definite integrals', 'Area under a curve'],
    color: '#4485c7',
  },
  {
    slug: 'trigonometry',
    name: 'Trigonometry',
    icon: 'θ',
    subtopics: ['Trigonometric ratios', 'Sine and cosine rules', 'Trigonometric identities', 'Solving trig equations', 'Radians', 'Arc length and sector area'],
    color: '#8b6bc4',
  },
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  foundation: 'Foundation',
  intermediate: 'Intermediate',
  hard: 'Hard',
  'exam-hard': 'Exam Hard',
};

export const TYPE_LABELS: Record<QuestionType, string> = {
  'short-answer': 'Short Answer',
  'multi-part': 'Multi-Part',
  proof: 'Proof',
  applied: 'Applied / Contextual',
  unfamiliar: 'Unfamiliar',
};
