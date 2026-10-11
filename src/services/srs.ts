import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Mistake, Review, ReviewStats, DueReview } from '../types';

/**
 * Spaced Repetition System Service
 * Implements SM-2 algorithm for optimal review scheduling
 */

// LocalStorage keys for guest mode
const LS_KEYS = {
  reviews: 'sscp_reviews',
  reviewStats: 'sscp_review_stats',
};

// Helper to safely use supabase
async function sb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    return await fn();
  } catch (e) {
    console.error('Supabase error:', e);
    return null;
  }
}

// Helper for localStorage
function lsGet<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function lsSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('LocalStorage error:', e);
  }
}

/**
 * Get all mistakes that are due for review
 */
export async function getDueReviews(userId: string, limit: number = 20): Promise<DueReview[]> {
  if (isSupabaseConfigured && supabase) {
    const result = await sb(async () => {
      const { data, error } = await supabase!
        .rpc('get_due_reviews', { p_user_id: userId, p_limit: limit });
      
      if (error) throw error;
      return data as DueReview[];
    });
    
    if (result) return result;
  }
  
  // Fallback to localStorage for guest mode
  const mistakes = lsGet<Mistake>('sscp_mistakes');
  const now = new Date();
  
  return mistakes
    .filter(m => 
      !m.resolved && 
      (!m.next_review_date || new Date(m.next_review_date) <= now)
    )
    .slice(0, limit)
    .map(m => ({
      mistake_id: m.id,
      question_text: m.question_text,
      subject: m.subject,
      topic: m.topic,
      interval_days: m.interval_days || 1,
      ease_factor: m.ease_factor || 2.5,
      review_count: m.review_count || 0,
      next_review_date: m.next_review_date || m.last_attempted_at,
    }));
}

/**
 * Submit a review for a mistake
 * @param mistakeId - ID of the mistake being reviewed
 * @param quality - Quality rating (0-5): 0=complete failure, 5=perfect recall
 * @param responseTime - Time taken to answer in seconds
 */
export async function submitReview(
  userId: string,
  mistakeId: string,
  quality: number,
  responseTime: number = 0
): Promise<{ success: boolean; nextReview?: string; error?: string }> {
  if (quality < 0 || quality > 5) {
    return { success: false, error: 'Quality must be between 0 and 5' };
  }

  if (isSupabaseConfigured && supabase) {
    const result = await sb(async () => {
      // Call the database function to calculate next review
      const { data: nextReview, error: calcError } = await supabase!
        .rpc('calculate_next_review', {
          p_mistake_id: mistakeId,
          p_quality: quality,
          p_response_time: responseTime,
        });
      
      if (calcError) throw calcError;
      
      return { nextReview: nextReview as string };
    });
    
    if (result) {
      return { success: true, nextReview: result.nextReview };
    }
  }
  
  // Fallback to localStorage for guest mode
  const mistakes = lsGet<Mistake>('sscp_mistakes');
  const mistakeIndex = mistakes.findIndex(m => m.id === mistakeId);
  
  if (mistakeIndex === -1) {
    return { success: false, error: 'Mistake not found' };
  }
  
  const mistake = mistakes[mistakeIndex];
  
  // SM-2 Algorithm implementation
  const currentInterval = mistake.interval_days || 1;
  const currentEase = mistake.ease_factor || 2.5;
  const reviewCount = mistake.review_count || 0;
  
  let newInterval: number;
  let newEase: number;
  
  if (quality >= 3) {
    // Correct response
    if (reviewCount === 0) {
      newInterval = 1;
    } else if (reviewCount === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(currentInterval * currentEase);
    }
  } else {
    // Incorrect response - reset interval
    newInterval = 1;
  }
  
  // Update ease factor (minimum 1.3)
  newEase = Math.max(
    1.3,
    currentEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );
  
  // Calculate next review date
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);
  
  // Update mistake
  mistakes[mistakeIndex] = {
    ...mistake,
    interval_days: newInterval,
    ease_factor: newEase,
    review_count: reviewCount + 1,
    next_review_date: nextReview.toISOString(),
    last_review_date: new Date().toISOString(),
    status: quality >= 3 ? 'review' : (reviewCount === 0 ? 'learning' : 'relearning'),
  };
  
  lsSet('sscp_mistakes', mistakes);
  
  // Save review record
  const reviews = lsGet<Review>(LS_KEYS.reviews);
  reviews.unshift({
    id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    user_id: userId,
    mistake_id: mistakeId,
    reviewed_at: new Date().toISOString(),
    quality,
    interval_before: currentInterval,
    interval_after: newInterval,
    ease_factor_before: currentEase,
    ease_factor_after: newEase,
    response_time_seconds: responseTime,
    is_correct: quality >= 3,
  });
  lsSet(LS_KEYS.reviews, reviews);
  
  return { success: true, nextReview: nextReview.toISOString() };
}

/**
 * Get review statistics for a user
 */
