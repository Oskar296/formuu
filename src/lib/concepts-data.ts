import { Topic } from './types';

export interface ConceptSection {
  title: string;
  formulas: { name: string; formula: string; note?: string }[];
  commonMistakes: string[];
  examinerTips: string[];
  workedExample: { question: string; solution: string };
}

export const conceptsData: Record<Topic, ConceptSection> = {
  'logarithmic-functions-and-indices': {
    title: 'Logarithmic Functions & Indices',
    formulas: [
      { name: 'Index law (multiplication)', formula: '$a^m \\times a^n = a^{m+n}$' },
      { name: 'Index law (division)', formula: '$a^m \\div a^n = a^{m-n}$' },
      { name: 'Index law (power)', formula: '$(a^m)^n = a^{mn}$' },
      { name: 'Fractional index', formula: '$a^{1/n} = \\sqrt[n]{a}$' },
      { name: 'Negative index', formula: '$a^{-n} = \\dfrac{1}{a^n}$' },
      { name: 'Log definition', formula: '$\\log_a b = c \\iff a^c = b$' },
      { name: 'Log product rule', formula: '$\\log_a(xy) = \\log_a x + \\log_a y$' },
      { name: 'Log quotient rule', formula: '$\\log_a\\left(\\dfrac{x}{y}\\right) = \\log_a x - \\log_a y$' },
      { name: 'Log power rule', formula: '$\\log_a(x^n) = n\\log_a x$' },
      { name: 'Change of base', formula: '$\\log_a b = \\dfrac{\\log_c b}{\\log_c a}$' },
    ],
    commonMistakes: [
      '$\\log(a + b) \\neq \\log a + \\log b$ — the log rules only apply to products/quotients',
      'Forgetting that $\\log_a 1 = 0$ and $\\log_a a = 1$',
      'Not checking that the argument of a logarithm is positive when solving equations',
      'Confusing $a^{m+n}$ (multiply bases) with $(ab)^n$ (power of product)',
    ],
    examinerTips: [
      'When solving exponential equations, take logs of BOTH sides — state which log you\'re using',
      'Always check solutions in logarithmic equations — reject any that make the argument negative',
      'Show each step when applying log laws — don\'t skip straight to the answer',
    ],
    workedExample: {
      question: 'Solve $\\log_3(2x - 1) + \\log_3(x + 2) = 2$',
      solution: 'Using the addition law:\n$$\\log_3((2x-1)(x+2)) = 2$$\n$$(2x-1)(x+2) = 3^2 = 9$$\n$$2x^2 + 3x - 2 = 9$$\n$$2x^2 + 3x - 11 = 0$$\n$$x = \\frac{-3 \\pm \\sqrt{9 + 88}}{4} = \\frac{-3 \\pm \\sqrt{97}}{4}$$\n\nCheck: $x \\approx 1.71$ gives positive arguments ✓\n$x \\approx -3.21$ gives $2(-3.21) - 1 < 0$ ✗ — reject.',
    },
  },
  'the-quadratic-function': {
    title: 'The Quadratic Function',
    formulas: [
      { name: 'Quadratic formula', formula: '$x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$' },
      { name: 'Discriminant', formula: '$\\Delta = b^2 - 4ac$', note: '$\\Delta > 0$: 2 real roots, $\\Delta = 0$: 1 repeated root, $\\Delta < 0$: no real roots' },
      { name: 'Completed square form', formula: '$ax^2 + bx + c = a\\left(x + \\dfrac{b}{2a}\\right)^2 + c - \\dfrac{b^2}{4a}$' },
      { name: 'Sum of roots', formula: '$\\alpha + \\beta = -\\dfrac{b}{a}$' },
      { name: 'Product of roots', formula: '$\\alpha\\beta = \\dfrac{c}{a}$' },
    ],
    commonMistakes: [
      'Forgetting to factor out the coefficient of $x^2$ before completing the square',
      'Sign errors in the quadratic formula — be careful with $-b$',
      'Not stating the full discriminant condition when asked about the nature of roots',
      'Substituting the wrong equation when solving simultaneous equations with a quadratic',
    ],
    examinerTips: [
      'Always show the discriminant working, even if you can see the roots by factorising',
      'When completing the square with a leading coefficient, factor it out first',
      'For "show that... has no real roots", prove $\\Delta < 0$',
    ],
    workedExample: {
      question: 'Find the values of $k$ for which $x^2 + kx + 9 = 0$ has equal roots.',
      solution: 'For equal roots: $\\Delta = 0$\n$$k^2 - 4(1)(9) = 0$$\n$$k^2 = 36$$\n$$k = \\pm 6$$',
    },
  },
  'identities-and-inequalities': {
    title: 'Identities & Inequalities',
    formulas: [
      { name: 'Factor theorem', formula: 'If $f(a) = 0$ then $(x - a)$ is a factor of $f(x)$' },
      { name: 'Remainder theorem', formula: 'When $f(x)$ is divided by $(x - a)$, the remainder is $f(a)$' },
      { name: 'Polynomial identity', formula: '$f(x) \\equiv (x - a)q(x) + r$ where $r = f(a)$' },
    ],
    commonMistakes: [
      'Confusing the factor theorem ($f(a) = 0$) with the remainder theorem ($f(a) = r$)',
      'Not checking the sign when using $(x + a)$ — substitute $x = -a$',
      'Drawing the wrong region when solving quadratic inequalities — always sketch the parabola',
      'Forgetting to reverse the inequality sign when multiplying/dividing by a negative number',
    ],
    examinerTips: [
      'For "show that $(x - a)$ is a factor", compute $f(a)$ and state it equals 0',
      'When factorising cubics: find one root by trial, then divide to get a quadratic',
      'For quadratic inequalities, sketch the graph — the answer is where the curve is above/below the $x$-axis',
    ],
    workedExample: {
      question: 'Solve $x^2 - x - 6 \\leq 0$.',
      solution: 'Factorise: $(x - 3)(x + 2) \\leq 0$\n\nCritical values: $x = -2$ and $x = 3$.\n\nSince coefficient of $x^2 > 0$ (U-shape), the quadratic is negative between the roots.\n\n$$-2 \\leq x \\leq 3$$',
    },
  },
  'graphs': {
    title: 'Graphs',
    formulas: [
      { name: 'Translation (vertical)', formula: '$y = f(x) + a$ shifts UP by $a$' },
      { name: 'Translation (horizontal)', formula: '$y = f(x - a)$ shifts RIGHT by $a$' },
      { name: 'Vertical stretch', formula: '$y = af(x)$ stretches by factor $a$ parallel to $y$-axis' },
      { name: 'Horizontal stretch', formula: '$y = f(ax)$ stretches by factor $1/a$ parallel to $x$-axis' },
      { name: 'Reflection in $x$-axis', formula: '$y = -f(x)$' },
      { name: 'Reflection in $y$-axis', formula: '$y = f(-x)$' },
      { name: 'Modulus', formula: '$y = |f(x)|$ reflects negative parts in the $x$-axis' },
    ],
    commonMistakes: [
      'Getting horizontal translations backwards — $f(x - 2)$ moves RIGHT, not left',
      'Confusing $|f(x)|$ with $f(|x|)$ — the first reflects negative $y$-values, the second reflects in the $y$-axis',
      'Stretches parallel to the $x$-axis use factor $1/a$, not $a$',
    ],
    examinerTips: [
      'Always state the transformation in words: "translation of $\\binom{a}{b}$" or "stretch factor $k$ parallel to..."',
      'When sketching, label key features: intercepts, vertices, asymptotes',
      'For modulus equations $|f(x)| = g(x)$, solve $f(x) = g(x)$ AND $-f(x) = g(x)$, then check both answers',
    ],
    workedExample: {
      question: 'The curve $y = f(x)$ has vertex $(3, -2)$. State the vertex of $y = 2f(x - 1) + 3$.',
      solution: '$f(x - 1)$: shift right 1 → vertex $(4, -2)$\n$2f(x-1)$: vertical stretch ×2 → vertex $(4, -4)$\n$2f(x-1) + 3$: shift up 3 → vertex $(4, -1)$',
    },
  },
  'series': {
    title: 'Series',
    formulas: [
      { name: 'Arithmetic $n$th term', formula: '$u_n = a + (n-1)d$' },
      { name: 'Arithmetic sum', formula: '$S_n = \\dfrac{n}{2}(2a + (n-1)d) = \\dfrac{n}{2}(a + l)$' },
      { name: 'Geometric $n$th term', formula: '$u_n = ar^{n-1}$' },
      { name: 'Geometric sum (finite)', formula: '$S_n = \\dfrac{a(1 - r^n)}{1 - r}$, $r \\neq 1$' },
      { name: 'Sum to infinity', formula: '$S_\\infty = \\dfrac{a}{1 - r}$, $|r| < 1$' },
    ],
    commonMistakes: [
      'Using $n$ instead of $n-1$ in the $n$th term formulas',
      'Forgetting the condition $|r| < 1$ for convergence',
      'Confusing $S_n$ (sum of first $n$ terms) with $u_n$ ($n$th term)',
      'Not checking whether a sequence is arithmetic or geometric before applying formulas',
    ],
    examinerTips: [
      'When finding $r$ from two terms: $r = u_{n+1} / u_n$',
      'If asked to "find the sum", check whether they want finite or infinite',
      'For recurring decimals to fractions, express as a geometric series',
    ],
    workedExample: {
      question: 'A geometric series has $u_2 = 6$ and $u_5 = 48$. Find $a$ and $r$.',
      solution: '$u_2 = ar = 6$ ... (1)\n$u_5 = ar^4 = 48$ ... (2)\n\nDivide (2) by (1): $r^3 = 8$, so $r = 2$.\n\nFrom (1): $a(2) = 6$, so $a = 3$.',
    },
  },
  'the-binomial-series': {
    title: 'The Binomial Series',
    formulas: [
      { name: 'Binomial theorem (positive integer)', formula: '$(1 + x)^n = \\sum_{r=0}^{n} \\binom{n}{r} x^r$' },
      { name: 'Binomial coefficient', formula: '$\\binom{n}{r} = \\dfrac{n!}{r!(n-r)!}$' },
      { name: 'General binomial (rational $n$)', formula: '$(1 + x)^n = 1 + nx + \\dfrac{n(n-1)}{2!}x^2 + \\dfrac{n(n-1)(n-2)}{3!}x^3 + \\ldots$', note: 'Valid when $|x| < 1$' },
    ],
    commonMistakes: [
      'Forgetting to state the range of validity for rational $n$ expansions',
      'Not squaring/cubing the entire bracket term (e.g., $(2x)^2 = 4x^2$, not $2x^2$)',
      'Sign errors when $n$ is negative — track signs carefully through each term',
    ],
    examinerTips: [
      'Always write the first line showing the substitution into the formula — don\'t skip',
      'For $(a + bx)^n$, factor out $a^n$ first: $a^n(1 + bx/a)^n$',
      'State the validity condition: $|bx/a| < 1$ ⟹ $|x| < a/b$',
    ],
    workedExample: {
      question: 'Find the first 3 terms of $(1 + 3x)^{-1}$ and state validity.',
      solution: '$(1 + 3x)^{-1} = 1 + (-1)(3x) + \\dfrac{(-1)(-2)}{2!}(3x)^2 + \\ldots$\n$= 1 - 3x + 9x^2 + \\ldots$\n\nValid when $|3x| < 1$, i.e. $|x| < \\dfrac{1}{3}$.',
    },
  },
  'scalar-and-vector-quantities': {
    title: 'Scalar & Vector Quantities',
    formulas: [
      { name: 'Position vector', formula: '$\\overrightarrow{AB} = \\mathbf{b} - \\mathbf{a}$' },
      { name: 'Magnitude', formula: '$|\\mathbf{a}| = \\sqrt{a_1^2 + a_2^2}$' },
      { name: 'Unit vector', formula: '$\\hat{\\mathbf{a}} = \\dfrac{\\mathbf{a}}{|\\mathbf{a}|}$' },
      { name: 'Midpoint', formula: '$M = \\dfrac{1}{2}(\\mathbf{a} + \\mathbf{b})$' },
      { name: 'Section formula', formula: 'Point dividing $AB$ in ratio $m:n$: $\\dfrac{n\\mathbf{a} + m\\mathbf{b}}{m+n}$' },
    ],
    commonMistakes: [
      '$\\overrightarrow{AB} = \\mathbf{b} - \\mathbf{a}$, NOT $\\mathbf{a} - \\mathbf{b}$ (think "destination minus start")',
      'Forgetting to square root when finding magnitude',
      'Confusing scalar and vector quantities in geometric proofs',
    ],
    examinerTips: [
      'In proofs, state "hence the points are collinear" or "hence the lines are parallel" — don\'t just leave the vector expression',
      'Always use vector notation: underline or bold for vectors, no underline for scalars',
      'To show vectors are parallel, show one is a scalar multiple of the other',
    ],
    workedExample: {
      question: 'Show that the points $A(1, 2)$, $B(3, 6)$, $C(4, 8)$ are collinear.',
      solution: '$\\overrightarrow{AB} = (2, 4)$ and $\\overrightarrow{AC} = (3, 6)$\n\n$\\overrightarrow{AC} = \\frac{3}{2}\\overrightarrow{AB}$\n\nSince $\\overrightarrow{AC}$ is a scalar multiple of $\\overrightarrow{AB}$ and they share point $A$, the points are collinear.',
    },
  },
  'rectangular-cartesian-coordinates': {
    title: 'Rectangular Cartesian Coordinates',
    formulas: [
      { name: 'Distance', formula: '$d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$' },
      { name: 'Midpoint', formula: '$M = \\left(\\dfrac{x_1+x_2}{2}, \\dfrac{y_1+y_2}{2}\\right)$' },
      { name: 'Gradient', formula: '$m = \\dfrac{y_2 - y_1}{x_2 - x_1}$' },
      { name: 'Equation of a line', formula: '$y - y_1 = m(x - x_1)$' },
      { name: 'Parallel lines', formula: '$m_1 = m_2$' },
      { name: 'Perpendicular lines', formula: '$m_1 \\times m_2 = -1$' },
      { name: 'Circle equation', formula: '$(x - a)^2 + (y - b)^2 = r^2$', note: 'Centre $(a, b)$, radius $r$' },
    ],
    commonMistakes: [
      'Forgetting that perpendicular gradients multiply to $-1$ (not just "negative reciprocal" without the sign)',
      'Not completing the square properly when converting circle equations to centre-radius form',
      'Forgetting that the tangent to a circle is perpendicular to the radius at the point of contact',
    ],
    examinerTips: [
      'When finding the equation of a perpendicular bisector, you need both the midpoint AND the perpendicular gradient',
      'For circle questions, always find the centre and radius first',
      'Show substitution into the distance or gradient formula — don\'t just state the answer',
    ],
    workedExample: {
      question: 'Find the equation of the perpendicular bisector of $A(1, 3)$ and $B(5, 7)$.',
      solution: 'Midpoint: $M = (3, 5)$\n\nGradient of $AB$: $m = \\dfrac{7-3}{5-1} = 1$\n\nPerpendicular gradient: $m_\\perp = -1$\n\nEquation: $y - 5 = -1(x - 3)$\n$$y = -x + 8$$',
    },
  },
  'calculus': {
    title: 'Calculus',
    formulas: [
      { name: 'First principles', formula: '$f\'(x) = \\lim_{h \\to 0} \\dfrac{f(x+h) - f(x)}{h}$' },
      { name: 'Power rule', formula: '$\\dfrac{d}{dx}(x^n) = nx^{n-1}$' },
      { name: 'Sum rule', formula: '$\\dfrac{d}{dx}(f + g) = f\' + g\'$' },
      { name: 'Integration (reverse)', formula: '$\\int x^n\\,dx = \\dfrac{x^{n+1}}{n+1} + c$, $n \\neq -1$' },
      { name: 'Definite integral', formula: '$\\int_a^b f(x)\\,dx = F(b) - F(a)$' },
      { name: 'Area between curves', formula: '$A = \\int_a^b |f(x) - g(x)|\\,dx$' },
    ],
    commonMistakes: [
      'Forgetting the $+ c$ in indefinite integration',
      'Not simplifying before differentiating — rewrite $\\sqrt{x}$ as $x^{1/2}$ and $1/x$ as $x^{-1}$',
      'Getting confused with second derivative sign test: positive → minimum, negative → maximum',
      'Forgetting absolute value when area is below the $x$-axis',
    ],
    examinerTips: [
      'For stationary points: find $dy/dx = 0$, then use $d^2y/dx^2$ to determine nature',
      'When finding areas, sketch the region first to identify which curve is on top',
      'For tangent/normal questions: find the $y$-coordinate first, then the gradient, then use $y - y_1 = m(x - x_1)$',
    ],
    workedExample: {
      question: 'Find the stationary point of $y = x^2 - 6x + 11$ and determine its nature.',
      solution: '$\\dfrac{dy}{dx} = 2x - 6 = 0$ ⟹ $x = 3$\n\n$y = 9 - 18 + 11 = 2$\n\nStationary point: $(3, 2)$\n\n$\\dfrac{d^2y}{dx^2} = 2 > 0$ → minimum point.',
    },
  },
  'trigonometry': {
    title: 'Trigonometry',
    formulas: [
      { name: 'Sine rule', formula: '$\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B} = \\dfrac{c}{\\sin C}$' },
      { name: 'Cosine rule', formula: '$a^2 = b^2 + c^2 - 2bc\\cos A$' },
      { name: 'Area of triangle', formula: '$A = \\dfrac{1}{2}ab\\sin C$' },
      { name: 'Pythagorean identity', formula: '$\\sin^2\\theta + \\cos^2\\theta = 1$' },
      { name: 'Tan identity', formula: '$\\tan\\theta = \\dfrac{\\sin\\theta}{\\cos\\theta}$' },
      { name: 'Radians ↔ degrees', formula: '$\\pi \\text{ rad} = 180°$' },
      { name: 'Arc length', formula: '$s = r\\theta$' },
      { name: 'Sector area', formula: '$A = \\dfrac{1}{2}r^2\\theta$' },
    ],
    commonMistakes: [
      'Using degrees in arc length/sector area formulas when radians are required',
      'Forgetting the ambiguous case with the sine rule (two possible triangles)',
      'Not finding all solutions in a given range — remember to check all quadrants',
      'Confusing $\\sin^2 x$ with $\\sin(x^2)$',
    ],
    examinerTips: [
      'When solving trig equations, use CAST diagram or sketch the relevant graph to find all solutions',
      'For proving identities: start from one side and work towards the other — don\'t work on both sides simultaneously',
      'In "solve for $0 \\leq x \\leq 2\\pi$" questions, give exact answers using surds and $\\pi$ where possible',
    ],
    workedExample: {
      question: 'Solve $2\\cos^2 x - \\cos x - 1 = 0$ for $0° \\leq x \\leq 360°$.',
      solution: 'Let $c = \\cos x$: $2c^2 - c - 1 = 0$\n$(2c + 1)(c - 1) = 0$\n$c = -1/2$ or $c = 1$\n\n$\\cos x = 1$: $x = 0°, 360°$\n$\\cos x = -1/2$: $x = 120°, 240°$\n\nSolutions: $x = 0°, 120°, 240°, 360°$',
    },
  },
};
