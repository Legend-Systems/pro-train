/**
 * Shared quiz-document parsing for structured .docx / .csv / .txt uploads.
 * Supports the ProTrain admin document formats:
 *  - Word: "Test Title:", "Question N", "A. …", "Answer: C"
 *  - CSV: Test Title | Test Description | Question Number | Question | Option A–E | Correct Answer
 */

export interface ParsedQuizOption {
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
  /** Original letter label when present (A–E). */
  label?: string;
}

export interface ParsedQuizQuestion {
  questionText: string;
  questionType: 'multiple_choice';
  points: number;
  orderIndex: number;
  options: ParsedQuizOption[];
  explanation?: string;
}

export interface ParsedQuizDocument {
  title: string;
  description: string;
  questions: ParsedQuizQuestion[];
  keyTopics: string[];
  summary: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  rawTextPreview: string;
}

const OPTION_LETTER_PATTERN = /^([A-Ea-e])[.)]\s*(.+)$/;
const QUESTION_HEADER_PATTERN =
  /^(?:Question\s*)?(\d+)[.)]?\s*(.*)$/i;
const TITLE_PATTERN = /^Test\s*Title\s*:\s*(.+)$/i;
const DESCRIPTION_PATTERN = /^Test\s*Description\s*:\s*(.+)$/i;
const ANSWER_PATTERN = /^Answer\s*:\s*([A-Ea-e1-5,/\s]+)\s*$/i;

const DEFAULT_POINTS = 1;

/** Maps answer letters (A–E) or 1-based indexes to zero-based option indexes. */
export function resolveCorrectIndexes(answerRaw: string): number[] {
  const parts = answerRaw
    .split(/[,/&\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const indexes: number[] = [];
  for (const part of parts) {
    const letterMatch = part.match(/^([A-Ea-e])$/);
    if (letterMatch) {
      indexes.push(letterMatch[1].toUpperCase().charCodeAt(0) - 65);
      continue;
    }
    const numeric = Number.parseInt(part, 10);
    if (!Number.isNaN(numeric) && numeric >= 1) {
      indexes.push(numeric - 1);
    }
  }
  return [...new Set(indexes)];
}

function normalizeLine(line: string): string {
  return line.replace(/\u00a0/g, ' ').replace(/\r/g, '').trim();
}

/**
 * Why options were saved as one concatenated string:
 * mammoth's extractRawText often joins consecutive Word runs/paragraphs with no
 * newline, producing a single line like:
 *   "A. Company registration numberB. Weather informationC. …"
 * OPTION_LETTER_PATTERN then matches once and stores everything after "A." as
 * one optionText — the same shape seen in Selling_Mechanisms.json / testId 84.
 *
 * Fix: insert a newline before each glued A–E marker so parseQuizText emits
 * five separate options (same payload shape TestForm uses: one options[] entry
 * per choice with its own optionText / isCorrect / orderIndex).
 */
function separateGluedOptionMarkers(text: string): string {
  return text.replace(/([^\n])([A-Ea-e][.)]\s*)/g, '$1\n$2');
}

function splitLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map(normalizeLine)
    .filter((line) => line.length > 0);
}

/**
 * If the question stem still contains inline A–E options (e.g. marker glued to
 * the stem on the same line), peel them into discrete option records.
 */
function peelInlineOptionsFromStem(stem: string): {
  questionText: string;
  options: Array<{ label: string; text: string }>;
} {
  const normalized = separateGluedOptionMarkers(stem);
  const parts = normalized
    .split(/\n+/)
    .map(normalizeLine)
    .filter((line) => line.length > 0);

  const questionParts: string[] = [];
  const options: Array<{ label: string; text: string }> = [];

  for (const part of parts) {
    const optionMatch = part.match(OPTION_LETTER_PATTERN);
    if (optionMatch) {
      options.push({
        label: optionMatch[1].toUpperCase(),
        text: optionMatch[2].trim(),
      });
      continue;
    }
    // Only keep non-option text as the stem (before the first option).
    if (options.length === 0) {
      questionParts.push(part);
    }
  }

  return {
    questionText: questionParts.join(' ').trim(),
    options,
  };
}

function deriveTopics(description: string, questions: ParsedQuizQuestion[]): string[] {
  const fromDescription = description
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (fromDescription.length > 0) {
    return fromDescription.slice(0, 8);
  }

  return questions
    .slice(0, 5)
    .map((question) => question.questionText.split(/\s+/).slice(0, 4).join(' '))
    .filter(Boolean);
}

function deriveDifficulty(
  questionCount: number,
): ParsedQuizDocument['difficulty'] {
  if (questionCount <= 5) return 'beginner';
  if (questionCount <= 15) return 'intermediate';
  return 'advanced';
}

function buildSummary(title: string, questionCount: number): string {
  if (!title && questionCount === 0) {
    return 'No quiz content detected in this document.';
  }
  return `${title || 'Untitled test'} — ${questionCount} question${
    questionCount === 1 ? '' : 's'
  } extracted from the uploaded document.`;
}

