import type { FlashcardContent, FlashcardRating } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseFlashcardContent(content: string): FlashcardContent | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) return null;

    if (
      typeof parsed.front !== 'string'
      || typeof parsed.back !== 'string'
      || typeof parsed.intervalDays !== 'number'
      || typeof parsed.easeFactor !== 'number'
      || typeof parsed.reviewCount !== 'number'
      || typeof parsed.repetitions !== 'number'
      || typeof parsed.dueAt !== 'string'
      || !Number.isFinite(Date.parse(parsed.dueAt))
    ) return null;

    return {
      front: parsed.front,
      back: parsed.back,
      intervalDays: Math.max(0, parsed.intervalDays),
      easeFactor: Math.max(1.3, parsed.easeFactor),
      reviewCount: Math.max(0, Math.floor(parsed.reviewCount)),
      repetitions: Math.max(0, Math.floor(parsed.repetitions)),
      dueAt: parsed.dueAt,
      lastReviewedAt: typeof parsed.lastReviewedAt === 'string' ? parsed.lastReviewedAt : null,
    };
  } catch {
    return null;
  }
}

export function scheduleFlashcardReview(
  card: FlashcardContent,
  rating: FlashcardRating,
  reviewedAt: Date = new Date(),
): FlashcardContent {
  const qualityByRating: Record<FlashcardRating, number> = {
    again: 1,
    hard: 3,
    good: 4,
    easy: 5,
  };
  const quality = qualityByRating[rating];
  const easeFactor = Math.max(
    1.3,
    card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  let intervalDays: number;
  let repetitions: number;

  if (rating === 'again') {
    intervalDays = 1;
    repetitions = 0;
  } else {
    if (rating === 'hard') {
      intervalDays = card.repetitions === 0
        ? 1
        : card.repetitions === 1
          ? 3
          : Math.max(1, Math.round(card.intervalDays * 1.2));
    } else if (rating === 'good') {
      intervalDays = card.repetitions === 0
        ? 1
        : card.repetitions === 1
          ? 6
          : Math.max(1, Math.round(card.intervalDays * card.easeFactor));
    } else {
      intervalDays = card.repetitions === 0
        ? 4
        : card.repetitions === 1
          ? 10
          : Math.max(1, Math.round(card.intervalDays * (card.easeFactor + 0.3)));
    }
    repetitions = card.repetitions + 1;
  }

  const dueAt = new Date(reviewedAt);
  dueAt.setDate(dueAt.getDate() + intervalDays);

  return {
    ...card,
    intervalDays,
    easeFactor,
    reviewCount: card.reviewCount + 1,
    repetitions,
    dueAt: dueAt.toISOString(),
    lastReviewedAt: reviewedAt.toISOString(),
  };
}
