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
    <div className="relative flex w-full h-20 md:h-24 select-none">
      {WHITE_KEYS.map(key => {
        const noteId = `${key}${octave}`;
        const isHighlighted = highlightedNotes.includes(noteId);
        return (
          <button
            key={key}
            className={cn(
              'piano-key-white flex-1 flex items-end justify-center pb-1.5 text-[10px] md:text-xs text-slate-echo font-inter z-0',
              isHighlighted && 'active',
            )}
            onPointerDown={() => onNotePlay?.(key, octave)}
          >
            {key}
          </button>
        );
      })}
      {BLACK_KEYS.map(name => {
        const noteId = `${name}${octave}`;
        const isHighlighted = highlightedNotes.includes(noteId);
        const pos = BLACK_KEY_POSITIONS[name];
        return (
          <button
            key={name}
            className={cn(
              'piano-key-black absolute top-0 flex items-end justify-center pb-1 text-[8px] md:text-[10px] text-ash-whisper font-inter z-10',
              isHighlighted && 'active',
            )}
            style={{
              left: `${(pos + 0.65) * (100 / WHITE_KEYS.length)}%`,
              width: `${(100 / WHITE_KEYS.length) * 0.58}%`,
              height: '58%',
            }}
            onPointerDown={() => onNotePlay?.(name, octave)}
          >
            {name.replace('#', '♯')}
          </button>
        );
      })}
    </div>
  );
}
