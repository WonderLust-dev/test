import { useState, useEffect } from 'react';
import { ReviewStats, DueReview } from '../types';
import { getReviewStats, getDueReviews, initializeSRS } from '../services/srs';
import { Brain, TrendingUp, Award, Clock, CheckCircle, Calendar, Flame, ArrowRight } from 'lucide-react';

interface ReviewDashboardProps {
  userId?: string;
  onStartReview: () => void;
}

export default function ReviewDashboard({ userId, onStartReview }: ReviewDashboardProps) {
  const effectiveUserId = userId || 'guest';
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [dueReviews, setDueReviews] = useState<DueReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [effectiveUserId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Initialize SRS for any existing mistakes
      await initializeSRS(effectiveUserId);
      
      // Load stats and due reviews
      const [statsData, reviewsData] = await Promise.all([
        getReviewStats(effectiveUserId),
        getDueReviews(effectiveUserId, 5),
      ]);
      
      setStats(statsData);
      setDueReviews(reviewsData);
    } catch (error) {
      console.error('Failed to load review data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const hasDueReviews = stats.due_count > 0;

  return (
    <div className="bento-card p-6 sm:p-7 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-900 shrink-0">
            <Brain size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              Spaced Repetition
              <span className="badge badge-accent">SM-2 Algorithm</span>
            </h2>
            <p className="text-xs text-gray-500">
              Review mistakes at optimal intervals for maximum memory retention
            </p>
          </div>
        </div>
        {hasDueReviews && (
          <button
            onClick={onStartReview}
            className="btn btn-primary text-xs self-start sm:self-auto"
          >
            Start Review ({stats.due_count} Due)
            <ArrowRight size={14} className="ml-1" />
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bento-subcard">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Due Today</span>
            <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Clock size={14} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {stats.due_count}
          </div>
          <span className="text-[11px] font-medium text-indigo-600 mt-1 inline-block">
            {stats.due_count > 0 ? 'Requires attention' : 'All caught up'}
          </span>
        </div>

        <div className="bento-subcard">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Today</span>
            <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-emerald-600 shadow-xs">
              <CheckCircle size={14} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {stats.today_reviews}
          </div>
          <span className="text-[11px] font-medium text-emerald-600 mt-1 inline-block">
            Questions reviewed
          </span>
        </div>

        <div className="bento-subcard">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">This Week</span>
            <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-blue-600 shadow-xs">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {stats.week_reviews}
          </div>
          <span className="text-[11px] font-medium text-blue-600 mt-1 inline-block">
            Past 7 days
          </span>
        </div>

        <div className="bento-subcard">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Streak</span>
            <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-amber-500 shadow-xs">
              <Flame size={14} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {stats.streak_days} <span className="text-xs font-semibold text-gray-400">days</span>
          </div>
          <span className="text-[11px] font-medium text-amber-600 mt-1 inline-block">
            Daily consistency
          </span>
        </div>
      </div>

      {/* Average Quality */}
      <div className="bento-subcard p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-700">Average Recall Quality</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-gray-900">
              {stats.avg_quality.toFixed(1)}
            </span>
            <span className="text-xs text-gray-400">/ 5.0</span>
          </div>
        </div>
        <div className="mt-2.5 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${(stats.avg_quality / 5) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Due Reviews Preview */}
      {hasDueReviews && dueReviews.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            Upcoming Reviews ({stats.due_count} total)
          </h3>
          <div className="space-y-2">
            {dueReviews.slice(0, 3).map((review) => (
              <div
                key={review.mistake_id}
                className="flex items-center justify-between p-3.5 bg-gray-50/70 hover:bg-white rounded-xl border border-gray-100 transition-all hover:shadow-xs"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-xs font-semibold text-gray-900 truncate">
                    {review.question_text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-medium text-gray-500">{review.subject}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-[11px] text-gray-400">{review.topic}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400 font-medium">Interval</div>
                    <div className="text-xs font-bold text-gray-900">
                      {review.interval_days}d
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400 font-medium">Reviews</div>
                    <div className="text-xs font-bold text-gray-900">
                      {review.review_count}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {stats.due_count > 3 && (
            <button
              onClick={onStartReview}
              className="w-full mt-3 py-2 text-xs font-semibold text-gray-700 hover:text-black transition-colors"
            >
              View all {stats.due_count} due reviews →
            </button>
          )}
        </div>
      )}

      {/* No Due Reviews */}
      {!hasDueReviews && (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-600">
            <CheckCircle size={24} />
          </div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">
            All Caught Up!
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            No mistakes currently due for review. Take another mock test or custom drill to expand your memory graph!
          </p>
        </div>
      )}
    </div>
  );
}
