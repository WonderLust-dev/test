import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Paper, Attempt, AttemptQuestion, Bookmark, Mistake, PaperJSON } from '../types';

// ============================================================
// LocalStorage fallback for when Supabase is not configured
// ============================================================
const LS_KEYS = {
  papers: 'sscp_papers',
  attempts: 'sscp_attempts',
  attemptQuestions: 'sscp_attempt_questions',
  bookmarks: 'sscp_bookmarks',
  mistakes: 'sscp_mistakes',
  session: 'sscp_session',
};

function lsGet<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function lsSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Only query remote Supabase if client is initialized AND user is a real authenticated UUID (never for guest or empty)
export function isRemoteUser(userId?: string): boolean {
  return Boolean(isSupabaseConfigured && supabase && userId && userId !== 'guest' && userId.length > 10);
}

// In-flight deduplication and short TTL cache to prevent duplicate bursts on page load
const inFlight = new Map<string, Promise<any>>();
const cache = new Map<string, { data: any; exp: number }>();

function cachedFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.exp > Date.now()) {
    return Promise.resolve(cached.data as T);
  }
  if (inFlight.has(key)) {
    return inFlight.get(key)! as Promise<T>;
  }
  const promise = fetcher().then((data) => {
    inFlight.delete(key);
    cache.set(key, { data, exp: Date.now() + ttlMs });
    return data;
  }).catch((err) => {
    inFlight.delete(key);
    throw err;
  });
  inFlight.set(key, promise);
  return promise;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
  } else {
    for (const k of cache.keys()) {
      if (k.startsWith(prefix)) cache.delete(k);
    }
  }
}

// Helper to safely use supabase
async function sb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    return await fn();
  } catch (e) {
    // Silently fail - will fall back to localStorage
    return null;
  }
}

// Helper for operations that need error reporting
async function sbWithResult<T>(fn: () => Promise<{ data: T | null; error: any }>): Promise<{ success: boolean; data?: T; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await fn();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as T };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// Papers Service
// ============================================================
export async function getPapers(userId?: string): Promise<Paper[]> {
  if (!isRemoteUser(userId)) {
    return lsGet<Paper>(LS_KEYS.papers);
  }
  return cachedFetch<Paper[]>(`papers_${userId}`, 8000, async () => {
    const result = await sb(async () => {
      // Fetch user's own papers AND all public papers
      const { data, error } = await supabase!
        .from('papers')
        .select('*')
        .or(`user_id.eq.${userId},visibility.eq.public`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Paper[];
    });
    if (result) return result;
    return lsGet<Paper>(LS_KEYS.papers);
  });
}

export async function getPaperById(paperId: string): Promise<Paper | null> {
  return cachedFetch<Paper | null>(`paper_${paperId}`, 15000, async () => {
    if (isSupabaseConfigured && supabase) {
      const result = await sb(async () => {
        const { data, error } = await supabase!.from('papers').select('*').eq('id', paperId).single();
        if (error) throw error;
        return data as Paper;
      });
      if (result) return result;
    }
    return lsGet<Paper>(LS_KEYS.papers).find(p => p.id === paperId) || null;
  });
}

export async function savePaper(paper: Omit<Paper, 'id' | 'created_at' | 'updated_at'>): Promise<Paper> {
  invalidateCache('papers');
  const now = new Date().toISOString();
  const newPaper: Paper = {
    ...paper,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };

  if (isRemoteUser(paper.user_id)) {
    const result = await sb(async () => {
      const { data, error } = await supabase!.from('papers').insert(newPaper).select().single();
      if (error) throw error;
      return data as Paper;
    });
    if (result) return result;
  }

  const papers = lsGet<Paper>(LS_KEYS.papers);
  papers.unshift(newPaper);
  lsSet(LS_KEYS.papers, papers);
  return newPaper;
}

export async function updatePaper(paperId: string, updates: Partial<Paper>): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await sb(async () => {
      const { error } = await supabase!.from('papers').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', paperId);
      if (error) throw error;
    });
    return;
  }
  const papers = lsGet<Paper>(LS_KEYS.papers);
  const idx = papers.findIndex(p => p.id === paperId);
  if (idx >= 0) {
    papers[idx] = { ...papers[idx], ...updates, updated_at: new Date().toISOString() };
    lsSet(LS_KEYS.papers, papers);
  }
}

