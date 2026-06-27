'use client';

import { useState } from 'react';
import Math from '@/components/Math';

interface FormulaItem {
  name: string;
  formula: string;
  example: string;
}

interface FormulaSection {
  title: string;
  color: string;
  formulas: FormulaItem[];
}

const FORMULA_SECTIONS: FormulaSection[] = [
  {
    title: 'Indices & Logarithms',
    color: '#6c5ce7',
    formulas: [
      { name: 'Index laws', formula: '$a^m \\times a^n = a^{m+n}$, $a^m \\div a^n = a^{m-n}$, $(a^m)^n = a^{mn}$', example: 'Simplify $2^3 \\times 2^5 = 2^{3+5} = 2^8 = 256$' },
      { name: 'Negative/fractional indices', formula: '$a^{-n} = \\dfrac{1}{a^n}$, $a^{1/n} = \\sqrt[n]{a}$', example: '$8^{-2/3} = \\dfrac{1}{(\\sqrt[3]{8})^2} = \\dfrac{1}{4}$' },
      { name: 'Log laws', formula: '$\\log(ab) = \\log a + \\log b$, $\\log(a/b) = \\log a - \\log b$, $\\log a^n = n\\log a$', example: '$\\log_2 8 + \\log_2 4 = \\log_2 32 = 5$' },
      { name: 'Change of base', formula: '$\\log_a b = \\dfrac{\\log_c b}{\\log_c a}$', example: '$\\log_4 8 = \\dfrac{\\log_2 8}{\\log_2 4} = \\dfrac{3}{2}$' },
    ],
  },
  {
    title: 'Quadratics',
    color: '#a55eea',
    formulas: [
      { name: 'Quadratic formula', formula: '$x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$', example: 'For $2x^2 + 5x - 3 = 0$: $x = \\dfrac{-5 \\pm 7}{4}$, so $x = \\frac{1}{2}$ or $x = -3$' },
      { name: 'Discriminant', formula: '$\\Delta = b^2 - 4ac$', example: '$\\Delta > 0$: 2 roots, $\\Delta = 0$: 1 root, $\\Delta < 0$: no real roots' },
      { name: 'Completing the square', formula: '$x^2 + bx = (x + b/2)^2 - (b/2)^2$', example: '$x^2 + 6x + 1 = (x+3)^2 - 8$' },
    ],
  },
  {
    title: 'Series',
    color: '#e17055',
    formulas: [
      { name: 'AP: nth term', formula: '$u_n = a + (n-1)d$', example: 'If $a = 3, d = 5$: $u_{10} = 3 + 9(5) = 48$' },
      { name: 'AP: sum', formula: '$S_n = \\dfrac{n}{2}(2a + (n-1)d)$', example: 'Sum of 1 to 100: $S_{100} = 5050$' },
      { name: 'GP: nth term', formula: '$u_n = ar^{n-1}$', example: 'If $a = 2, r = 3$: $u_5 = 2 \\times 3^4 = 162$' },
      { name: 'GP: sum', formula: '$S_n = \\dfrac{a(1-r^n)}{1-r}$', example: 'Sum of $2 + 6 + 18 + 54$: $S_4 = 80$' },
      { name: 'Sum to infinity', formula: '$S_\\infty = \\dfrac{a}{1-r}$ (when $|r| < 1$)', example: '$a = 10, r = 1/2$: $S_\\infty = 20$' },
    ],
  },
  {
    title: 'Binomial Series',
    color: '#fdcb6e',
    formulas: [
      { name: 'Binomial theorem', formula: '$(1+x)^n = 1 + nx + \\dfrac{n(n-1)}{2!}x^2 + \\dfrac{n(n-1)(n-2)}{3!}x^3 + \\ldots$', example: '$(1+x)^4 = 1 + 4x + 6x^2 + 4x^3 + x^4$' },
      { name: 'Binomial coefficient', formula: '$\\binom{n}{r} = \\dfrac{n!}{r!(n-r)!}$', example: '$\\binom{7}{3} = 35$' },
    ],
  },
  {
    title: 'Coordinate Geometry',
    color: '#00b894',
    formulas: [
      { name: 'Distance', formula: '$d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$', example: 'Between $(1,2)$ and $(4,6)$: $d = 5$' },
      { name: 'Gradient', formula: '$m = \\dfrac{y_2 - y_1}{x_2 - x_1}$', example: 'Through $(1,2)$ and $(3,8)$: $m = 3$' },
      { name: 'Line equation', formula: '$y - y_1 = m(x - x_1)$', example: 'Gradient 2 through $(3,1)$: $y = 2x - 5$' },
      { name: 'Perpendicular gradients', formula: '$m_1 \\times m_2 = -1$', example: 'If $m_1 = 3$ then $m_2 = -1/3$' },
      { name: 'Circle', formula: '$(x-a)^2 + (y-b)^2 = r^2$', example: 'Centre $(3,-1)$, radius 5: $(x-3)^2 + (y+1)^2 = 25$' },
    ],
  },
  {
    title: 'Calculus',
    color: '#0984e3',
    formulas: [
      { name: 'Differentiation', formula: '$\\dfrac{d}{dx}(x^n) = nx^{n-1}$', example: '$y = 3x^4 \\Rightarrow \\frac{dy}{dx} = 12x^3$' },
      { name: 'First principles', formula: '$f\'(x) = \\lim_{h \\to 0} \\dfrac{f(x+h)-f(x)}{h}$', example: '$f(x) = x^2 \\Rightarrow f\'(x) = 2x$' },
      { name: 'Integration', formula: '$\\int x^n\\,dx = \\dfrac{x^{n+1}}{n+1} + c$', example: '$\\int 6x^2\\,dx = 2x^3 + c$' },
      { name: 'Definite integral', formula: '$\\int_a^b f(x)\\,dx = F(b) - F(a)$', example: '$\\int_1^3 2x\\,dx = [x^2]_1^3 = 8$' },
    ],
  },
  {
    title: 'Trigonometry',
    color: '#6c5ce7',
    formulas: [
      { name: 'Sine rule', formula: '$\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B} = \\dfrac{c}{\\sin C}$', example: 'Find side $b$ given angle $B$, side $a$ and angle $A$' },
      { name: 'Cosine rule', formula: '$a^2 = b^2 + c^2 - 2bc\\cos A$', example: '$a^2 = 25 + 49 - 70\\cos 60° = 39$' },
      { name: 'Area', formula: '$A = \\dfrac{1}{2}ab\\sin C$', example: '$A = \\frac{1}{2}(5)(7)\\sin 60° = \\frac{35\\sqrt{3}}{4}$' },
      { name: 'Identity', formula: '$\\sin^2\\theta + \\cos^2\\theta = 1$', example: 'If $\\sin\\theta = 3/5$ then $\\cos\\theta = \\pm 4/5$' },
      { name: 'Arc length', formula: '$s = r\\theta$ (radians)', example: '$r = 5, \\theta = \\pi/3$: $s = 5\\pi/3$' },
      { name: 'Sector area', formula: '$A = \\dfrac{1}{2}r^2\\theta$ (radians)', example: '$r = 5, \\theta = \\pi/3$: $A = 25\\pi/6$' },
    ],
  },
];

export default function FormulaSheetPage() {
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Formula Sheet</h1>
        <p className="text-sm text-muted">Click any formula to see a worked example</p>
      </div>

      <div className="space-y-10">
        {FORMULA_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: section.color }}>
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.formulas.map((f) => {
                const key = `${section.title}-${f.name}`;
                const isExpanded = expandedFormula === key;
                return (
                  <button
                    key={key}
                    onClick={() => setExpandedFormula(isExpanded ? null : key)}
                    className={`text-left w-full rounded-lg border p-4 transition-all ${
                      isExpanded
                        ? 'border-accent/20 bg-accent-light/30'
                        : 'border-border hover:border-accent/20 hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <span className="text-xs font-medium text-muted">{f.name}</span>
                        <Math text={f.formula} className="mt-1" />
                      </div>
                      <span className="text-[10px] text-muted shrink-0 mt-1">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Example</span>
                        <Math text={f.example} className="mt-1.5 text-sm text-foreground/70" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