/**
 * Parses free-form structured quiz text (Word / plain text).
 * Emits one options[] entry per A–E choice so POST /tests matches TestForm.
 */
export function parseQuizText(rawText: string): ParsedQuizDocument {
  // Split glued "A.…B.…C.…" runs from DOCX before line-based parsing.
  const lines = splitLines(separateGluedOptionMarkers(rawText));
  let title = '';
  let description = '';
  const questions: ParsedQuizQuestion[] = [];

  let currentQuestionText = '';
  let currentOptions: Array<{ label: string; text: string }> = [];
  let pendingAnswer: string | null = null;
  let orderIndex = 0;

  const flushQuestion = (): void => {
    if (!currentQuestionText.trim()) {
      currentOptions = [];
      pendingAnswer = null;
      return;
    }

    // Safety net: options still stuck inside the stem become discrete records.
    let questionText = currentQuestionText.trim();
    let collectedOptions = [...currentOptions];
    if (collectedOptions.length === 0) {
      const peeled = peelInlineOptionsFromStem(questionText);
      questionText = peeled.questionText || questionText;
      collectedOptions = peeled.options;
    }

    const correctIndexes = pendingAnswer
      ? resolveCorrectIndexes(pendingAnswer)
      : [];

    // Mirror TestForm / mapFormQuestionsToCreatePayload: one option object each.
    const options: ParsedQuizOption[] = collectedOptions.map((option, index) => ({
      optionText: option.text.trim(),
      isCorrect: correctIndexes.includes(index),
      orderIndex: index + 1,
      label: option.label,
    }));

    // If no answer marker was found, mark the first option correct as a safe default
    // only when options exist — admins can still edit after import.
    if (options.length > 0 && !options.some((option) => option.isCorrect)) {
      options[0].isCorrect = true;
    }

    orderIndex += 1;
    questions.push({
      questionText,
      questionType: 'multiple_choice',
      points: DEFAULT_POINTS,
      orderIndex,
      options,
    });

    currentQuestionText = '';
    currentOptions = [];
    pendingAnswer = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const titleMatch = line.match(TITLE_PATTERN);
    if (titleMatch) {
      flushQuestion();
      title = titleMatch[1].trim();
      continue;
    }

    const descriptionMatch = line.match(DESCRIPTION_PATTERN);
    if (descriptionMatch) {
      flushQuestion();
      description = descriptionMatch[1].trim();
      continue;
    }

    const answerMatch = line.match(ANSWER_PATTERN);
    if (answerMatch) {
      pendingAnswer = answerMatch[1].trim();
      flushQuestion();
      continue;
    }

    const optionMatch = line.match(OPTION_LETTER_PATTERN);
    if (optionMatch) {
      // Each matched line is one choice — never append later letters into optionText.
      currentOptions.push({
        label: optionMatch[1].toUpperCase(),
        text: optionMatch[2].trim(),
      });
      continue;
    }

    const questionHeaderMatch = line.match(QUESTION_HEADER_PATTERN);
    const looksLikeQuestionHeader =
      questionHeaderMatch &&
      (/^Question\s*\d+/i.test(line) ||
        (/^\d+[.)]\s+/.test(line) && currentOptions.length === 0 && !currentQuestionText));

    if (looksLikeQuestionHeader && questionHeaderMatch) {
      flushQuestion();
      const remainder = questionHeaderMatch[2]?.trim() ?? '';
      currentQuestionText = remainder;
      // Support "Question 1" on its own line with the stem on the next line(s).
      continue;
    }

    // Continuation of question stem (before options appear).
    if (currentOptions.length === 0) {
      if (
        !currentQuestionText &&
        !TITLE_PATTERN.test(line) &&
        !DESCRIPTION_PATTERN.test(line)
      ) {
        // First free line after a bare "Question N" header becomes the stem.
        currentQuestionText = line;
      } else if (currentQuestionText) {
        currentQuestionText = `${currentQuestionText} ${line}`.trim();
      }
    }
  }

  flushQuestion();

  // Fallback title from first line when metadata markers are missing.
  if (!title && lines.length > 0) {
    title = lines[0].slice(0, 120);
  }

  return {
    title: title || 'Imported Test',
    description,
    questions,
    keyTopics: deriveTopics(description, questions),
    summary: buildSummary(title || 'Imported Test', questions.length),
    difficulty: deriveDifficulty(questions.length),
    rawTextPreview: rawText.slice(0, 2000),
  };
}

/** Minimal CSV row splitter that respects quoted fields. */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Detects whether the quiz template uses comma or pipe delimiters.
 * Sample templates use pipes: Test Title | Test Description | Question | …
 */
