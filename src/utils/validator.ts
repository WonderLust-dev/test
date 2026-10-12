import { PaperJSON, QuestionJSON, ValidationResult, ValidationError, Difficulty, BatchValidationResult, BatchItemValidation } from '../types';

const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export function validateSinglePaperObject(data: unknown, prefixLabel: string = ''): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const prefix = prefixLabel ? `[${prefixLabel}] ` : '';

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{ path: 'root', message: `${prefix}Paper must be an object.`, severity: 'error' }],
      warnings: [],
      questionCount: 0,
      totalMarks: 0,
      subjects: [],
      duration: 0,
    };
  }

  const paper = data as Record<string, unknown>;

  // Validate paper-level fields
  if (!paper.paperTitle || typeof paper.paperTitle !== 'string') {
    errors.push({ path: 'paperTitle', message: `${prefix}Missing or invalid "paperTitle" (must be a non-empty string).`, severity: 'error' });
  }

  if (!paper.durationMinutes || typeof paper.durationMinutes !== 'number' || paper.durationMinutes <= 0) {
    errors.push({ path: 'durationMinutes', message: `${prefix}Missing or invalid "durationMinutes" (must be a positive number).`, severity: 'error' });
  }

  if (!paper.totalMarks || typeof paper.totalMarks !== 'number' || paper.totalMarks <= 0) {
    warnings.push({ path: 'totalMarks', message: `${prefix}"totalMarks" is missing or invalid. It will be calculated from questions.`, severity: 'warning' });
  }

  if (paper.negativeMarking !== undefined && (typeof paper.negativeMarking !== 'number' || paper.negativeMarking < 0)) {
    warnings.push({ path: 'negativeMarking', message: `${prefix}"negativeMarking" should be a non-negative number.`, severity: 'warning' });
  }

  if (!paper.questions || !Array.isArray(paper.questions)) {
    return {
      valid: false,
      errors: [{ path: 'questions', message: `${prefix}Missing or invalid "questions" array.`, severity: 'error' }],
      warnings,
      questionCount: 0,
      totalMarks: 0,
      subjects: [],
      duration: 0,
    };
  }

  if (paper.questions.length === 0) {
    errors.push({ path: 'questions', message: 'Questions array is empty. At least one question is required.', severity: 'error' });
  }

  // Validate each question
  const questionIds = new Set<string | number>();
  const subjects = new Set<string>();
  let totalMarks = 0;

  (paper.questions as unknown[]).forEach((q: unknown, index: number) => {
    const prefix = `Question ${index + 1}`;
    if (!q || typeof q !== 'object') {
      errors.push({ path: `questions[${index}]`, message: `${prefix}: Must be an object.`, severity: 'error' });
      return;
    }

    const question = q as Record<string, unknown>;

    // ID
    if (question.id === undefined || question.id === null) {
      errors.push({ path: `questions[${index}].id`, message: `${prefix}: Missing "id" field.`, severity: 'error' });
    } else if (questionIds.has(question.id as string | number)) {
      errors.push({ path: `questions[${index}].id`, message: `${prefix}: Duplicate question id "${question.id}".`, severity: 'error' });
    } else {
      questionIds.add(question.id as string | number);
    }

    // Question text
    if (!question.question || typeof question.question !== 'string' || (question.question as string).trim() === '') {
      errors.push({ path: `questions[${index}].question`, message: `${prefix}: Missing or empty "question" text.`, severity: 'error' });
    }

    // Subject
    if (!question.subject || typeof question.subject !== 'string') {
      warnings.push({ path: `questions[${index}].subject`, message: `${prefix}: Missing "subject" field.`, severity: 'warning' });
    } else {
      subjects.add(question.subject as string);
    }

    // Topic
    if (!question.topic || typeof question.topic !== 'string') {
      warnings.push({ path: `questions[${index}].topic`, message: `${prefix}: Missing "topic" field.`, severity: 'warning' });
    }

    // Options
    if (!Array.isArray(question.options) || question.options.length < 2) {
      errors.push({ path: `questions[${index}].options`, message: `${prefix}: "options" must be an array with at least 2 items.`, severity: 'error' });
    } else {
      (question.options as unknown[]).forEach((opt, optIdx) => {
        if (typeof opt !== 'string' || (opt as string).trim() === '') {
          errors.push({ path: `questions[${index}].options[${optIdx}]`, message: `${prefix}, Option ${String.fromCharCode(65 + optIdx)}: Must be a non-empty string.`, severity: 'error' });
        }
      });
    }

    // Correct answer
    if (question.correctAnswer === undefined || question.correctAnswer === null) {
      errors.push({ path: `questions[${index}].correctAnswer`, message: `${prefix}: Missing "correctAnswer".`, severity: 'error' });
    } else if (typeof question.correctAnswer !== 'string') {
      errors.push({ path: `questions[${index}].correctAnswer`, message: `${prefix}: "correctAnswer" must be a string matching one of the options.`, severity: 'error' });
    } else if (Array.isArray(question.options)) {
      const optionValues = question.options as string[];
      if (!optionValues.includes(question.correctAnswer as string)) {
        errors.push({
          path: `questions[${index}].correctAnswer`,
          message: `${prefix}: "correctAnswer" value "${question.correctAnswer}" does not match any option. Available: ${optionValues.join(', ')}`,
          severity: 'error',
        });
      }
    }

    // Answer index
    if (question.answerIndex === undefined || question.answerIndex === null) {
      errors.push({ path: `questions[${index}].answerIndex`, message: `${prefix}: Missing "answerIndex".`, severity: 'error' });
    } else if (typeof question.answerIndex !== 'number') {
      errors.push({ path: `questions[${index}].answerIndex`, message: `${prefix}: "answerIndex" must be a number.`, severity: 'error' });
    } else if (Array.isArray(question.options)) {
      const maxIdx = (question.options as unknown[]).length - 1;
      if ((question.answerIndex as number) < 0 || (question.answerIndex as number) > maxIdx) {
        errors.push({ path: `questions[${index}].answerIndex`, message: `${prefix}: "answerIndex" ${question.answerIndex} is out of range (0-${maxIdx}).`, severity: 'error' });
      }
      // Verify answerIndex matches correctAnswer
      if (typeof question.correctAnswer === 'string' && Array.isArray(question.options)) {
        const opts = question.options as string[];
        if (opts[question.answerIndex as number] !== question.correctAnswer) {
          errors.push({
            path: `questions[${index}].answerIndex`,
            message: `${prefix}: "answerIndex" (${question.answerIndex} → "${opts[question.answerIndex as number]}") does not match "correctAnswer" ("${question.correctAnswer}").`,
            severity: 'error',
          });
        }
      }
    }

    // Marks
    if (question.marks === undefined || typeof question.marks !== 'number' || (question.marks as number) <= 0) {
      errors.push({ path: `questions[${index}].marks`, message: `${prefix}: "marks" must be a positive number.`, severity: 'error' });
    } else {
      totalMarks += question.marks as number;
    }

    // Difficulty
    if (question.difficulty && !VALID_DIFFICULTIES.includes(question.difficulty as Difficulty)) {
      warnings.push({ path: `questions[${index}].difficulty`, message: `${prefix}: Invalid difficulty "${question.difficulty}". Should be easy/medium/hard.`, severity: 'warning' });
    }

    // Negative marks
    if (question.negativeMarks !== undefined && (typeof question.negativeMarks !== 'number' || (question.negativeMarks as number) < 0)) {
      warnings.push({ path: `questions[${index}].negativeMarks`, message: `${prefix}: "negativeMarks" should be a non-negative number.`, severity: 'warning' });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    questionCount: (paper.questions as unknown[]).length,
    totalMarks,
    subjects: Array.from(subjects),
    duration: (paper.durationMinutes as number) || 0,
  };
}

export function validatePaperJSON(jsonString: string): ValidationResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    return {
      valid: false,
      errors: [{ path: 'root', message: `Invalid JSON syntax: ${(e as Error).message}`, severity: 'error' }],
      warnings: [],
      questionCount: 0,
      totalMarks: 0,
      subjects: [],
      duration: 0,
    };
  }

  // If array, validate first or return informative message
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return {
        valid: false,
        errors: [{ path: 'root', message: 'The provided JSON array of papers is empty.', severity: 'error' }],
        warnings: [],
        questionCount: 0,
        totalMarks: 0,
        subjects: [],
        duration: 0,
      };
    }
    return validateSinglePaperObject(data[0], 'Paper 1');
  }

  return validateSinglePaperObject(data);
}

