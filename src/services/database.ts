import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Paper, Attempt, AttemptQuestion, Bookmark, Mistake, PaperJSON, StudyNote } from '../types';
import { DEMO_NOTES } from '../utils/demoNotes';

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
  pendingSyncAttempts: 'sscp_pending_sync_attempts',
  pendingSyncBookmarks: 'sscp_pending_sync_bookmarks',
  pendingSyncNotes: 'sscp_pending_sync_notes',
  notes: 'sscp_notes',
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
  const localPapers = lsGet<Paper>(LS_KEYS.papers);

  if (!isRemoteUser(userId)) {
    // For guest/visitor: load local papers and fetch all public papers from Supabase
    if (isSupabaseConfigured && supabase) {
      return cachedFetch<Paper[]>('papers_public', 10000, async () => {
        const result = await sb(async () => {
          const { data, error } = await supabase!
            .from('papers')
            .select('*')
            .eq('visibility', 'public')
            .order('created_at', { ascending: false });
          if (error) throw error;
          return (data || []) as Paper[];
        });
        if (result && result.length > 0) {
          const localIds = new Set(localPapers.map(p => p.id));
          const merged = [...localPapers, ...result.filter(p => !localIds.has(p.id))];
          lsSet(LS_KEYS.papers, merged); // Cache locally for offline test-taking
          return merged;
        }
        return localPapers;
      });
    }
    return localPapers;
  }

  // Authenticated user: fetch own papers AND all public papers
  return cachedFetch<Paper[]>(`papers_${userId}`, 8000, async () => {
    const result = await sb(async () => {
      const { data, error } = await supabase!
        .from('papers')
        .select('*')
        .or(`user_id.eq.${userId},visibility.eq.public`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Paper[];
    });
    if (result) {
      // Merge with any local-only papers and persist locally for offline access
      const remoteIds = new Set(result.map(p => p.id));
      const localOnly = localPapers.filter(p => !remoteIds.has(p.id));
      const merged = [...localOnly, ...result];
      lsSet(LS_KEYS.papers, merged); // Cache locally for offline test-taking
      return merged;
    }
    return localPapers;
  });
}

export async function getPaperById(paperId: string): Promise<Paper | null> {
  const localPapers = lsGet<Paper>(LS_KEYS.papers);
  const local = localPapers.find(p => p.id === paperId);
  if (local) return local;

  return cachedFetch<Paper | null>(`paper_${paperId}`, 15000, async () => {
    if (isSupabaseConfigured && supabase) {
      const result = await sb(async () => {
        const { data, error } = await supabase!.from('papers').select('*').eq('id', paperId).maybeSingle();
        if (error) {
          console.warn('[Supabase] Failed to fetch paper by id:', error);
          return null;
        }
        return data as Paper | null;
      });
      if (result) {
        // Cache paper into local storage so it can be taken offline later
        const currentPapers = lsGet<Paper>(LS_KEYS.papers);
        if (!currentPapers.some(p => p.id === result.id)) {
          currentPapers.unshift(result);
          lsSet(LS_KEYS.papers, currentPapers);
        }
        return result;
      }
    }
    return null;
  });
}

