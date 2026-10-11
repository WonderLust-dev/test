import { useState, useEffect } from 'react';
import { DueReview, Mistake } from '../types';
import { getDueReviews, submitReview } from '../services/srs';
import { getMistakes } from '../services/database';
import { Clock, CheckCircle, XCircle, Brain, TrendingUp, Award, ArrowRight, RotateCcw, ArrowLeft, Lightbulb, Zap } from 'lucide-react';

interface ReviewSessionProps {
  userId?: string;
  onComplete: () => void;
  onExit: () => void;
}

export default function ReviewSession({ userId, onComplete, onExit }: ReviewSessionProps) {
  const effectiveUserId = userId || 'guest';
  const [dueReviews, setDueReviews] = useState<DueReview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mistake, setMistake] = useState<Mistake | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [availableMistakes, setAvailableMistakes] = useState<Mistake[]>([]);
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    correct: 0,
    incorrect: 0,
    startTime: Date.now(),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDueReviews();
  }, [effectiveUserId]);

  const loadDueReviews = async () => {
    setLoading(true);
    try {
      const [reviews, allMistakes] = await Promise.all([
        getDueReviews(effectiveUserId, 20),
        getMistakes(effectiveUserId),
      ]);
      setAvailableMistakes(allMistakes);
      setDueReviews(reviews);
      setSessionStats(prev => ({ ...prev, total: reviews.length }));

      if (reviews.length > 0) {
        await loadMistake(reviews[0].mistake_id, allMistakes);
      }
    } catch (error) {
      console.error('Failed to load due reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMistake = async (mistakeId: string, cachedMistakes?: Mistake[]) => {
    const mistakes = cachedMistakes || (await getMistakes(effectiveUserId));
    const found = mistakes.find(m => m.id === mistakeId);
    setMistake(found || null);
  };

  const startPracticeAllMistakes = () => {
    if (availableMistakes.length === 0) return;
    const syntheticReviews: DueReview[] = availableMistakes.map(m => ({
      mistake_id: m.id,
      question_text: m.question_text,
      subject: m.subject,
      topic: m.topic,
      interval_days: m.interval_days || 1,
      ease_factor: m.ease_factor || 2.5,
      review_count: m.review_count || 0,
      next_review_date: m.next_review_date || m.last_attempted_at,
    }));
    setDueReviews(syntheticReviews);
    setCurrentIndex(0);
    loadMistake(syntheticReviews[0].mistake_id, availableMistakes);
    setSelectedAnswer(null);
    setShowAnswer(false);
    setShowRating(false);
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
    const result = await submitReview(effectiveUserId, mistake.id, quality, responseTime);

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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-medium text-slate-600">Loading your review session...</p>
        </div>
      </div>
    );
  }

  if (dueReviews.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="bento-card rounded-3xl p-8 sm:p-10 max-w-lg w-full text-center border border-gray-200/80 shadow-soft">
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-soft">
            <CheckCircle size={40} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            All Caught Up!
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {availableMistakes.length > 0
              ? `You have no reviews strictly due today, but you have ${availableMistakes.length} question${availableMistakes.length > 1 ? 's' : ''} in your mistake notebook.`
              : 'You have no pending mistakes scheduled for review right now. Excellent progress!'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {availableMistakes.length > 0 && (
              <button onClick={startPracticeAllMistakes} className="btn btn-primary">
                <RotateCcw size={16} /> Review Mistakes Now
              </button>
            )}
            <button onClick={onExit} className="btn btn-outline">
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!mistake) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Preparing next question...</p>
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
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Brain size={28} className="text-indigo-600" />
                Review Session
              </h1>
              <p className="text-sm text-gray-600">
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
          <div className="bento-card rounded-full p-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bento-card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {sessionStats.correct + sessionStats.incorrect}
            </div>
            <div className="text-xs text-gray-600">Reviewed</div>
          </div>
          <div className="bento-card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {sessionStats.correct}
            </div>
            <div className="text-xs text-gray-600">Correct</div>
          </div>
          <div className="bento-card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {sessionStats.incorrect}
            </div>
            <div className="text-xs text-gray-600">Incorrect</div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bento-card rounded-2xl p-6 mb-6">
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
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {mistake.question_text}
          </h2>

          {/* Answer Options */}
          <div className="space-y-3 mb-6">
            {mistake.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrectAnswer = index === mistake.correct_answer;
              
              let borderColor = 'border-gray-200';
              let bgColor = 'bg-white';
              
              if (showAnswer) {
                if (isCorrectAnswer) {
                  borderColor = 'border-green-500';
                  bgColor = 'bg-green-50';
                } else if (isSelected && !isCorrectAnswer) {
                  borderColor = 'border-red-500';
                  bgColor = 'bg-red-50';
                }
              } else if (isSelected) {
                borderColor = 'border-indigo-500';
                bgColor = 'bg-indigo-50';
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
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="flex-1 text-gray-900">{option}</span>
                    {showAnswer && isCorrectAnswer && (
                      <CheckCircle size={24} className="text-green-600" />
                    )}
                    {showAnswer && isSelected && !isCorrectAnswer && (
                      <XCircle size={24} className="text-red-600" />
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
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {isCorrect ? (
                    <CheckCircle size={20} className="text-green-600" />
                  ) : (
                    <XCircle size={20} className="text-red-600" />
                  )}
                  <span className={`font-semibold ${
                    isCorrect ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                  </span>
                </div>
                <p className={`text-sm ${
                  isCorrect ? 'text-green-700' : 'text-red-700'
                }`}>
                  {isCorrect 
                    ? 'Great job! Rate how well you remembered this.' 
                    : `The correct answer is ${String.fromCharCode(65 + mistake.correct_answer)}) ${mistake.options[mistake.correct_answer]}`
                  }
                </p>
              </div>

              {/* Explanation */}
              {mistake.solution && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <TrendingUp size={18} />
                    Solution
                  </h3>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">
                    {mistake.solution}
                  </p>
                </div>
              )}

              {/* Shortcut */}
              {mistake.shortcut && (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    <Award size={18} />
                    Shortcut Method
                  </h3>
                  <p className="text-sm text-purple-800">
                    {mistake.shortcut}
                  </p>
                </div>
              )}

              {/* Rating */}
              {showRating && (
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-2 text-center">
                    How well did you remember this?
                  </h3>
                  <p className="text-sm text-gray-600 text-center mb-4">
                    Rate your recall quality (0 = complete failure, 5 = perfect recall)
                  </p>
                  <div className="grid grid-cols-6 gap-2">
                    {[0, 1, 2, 3, 4, 5].map((quality) => (
                      <button
                        key={quality}
                        onClick={() => handleRateQuality(quality)}
                        className={`p-3 rounded-lg font-semibold transition-all hover:scale-105 ${
                          quality <= 2 
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : quality === 3
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {quality}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
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