export async function updatePaperVisibility(paperId: string, visibility: 'private' | 'public'): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured && supabase) {
    const result = await sbWithResult<void>(async () => {
      const { error } = await supabase!
        .from('papers')
        .update({ visibility, updated_at: new Date().toISOString() })
        .eq('id', paperId);
      return { data: null, error };
    });
    
    if (result.success) {
      // Update localStorage too
      const papers = lsGet<Paper>(LS_KEYS.papers);
      const idx = papers.findIndex(p => p.id === paperId);
      if (idx >= 0) {
        papers[idx].visibility = visibility;
        lsSet(LS_KEYS.papers, papers);
      }
      return { success: true };
    }
    return { success: false, error: result.error };
  }
  
  // Fallback to localStorage
  const papers = lsGet<Paper>(LS_KEYS.papers);
  const idx = papers.findIndex(p => p.id === paperId);
  if (idx >= 0) {
    papers[idx].visibility = visibility;
    lsSet(LS_KEYS.papers, papers);
    return { success: true };
  }
  return { success: false, error: 'Paper not found' };
}

export async function deletePaper(paperId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await sb(async () => {
      const { error } = await supabase!.from('papers').delete().eq('id', paperId);
      if (error) throw error;
    });
    return;
  }
  const papers = lsGet<Paper>(LS_KEYS.papers).filter(p => p.id !== paperId);
  lsSet(LS_KEYS.papers, papers);
}

export async function checkDuplicatePaper(title: string, userId?: string): Promise<Paper | null> {
  if (isSupabaseConfigured && supabase && userId) {
    const result = await sb(async () => {
      const { data } = await supabase!.from('papers').select('*').eq('user_id', userId).eq('title', title).limit(1);
      return (data?.[0] as Paper) || null;
    });
    if (result) return result;
  }
  return lsGet<Paper>(LS_KEYS.papers).find(p => p.title === title) || null;
}

