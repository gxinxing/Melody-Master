import { NOTE_NAMES, noteNameToIndex } from '@/utils/musicData';
import { cn } from '@/lib/utils';

interface PianoKeyboardProps {
  highlightedNotes?: string[];
  onNotePlay?: (noteName: string, octave: number) => void;
  octave?: number;
}

const WHITE_KEYS = NOTE_NAMES.filter(n => !n.includes('#'));
const BLACK_KEYS = NOTE_NAMES.filter(n => n.includes('#'));

const BLACK_KEY_POSITIONS: Record<string, number> = {};
BLACK_KEYS.forEach(name => {
  const idx = noteNameToIndex(name);
  BLACK_KEY_POSITIONS[name] = Math.floor(idx / 2) - (idx >= 5 ? 1 : 0);
});

export default function PianoKeyboard({
  highlightedNotes = [],
  onNotePlay,
  octave = 4,
}: PianoKeyboardProps) {
  return (
    <div className="overflow-x-auto overscroll-x-contain -webkit-overflow-scrolling-touch">
      <div className="relative flex h-24 md:h-28 select-none" style={{ minWidth: `${WHITE_KEYS.length * 44}px` }}>
        {WHITE_KEYS.map(key => {
          const noteId = `${key}${octave}`;
          const isHighlighted = highlightedNotes.includes(noteId);
          return (
            <button
              key={key}
              className={cn(
                'piano-key-white flex-1 flex items-end justify-center pb-2 text-xs md:text-sm text-slate-echo font-inter z-0',
                isHighlighted && 'active',
              )}
              onPointerDown={(e) => {
                e.preventDefault();
                onNotePlay?.(key, octave);
              }}
            >
              {key}
            </button>
          );
        })}
        {BLACK_KEYS.map(name => {
          const noteId = `${name}${octave}`;
          const isHighlighted = highlightedNotes.includes(noteId);
          const pos = BLACK_KEY_POSITIONS[name];
          const whiteKeyWidthPct = 100 / WHITE_KEYS.length;
          return (
            <button
              key={name}
              className={cn(
                'piano-key-black absolute top-0 flex items-end justify-center pb-1.5 text-[9px] md:text-[11px] text-ash-whisper font-inter z-10',
                isHighlighted && 'active',
              )}
              style={{
                left: `${(pos + 0.65) * whiteKeyWidthPct}%`,
                width: `${whiteKeyWidthPct * 0.6}%`,
                height: '60%',
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                onNotePlay?.(name, octave);
              }}
            >
              {name.replace('#', '♯')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
