import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Shapes, Trash2 } from 'lucide-react';
import type { StudyNote } from '../types';
import { deleteNote, getNotes, saveNote } from '../services/database';

const WhiteboardEditor = lazy(() => import('./WhiteboardEditor'));

interface StudyWhiteboardsProps {
  userId: string;
}

const panelClass = 'bento-card border border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-surface)]';

export default function StudyWhiteboards({ userId }: StudyWhiteboardsProps) {
  const [boards, setBoards] = useState<StudyNote[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const notes = await getNotes(userId);
      setBoards(notes.filter(note => note.file_type === 'whiteboard' && !note.parent_id));
    } catch (loadError) {
      console.error('Failed to load whiteboards:', loadError);
      setError('Could not load whiteboards. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeBoard = useMemo(
    () => boards.find(board => board.id === activeBoardId) || null,
    [boards, activeBoardId],
  );

  const createBoard = async () => {
    setError(null);
    try {
      const board = await saveNote({
        user_id: userId,
        title: 'Untitled whiteboard',
        content: JSON.stringify({ version: 1, elements: [], appState: {}, files: {} }),
        file_type: 'whiteboard',
        subject: 'General Studies',
        tags: [],
        is_pinned: false,
        file_name: 'Untitled whiteboard.excalidraw',
      });
      setBoards(previous => [board, ...previous]);
      setActiveBoardId(board.id);
    } catch (saveError) {
      console.error('Failed to create whiteboard:', saveError);
      setError('Could not create a whiteboard. Please try again.');
    }
  };

  const removeBoard = async (board: StudyNote) => {
    if (!confirm(`Delete whiteboard "${board.title}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteNote(board.id, userId);
      setBoards(previous => previous.filter(item => item.id !== board.id));
      setActiveBoardId(null);
    } catch (deleteError) {
      console.error('Failed to delete whiteboard:', deleteError);
      setError('Could not delete this whiteboard. Please try again.');
    }
  };

  const updateBoardInList = useCallback((updated: StudyNote) => {
    setBoards(previous => previous.map(board => board.id === updated.id ? updated : board));
  }, []);

  if (loading) {
    return <div className={`${panelClass} flex items-center justify-center gap-2 p-10 text-sm text-[var(--text-muted)]`}><Loader2 size={16} className="animate-spin" /> Loading whiteboards…</div>;
  }

  return (
    <section className="space-y-5">
      {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">{error}</div>}
      {activeBoard ? (
        <Suspense fallback={<div className={`${panelClass} p-10 text-center text-sm text-[var(--text-muted)]`}>Opening whiteboard editor…</div>}>
          <WhiteboardEditor
            key={activeBoard.id}
            board={activeBoard}
            onBack={() => setActiveBoardId(null)}
            onDelete={() => void removeBoard(activeBoard)}
            onSaved={updateBoardInList}
          />
        </Suspense>
      ) : (
        <>
          <header className={`${panelClass} flex flex-wrap items-center justify-between gap-4 p-5`}>
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-[var(--text-main)]"><Shapes size={22} className="text-indigo-500" /> Whiteboards</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Sketch ideas, add shapes and text, and keep everything editable.</p>
            </div>
            <button type="button" onClick={() => void createBoard()} className="btn btn-primary">
              <Plus size={16} /> New whiteboard
            </button>
          </header>
          {boards.length === 0 ? (
            <div className={`${panelClass} p-10 text-center`}>
              <Shapes size={36} className="mx-auto text-indigo-500" />
              <h3 className="mt-3 font-bold text-[var(--text-main)]">Your canvas is ready</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">Create a whiteboard for diagrams, handwritten notes, and visual study plans. Boards are saved as editable drawing data—not flattened screenshots.</p>
              <button type="button" onClick={() => void createBoard()} className="btn btn-primary mt-4"><Plus size={15} /> Create a board</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map(board => (
                <article key={board.id} className={`${panelClass} group overflow-hidden`}>
                  <button type="button" onClick={() => setActiveBoardId(board.id)} className="block w-full p-5 text-left">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500"><Shapes size={21} /></span>
                    <span className="mt-4 block truncate text-lg font-extrabold text-[var(--text-main)]">{board.title}</span>
                    <span className="mt-1 block text-xs text-[var(--text-muted)]">Updated {new Date(board.updated_at).toLocaleDateString()}</span>
                  </button>
                  <div className="flex justify-end gap-2 border-t border-[var(--border-color)] px-4 py-2">
                    <button type="button" onClick={() => setActiveBoardId(board.id)} className="btn btn-ghost text-xs">Open board</button>
                    <button type="button" onClick={() => void removeBoard(board)} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-500" aria-label={`Delete ${board.title}`}><Trash2 size={15} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