export async function getReviewStats(userId: string): Promise<ReviewStats> {
  if (isSupabaseConfigured && supabase) {
    const result = await sb(async () => {
      const { data, error } = await supabase!
        .rpc('get_review_stats', { p_user_id: userId });
      
      if (error) throw error;
      return data as ReviewStats;
    });
    
    if (result) return result;
  }
  
  // Fallback to localStorage
  const reviews = lsGet<Review>(LS_KEYS.reviews);
  const mistakes = lsGet<Mistake>('sscp_mistakes');
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const todayReviews = reviews.filter(r => new Date(r.reviewed_at) >= today);
  const weekReviews = reviews.filter(r => new Date(r.reviewed_at) >= weekAgo);
  
  const dueCount = mistakes.filter(m => 
    !m.resolved && 
    (!m.next_review_date || new Date(m.next_review_date) <= now)
  ).length;
  
  // Calculate streak (simplified)
  let streak = 0;
  const reviewDates = new Set(reviews.map(r => new Date(r.reviewed_at).toDateString()));
  let checkDate = new Date(today);
  
  while (reviewDates.has(checkDate.toDateString())) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  return {
    total_reviews: reviews.length,
    today_reviews: todayReviews.length,
    week_reviews: weekReviews.length,
    avg_quality: reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.quality, 0) / reviews.length 
      : 0,
    due_count: dueCount,
    streak_days: streak,
  };
}

/**
 * Get review history for a specific mistake
 */
export async function getMistakeReviews(mistakeId: string): Promise<Review[]> {
  if (isSupabaseConfigured && supabase) {
    const result = await sb(async () => {
      const { data, error } = await supabase!
        .from('reviews')
        .select('*')
        .eq('mistake_id', mistakeId)
        .order('reviewed_at', { ascending: false });
      
      if (error) throw error;
      return data as Review[];
    });
    
    if (result) return result;
  }
  
  // Fallback to localStorage
  const reviews = lsGet<Review>(LS_KEYS.reviews);
  return reviews
    .filter(r => r.mistake_id === mistakeId)
    .sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime());
}

/**
 * Get all reviews for a user
 */
export async function getUserReviews(userId: string, limit: number = 50): Promise<Review[]> {
  if (isSupabaseConfigured && supabase) {
    const result = await sb(async () => {
      const { data, error } = await supabase!
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .order('reviewed_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as Review[];
    });
    
    if (result) return result;
  }
  
  // Fallback to localStorage
  const reviews = lsGet<Review>(LS_KEYS.reviews);
  return reviews.slice(0, limit);
}

/**
 * Initialize SRS for existing mistakes (set initial review dates)
 */
export async function initializeSRS(userId: string): Promise<{ success: boolean; count: number }> {
  if (isSupabaseConfigured && supabase) {
    const result = await sb(async () => {
      // Get all unresolved mistakes without next_review_date
      const { data: mistakes, error } = await supabase!
        .from('mistakes')
        .select('id')
        .eq('user_id', userId)
        .eq('resolved', false)
        .is('next_review_date', null);
      
      if (error) throw error;
      
      if (!mistakes || mistakes.length === 0) {
        return { count: 0 };
      }
      
      // Set next_review_date to now for all uninitialized mistakes
      const { error: updateError } = await supabase!
        .from('mistakes')
        .update({ 
          next_review_date: new Date().toISOString(),
          status: 'new',
          interval_days: 1,
          ease_factor: 2.5,
          review_count: 0,
        })
        .in('id', mistakes.map(m => m.id));
      
      if (updateError) throw updateError;
      
      return { count: mistakes.length };
    });
    
    if (result) return { success: true, count: result.count };
  }
  
  // Fallback to localStorage
  const mistakes = lsGet<Mistake>('sscp_mistakes');
  const now = new Date().toISOString();
  let count = 0;
  
  const updated = mistakes.map(m => {
    if (!m.resolved && !m.next_review_date) {
      count++;
      return {
        ...m,
        next_review_date: now,
        status: 'new' as const,
        interval_days: 1,
        ease_factor: 2.5,
        review_count: 0,
      };
    }
    return m;
  });
  
  lsSet('sscp_mistakes', updated);
  return { success: true, count };
}

/**
 * Get mistakes by SRS status
 */
export async function getMistakesByStatus(
  userId: string,
  status: 'new' | 'learning' | 'review' | 'relearning'
): Promise<Mistake[]> {
  if (isSupabaseConfigured && supabase) {
    const result = await sb(async () => {
      const { data, error } = await supabase!
        .from('mistakes')
        .select('*')
        .eq('user_id', userId)
        .eq('resolved', false)
        .eq('status', status)
        .order('next_review_date', { ascending: true });
      
      if (error) throw error;
      return data as Mistake[];
    });
    
    if (result) return result;
  }
  
  // Fallback to localStorage
  const mistakes = lsGet<Mistake>('sscp_mistakes');
  return mistakes
    .filter(m => !m.resolved && m.status === status)
    .sort((a, b) => {
      const dateA = a.next_review_date ? new Date(a.next_review_date).getTime() : 0;
      const dateB = b.next_review_date ? new Date(b.next_review_date).getTime() : 0;
      return dateA - dateB;
    });
}