function normalizeQuizDelimitedText(rawText: string): string {
  const firstLine = rawText.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const pipeCount = (firstLine.match(/\|/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;

  // Prefer pipes when the header clearly looks pipe-delimited.
  if (pipeCount >= 3 && pipeCount > commaCount) {
    return rawText
      .split(/\r?\n/)
      .map((line) => {
        if (!line.includes('|')) return line;
        return line
          .split('|')
          .map((cell) => cell.trim())
          .map((cell) => (cell.includes(',') ? `"${cell.replace(/"/g, '""')}"` : cell))
          .join(',');
      })
      .join('\n');
  }

  return rawText;
}

/**
 * Parses the ProTrain quiz CSV template.
 * Columns: Test Title | Test Description | Question Number | Question | Option A–E | Correct Answer
 * Accepts comma-separated or pipe-separated rows.
 */
export function parseQuizCsv(csvText: string): ParsedQuizDocument {
  const normalized = normalizeQuizDelimitedText(csvText);
  const rows = parseCsvRows(normalized);
  if (rows.length < 2) {
    return parseQuizText(csvText);
  }

  const headers = rows[0].map(normalizeHeader);
  const findColumn = (...aliases: string[]): number =>
    headers.findIndex((header) => aliases.includes(header));

  const titleIdx = findColumn('testtitle', 'title');
  const descriptionIdx = findColumn('testdescription', 'description');
  const numberIdx = findColumn('questionnumber', 'number', 'qnumber');
  const questionIdx = findColumn('question', 'questiontext');
  const optionAIdx = findColumn('optiona', 'a');
  const optionBIdx = findColumn('optionb', 'b');
  const optionCIdx = findColumn('optionc', 'c');
  const optionDIdx = findColumn('optiond', 'd');
  const optionEIdx = findColumn('optione', 'e');
  const answerIdx = findColumn('correctanswer', 'answer', 'correct');

  // If headers don't match the quiz template, treat the whole file as free-form text.
  if (questionIdx < 0 || (optionAIdx < 0 && answerIdx < 0)) {
    return parseQuizText(csvText);
  }

  let title = '';
  let description = '';
  const questions: ParsedQuizQuestion[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const questionText = row[questionIdx]?.trim() ?? '';
    if (!questionText) continue;

    if (!title && titleIdx >= 0 && row[titleIdx]) {
      title = row[titleIdx].trim();
    }
    if (!description && descriptionIdx >= 0 && row[descriptionIdx]) {
      description = row[descriptionIdx].trim();
    }

    const optionCells = [
      { label: 'A', idx: optionAIdx },
      { label: 'B', idx: optionBIdx },
      { label: 'C', idx: optionCIdx },
      { label: 'D', idx: optionDIdx },
      { label: 'E', idx: optionEIdx },
    ]
      .map((entry) => ({
        label: entry.label,
        text: entry.idx >= 0 ? (row[entry.idx] ?? '').trim() : '',
      }))
      .filter((entry) => entry.text.length > 0);

    const answerRaw = answerIdx >= 0 ? (row[answerIdx] ?? '').trim() : '';
    const correctIndexes = answerRaw ? resolveCorrectIndexes(answerRaw) : [];

    const options: ParsedQuizOption[] = optionCells.map((option, index) => ({
      optionText: option.text,
      isCorrect: correctIndexes.includes(index),
      orderIndex: index + 1,
      label: option.label,
    }));

    if (options.length > 0 && !options.some((option) => option.isCorrect)) {
      options[0].isCorrect = true;
    }

    const explicitNumber =
      numberIdx >= 0 ? Number.parseInt(row[numberIdx] ?? '', 10) : NaN;

    questions.push({
      questionText,
      questionType: 'multiple_choice',
      points: DEFAULT_POINTS,
      orderIndex: Number.isFinite(explicitNumber)
        ? explicitNumber
        : questions.length + 1,
      options,
    });
  }

  questions.sort((a, b) => a.orderIndex - b.orderIndex);
  questions.forEach((question, index) => {
    question.orderIndex = index + 1;
  });

  return {
    title: title || 'Imported Test',
    description,
    questions,
    keyTopics: deriveTopics(description, questions),
    summary: buildSummary(title || 'Imported Test', questions.length),
    difficulty: deriveDifficulty(questions.length),
    rawTextPreview: csvText.slice(0, 2000),
  };
}

/** Maps a parsed document into the POST /tests questions payload shape. */
export function mapParsedQuizToCreateQuestions(
  document: ParsedQuizDocument,
): Array<{
  questionText: string;
  questionType: string;
  points: number;
  orderIndex: number;
  explanation?: string;
  options: Array<{
    optionText: string;
    isCorrect: boolean;
    orderIndex: number;
  }>;
}> {
  return document.questions.map((question) => ({
    questionText: question.questionText,
    questionType: question.questionType,
    points: question.points,
    orderIndex: question.orderIndex,
    explanation: question.explanation,
    options: question.options.map((option) => ({
      optionText: option.optionText,
      isCorrect: option.isCorrect,
      orderIndex: option.orderIndex,
    })),
  }));
}
