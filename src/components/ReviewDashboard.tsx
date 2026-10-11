import { useState, useEffect } from 'react';
import { ReviewStats, DueReview } from '../types';
import { getReviewStats, getDueReviews, initializeSRS } from '../services/srs';
import { Brain, TrendingUp, Award, Clock, CheckCircle, Calendar, Flame, ArrowRight } from 'lucide-react';

interface ReviewDashboardProps {
  userId?: string;
  onStartReview: () => void;
}

export default function ReviewDashboard({ userId, onStartReview }: ReviewDashboardProps) {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [dueReviews, setDueReviews] = useState<DueReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Initialize SRS for any existing mistakes
      await initializeSRS(userId!);
      
      // Load stats and due reviews
      const [statsData, reviewsData] = await Promise.all([
        getReviewStats(userId!),
        getDueReviews(userId!, 5),
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
    <div className="glass-card rounded-2xl p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain size={24} className="text-indigo-600" />
            Spaced Repetition
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Review mistakes at optimal intervals for better retention
          </p>
        </div>
        {hasDueReviews && (
          <button
            onClick={onStartReview}
            className="btn btn-primary"
          >
            Start Review
            <ArrowRight size={16} className="ml-2" />
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={20} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Due Today</span>
          </div>
          <div className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
            {stats.due_count}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-700 dark:text-green-300">Today</span>
          </div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-100">
            {stats.today_reviews}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">This Week</span>
          </div>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
            {stats.week_reviews}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-2">
            <Flame size={20} className="text-orange-600 dark:text-orange-400" />
            <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Streak</span>
          </div>
          <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">
            {stats.streak_days}
            <span className="text-lg ml-1">days</span>
          </div>
        </div>
      </div>

      {/* Average Quality */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={20} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Average Recall Quality</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.avg_quality.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">/ 5.0</div>
          </div>
        </div>
        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
            style={{ width: `${(stats.avg_quality / 5) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Due Reviews Preview */}
      {hasDueReviews && dueReviews.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Calendar size={16} />
            Upcoming Reviews ({stats.due_count} total)
          </h3>
          <div className="space-y-2">
            {dueReviews.slice(0, 3).map((review, index) => (
              <div
                key={review.mistake_id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {review.question_text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{review.subject}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{review.topic}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Interval</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {review.interval_days}d
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Reviews</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
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
              className="w-full mt-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              View all {stats.due_count} due reviews →
            </button>
          )}
        </div>
      )}

      {/* No Due Reviews */}
      {!hasDueReviews && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            All Caught Up!
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No mistakes due for review. Keep practicing to add more!
          </p>
        </div>
      )}
    </div>
  );
}
