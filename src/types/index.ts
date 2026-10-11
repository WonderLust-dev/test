// ============================================================
// SSC CGL Exam Platform — Complete Type Definitions
// ============================================================

// --- Exam & Paper Types ---
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ExamType = 'SSC CGL' | 'SSC CHSL' | 'SSC MTS' | 'SSC CPO' | 'SSC GD';
export type BookmarkCategory = 'important' | 'difficult' | 'revise_later' | 'shortcut' | 'formula' | 'doubt';

export interface QuestionJSON {
  id: number | string;
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty?: Difficulty;
  question: string;
  options: string[];
  correctAnswer: string;
  answerIndex: number;
  marks: number;
  negativeMarks?: number;
  hint?: string;
  solution?: string;
  method?: string;
  shortcut?: string;
  learningSuggestion?: string;
  timeEstimate?: number;
  tags?: string[];
  source?: string;
  image?: string;
  formula?: string;
  table?: string;
  passage?: string;
}

export interface PaperJSON {
  exam: ExamType | string;
  paperTitle: string;
  description?: string;
  durationMinutes: number;
  totalMarks: number;
  negativeMarking?: number;
  difficulty?: Difficulty;
  subjects?: string[];
  questions: QuestionJSON[];
}

// --- Database Models ---
export interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Paper {
  id: string;
  user_id: string;
  exam: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  duration_minutes: number;
  total_marks: number;
  negative_marking: number;
  question_count: number;
  subjects: string[];
  raw_json: PaperJSON;
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
  visibility: 'private' | 'public';
}

export interface Attempt {
  id: string;
  user_id: string;
  paper_id: string;
  paper_title: string;
  started_at: string;
  completed_at?: string;
  score: number;
  total_marks: number;
  accuracy: number;
  attempted_count: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  time_spent_seconds: number;
  is_complete: boolean;
  mode: 'exam' | 'practice';
}

export interface AttemptQuestion {
  id: string;
  attempt_id: string;
  question_id: number | string;
  question_index: number;
  selected_answer: number | null;
  is_correct: boolean | null;
  time_spent_seconds: number;
  marked_for_review: boolean;
  is_answered: boolean;
}

export interface Bookmark {
  id: string;
  user_id: string;
  paper_id: string;
  question_id: number | string;
  question_text: string;
  category: BookmarkCategory;
  created_at: string;
}

export interface Mistake {
  id: string;
  user_id: string;
  paper_id: string;
  paper_title: string;
  question_id: number | string;
  question_text: string;
  subject: string;
  topic: string;
  selected_answer: number | null;
  correct_answer: number;
  options: string[];
  solution?: string;
  shortcut?: string;
  hint?: string;
  learning_suggestion?: string;
  incorrect_count: number;
  last_attempted_at: string;
  resolved: boolean;
  // Spaced Repetition fields
  next_review_date?: string | null;
  interval_days?: number;
  ease_factor?: number;
  review_count?: number;
  last_review_date?: string | null;
  status?: 'new' | 'learning' | 'review' | 'relearning';
}

export interface Review {
  id: string;
  user_id: string;
  mistake_id: string;
  reviewed_at: string;
  quality: number; // 0-5 rating
  interval_before?: number;
  interval_after?: number;
  ease_factor_before?: number;
  ease_factor_after?: number;
  response_time_seconds?: number;
  is_correct: boolean;
}

export interface ReviewStats {
  total_reviews: number;
  today_reviews: number;
  week_reviews: number;
  avg_quality: number;
  due_count: number;
  streak_days: number;
}

export interface DueReview {
  mistake_id: string;
  question_text: string;
  subject: string;
  topic: string;
  interval_days: number;
  ease_factor: number;
  review_count: number;
  next_review_date: string;
}

// --- Exam Session State ---
export interface ExamSession {
  paperId: string;
  paperTitle: string;
  questions: QuestionJSON[];
  startTime: number;
  durationSeconds: number;
  deadline?: number; // Absolute deadline timestamp for reliable timer
  answers: Record<number, number | null>;
  markedForReview: Record<number, boolean>;
  questionTimes: Record<number, number>;
  currentQuestion: number;
  mode: 'exam' | 'practice';
}

// --- Analytics Types ---
export interface SubjectPerformance {
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
  avgTime: number;
}

export interface TopicPerformance {
  topic: string;
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
  avgTime: number;
}

export interface DashboardStats {
  totalExams: number;
  totalQuestions: number;
  overallAccuracy: number;
  averageScore: number;
  highestScore: number;
  papersCompleted: number;
  currentStreak: number;
  weakestSubject: string;
  strongestSubject: string;
  weakestTopics: TopicPerformance[];
  strongestTopics: TopicPerformance[];
}

// --- Validation Types ---
export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  questionCount: number;
  totalMarks: number;
  subjects: string[];
  duration: number;
}

// --- Filter Types ---
export interface PaperFilters {
  exam?: string;
  subject?: string;
  difficulty?: Difficulty;
  topic?: string;
  search?: string;
  status?: 'all' | 'attempted' | 'not_attempted' | 'completed';
  sortBy?: 'recent' | 'name' | 'score' | 'questions';
}

export interface PracticeConfig {
  mode: 'quick' | 'topic' | 'weak' | 'mistakes' | 'timed' | 'random';
  subject?: string;
  topic?: string;
  difficulty?: Difficulty;
  questionCount: number;
  timeLimitMinutes?: number;
  paperIds?: string[];
}