export function saveCustomPaper(paper: Paper): void {
  const papers = lsGet<Paper>(LS_KEYS.papers);
  const existingIdx = papers.findIndex(p => p.id === paper.id);
  if (existingIdx >= 0) {
    papers[existingIdx] = { ...paper, updated_at: new Date().toISOString() };
  } else {
    papers.unshift(paper);
  }
  lsSet(LS_KEYS.papers, papers);
  invalidateCache('papers');
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

export async function savePapersBatch(papersToSave: Array<Omit<Paper, 'id' | 'created_at' | 'updated_at'>>): Promise<Paper[]> {
  invalidateCache('papers');
  const now = new Date().toISOString();
  const newPapers: Paper[] = papersToSave.map((p, idx) => ({
    ...p,
    id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: now,
    updated_at: now,
  }));

  if (newPapers.length === 0) return [];

  const userId = papersToSave[0]?.user_id;
  if (isRemoteUser(userId)) {
    const result = await sb(async () => {
      const { data, error } = await supabase!.from('papers').insert(newPapers).select();
      if (error) throw error;
      return (data || []) as Paper[];
    });
    if (result && result.length > 0) return result;
  }

  const existingPapers = lsGet<Paper>(LS_KEYS.papers);
  const updated = [...newPapers, ...existingPapers];
  lsSet(LS_KEYS.papers, updated);
  return newPapers;
}

export async function updatePaper(paperId: string, updates: Partial<Paper>): Promise<void> {
  invalidateCache('papers');
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

export async function updatePaperVisibility(
  paperId: string,
  visibility: 'private' | 'public',
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  invalidateCache('papers');

  const localPapers = lsGet<Paper>(LS_KEYS.papers);
  const localPaper = localPapers.find(p => p.id === paperId);

  if (isSupabaseConfigured && supabase) {
    if (isRemoteUser(userId)) {
      // Check if paper already exists in Supabase
      const { data: existing, error: checkError } = await supabase!
        .from('papers')
        .select('id, user_id')
        .eq('id', paperId)
        .limit(1);

      if (!checkError && existing && existing.length > 0) {
        // Exists in Supabase — update its visibility
        const { error } = await supabase!
          .from('papers')
          .update({ visibility, updated_at: new Date().toISOString() })
          .eq('id', paperId);
        
        if (error) {
          return { success: false, error: error.message };
        }
      } else if (localPaper) {
        // Exists locally only — insert into Supabase so it becomes accessible to all
        const cloudPaper: Paper = {
          ...localPaper,
          user_id: userId!,
          visibility,
          updated_at: new Date().toISOString(),
        };
        const { error: insertError } = await supabase!
          .from('papers')
          .insert(cloudPaper);

        if (insertError) {
          return { success: false, error: insertError.message };
        }

        // Also update local storage paper to match
        localPaper.user_id = userId!;
        localPaper.visibility = visibility;
        localPaper.updated_at = new Date().toISOString();
        lsSet(LS_KEYS.papers, localPapers);
      }
    } else if (visibility === 'public') {
      return {
        success: false,
        error: 'Please sign in to publish this test to the public community so colleagues can access it.',
      };
    }
  }

  // Update in localStorage
  if (localPaper) {
    localPaper.visibility = visibility;
    localPaper.updated_at = new Date().toISOString();
    lsSet(LS_KEYS.papers, localPapers);
    return { success: true };
  }

  return { success: true };
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
  const localAttempts = lsGet<Attempt>(LS_KEYS.attempts);
  if (!isRemoteUser(userId)) {
    return localAttempts;
  }
  return cachedFetch<Attempt[]>(`attempts_${userId}`, 8000, async () => {
    const result = await sb(async () => {
      const { data, error } = await supabase!.from('attempts').select('*').eq('user_id', userId!).order('started_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Attempt[];
    });
    if (result) {
      // Merge remote attempts with local attempts, avoiding duplicate IDs
      const remoteIds = new Set(result.map(a => a.id));
      return [...result, ...localAttempts.filter(a => !remoteIds.has(a.id))];
    }
    return localAttempts;
  });
}

export async function getAttemptsByPaper(paperId: string, userId?: string): Promise<Attempt[]> {
  const localByPaper = lsGet<Attempt>(LS_KEYS.attempts).filter(a => String(a.paper_id) === String(paperId));
  if (!isRemoteUser(userId)) {
    return localByPaper;
  }
  return cachedFetch<Attempt[]>(`attempts_${paperId}_${userId}`, 8000, async () => {
    const result = await sb(async () => {
      const { data } = await supabase!.from('attempts').select('*').eq('paper_id', paperId).eq('user_id', userId!).order('started_at', { ascending: false });
      return (data || []) as Attempt[];
    });
    if (result) {
      const remoteIds = new Set(result.map(a => a.id));
      return [...result, ...localByPaper.filter(a => !remoteIds.has(a.id))];
    }
    return localByPaper;
  });
}

export async function saveAttempt(attempt: Omit<Attempt, 'id'>, questions: Omit<AttemptQuestion, 'id' | 'attempt_id'>[]): Promise<Attempt> {
  invalidateCache('attempts');
  const newAttempt: Attempt = { ...attempt, id: generateId() };
  const newQuestions = questions.map(q => ({ ...q, id: generateId(), attempt_id: newAttempt.id }));

  // Always persist locally first so attempts are immediately available and resilient
  const attempts = lsGet<Attempt>(LS_KEYS.attempts);
  attempts.unshift(newAttempt);
  lsSet(LS_KEYS.attempts, attempts);
  const allQs = lsGet<AttemptQuestion>(LS_KEYS.attemptQuestions);
  allQs.push(...newQuestions);
  lsSet(LS_KEYS.attemptQuestions, allQs);

  if (isRemoteUser(attempt.user_id)) {
    let synced = false;
    if (navigator.onLine) {
      try {
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
          synced = true;
          const remoteAttempt = result.data;
          const remoteId = remoteAttempt.id;
          if (remoteId && remoteId !== newAttempt.id) {
            const locAttempts = lsGet<Attempt>(LS_KEYS.attempts);
            const aIdx = locAttempts.findIndex(a => a.id === newAttempt.id);
            if (aIdx >= 0) {
              locAttempts[aIdx] = remoteAttempt;
              lsSet(LS_KEYS.attempts, locAttempts);
            }
            const locQs = lsGet<AttemptQuestion>(LS_KEYS.attemptQuestions);
            locQs.forEach(q => {
              if (q.attempt_id === newAttempt.id) q.attempt_id = remoteId;
            });
            lsSet(LS_KEYS.attemptQuestions, locQs);
          }
          return remoteAttempt;
        }
      } catch {
        synced = false;
      }
    }

    // If offline or remote sync didn't succeed, queue for background sync
    if (!synced) {
      const pending = lsGet<{ attempt: Attempt; questions: AttemptQuestion[] }>(LS_KEYS.pendingSyncAttempts);
      pending.push({ attempt: newAttempt, questions: newQuestions });
      lsSet(LS_KEYS.pendingSyncAttempts, pending);
    }
  }

  return newAttempt;
}

export async function getAttemptQuestions(attemptId: string): Promise<AttemptQuestion[]> {
  const local = lsGet<AttemptQuestion>(LS_KEYS.attemptQuestions).filter(q => q.attempt_id === attemptId);
  if (local.length > 0) return local;

  if (isSupabaseConfigured && supabase) {
    const result = await sb(async () => {
      const { data } = await supabase!.from('attempt_questions').select('*').eq('attempt_id', attemptId);
      return (data || []) as AttemptQuestion[];
    });
    if (result && result.length > 0) return result;
  }
  return local;
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
    if (navigator.onLine) {
      const result = await sb(async () => {
        const { data } = await supabase!.from('bookmarks').insert(newBookmark).select().single();
        return data as Bookmark;
      });
      if (result) return result;
    }
    // Offline or failed - queue for background sync
    const pendingBm = lsGet<Bookmark>(LS_KEYS.pendingSyncBookmarks);
    pendingBm.push(newBookmark);
    lsSet(LS_KEYS.pendingSyncBookmarks, pendingBm);
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

// ============================================================
// Offline Sync Service
// ============================================================

export function getPendingSyncCount(): number {
  const pendingAttempts = lsGet<{ attempt: Attempt; questions: AttemptQuestion[] }>(LS_KEYS.pendingSyncAttempts);
  const pendingBookmarks = lsGet<Bookmark>(LS_KEYS.pendingSyncBookmarks);
  const pendingNotes = lsGet<StudyNote>(LS_KEYS.pendingSyncNotes);
  return pendingAttempts.length + pendingBookmarks.length + pendingNotes.length;
}

export function isPaperAvailableOffline(paperId: string): boolean {
  const localPapers = lsGet<Paper>(LS_KEYS.papers);
  const p = localPapers.find(item => item.id === paperId);
  return Boolean(p && p.raw_json && Array.isArray(p.raw_json.questions) && p.raw_json.questions.length > 0);
}

export function savePaperForOffline(paper: Paper): void {
  const localPapers = lsGet<Paper>(LS_KEYS.papers);
  const idx = localPapers.findIndex(p => p.id === paper.id);
  if (idx >= 0) {
    localPapers[idx] = paper;
  } else {
    localPapers.unshift(paper);
  }
  lsSet(LS_KEYS.papers, localPapers);
}

export async function syncPendingOfflineData(userId?: string): Promise<{ syncedAttempts: number; syncedBookmarks: number; syncedNotes: number }> {
  if (!navigator.onLine) return { syncedAttempts: 0, syncedBookmarks: 0, syncedNotes: 0 };

  let effectiveUserId = userId;
  if (!effectiveUserId && isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      effectiveUserId = data.user?.id;
    } catch {}
  }

  if (!isRemoteUser(effectiveUserId)) return { syncedAttempts: 0, syncedBookmarks: 0, syncedNotes: 0 };

  let syncedAttempts = 0;
  let syncedBookmarks = 0;
  let syncedNotes = 0;

  // 1. Sync pending attempts
  const pendingAttempts = lsGet<{ attempt: Attempt; questions: AttemptQuestion[] }>(LS_KEYS.pendingSyncAttempts);
  if (pendingAttempts.length > 0) {
    const remainingAttempts: typeof pendingAttempts = [];
    for (const item of pendingAttempts) {
      try {
        const attemptToSync = { ...item.attempt, user_id: effectiveUserId! };
        const result = await sbWithResult<Attempt>(async () => {
          const { data, error } = await supabase!.from('attempts').upsert(attemptToSync).select().single();
          if (error) return { data: null, error };
          if (data && item.questions.length > 0) {
            const qs = item.questions.map(q => ({ ...q, attempt_id: data.id }));
            const { error: qError } = await supabase!.from('attempt_questions').upsert(qs);
            if (qError) return { data: null, error: qError };
          }
          return { data, error: null };
        });

        if (result.success) {
          syncedAttempts++;
        } else {
          remainingAttempts.push(item);
        }
      } catch {
        remainingAttempts.push(item);
      }
    }
    lsSet(LS_KEYS.pendingSyncAttempts, remainingAttempts);
  }

  // 2. Sync pending bookmarks
  const pendingBookmarks = lsGet<Bookmark>(LS_KEYS.pendingSyncBookmarks);
  if (pendingBookmarks.length > 0) {
    const remainingBm: Bookmark[] = [];
    for (const bm of pendingBookmarks) {
      try {
        const bmToSync = { ...bm, user_id: effectiveUserId! };
        const res = await sb(async () => {
          const { error } = await supabase!.from('bookmarks').upsert(bmToSync);
          if (error) throw error;
          return true;
        });
        if (res) {
          syncedBookmarks++;
        } else {
          remainingBm.push(bm);
        }
      } catch {
        remainingBm.push(bm);
      }
    }
    lsSet(LS_KEYS.pendingSyncBookmarks, remainingBm);
  }

  // 3. Sync pending study notes
  const pendingNotes = lsGet<StudyNote>(LS_KEYS.pendingSyncNotes);
  if (pendingNotes.length > 0) {
    const remainingNotes: StudyNote[] = [];
    for (const note of pendingNotes) {
      try {
        const noteToSync = { ...note, user_id: effectiveUserId! };
        const res = await sb(async () => {
          const { error } = await supabase!.from('notes').upsert(noteToSync);
          if (error) throw error;
          return true;
        });
        if (res) {
          syncedNotes++;
        } else {
          remainingNotes.push(note);
        }
      } catch {
        remainingNotes.push(note);
      }
    }
    lsSet(LS_KEYS.pendingSyncNotes, remainingNotes);
  }

  if (syncedAttempts > 0 || syncedBookmarks > 0 || syncedNotes > 0) {
    invalidateCache();
  }

  return { syncedAttempts, syncedBookmarks, syncedNotes };
}

// ============================================================
// Study Notes Service (.md and .txt notes)
// Cloud Supabase Sync + PWA Offline LocalStorage Fallback
// ============================================================

export async function getNotes(userId?: string): Promise<StudyNote[]> {
  const localNotes = lsGet<StudyNote>(LS_KEYS.notes);

  if (!isRemoteUser(userId)) {
    // Guest or offline-only mode
    if (localNotes.length === 0) {
      const seeded: StudyNote[] = DEMO_NOTES.map((n, idx) => ({
        ...n,
        id: `seed_note_${Date.now()}_${idx}`,
        user_id: userId || 'guest',
        created_at: new Date(Date.now() - (idx * 3600000)).toISOString(),
        updated_at: new Date(Date.now() - (idx * 3600000)).toISOString(),
      }));
      lsSet(LS_KEYS.notes, seeded);
      return seeded;
    }
    return localNotes;
  }

  // Remote authenticated user
  return cachedFetch<StudyNote[]>(`notes_${userId}`, 5000, async () => {
    const remoteData = await sb(async () => {
      const { data, error } = await supabase!
        .from('notes')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as StudyNote[];
    });

    if (remoteData !== null) {
      // Supabase query succeeded
      if (remoteData.length === 0 && localNotes.length > 0) {
        // First cloud sync: push existing local notes to Supabase
        const notesToUpload = localNotes.map(n => ({
          ...n,
          user_id: userId!,
        }));
        await sb(async () => {
          await supabase!.from('notes').upsert(notesToUpload);
        });
        lsSet(LS_KEYS.notes, notesToUpload);
        return notesToUpload;
      }

      if (remoteData.length === 0 && localNotes.length === 0) {
        // Fresh user: seed default demo notes
        const seeded: StudyNote[] = DEMO_NOTES.map((n, idx) => ({
          ...n,
          id: `seed_note_${Date.now()}_${idx}`,
          user_id: userId!,
          created_at: new Date(Date.now() - (idx * 3600000)).toISOString(),
          updated_at: new Date(Date.now() - (idx * 3600000)).toISOString(),
        }));
        await sb(async () => {
          await supabase!.from('notes').upsert(seeded);
        });
        lsSet(LS_KEYS.notes, seeded);
        return seeded;
      }

      // Check if any local notes were created while offline that aren't on Supabase
      const remoteIds = new Set(remoteData.map(n => n.id));
      const offlineOnlyNotes = localNotes.filter(n => !remoteIds.has(n.id) && (n.user_id === userId || n.user_id === 'guest'));

      if (offlineOnlyNotes.length > 0) {
        const notesToPush = offlineOnlyNotes.map(n => ({ ...n, user_id: userId! }));
        await sb(async () => {
          await supabase!.from('notes').upsert(notesToPush);
        });
        const combined = [...notesToPush, ...remoteData].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        lsSet(LS_KEYS.notes, combined);
        return combined;
      }

      lsSet(LS_KEYS.notes, remoteData);
      return remoteData;
    }

    // Network error or Supabase offline: return local cached notes
    return localNotes;
  });
}

export async function getNoteById(noteId: string, userId?: string): Promise<StudyNote | null> {
  const notes = await getNotes(userId);
  return notes.find(n => n.id === noteId) || null;
}

export async function checkDuplicateNote(title: string, userId?: string): Promise<StudyNote | null> {
  const clean = title.trim().toLowerCase();
  if (!clean) return null;

  const localNotes = lsGet<StudyNote>(LS_KEYS.notes);
  const match = localNotes.find(
    n => n.title.trim().toLowerCase() === clean && (!userId || n.user_id === userId || n.user_id === 'guest')
  );
  if (match) return match;

  if (isRemoteUser(userId)) {
    const remote = await sb(async () => {
      const { data } = await supabase!
        .from('notes')
        .select('*')
        .eq('user_id', userId!)
        .ilike('title', title.trim())
        .limit(1);
      return data && data.length > 0 ? (data[0] as StudyNote) : null;
    });
    if (remote) return remote;
  }

  return null;
}

export async function saveNote(note: Omit<StudyNote, 'id' | 'created_at' | 'updated_at'>): Promise<StudyNote> {
  const now = new Date().toISOString();
  const newNote: StudyNote = {
    ...note,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };

  // 1. LocalStorage for instant UI response and offline resilience
  const notes = lsGet<StudyNote>(LS_KEYS.notes);
  notes.unshift(newNote);
  lsSet(LS_KEYS.notes, notes);
  invalidateCache('notes');

  // 2. Cloud Supabase Sync
  if (isRemoteUser(note.user_id)) {
    if (navigator.onLine) {
      const result = await sb(async () => {
        const { data, error } = await supabase!.from('notes').insert(newNote).select().single();
        if (error) throw error;
        return data as StudyNote;
      });
      if (result) {
        return result;
      }
    }
    // Offline or network error: add to offline sync queue
    const pending = lsGet<StudyNote>(LS_KEYS.pendingSyncNotes);
    pending.unshift(newNote);
    lsSet(LS_KEYS.pendingSyncNotes, pending);
  }

  return newNote;
}

export async function saveNotesBatch(notesToSave: Array<Omit<StudyNote, 'id' | 'created_at' | 'updated_at'>>): Promise<StudyNote[]> {
  const now = new Date().toISOString();
  const newNotes: StudyNote[] = notesToSave.map((n, idx) => ({
    ...n,
    id: `${Date.now()}_note_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    created_at: now,
    updated_at: now,
  }));

  // 1. LocalStorage first
  const existingNotes = lsGet<StudyNote>(LS_KEYS.notes);
  const updated = [...newNotes, ...existingNotes];
  lsSet(LS_KEYS.notes, updated);
  invalidateCache('notes');

  // 2. Cloud Supabase Sync
  const sampleUserId = notesToSave[0]?.user_id;
  if (isRemoteUser(sampleUserId)) {
    if (navigator.onLine) {
      const result = await sb(async () => {
        const { data, error } = await supabase!.from('notes').insert(newNotes).select();
        if (error) throw error;
        return (data || []) as StudyNote[];
      });
      if (result && result.length > 0) {
        return result;
      }
    }
    // Offline or network error: queue for background sync
    const pending = lsGet<StudyNote>(LS_KEYS.pendingSyncNotes);
    lsSet(LS_KEYS.pendingSyncNotes, [...newNotes, ...pending]);
  }

  return newNotes;
}

export async function updateNote(noteId: string, updates: Partial<StudyNote>, userId?: string): Promise<void> {
  const now = new Date().toISOString();
  const notes = lsGet<StudyNote>(LS_KEYS.notes);
  const idx = notes.findIndex(n => n.id === noteId);
  let effectiveUserId = userId;

  if (idx >= 0) {
    effectiveUserId = effectiveUserId || notes[idx].user_id;
    notes[idx] = {
      ...notes[idx],
      ...updates,
      updated_at: now,
    };
    lsSet(LS_KEYS.notes, notes);
  }
  invalidateCache('notes');

  // Cloud Sync
  if (isRemoteUser(effectiveUserId)) {
    if (navigator.onLine) {
      await sb(async () => {
        const { error } = await supabase!
          .from('notes')
          .update({
            ...updates,
            updated_at: now,
          })
          .eq('id', noteId);
        if (error) throw error;
      });
    } else {
      const pending = lsGet<StudyNote>(LS_KEYS.pendingSyncNotes);
      const pIdx = pending.findIndex(n => n.id === noteId);
      if (pIdx >= 0) {
        pending[pIdx] = { ...pending[pIdx], ...updates, updated_at: now };
        lsSet(LS_KEYS.pendingSyncNotes, pending);
      } else if (idx >= 0) {
        pending.unshift(notes[idx]);
        lsSet(LS_KEYS.pendingSyncNotes, pending);
      }
    }
  }
}

export async function togglePinNote(noteId: string, userId?: string): Promise<boolean> {
  const now = new Date().toISOString();
  const notes = lsGet<StudyNote>(LS_KEYS.notes);
  const idx = notes.findIndex(n => n.id === noteId);

  if (idx >= 0) {
    const nextState = !notes[idx].is_pinned;
    const noteUserId = userId || notes[idx].user_id;
    notes[idx].is_pinned = nextState;
    notes[idx].updated_at = now;
    lsSet(LS_KEYS.notes, notes);
    invalidateCache('notes');

    if (isRemoteUser(noteUserId) && navigator.onLine) {
      sb(async () => {
        await supabase!.from('notes').update({ is_pinned: nextState, updated_at: now }).eq('id', noteId);
      });
    }
    return nextState;
  }
  return false;
}

export async function deleteNote(noteId: string, userId?: string): Promise<void> {
  const notes = lsGet<StudyNote>(LS_KEYS.notes);
  const target = notes.find(n => n.id === noteId);
  const effectiveUserId = userId || target?.user_id;

  lsSet(LS_KEYS.notes, notes.filter(n => n.id !== noteId));

  const pending = lsGet<StudyNote>(LS_KEYS.pendingSyncNotes).filter(n => n.id !== noteId);
  lsSet(LS_KEYS.pendingSyncNotes, pending);
  invalidateCache('notes');

  if (isRemoteUser(effectiveUserId) && navigator.onLine) {
    await sb(async () => {
      const { error } = await supabase!.from('notes').delete().eq('id', noteId);
      if (error) throw error;
    });
  }
}

export async function syncNotesWithCloud(userId?: string): Promise<{ success: boolean; count: number; error?: string }> {
  if (!isRemoteUser(userId)) {
    return { success: true, count: 0 };
  }

  if (!navigator.onLine) {
    return { success: false, count: 0, error: 'Offline - cannot sync with cloud right now' };
  }

  try {
    invalidateCache('notes');
    // 1. Sync pending notes
    const pendingNotes = lsGet<StudyNote>(LS_KEYS.pendingSyncNotes);
    if (pendingNotes.length > 0) {
      const remaining: StudyNote[] = [];
      for (const note of pendingNotes) {
        try {
          const res = await sb(async () => {
            const { error } = await supabase!.from('notes').upsert({ ...note, user_id: userId! });
            if (error) throw error;
            return true;
          });
          if (!res) remaining.push(note);
        } catch {
          remaining.push(note);
        }
      }
      lsSet(LS_KEYS.pendingSyncNotes, remaining);
    }

    // 2. Fetch fresh from remote
    const { data, error } = await supabase!
      .from('notes')
      .select('*')
      .eq('user_id', userId!)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const freshNotes = (data || []) as StudyNote[];
    lsSet(LS_KEYS.notes, freshNotes);
    invalidateCache('notes');
    return { success: true, count: freshNotes.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Sync failed' };
  }
}

export function downloadNote(note: StudyNote): void {
  const ext = note.file_type === 'md' ? '.md' : '.txt';
  const cleanTitle = note.title.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = note.file_name || `${cleanTitle}${ext}`;
  const blob = new Blob([note.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
