import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { audioEngine } from '@/utils/audioEngine';
import { CHORD_TYPES, NOTE_NAMES, getFrequency, noteNameToIndex } from '@/utils/musicData';
import type { ChordInfo } from '@/utils/musicData';
import { useGameStore } from '@/store/gameStore';
import PianoKeyboard from '@/components/PianoKeyboard';
import { ArrowLeft, RotateCcw, Check, X, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHORD_HINTS: Record<string, string> = {
  maj: '大三和弦',
  min: '小三和弦',
  dim: '减三和弦',
  aug: '增三和弦',
  '7': '属七和弦',
  maj7: '大七和弦',
  min7: '小七和弦',
  sus2: '挂二和弦',
  sus4: '挂四和弦',
};

const SYMBOL_DISPLAY: Record<string, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  '7': '7',
  maj7: 'maj7',
  min7: 'm7',
  sus2: 'sus2',
  sus4: 'sus4',
};

function getChordDisplayName(root: number, chordType: ChordInfo): string {
  return NOTE_NAMES[root] + (SYMBOL_DISPLAY[chordType.symbol] ?? chordType.symbol);
}

function getChordTypesForLevel(level: number): ChordInfo[] {
  if (level <= 2) return CHORD_TYPES.filter((_, i) => [0, 1].includes(i));
  if (level <= 4) return CHORD_TYPES.filter((_, i) => [0, 1, 2, 3, 7, 8].includes(i));
  return [...CHORD_TYPES];
}

interface CurrentChord {
  root: number;
  type: ChordInfo;
  notes: number[];
  displayName: string;
  hint: string;
}

function generateChord(level: number, prevChord?: CurrentChord | null): CurrentChord {
  const types = getChordTypesForLevel(level);
  let chord: CurrentChord;
  let attempts = 0;
  do {
    const root = Math.floor(Math.random() * 12);
    const type = types[Math.floor(Math.random() * types.length)];
    const notes = type.intervals.map((i) => (root + i) % 12);
    chord = {
      root,
      type,
      notes,
      displayName: getChordDisplayName(root, type),
      hint: CHORD_HINTS[type.symbol] ?? type.name,
    };
    attempts++;
  } while (prevChord && chord.displayName === prevChord.displayName && attempts < 20);
  return chord;
}