export function validateInputJSON(jsonString: string): BatchValidationResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    const errorResult: ValidationResult = {
      valid: false,
      errors: [{ path: 'root', message: `Invalid JSON syntax: ${(e as Error).message}`, severity: 'error' }],
      warnings: [],
      questionCount: 0,
      totalMarks: 0,
      subjects: [],
      duration: 0,
    };
    return {
      isBatch: false,
      totalPapers: 0,
      validCount: 0,
      items: [],
      singleResult: errorResult,
      singlePaper: null,
    };
  }

  // Check if batch array: either raw Array or { papers: [...] }
  let paperArray: unknown[] | null = null;
  if (Array.isArray(data)) {
    paperArray = data;
  } else if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).papers)) {
    paperArray = (data as Record<string, unknown>).papers as unknown[];
  }

  if (paperArray) {
    const items: BatchItemValidation[] = paperArray.map((item, idx) => {
      const val = validateSinglePaperObject(item, `Paper ${idx + 1}`);
      const title = (item && typeof item === 'object' && typeof (item as Record<string, unknown>).paperTitle === 'string')
        ? (item as Record<string, unknown>).paperTitle as string
        : `Paper ${idx + 1}`;
      const paper = val.valid ? (item as PaperJSON) : null;
      return {
        index: idx,
        title,
        paper,
        validation: val,
        selected: val.valid,
      };
    });

    const validCount = items.filter(it => it.validation.valid).length;
    return {
      isBatch: true,
      totalPapers: items.length,
      validCount,
      items,
      singleResult: items[0]?.validation,
      singlePaper: items[0]?.paper,
    };
  }

  // Single paper
  const singleVal = validateSinglePaperObject(data);
  const singlePaper = singleVal.valid ? (data as PaperJSON) : null;
  return {
    isBatch: false,
    totalPapers: 1,
    validCount: singleVal.valid ? 1 : 0,
    items: [{
      index: 0,
      title: (data && typeof data === 'object' && typeof (data as Record<string, unknown>).paperTitle === 'string')
        ? (data as Record<string, unknown>).paperTitle as string
        : 'Paper 1',
      paper: singlePaper,
      validation: singleVal,
      selected: singleVal.valid,
    }],
    singleResult: singleVal,
    singlePaper,
  };
}

export function parsePaperJSON(jsonString: string): PaperJSON | null {
  try {
    const data = JSON.parse(jsonString);
    if (Array.isArray(data)) return data[0] || null;
    if (data && typeof data === 'object' && Array.isArray(data.papers)) return data.papers[0] || null;
    return data as PaperJSON;
  } catch {
    return null;
  }
}

export function parseInputJSON(jsonString: string): { isBatch: boolean; papers: PaperJSON[]; single: PaperJSON | null } {
  try {
    const data = JSON.parse(jsonString);
    if (Array.isArray(data)) {
      return { isBatch: true, papers: data as PaperJSON[], single: data[0] || null };
    }
    if (data && typeof data === 'object' && Array.isArray(data.papers)) {
      return { isBatch: true, papers: data.papers as PaperJSON[], single: data.papers[0] || null };
    }
    return { isBatch: false, papers: [data as PaperJSON], single: data as PaperJSON };
  } catch {
    return { isBatch: false, papers: [], single: null };
  }
}
