import { mulberry32, pick, shuffle } from './rng.js';

// Every question is about things that DO NOT EXIST — fake countries, fake
// history, invented words. The "correct" answer is minted from the round seed,
// so it lives only inside this round: a second device can't look it up.

const SYL_A = ['Blor', 'Zam', 'Quiv', 'Fren', 'Osk', 'Tul', 'Marn', 'Vex', 'Plom', 'Gru', 'Skarn', 'Drib'];
const SYL_B = ['go', 'ta', 'mi', 'ru', 'ne', 'va', 'lo', 'shi'];
const SYL_C = ['via', 'stan', 'onia', 'land', 'burg', 'topia', 'mark', 'grad'];
const CITY_C = ['ville', ' City', 'holm', 'minster', 'port', 'dorf', 'pool', 'ham'];
const PROFS = ['Wobble', 'Grumble', 'Sprocket', 'Fizzle', 'Mumble', 'Crank', 'Puddle', 'Snoot'];
const DEFS = [
  'a small ceremonial hat', 'the fear of round objects', 'a soup made entirely of pebbles',
  'to sneeze politely', 'the smell of old maps', 'a dance done only on Tuesdays',
  'the third sock in a pair', 'an argument between clocks', 'to apologize to furniture',
  'the echo of a whisper', 'a ladder with opinions', 'the north side of a sandwich',
];
const OPIN_CATS = [
  ['shape', ['the triangle', 'the hexagon', 'the blob', 'the rhombus']],
  ['soup', ['leek surprise', 'cold gravel', 'essence of Monday', 'invisible broth']],
  ['historical hat', ['the tall one', 'the wide one', 'the suspicious one', 'the damp one']],
  ['classroom rule', ['no blinking', 'silent sneezes', 'alphabetical breathing', 'humming quietly']],
];
const EVENTS = ['Great Spoon Uprising', 'War of the Squiggle', 'Treaty of Mild Discomfort',
  'Second Pancake Rebellion', 'Silence of the Accordions', 'Glorious Sock Reform'];
const ELEMS = ['Confusium', 'Regretium', 'Snackium', 'Borium', 'Panicum', 'Whynot', 'Meltium', 'Oopsium'];

function word(rand, parts) { return parts.map(p => pick(rand, p)).join(''); }

const TEMPLATES = [
  (rand) => ({
    text: `What is the capital of ${word(rand, [SYL_A, SYL_B, SYL_C])}?`,
    options: Array.from({ length: 4 }, () => word(rand, [SYL_A, SYL_B]) + pick(rand, CITY_C)),
  }),
  (rand) => ({
    text: `In which year did the ${pick(rand, EVENTS)} end?`,
    options: shuffle(rand, [0, 1, 2, 3]).map(i => String(1300 + Math.floor(rand() * 40) + i * 141)),
  }),
  (rand) => ({
    text: `The word "${word(rand, [SYL_A, SYL_B, SYL_B]).toLowerCase()}" most nearly means:`,
    options: shuffle(rand, DEFS).slice(0, 4),
  }),
  (rand) => {
    const a = 2 + Math.floor(rand() * 7), b = 2 + Math.floor(rand() * 7);
    return {
      text: `By Professor ${pick(rand, PROFS)}'s Theorem, ${a} ⊛ ${b} equals:`,
      options: Array.from({ length: 4 }, () => String(Math.floor(rand() * 90) + 7)),
    };
  },
  (rand, teacherName) => {
    const [cat, opts] = pick(rand, OPIN_CATS);
    return {
      text: `According to ${teacherName}, the greatest ${cat} of all time is:`,
      options: shuffle(rand, opts),
    };
  },
  (rand) => ({
    text: `On the Revised Periodic Table, "${pick(rand, SYL_A).slice(0, 2)}" stands for:`,
    options: shuffle(rand, ELEMS).slice(0, 4),
  }),
];

export const N_QUESTIONS = 8;
export const LETTERS = ['A', 'B', 'C', 'D'];

export function generateExam(seed, teacherName = 'Mr. Grumble') {
  const rand = mulberry32(seed);
  const questions = [];
  for (let i = 0; i < N_QUESTIONS; i++) {
    const t = TEMPLATES[i % TEMPLATES.length];
    const q = t(rand, teacherName);
    q.correct = Math.floor(rand() * 4); // 0..3 -> A..D, exists only in this seed
    questions.push(q);
  }
  return questions;
}

// Deal each student 2 "studied" answers, covering all questions as evenly as possible.
export function dealKnowledge(seed, studentIds) {
  const rand = mulberry32(seed ^ 0x5EED);
  const deal = {};
  studentIds.forEach(id => { deal[id] = []; });
  let qs = [];
  const perStudent = 2;
  for (let need = studentIds.length * perStudent; qs.length < need;) {
    qs = qs.concat(shuffle(rand, Array.from({ length: N_QUESTIONS }, (_, i) => i)));
  }
  let i = 0;
  for (const id of shuffle(rand, studentIds)) {
    while (deal[id].length < perStudent) {
      const q = qs[i++];
      if (!deal[id].some(k => k.q === q)) deal[id].push({ q });
    }
  }
  return deal; // answers looked up from exam[q].correct by consumers
}

export function score(answers, exam) {
  let c = 0;
  for (let i = 0; i < exam.length; i++) if (answers[i] === exam[i].correct) c++;
  return c;
}