export default function ChordPuzzle() {
  const navigate = useNavigate();
  const addXp = useGameStore((s) => s.addXp);
  const updateChordPuzzle = useGameStore((s) => s.updateChordPuzzle);
  const incrementChordPuzzleLevel = useGameStore((s) => s.incrementChordPuzzleLevel);
  const level = useGameStore((s) => s.chordPuzzle.level);

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'success'>('idle');
  const [currentChord, setCurrentChord] = useState<CurrentChord | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef = useRef(0);

  scoreRef.current = score;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (scoreRef.current > 0) {
        useGameStore.getState().updateChordPuzzle(scoreRef.current);
      }
      audioEngine.stopAll();
    };
  }, []);

  const startGame = useCallback(async () => {
    await audioEngine.init();
    const currentLevel = useGameStore.getState().chordPuzzle.level;
    const chord = generateChord(currentLevel);
    setCurrentChord(chord);
    setSelectedNotes(new Set());
    setFeedback(null);
    setMistakes(0);
    setScore(0);
    setCorrectCount(0);
    setGameState('playing');
  }, []);

  const nextChord = useCallback(() => {
    const currentLevel = useGameStore.getState().chordPuzzle.level;
    const chord = generateChord(currentLevel, currentChord);
    setCurrentChord(chord);
    setSelectedNotes(new Set());
    setFeedback(null);
    setMistakes(0);
    setGameState('playing');
  }, [currentChord]);

  const handleNoteClick = useCallback(
    (noteIdx: number) => {
      if (gameState === 'success') return;

      if (feedback === 'wrong') {
        setFeedback(null);
      }

      setSelectedNotes((prev) => {
        const next = new Set(prev);
        if (next.has(noteIdx)) {
          next.delete(noteIdx);
        } else {
          next.add(noteIdx);
          const freq = getFrequency(NOTE_NAMES[noteIdx], 4);
          audioEngine.playNote(freq, 0.4, 'triangle');
        }
        return next;
      });
    },
    [gameState, feedback],
  );

  const handleSubmit = useCallback(() => {
    if (!currentChord || gameState === 'success') return;
    if (selectedNotes.size === 0) return;

    const isCorrect =
      currentChord.notes.length === selectedNotes.size &&
      currentChord.notes.every((n) => selectedNotes.has(n));

    if (isCorrect) {
      setFeedback('correct');
      setGameState('success');

      const bonus = mistakes === 0 ? 50 : 0;
      const points = 100 + bonus;
      setPointsEarned(points);
      const newScore = score + points;
      setScore(newScore);
      addXp(points);

      const freqs = currentChord.notes.map((n) => getFrequency(NOTE_NAMES[n], 4));
      audioEngine.playChord(freqs, 1.5, 'triangle');

      const newCorrectCount = correctCount + 1;
      setCorrectCount(newCorrectCount);

      if (newCorrectCount % 3 === 0) {
        incrementChordPuzzleLevel();
      }

      timeoutRef.current = setTimeout(() => {
        nextChord();
      }, 1500);
    } else {
      setFeedback('wrong');
      setMistakes((m) => m + 1);

      const wrongNotes = Array.from(selectedNotes).filter((n) => !currentChord.notes.includes(n));
      if (wrongNotes.length > 0) {
        const freq = getFrequency(NOTE_NAMES[wrongNotes[0]], 4);
        audioEngine.playNote(freq, 0.3, 'sawtooth');
      }

      timeoutRef.current = setTimeout(() => {
        setFeedback(null);
      }, 1500);
    }
  }, [currentChord, gameState, selectedNotes, score, mistakes, correctCount, addXp, incrementChordPuzzleLevel, nextChord]);

  const handleSkip = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    nextChord();
  }, [nextChord]);

  const handleBack = useCallback(() => {
    if (score > 0) {
      updateChordPuzzle(score);
    }
    navigate(-1);
  }, [score, updateChordPuzzle, navigate]);

  const getNoteButtonClass = (noteIdx: number): string => {
    const isSelected = selectedNotes.has(noteIdx);
    const isCorrectNote = currentChord?.notes.includes(noteIdx) ?? false;

    if (feedback === 'correct' || gameState === 'success') {
      if (isCorrectNote) return 'bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/30 scale-105';
      if (isSelected) return 'bg-[#ef4444] text-white opacity-60';
      return 'bg-slate-echo/20 text-ash-whisper/50';
    }

    if (feedback === 'wrong') {
      if (isSelected && isCorrectNote) return 'bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/30';
      if (isSelected && !isCorrectNote) return 'bg-[#ef4444] text-white shadow-lg shadow-[#ef4444]/30 animate-pulse';
      if (!isSelected && isCorrectNote) return 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40';
      return 'bg-slate-echo/20 text-ash-whisper/50';
    }

    if (isSelected) return 'bg-deep-violet text-ghost-white glow-violet scale-105';
    return 'bg-slate-echo/20 text-ash-whisper hover:bg-slate-echo/30 active:scale-95';
  };

  if (gameState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-midnight-void px-6 safe-top safe-bottom">
        <div className="w-20 h-20 rounded-full bg-deep-violet/20 flex items-center justify-center mb-6 animate-pulse-glow">
          <Music className="w-10 h-10 text-deep-violet" />
        </div>
        <h1 className="font-brand text-4xl md:text-5xl font-bold text-gradient-violet mb-4">
          和弦拼图
        </h1>
        <p className="text-ash-whisper text-center max-w-md mb-2 font-inter leading-relaxed">
          根据和弦名称，从十二个音中选择正确的音符组合
        </p>
        <p className="text-ash-whisper/60 text-center max-w-sm mb-8 font-inter text-sm">
          学习大三和弦、小三和弦、七和弦等和弦构成，提升音乐理论能力
        </p>
        <button
          onClick={startGame}
          className="px-8 py-3 bg-deep-violet text-ghost-white rounded-btn font-inter font-semibold text-lg hover:bg-deep-violet/80 transition-all glow-violet active:scale-95"
        >
          开始游戏
        </button>
        {level > 1 && (
          <p className="mt-4 text-lavender-haze/60 font-inter text-sm">
            当前等级: Lv.{level}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-midnight-void relative overflow-hidden">
      <div className="absolute inset-0 bg-noise pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-slate-echo/10 safe-top">
        <button
          onClick={handleBack}
          className="p-2 text-ash-whisper hover:text-ghost-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-4 font-inter text-sm">
          <span className="text-ash-whisper">
            分数:{' '}
            <span className="text-ghost-white font-semibold">{score}</span>
          </span>
          <span className="px-2.5 py-0.5 bg-deep-violet/20 text-lavender-haze rounded-badge text-xs font-semibold">
            Lv.{level}
          </span>
        </div>
      </header>

      <div className="relative z-10 flex flex-col items-center py-4 md:py-6">
        <div className="relative">
          <div
            className={cn(
              'text-4xl md:text-6xl font-brand font-bold text-ghost-white mb-1 transition-all duration-300',
              gameState === 'success' && 'animate-level-up text-[#22c55e]',
            )}
          >
            {currentChord?.displayName}
          </div>
          {gameState === 'success' && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 animate-pop text-sm font-inter font-semibold text-[#22c55e] whitespace-nowrap">
              +{pointsEarned} {mistakes === 0 && '🎉'}
            </div>
          )}
        </div>
        <p className="text-ash-whisper font-inter text-sm">{currentChord?.hint}</p>
        <p className="text-ash-whisper/50 font-inter text-xs mt-1">
          选择 {currentChord?.notes.length} 个音符
        </p>
      </div>

      {feedback === 'wrong' && (
        <div className="relative z-10 flex items-center justify-center gap-2 py-2 animate-slide-in">
          <X className="w-4 h-4 text-[#ef4444]" />
          <span className="text-[#ef4444] font-inter text-sm font-semibold">再试一次</span>
        </div>
      )}

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-2">
        <div className="grid grid-cols-4 gap-2.5 md:gap-3 max-w-xs w-full">
          {NOTE_NAMES.map((name, idx) => (
            <button
              key={idx}
              onClick={() => handleNoteClick(idx)}
              disabled={gameState === 'success'}
              className={cn(
                'aspect-square min-h-[48px] md:min-h-[56px] rounded-card font-inter font-semibold text-sm md:text-lg flex items-center justify-center transition-all duration-200',
                getNoteButtonClass(idx),
                gameState === 'success' && 'pointer-events-none',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 px-4 py-2 safe-bottom">
        <div className="bg-midnight-void/80 rounded-card border border-slate-echo/10 p-2">
          <PianoKeyboard
            highlightedNotes={Array.from(selectedNotes).map(i => `${NOTE_NAMES[i]}4`)}
            onNotePlay={(noteName: string) => {
              try {
                const idx = noteNameToIndex(noteName);
                handleNoteClick(idx);
              } catch { /* invalid note name */ }
            }}
            octave={4}
          />
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3 px-4 py-4 pb-4 md:pb-4 safe-bottom">
        <button
          onClick={handleSkip}
          className="px-5 py-2.5 bg-slate-echo/20 text-ash-whisper rounded-btn font-inter text-sm hover:bg-slate-echo/30 transition-all active:scale-95 flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          跳过
        </button>
        <button
          onClick={handleSubmit}
          disabled={selectedNotes.size === 0 || gameState === 'success'}
          className={cn(
            'px-8 py-2.5 bg-deep-violet text-ghost-white rounded-btn font-inter font-semibold transition-all flex items-center gap-2',
            selectedNotes.size > 0 && gameState !== 'success'
              ? 'glow-violet hover:bg-deep-violet/80 active:scale-95'
              : 'opacity-50 cursor-not-allowed',
          )}
        >
          <Check className="w-4 h-4" />
          确认和弦
        </button>
      </div>
    </div>
  );
}
