const fs = require('fs');
const path = require('path');

const data = require('./pt-pt-translations-data.js');
const source = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'export-translation-source.json'), 'utf8'),
);

const output = {
  locale: 'pt-PT',
  courses: data.courses,
  tests: data.tests,
  questions: data.questions,
  options: data.options,
};

const outDir = path.join(__dirname, '..', 'src', 'migrations', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'pt-pt-translations.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

function assertCount(label, expected, actual) {
  if (expected !== actual) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

assertCount('courses', source.courses.length, Object.keys(data.courses).length);
assertCount('tests', source.tests.length, Object.keys(data.tests).length);
assertCount(
  'questions',
  source.questions.length,
  Object.keys(data.questions).length,
);
assertCount('options', source.options.length, Object.keys(data.options).length);

for (const c of source.courses) {
  if (!data.courses[String(c.courseId)]) {
    throw new Error(`Missing course translation: ${c.courseId}`);
  }
}
for (const t of source.tests) {
  if (!data.tests[String(t.testId)]) {
    throw new Error(`Missing test translation: ${t.testId}`);
  }
}
for (const q of source.questions) {
  if (!data.questions[String(q.questionId)]) {
    throw new Error(`Missing question translation: ${q.questionId}`);
  }
}
for (const o of source.options) {
  if (!data.options[String(o.optionId)]) {
    throw new Error(`Missing option translation: ${o.optionId}`);
  }
}

console.log('Written:', outPath);
console.log(
  'Counts: courses',
  Object.keys(data.courses).length,
  'tests',
  Object.keys(data.tests).length,
  'questions',
  Object.keys(data.questions).length,
  'options',
  Object.keys(data.options).length,
);
