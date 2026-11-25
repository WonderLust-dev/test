import { useCallback, useEffect, useRef, useState } from 'react';
import { Ellipse, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import { ArrowLeft, Circle, Download, Eraser, Pencil, Redo2, Save, Square, Trash2, Type, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { StudyNote } from '../types';
import { deleteNote, updateNote } from '../services/database';

type BoardTool = 'select' | 'draw' | 'text' | 'rectangle' | 'ellipse' | 'eraser';

interface StrokeElement {
  id: string;
  type: 'stroke';
  points: number[];
  color: string;
  width: number;
}

interface RectangleElement {
  id: string;
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

interface EllipseElement {
  id: string;
  type: 'ellipse';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

interface TextElement {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

type BoardElement = StrokeElement | RectangleElement | EllipseElement | TextElement;
interface TextDraft { x: number; y: number; elementId?: string; }
interface BoardDocument { version: 1; elements: BoardElement[]; }

interface WhiteboardEditorProps {
  board: StudyNote;
  onBack: () => void;
  onDelete: () => void;
  onSaved: (board: StudyNote) => void;
}

const isBoardElement = (value: unknown): value is BoardElement => {
  if (!value || typeof value !== 'object') return false;
  const element = value as Record<string, unknown>;
  if (typeof element.id !== 'string' || typeof element.type !== 'string') return false;
  if (element.type === 'stroke') {
    return Array.isArray(element.points) && typeof element.color === 'string' && typeof element.width === 'number';
  }
  if (element.type === 'rectangle' || element.type === 'ellipse') {
    return ['x', 'y', 'width', 'height', 'strokeWidth'].every(key => typeof element[key] === 'number') && typeof element.color === 'string';
  }
  return element.type === 'text' &&
    typeof element.x === 'number' &&
    typeof element.y === 'number' &&
    typeof element.text === 'string' &&
    typeof element.color === 'string' &&
    typeof element.fontSize === 'number';
};

function parseElements(content: string): BoardElement[] {
  if (!content) return [];
  try {
    const parsed: unknown = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && 'elements' in parsed && Array.isArray(parsed.elements)) {
      return parsed.elements.filter(isBoardElement);
    }
  } catch (error) {
    console.error('Could not parse saved whiteboard JSON:', error);
  }
  return [];
}

const createId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function WhiteboardEditor({ board, onBack, onDelete, onSaved }: WhiteboardEditorProps) {
  const [title, setTitle] = useState(board.title);
  const [elements, setElements] = useState<BoardElement[]>(() => parseElements(board.content));
  const [tool, setTool] = useState<BoardTool>('draw');
  const [color, setColor] = useState('#4338ca');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [textValue, setTextValue] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 600 });
  const [past, setPast] = useState<BoardElement[][]>([]);
  const [future, setFuture] = useState<BoardElement[][]>([]);
  const stageRef = useRef<KonvaStage>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef(elements);
  const titleRef = useRef(title);
  const draftElementRef = useRef<BoardElement | null>(null);
  const drawingRef = useRef(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const cancelTextRef = useRef(false);

  const commitElements = useCallback((next: BoardElement[]) => {
    const previous = elementsRef.current;
    setPast(current => [...current.slice(-49), previous]);
    setFuture([]);
    elementsRef.current = next;
    setElements(next);
  }, []);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const updateSize = () => setCanvasSize({
      width: Math.max(container.clientWidth, 320),
      height: Math.max(container.clientHeight, 360),
    });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (textDraft) textInputRef.current?.focus();
  }, [textDraft]);

  const persist = useCallback(async () => {
    const nextTitle = titleRef.current.trim() || 'Untitled whiteboard';
    const serialized = JSON.stringify({ version: 1, elements: elementsRef.current } satisfies BoardDocument);
    try {
      setSaveState('saving');
      await updateNote(board.id, {
        title: nextTitle,
        content: serialized,
        file_name: `${nextTitle.replace(/[\\/:*?"<>|]/g, '_')}.json`,
        file_size: new Blob([serialized]).size,
      });
      setSaveState('saved');
      onSaved({
        ...board,
        title: nextTitle,
        content: serialized,
        file_name: `${nextTitle.replace(/[\\/:*?"<>|]/g, '_')}.json`,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to save whiteboard:', error);
      setSaveState('error');
    }
  }, [board, onSaved]);

  saveRef.current = persist;

  useEffect(() => {
    const timer = window.setTimeout(() => void saveRef.current(), 900);
    return () => window.clearTimeout(timer);
  }, [elements, title]);

  const handleTitleChange = (nextTitle: string) => {
    titleRef.current = nextTitle;
    setTitle(nextTitle);
  };

  const getPointer = () => stageRef.current?.getPointerPosition() || null;

  const startDrawing = () => {
    const pointer = getPointer();
    if (!pointer) return;
    if (tool === 'draw') {
      drawingRef.current = true;
      draftElementRef.current = { id: createId(), type: 'stroke', points: [pointer.x, pointer.y], color, width: strokeWidth };
      return;
    }
    if (tool === 'rectangle' || tool === 'ellipse') {
      drawingRef.current = true;
      draftElementRef.current = { id: createId(), type: tool, x: pointer.x, y: pointer.y, width: 0, height: 0, color, strokeWidth };
      return;
    }
    if (tool === 'text') {
      cancelTextRef.current = false;
      setTextValue('');
      setTextDraft({ x: pointer.x, y: pointer.y });
    }
  };

  const moveDrawing = () => {
    if (!drawingRef.current || !draftElementRef.current) return;
    const pointer = getPointer();
    if (!pointer) return;
    const draft = draftElementRef.current;
    if (draft.type === 'stroke') {
      draftElementRef.current = { ...draft, points: [...draft.points, pointer.x, pointer.y] };
    } else if (draft.type === 'rectangle' || draft.type === 'ellipse') {
      draftElementRef.current = {
        ...draft,
        x: Math.min(draft.x, pointer.x),
        y: Math.min(draft.y, pointer.y),
        width: Math.abs(pointer.x - draft.x),
        height: Math.abs(pointer.y - draft.y),
      };
    } else {
      return;
    }
    const updated = draftElementRef.current;
    if (updated) setElements([...elementsRef.current, updated]);
  };

  const finishDrawing = () => {
    if (!drawingRef.current || !draftElementRef.current) return;
    const finished = draftElementRef.current;
    const previous = elementsRef.current;
    drawingRef.current = false;
    draftElementRef.current = null;
    const next = [...previous, finished];
    elementsRef.current = next;
    setElements(next);
    setPast(current => [...current.slice(-49), previous]);
    setFuture([]);
  };

  const removeElement = (id: string) => {
    if (tool !== 'eraser') return;
    commitElements(elementsRef.current.filter(element => element.id !== id));
  };

  const moveElement = (id: string, x: number, y: number) => {
    const next = elementsRef.current.map(element => element.id === id && element.type !== 'stroke' ? { ...element, x, y } : element);
    commitElements(next);
  };

  const saveText = () => {
    if (!textDraft) return;
    const value = textValue.trim();
    let next: BoardElement[];
    if (textDraft.elementId) {
      next = elementsRef.current.map(element =>
        element.id === textDraft.elementId && element.type === 'text'
          ? { ...element, text: value }
          : element,
      );
    } else if (value) {
      next = [...elementsRef.current, {
        id: createId(),
        type: 'text',
        x: textDraft.x,
        y: textDraft.y,
        text: value,
        color,
        fontSize: 20,
      }];
    } else {
      cancelTextRef.current = true;
      setTextDraft(null);
      return;
    }
    commitElements(next);
    cancelTextRef.current = true;
    setTextDraft(null);
  };

  const editText = (element: TextElement) => {
    if (tool === 'eraser') {
      removeElement(element.id);
      return;
    }
    if (tool !== 'select') return;
    setTextValue(element.text);
    cancelTextRef.current = false;
    setTextDraft({ x: element.x, y: element.y, elementId: element.id });
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setFuture(items => [elementsRef.current, ...items]);
    setPast(items => items.slice(0, -1));
    elementsRef.current = previous;
    setElements(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setPast(items => [...items, elementsRef.current]);
    setFuture(items => items.slice(1));
    elementsRef.current = next;
    setElements(next);
  };

  const clearBoard = () => {
    if (!elementsRef.current.length || !confirm('Clear all content from this whiteboard?')) return;
    commitElements([]);
  };

  const handleBack = async () => {
    await saveRef.current();
    onBack();
  };

  const exportJson = () => {
    const content = JSON.stringify({ version: 1, elements: elementsRef.current } satisfies BoardDocument, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${titleRef.current.trim().replace(/[\\/:*?"<>|]/g, '_') || 'whiteboard'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPng = () => {
    const canvas = stageRef.current?.toCanvas({ pixelRatio: 2 });
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${titleRef.current.trim().replace(/[\\/:*?"<>|]/g, '_') || 'whiteboard'}.png`;
    link.click();
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void handleBack()} className="btn btn-outline" aria-label="Back to whiteboards">
          <ArrowLeft size={16} /> Whiteboards
        </button>
        <input
          value={title}
          onChange={event => handleTitleChange(event.target.value)}
          aria-label="Whiteboard title"
          className="min-w-[180px] flex-1 rounded-[var(--radius-control)] border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-base font-bold text-[var(--text-main)] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        />
        <span aria-live="polite" className={`text-xs font-semibold ${saveState === 'error' ? 'text-rose-500' : 'text-[var(--text-muted)]'}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed — retry as you edit' : 'All changes saved'}
        </span>
        <button type="button" onClick={() => void saveRef.current()} className="btn btn-primary" title="Save now"><Save size={15} /> Save</button>
        <button type="button" onClick={exportJson} className="btn btn-outline" title="Download editable drawing data"><Download size={15} /> JSON</button>
        <button type="button" onClick={exportPng} className="btn btn-outline" title="Export a PNG copy"><Download size={15} /> PNG</button>
        <button type="button" onClick={onDelete} className="btn btn-outline text-rose-500" title="Delete whiteboard"><Trash2 size={15} /></button>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-panel)] border border-[var(--border-color)] bg-[var(--bg-surface)] p-2" role="toolbar" aria-label="Whiteboard tools">
        <ToolButton label="Select and move" active={tool === 'select'} onClick={() => setTool('select')}><span className="text-sm font-bold">↖</span></ToolButton>
        <ToolButton label="Freehand pen" active={tool === 'draw'} onClick={() => setTool('draw')}><Pencil size={16} /></ToolButton>
        <ToolButton label="Add text" active={tool === 'text'} onClick={() => setTool('text')}><Type size={16} /></ToolButton>
        <ToolButton label="Rectangle" active={tool === 'rectangle'} onClick={() => setTool('rectangle')}><Square size={16} /></ToolButton>
        <ToolButton label="Ellipse" active={tool === 'ellipse'} onClick={() => setTool('ellipse')}><Circle size={16} /></ToolButton>
        <ToolButton label="Eraser" active={tool === 'eraser'} onClick={() => setTool('eraser')}><Eraser size={16} /></ToolButton>
        <span className="mx-1 h-6 w-px bg-[var(--border-color)]" />
        <label className="flex items-center gap-2 px-2 text-xs font-semibold text-[var(--text-muted)]">
          Ink
          <input type="color" value={color} onChange={event => setColor(event.target.value)} aria-label="Ink color" className="h-8 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
        </label>
        <label className="flex items-center gap-2 px-2 text-xs font-semibold text-[var(--text-muted)]">
          Width
          <select value={strokeWidth} onChange={event => setStrokeWidth(Number(event.target.value))} aria-label="Stroke width" className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-subcard)] px-2 py-1.5 text-[var(--text-main)]">
            <option value={2}>Fine</option>
            <option value={4}>Medium</option>
            <option value={8}>Bold</option>
          </select>
        </label>
        <span className="mx-1 h-6 w-px bg-[var(--border-color)]" />
        <ToolButton label="Undo" disabled={!past.length} onClick={undo}><Undo2 size={16} /></ToolButton>
        <ToolButton label="Redo" disabled={!future.length} onClick={redo}><Redo2 size={16} /></ToolButton>
        <button type="button" onClick={clearBoard} className="btn btn-ghost ml-auto text-xs text-rose-500"><Trash2 size={15} /> Clear</button>
        <span className="w-full px-2 text-[11px] text-[var(--text-muted)] md:w-auto">
          {tool === 'text' ? 'Click the canvas to type.' : tool === 'eraser' ? 'Click an item to erase it.' : 'Draw with mouse, touch, or a stylus.'}
        </span>
      </div>

      <div ref={canvasRef} className="relative h-[min(68vh,820px)] min-h-[420px] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-color)] bg-white shadow-[var(--shadow-card)]">
        <Stage
          ref={stageRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={startDrawing}
          onTouchStart={startDrawing}
          onMouseMove={moveDrawing}
          onTouchMove={moveDrawing}
          onMouseUp={finishDrawing}
          onTouchEnd={finishDrawing}
          onMouseLeave={finishDrawing}
          style={{ cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'crosshair' : tool === 'select' ? 'default' : 'crosshair' }}
        >
          <Layer>
            <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill="#ffffff" listening={false} />
            {elements.map(element => {
              if (element.type === 'stroke') {
                return <Line key={element.id} points={element.points} stroke={element.color} strokeWidth={element.width} lineCap="round" lineJoin="round" tension={0.25} hitStrokeWidth={Math.max(element.width, 16)} onClick={() => removeElement(element.id)} onTap={() => removeElement(element.id)} />;
              }
              if (element.type === 'ellipse') {
                return <Ellipse key={element.id} x={element.x + element.width / 2} y={element.y + element.height / 2} radiusX={Math.max(element.width / 2, 1)} radiusY={Math.max(element.height / 2, 1)} stroke={element.color} strokeWidth={element.strokeWidth} draggable={tool === 'select'} onDragEnd={event => moveElement(element.id, event.target.x() - element.width / 2, event.target.y() - element.height / 2)} onClick={() => removeElement(element.id)} onTap={() => removeElement(element.id)} />;
              }
              if (element.type === 'rectangle') {
                return <Rect key={element.id} x={element.x} y={element.y} width={element.width} height={element.height} stroke={element.color} strokeWidth={element.strokeWidth} draggable={tool === 'select'} onDragEnd={event => moveElement(element.id, event.target.x(), event.target.y())} onClick={() => removeElement(element.id)} onTap={() => removeElement(element.id)} />;
              }
              if (element.type !== 'text') return null;
              return <Text key={element.id} x={element.x} y={element.y} text={element.text} fill={element.color} fontSize={element.fontSize} draggable={tool === 'select'} onDblClick={() => editText(element)} onDblTap={() => editText(element)} onDragEnd={event => moveElement(element.id, event.target.x(), event.target.y())} onClick={() => removeElement(element.id)} onTap={() => removeElement(element.id)} />;
            })}
          </Layer>
        </Stage>
        {textDraft && (
          <textarea
            ref={textInputRef}
            value={textValue}
            onChange={event => setTextValue(event.target.value)}
            onBlur={() => {
              if (cancelTextRef.current) {
                cancelTextRef.current = false;
                setTextDraft(null);
                return;
              }
              saveText();
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                saveText();
              }
              if (event.key === 'Escape') {
                cancelTextRef.current = true;
                setTextDraft(null);
              }
            }}
            placeholder="Type here…"
            aria-label="Whiteboard text"
            className="absolute z-10 min-h-10 min-w-40 resize rounded-lg border-2 border-indigo-500 bg-white/95 p-2 text-sm text-gray-900 shadow-lg outline-none"
            style={{ left: Math.min(textDraft.x, Math.max(canvasSize.width - 180, 0)), top: Math.min(textDraft.y, Math.max(canvasSize.height - 70, 0)) }}
          />
        )}
      </div>
    </section>
  );
}

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-color)] hover:bg-[var(--bg-subcard)] hover:text-[var(--text-main)]'}`}
    >
      {children}
    </button>
  );
}
