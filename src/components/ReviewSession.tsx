import { useState, useEffect } from 'react';
import { DueReview, Mistake } from '../types';
import { getDueReviews, submitReview, getReviewStats } from '../services/srs';
import { getMistakes } from '../services/database';
import { Clock, CheckCircle, XCircle, Brain, TrendingUp, Award, ArrowRight, RotateCcw } from 'lucide-react';

interface ReviewSessionProps {
  userId?: string;
  onComplete: () => void;
  onExit: () => void;
}

export default function ReviewSession({ userId, onComplete, onExit }: ReviewSessionProps) {
  const [dueReviews, setDueReviews] = useState<DueReview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mistake, setMistake] = useState<Mistake | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    correct: 0,
    incorrect: 0,
    startTime: Date.now(),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDueReviews();
  }, [userId]);

  const loadDueReviews = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const reviews = await getDueReviews(userId, 20);
      setDueReviews(reviews);
      setSessionStats(prev => ({ ...prev, total: reviews.length }));
      
      if (reviews.length > 0) {
        await loadMistake(reviews[0].mistake_id);
      }
    } catch (error) {
      console.error('Failed to load due reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMistake = async (mistakeId: string) => {
    const mistakes = await getMistakes(userId);
    const found = mistakes.find(m => m.id === mistakeId);
    setMistake(found || null);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (showAnswer) return;
    setSelectedAnswer(answerIndex);
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    setShowRating(true);
  };

  const handleRateQuality = async (quality: number) => {
    if (!mistake) return;

    const responseTime = Math.floor((Date.now() - sessionStats.startTime) / 1000);
    const result = await submitReview(userId!, mistake.id, quality, responseTime);

    if (result.success) {
      const isCorrect = quality >= 3;
      
      setSessionStats(prev => ({
        ...prev,
        correct: prev.correct + (isCorrect ? 1 : 0),
        incorrect: prev.incorrect + (isCorrect ? 0 : 1),
      }));

      // Move to next review
      const nextIndex = currentIndex + 1;
      if (nextIndex < dueReviews.length) {
        setCurrentIndex(nextIndex);
        await loadMistake(dueReviews[nextIndex].mistake_id);
        setSelectedAnswer(null);
        setShowAnswer(false);
        setShowRating(false);
        setSessionStats(prev => ({ ...prev, startTime: Date.now() }));
      } else {
        // Session complete
        onComplete();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading review session...</p>
        </div>
      </div>
    );
  }

  if (dueReviews.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            All Caught Up!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You have no mistakes due for review. Great job keeping up with your studies!
          </p>
          <button
            onClick={onExit}
            className="btn btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!mistake) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Loading question...</p>
        </div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / dueReviews.length) * 100;
  const isCorrect = selectedAnswer === mistake.correct_answer;

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Brain size={28} className="text-indigo-600" />
                Review Session
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Question {currentIndex + 1} of {dueReviews.length}
              </p>
            </div>
            <button
              onClick={onExit}
              className="btn btn-ghost"
            >
              Exit
            </button>
          </div>

          {/* Progress Bar */}
          <div className="glass-card rounded-full p-1">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {sessionStats.correct + sessionStats.incorrect}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Reviewed</div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {sessionStats.correct}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Correct</div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {sessionStats.incorrect}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Incorrect</div>
          </div>
        </div>

        {/* Question Card */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          {/* Question Info */}
          <div className="flex items-center gap-2 mb-4">
            <span className="badge badge-accent">{mistake.subject}</span>
            <span className="badge badge-muted">{mistake.topic}</span>
            {mistake.status && (
              <span className={`badge ${
                mistake.status === 'review' ? 'badge-success' :
                mistake.status === 'learning' ? 'badge-warning' :
                mistake.status === 'relearning' ? 'badge-danger' :
                'badge-muted'
              }`}>
                {mistake.status}
              </span>
            )}
          </div>

          {/* Question Text */}
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {mistake.question_text}
          </h2>

          {/* Answer Options */}
          <div className="space-y-3 mb-6">
            {mistake.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrectAnswer = index === mistake.correct_answer;
              
              let borderColor = 'border-gray-200 dark:border-gray-700';
              let bgColor = 'bg-white dark:bg-gray-800';
              
              if (showAnswer) {
                if (isCorrectAnswer) {
                  borderColor = 'border-green-500';
                  bgColor = 'bg-green-50 dark:bg-green-900/20';
                } else if (isSelected && !isCorrectAnswer) {
                  borderColor = 'border-red-500';
                  bgColor = 'bg-red-50 dark:bg-red-900/20';
                }
              } else if (isSelected) {
                borderColor = 'border-indigo-500';
                bgColor = 'bg-indigo-50 dark:bg-indigo-900/20';
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showAnswer}
                  className={`w-full p-4 rounded-xl border-2 ${borderColor} ${bgColor} text-left transition-all hover:shadow-medium disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="flex-1 text-gray-900 dark:text-white">{option}</span>
                    {showAnswer && isCorrectAnswer && (
                      <CheckCircle size={24} className="text-green-600 dark:text-green-400" />
                    )}
                    {showAnswer && isSelected && !isCorrectAnswer && (
                      <XCircle size={24} className="text-red-600 dark:text-red-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Show Answer Button */}
          {!showAnswer && selectedAnswer !== null && (
            <button
              onClick={handleShowAnswer}
              className="btn btn-primary w-full"
            >
              Show Answer
            </button>
          )}

          {/* Answer Explanation */}
          {showAnswer && (
            <div className="mt-6 space-y-4">
              {/* Result */}
              <div className={`p-4 rounded-xl ${
                isCorrect 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {isCorrect ? (
                    <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle size={20} className="text-red-600 dark:text-red-400" />
                  )}
                  <span className={`font-semibold ${
                    isCorrect ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                  }`}>
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                  </span>
                </div>
                <p className={`text-sm ${
                  isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                }`}>
                  {isCorrect 
                    ? 'Great job! Rate how well you remembered this.' 
                    : `The correct answer is ${String.fromCharCode(65 + mistake.correct_answer)}) ${mistake.options[mistake.correct_answer]}`
                  }
                </p>
              </div>

              {/* Explanation */}
              {mistake.solution && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <TrendingUp size={18} />
                    Solution
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-400 whitespace-pre-wrap">
                    {mistake.solution}
                  </p>
                </div>
              )}

              {/* Shortcut */}
              {mistake.shortcut && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
                    <Award size={18} />
                    Shortcut Method
                  </h3>
                  <p className="text-sm text-purple-800 dark:text-purple-400">
                    {mistake.shortcut}
                  </p>
                </div>
              )}

              {/* Rating */}
              {showRating && (
                <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-center">
                    How well did you remember this?
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                    Rate your recall quality (0 = complete failure, 5 = perfect recall)
                  </p>
                  <div className="grid grid-cols-6 gap-2">
                    {[0, 1, 2, 3, 4, 5].map((quality) => (
                      <button
                        key={quality}
                        onClick={() => handleRateQuality(quality)}
                        className={`p-3 rounded-lg font-semibold transition-all hover:scale-105 ${
                          quality <= 2 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                            : quality === 3
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        }`}
                      >
                        {quality}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>Complete failure</span>
                    <span>Perfect recall</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