// ============================================================
// Attempts Service
// ============================================================
export async function getAttempts(userId?: string): Promise<Attempt[]> {
  if (!isRemoteUser(userId)) {
    return lsGet<Attempt>(LS_KEYS.attempts);
  }
  return cachedFetch<Attempt[]>(`attempts_${userId}`, 8000, async () => {
    const result = await sb(async () => {
      const { data, error } = await supabase!.from('attempts').select('*').eq('user_id', userId!).order('started_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Attempt[];
    });
    if (result) return result;
    return lsGet<Attempt>(LS_KEYS.attempts);
  });
}

export async function getAttemptsByPaper(paperId: string, userId?: string): Promise<Attempt[]> {
  if (!isRemoteUser(userId)) {
    return lsGet<Attempt>(LS_KEYS.attempts).filter(a => a.paper_id === paperId);
  }
  return cachedFetch<Attempt[]>(`attempts_${paperId}_${userId}`, 8000, async () => {
    const result = await sb(async () => {
      const { data } = await supabase!.from('attempts').select('*').eq('paper_id', paperId).eq('user_id', userId!).order('started_at', { ascending: false });
      return (data || []) as Attempt[];
    });
    if (result) return result;
    return lsGet<Attempt>(LS_KEYS.attempts).filter(a => a.paper_id === paperId);
  });
}

export async function saveAttempt(attempt: Omit<Attempt, 'id'>, questions: Omit<AttemptQuestion, 'id' | 'attempt_id'>[]): Promise<Attempt> {
  invalidateCache('attempts');
  const newAttempt: Attempt = { ...attempt, id: generateId() };
  const newQuestions = questions.map(q => ({ ...q, id: generateId(), attempt_id: newAttempt.id }));

  if (isRemoteUser(attempt.user_id)) {
    const result = await sbWithResult<Attempt>(async () => {
      const { data, error } = await supabase!.from('attempts').insert(newAttempt).select().single();
      if (error) return { data: null, error };
      if (data) {
        const qs = newQuestions.map(q => ({ ...q, attempt_id: data.id }));
        const { error: qError } = await supabase!.from('attempt_questions').insert(qs);
        if (qError) return { data: null, error: qError };
      }
      return { data, error: null };
    });
    
    if (result.success && result.data) {
      return result.data;
    }
  }

  // Fallback to localStorage
  const attempts = lsGet<Attempt>(LS_KEYS.attempts);
  attempts.unshift(newAttempt);
  lsSet(LS_KEYS.attempts, attempts);
  const allQs = lsGet<AttemptQuestion>(LS_KEYS.attemptQuestions);
  allQs.push(...newQuestions);
  lsSet(LS_KEYS.attemptQuestions, allQs);
  return newAttempt;
}

export async function getAttemptQuestions(attemptId: string): Promise<AttemptQuestion[]> {
  if (isSupabaseConfigured && supabase) {
    const result = await sb(async () => {
      const { data } = await supabase!.from('attempt_questions').select('*').eq('attempt_id', attemptId);
      return (data || []) as AttemptQuestion[];
    });
    if (result) return result;
  }
  return lsGet<AttemptQuestion>(LS_KEYS.attemptQuestions).filter(q => q.attempt_id === attemptId);
}

// ============================================================
// Bookmarks Service
// ============================================================
export async function getBookmarks(userId?: string): Promise<Bookmark[]> {
  if (!isRemoteUser(userId)) {
    return lsGet<Bookmark>(LS_KEYS.bookmarks);
  }
  return cachedFetch<Bookmark[]>(`bookmarks_${userId}`, 8000, async () => {
    const result = await sb(async () => {
      const { data } = await supabase!.from('bookmarks').select('*').eq('user_id', userId!).order('created_at', { ascending: false });
      return (data || []) as Bookmark[];
    });
    if (result) return result;
    return lsGet<Bookmark>(LS_KEYS.bookmarks);
  });
}

export async function addBookmark(bookmark: Omit<Bookmark, 'id' | 'created_at'>): Promise<Bookmark> {
  invalidateCache('bookmarks');
  const newBookmark: Bookmark = { ...bookmark, id: generateId(), created_at: new Date().toISOString() };
  if (isRemoteUser(bookmark.user_id)) {
    const result = await sb(async () => {
      const { data } = await supabase!.from('bookmarks').insert(newBookmark).select().single();
      return data as Bookmark;
    });
    if (result) return result;
  }
  const bookmarks = lsGet<Bookmark>(LS_KEYS.bookmarks);
  bookmarks.unshift(newBookmark);
  lsSet(LS_KEYS.bookmarks, bookmarks);
  return newBookmark;
}

export async function removeBookmark(bookmarkId: string): Promise<void> {
  invalidateCache('bookmarks');
  if (isSupabaseConfigured && supabase) {
    await sb(async () => {
      const { error } = await supabase!.from('bookmarks').delete().eq('id', bookmarkId);
      if (error) throw error;
    });
  }
  const bookmarks = lsGet<Bookmark>(LS_KEYS.bookmarks).filter(b => b.id !== bookmarkId);
  lsSet(LS_KEYS.bookmarks, bookmarks);
}

export async function isBookmarked(paperId: string, questionId: number | string, userId?: string): Promise<boolean> {
  if (!isRemoteUser(userId)) {
    return lsGet<Bookmark>(LS_KEYS.bookmarks).some(b => b.paper_id === paperId && String(b.question_id) === String(questionId));
  }
  const result = await sb(async () => {
    const { data } = await supabase!.from('bookmarks').select('id').eq('paper_id', paperId).eq('question_id', String(questionId)).eq('user_id', userId!).limit(1);
    return (data?.length || 0) > 0;
  });
  if (result !== null) return result;
  return lsGet<Bookmark>(LS_KEYS.bookmarks).some(b => b.paper_id === paperId && String(b.question_id) === String(questionId));
}

// ============================================================
// Mistakes Service
// ============================================================
export async function getMistakes(userId?: string): Promise<Mistake[]> {
  if (!isRemoteUser(userId)) {
    return lsGet<Mistake>(LS_KEYS.mistakes).filter(m => !m.resolved);
  }
  return cachedFetch<Mistake[]>(`mistakes_${userId}`, 8000, async () => {
    const result = await sb(async () => {
      const { data } = await supabase!.from('mistakes').select('*').eq('user_id', userId!).eq('resolved', false).order('last_attempted_at', { ascending: false });
      return (data || []) as Mistake[];
    });
    if (result) return result;
    return lsGet<Mistake>(LS_KEYS.mistakes).filter(m => !m.resolved);
  });
}

export async function addOrUpdateMistake(mistake: Omit<Mistake, 'id' | 'incorrect_count' | 'last_attempted_at'>, userId?: string): Promise<void> {
  invalidateCache('mistakes');
  if (isRemoteUser(userId)) {
    await sb(async () => {
      const { data: existing } = await supabase!
        .from('mistakes')
        .select('*')
        .eq('user_id', userId!)
        .eq('paper_id', mistake.paper_id)
        .eq('question_id', String(mistake.question_id))
        .eq('resolved', false)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase!.from('mistakes').update({
          incorrect_count: existing[0].incorrect_count + 1,
          last_attempted_at: new Date().toISOString(),
        }).eq('id', existing[0].id);
      } else {
        await supabase!.from('mistakes').insert({
          ...mistake,
          id: generateId(),
          incorrect_count: 1,
          last_attempted_at: new Date().toISOString(),
        });
      }
    });
    return;
  }

  const mistakes = lsGet<Mistake>(LS_KEYS.mistakes);
  const existing = mistakes.find(m =>
    m.paper_id === mistake.paper_id &&
    String(m.question_id) === String(mistake.question_id) &&
    !m.resolved
  );

  if (existing) {
    existing.incorrect_count += 1;
    existing.last_attempted_at = new Date().toISOString();
  } else {
    mistakes.unshift({
      ...mistake,
      id: generateId(),
      incorrect_count: 1,
      last_attempted_at: new Date().toISOString(),
    });
  }
  lsSet(LS_KEYS.mistakes, mistakes);
}

export async function resolveMistake(mistakeId: string): Promise<void> {
  invalidateCache('mistakes');
  if (isSupabaseConfigured && supabase) {
    await sb(async () => {
      const { error } = await supabase!.from('mistakes').update({ resolved: true }).eq('id', mistakeId);
      if (error) throw error;
    });
  }
  const mistakes = lsGet<Mistake>(LS_KEYS.mistakes);
  const idx = mistakes.findIndex(m => m.id === mistakeId);
  if (idx >= 0) {
    mistakes[idx].resolved = true;
    lsSet(LS_KEYS.mistakes, mistakes);
  }
}

// ============================================================
// Session persistence (for exam resume)
// ============================================================
export function saveExamSession(session: unknown): void {
  try {
    localStorage.setItem(LS_KEYS.session, JSON.stringify(session));
  } catch {}
}

export function getExamSession(): unknown | null {
  try {
    const data = localStorage.getItem(LS_KEYS.session);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function clearExamSession(): void {
  localStorage.removeItem(LS_KEYS.session);
}

// ============================================================
// Export helpers
// ============================================================
export function exportPaperAsJSON(paper: Paper): string {
  return JSON.stringify(paper.raw_json, null, 2);
}

export function downloadJSON(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
