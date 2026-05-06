import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { audioEngine } from '@/utils/audioEngine';
import { INTERVAL_NAMES, MODES, NOTE_NAMES, getFrequency } from '@/utils/musicData';
import { useGameStore } from '@/store/gameStore';
import PianoKeyboard from '@/components/PianoKeyboard';
import { ArrowLeft, BookOpen, Music, Lock, Play, ChevronRight, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

type Category = 'note' | 'interval' | 'chord' | 'scale' | 'rhythm' | 'mode';

interface EncyclopediaEntry {
  id: string;
  title: string;
  description: string;
  category: Category;
  unlockLevel: number;
  relatedGames: { label: string; route: string }[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  note: '音符',
  interval: '音程',
  chord: '和弦',
  scale: '音阶',
  rhythm: '节拍',
  mode: '调式',
};

const CATEGORY_COLORS: Record<Category, string> = {
  note: 'bg-blue-500/20 text-blue-400',
  interval: 'bg-emerald-500/20 text-emerald-400',
  chord: 'bg-amber-500/20 text-amber-400',
  scale: 'bg-deep-violet/20 text-lavender-haze',
  rhythm: 'bg-pink-500/20 text-pink-400',
  mode: 'bg-teal-500/20 text-teal-400',
};

const ENTRIES: EncyclopediaEntry[] = [
  { id: 'note_basics', title: '音符基础', description: '音符是音乐的基本元素，每个音符代表一个特定的音高。', category: 'note', unlockLevel: 1, relatedGames: [{ label: '音符跑酷', route: '/note-runner' }] },
  { id: 'note_names', title: '音名与唱名', description: 'C-D-E-F-G-A-B 对应 Do-Re-Mi-Fa-Sol-La-Si', category: 'note', unlockLevel: 1, relatedGames: [{ label: '音符跑酷', route: '/note-runner' }] },
  { id: 'note_octave', title: '八度', description: '频率翻倍即为一个八度，音名循环重复。', category: 'note', unlockLevel: 2, relatedGames: [{ label: '音符跑酷', route: '/note-runner' }] },
  { id: 'interval_basics', title: '音程基础', description: '两个音之间的距离称为音程，用半音数衡量。', category: 'interval', unlockLevel: 1, relatedGames: [{ label: '听力挑战', route: '/ear-training' }] },
  { id: 'interval_consonant', title: '协和音程', description: '纯一度、纯四度、纯五度、纯八度是最协和的音程。', category: 'interval', unlockLevel: 2, relatedGames: [{ label: '听力挑战', route: '/ear-training' }] },
  { id: 'interval_dissonant', title: '不协和音程', description: '小二度、三全音等产生紧张感的音程。', category: 'interval', unlockLevel: 3, relatedGames: [{ label: '听力挑战', route: '/ear-training' }] },
  { id: 'chord_major', title: '大三和弦', description: '根音+大三度+纯五度，听起来明亮欢快。', category: 'chord', unlockLevel: 2, relatedGames: [{ label: '和弦拼图', route: '/chord-puzzle' }] },
  { id: 'chord_minor', title: '小三和弦', description: '根音+小三度+纯五度，听起来柔和忧伤。', category: 'chord', unlockLevel: 2, relatedGames: [{ label: '和弦拼图', route: '/chord-puzzle' }] },
  { id: 'chord_seventh', title: '七和弦', description: '在三和弦上加入七度音，增加色彩和张力。', category: 'chord', unlockLevel: 3, relatedGames: [{ label: '和弦拼图', route: '/chord-puzzle' }] },
  { id: 'scale_major', title: '大调音阶', description: '全全半全全全半的音程模式，明亮开朗。', category: 'scale', unlockLevel: 1, relatedGames: [{ label: '调式作曲', route: '/mode-composer' }] },
  { id: 'scale_minor', title: '小调音阶', description: '全半全全半全全的音程模式，柔和忧伤。', category: 'scale', unlockLevel: 2, relatedGames: [{ label: '调式作曲', route: '/mode-composer' }] },
  { id: 'rhythm_basics', title: '节拍基础', description: '4/4拍、3/4拍等节拍型是音乐的骨架。', category: 'rhythm', unlockLevel: 2, relatedGames: [{ label: '音符跑酷', route: '/note-runner' }] },
  { id: 'rhythm_note_values', title: '音符时值', description: '全音符、二分音符、四分音符等表示不同时长。', category: 'rhythm', unlockLevel: 3, relatedGames: [{ label: '音符跑酷', route: '/note-runner' }] },
  { id: 'mode_ionian', title: 'Ionian 调式', description: '即大调，全全半全全全半，明亮欢快。', category: 'mode', unlockLevel: 3, relatedGames: [{ label: '调式作曲', route: '/mode-composer' }] },
  { id: 'mode_aeolian', title: 'Aeolian 调式', description: '即自然小调，全半全全半全全，忧伤深沉。', category: 'mode', unlockLevel: 3, relatedGames: [{ label: '调式作曲', route: '/mode-composer' }] },
  { id: 'mode_dorian', title: 'Dorian 调式', description: '全半全全全半全，带有爵士色彩的调式。', category: 'mode', unlockLevel: 4, relatedGames: [{ label: '调式作曲', route: '/mode-composer' }] },
  { id: 'mode_mixolydian', title: 'Mixolydian 调式', description: '全全半全全半全，蓝调风格的调式。', category: 'mode', unlockLevel: 4, relatedGames: [{ label: '调式作曲', route: '/mode-composer' }] },
];

const DEFAULT_UNLOCKED = ['note_basics', 'interval_basics', 'scale_major'];

function computeScaleHighlightNotes(rootIndex: number, intervals: number[], octave: number): string[] {
  const notes: string[] = [`${NOTE_NAMES[rootIndex]}${octave}`];
  let semitone = 0;
  for (let i = 0; i < intervals.length - 1; i++) {
    semitone += intervals[i];
    const noteIndex = (rootIndex + semitone) % 12;
    const noteOctave = octave + Math.floor((rootIndex + semitone) / 12);
    notes.push(`${NOTE_NAMES[noteIndex]}${noteOctave}`);
  }
  return notes;
}

interface DemoConfig {
  rootIndex: number;
  octave: number;
  highlighted: string[];
  semitones?: number;
  chordIntervals?: number[];
  scaleIntervals?: number[];
  noteLabels?: string[];
}

const ENTRY_DEMOS: Record<string, DemoConfig> = {
  note_basics: { rootIndex: 0, octave: 4, highlighted: ['C4'] },
  note_names: { rootIndex: 0, octave: 4, highlighted: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'] },
  note_octave: { rootIndex: 0, octave: 4, highlighted: ['C4'] },
  interval_basics: { rootIndex: 0, octave: 4, highlighted: ['C4', 'E4'], semitones: 4 },
  interval_consonant: { rootIndex: 0, octave: 4, highlighted: ['C4', 'G4'], semitones: 7 },
  interval_dissonant: { rootIndex: 0, octave: 4, highlighted: ['C4', 'F#4'], semitones: 6 },
  chord_major: { rootIndex: 0, octave: 4, highlighted: ['C4', 'E4', 'G4'], chordIntervals: [0, 4, 7], noteLabels: ['C', 'E', 'G'] },
  chord_minor: { rootIndex: 0, octave: 4, highlighted: ['C4', 'D#4', 'G4'], chordIntervals: [0, 3, 7], noteLabels: ['C', 'Eb', 'G'] },
  chord_seventh: { rootIndex: 0, octave: 4, highlighted: ['C4', 'E4', 'G4', 'A#4'], chordIntervals: [0, 4, 7, 10], noteLabels: ['C', 'E', 'G', 'Bb'] },
  scale_major: { rootIndex: 0, octave: 4, highlighted: computeScaleHighlightNotes(0, [2, 2, 1, 2, 2, 2, 1], 4), scaleIntervals: [2, 2, 1, 2, 2, 2, 1] },
  scale_minor: { rootIndex: 0, octave: 4, highlighted: computeScaleHighlightNotes(0, [2, 1, 2, 2, 1, 2, 2], 4), scaleIntervals: [2, 1, 2, 2, 1, 2, 2] },
  rhythm_basics: { rootIndex: 0, octave: 4, highlighted: ['C4'] },
  rhythm_note_values: { rootIndex: 0, octave: 4, highlighted: ['C4'] },
  mode_ionian: { rootIndex: 0, octave: 4, highlighted: computeScaleHighlightNotes(0, [2, 2, 1, 2, 2, 2, 1], 4), scaleIntervals: [2, 2, 1, 2, 2, 2, 1] },
  mode_aeolian: { rootIndex: 0, octave: 4, highlighted: computeScaleHighlightNotes(0, [2, 1, 2, 2, 1, 2, 2], 4), scaleIntervals: [2, 1, 2, 2, 1, 2, 2] },
  mode_dorian: { rootIndex: 0, octave: 4, highlighted: computeScaleHighlightNotes(0, [2, 1, 2, 2, 2, 1, 2], 4), scaleIntervals: [2, 1, 2, 2, 2, 1, 2] },
  mode_mixolydian: { rootIndex: 0, octave: 4, highlighted: computeScaleHighlightNotes(0, [2, 2, 1, 2, 2, 1, 2], 4), scaleIntervals: [2, 2, 1, 2, 2, 1, 2] },
};

const CATEGORY_TABS: { key: Category | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'note', label: '音符' },
  { key: 'interval', label: '音程' },
  { key: 'chord', label: '和弦' },
  { key: 'scale', label: '音阶' },
  { key: 'rhythm', label: '节拍' },
  { key: 'mode', label: '调式' },
];

export default function Encyclopedia() {
  const navigate = useNavigate();
  const level = useGameStore((s) => s.level);
  const encyclopedia = useGameStore((s) => s.encyclopedia);
  const unlockEncyclopediaEntry = useGameStore((s) => s.unlockEncyclopediaEntry);
  const addXp = useGameStore((s) => s.addXp);

  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [selectedEntry, setSelectedEntry] = useState<EncyclopediaEntry | null>(null);
  const [activeBeat, setActiveBeat] = useState<number>(-1);
  const rhythmTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      rhythmTimeoutsRef.current.forEach(clearTimeout);
      audioEngine.stopAll();
    };
  }, []);

  const isEntryUnlocked = useCallback(
    (entry: EncyclopediaEntry) => level >= entry.unlockLevel,
    [level],
  );

  const isEntryDiscovered = useCallback(
    (entry: EncyclopediaEntry) =>
      encyclopedia.unlockedEntries.includes(entry.id) || DEFAULT_UNLOCKED.includes(entry.id),
    [encyclopedia.unlockedEntries],
  );

  const filteredEntries = useMemo(() => {
    if (activeCategory === 'all') return ENTRIES;
    return ENTRIES.filter((e) => e.category === activeCategory);
  }, [activeCategory]);

  const handleEntryClick = useCallback(
    (entry: EncyclopediaEntry) => {
      if (!isEntryUnlocked(entry)) return;
      if (!isEntryDiscovered(entry)) {
        unlockEncyclopediaEntry(entry.id);
        addXp(5);
      }
      setSelectedEntry(entry);
      setActiveBeat(-1);
    },
    [isEntryUnlocked, isEntryDiscovered, unlockEncyclopediaEntry, addXp],
  );

  const handleCloseModal = useCallback(() => {
    setSelectedEntry(null);
    setActiveBeat(-1);
    rhythmTimeoutsRef.current.forEach(clearTimeout);
    rhythmTimeoutsRef.current = [];
    audioEngine.stopAll();
  }, []);

  const handlePianoNotePlay = useCallback(async (noteName: string, octave: number) => {
    await audioEngine.init();
    const freq = getFrequency(noteName, octave);
    audioEngine.playNote(freq, 0.5, 'triangle');
  }, []);

  const playNoteDemo = useCallback(async (entryId: string) => {
    await audioEngine.init();
    const demo = ENTRY_DEMOS[entryId];
    if (!demo) return;
    const freq = getFrequency(NOTE_NAMES[demo.rootIndex], demo.octave);
    audioEngine.playNote(freq, 0.8, 'triangle');
  }, []);

  const playOctaveDemo = useCallback(async () => {
    await audioEngine.init();
    const freq4 = getFrequency('C', 4);
    const freq5 = getFrequency('C', 5);
    audioEngine.playNote(freq4, 0.6, 'triangle');
    setTimeout(() => audioEngine.playNote(freq5, 0.6, 'triangle'), 700);
  }, []);

  const playNoteNamesDemo = useCallback(async () => {
    await audioEngine.init();
    const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    whiteNotes.forEach((name, i) => {
      setTimeout(() => {
        audioEngine.playNote(getFrequency(name, 4), 0.4, 'triangle');
      }, i * 400);
    });
  }, []);

  const playIntervalRoot = useCallback(async (entryId: string) => {
    await audioEngine.init();
    const demo = ENTRY_DEMOS[entryId];
    if (!demo) return;
    const freq = getFrequency(NOTE_NAMES[demo.rootIndex], demo.octave);
    audioEngine.playNote(freq, 0.6, 'triangle');
  }, []);

  const playIntervalSecond = useCallback(async (entryId: string) => {
    await audioEngine.init();
    const demo = ENTRY_DEMOS[entryId];
    if (!demo || demo.semitones === undefined) return;
    const secondIndex = (demo.rootIndex + demo.semitones) % 12;
    const freq = getFrequency(NOTE_NAMES[secondIndex], demo.octave);
    audioEngine.playNote(freq, 0.6, 'triangle');
  }, []);

  const playIntervalBoth = useCallback(async (entryId: string) => {
    await audioEngine.init();
    const demo = ENTRY_DEMOS[entryId];
    if (!demo || demo.semitones === undefined) return;
    const rootFreq = getFrequency(NOTE_NAMES[demo.rootIndex], demo.octave);
    audioEngine.playInterval(rootFreq, demo.semitones, 1.5);
  }, []);

  const playChordDemo = useCallback(async (entryId: string) => {
    await audioEngine.init();
    const demo = ENTRY_DEMOS[entryId];
    if (!demo || !demo.chordIntervals) return;
    const freqs = demo.chordIntervals.map((semitone) => {
      const noteIndex = (demo.rootIndex + semitone) % 12;
      return getFrequency(NOTE_NAMES[noteIndex], demo.octave);
    });
    audioEngine.playChord(freqs, 1.5, 'triangle');
  }, []);

  const playScaleDemo = useCallback(async (entryId: string) => {
    await audioEngine.init();
    const demo = ENTRY_DEMOS[entryId];
    if (!demo || !demo.scaleIntervals) return;
    const rootFreq = getFrequency(NOTE_NAMES[demo.rootIndex], demo.octave);
    audioEngine.playScale(rootFreq, demo.scaleIntervals, 2.5);
  }, []);

  const playRhythmBasics = useCallback(async () => {
    await audioEngine.init();
    rhythmTimeoutsRef.current.forEach(clearTimeout);
    rhythmTimeoutsRef.current = [];
    const freq = getFrequency('C', 4);
    for (let i = 0; i < 4; i++) {
      const t = setTimeout(() => {
        audioEngine.playNote(freq, 0.3, 'triangle');
        setActiveBeat(i);
      }, i * 500);
      rhythmTimeoutsRef.current.push(t);
    }
    const t = setTimeout(() => setActiveBeat(-1), 2200);
    rhythmTimeoutsRef.current.push(t);
  }, []);

  const playRhythmNoteValues = useCallback(async () => {
    await audioEngine.init();
    rhythmTimeoutsRef.current.forEach(clearTimeout);
    rhythmTimeoutsRef.current = [];
    const freq = getFrequency('C', 4);
    const schedule = [
      { duration: 1.6, beat: 0 },
      { duration: 0.8, beat: 1 },
      { duration: 0.8, beat: 2 },
      { duration: 0.4, beat: 3 },
      { duration: 0.4, beat: 4 },
      { duration: 0.4, beat: 5 },
      { duration: 0.4, beat: 6 },
    ];
    let time = 0;
    schedule.forEach((note) => {
      const t = setTimeout(() => {
        audioEngine.playNote(freq, note.duration * 0.9, 'triangle');
        setActiveBeat(note.beat);
      }, time * 1000);
      rhythmTimeoutsRef.current.push(t);
      time += note.duration;
    });
    const t = setTimeout(() => setActiveBeat(-1), time * 1000 + 300);
    rhythmTimeoutsRef.current.push(t);
  }, []);

  const renderCategoryDemo = (entry: EncyclopediaEntry, demo: DemoConfig) => {
    switch (entry.category) {
      case 'note':
        return (
          <div className="flex gap-2 flex-wrap">
            {entry.id === 'note_octave' ? (
              <button
                onClick={playOctaveDemo}
                className="flex items-center gap-1.5 px-4 py-2 bg-deep-violet text-ghost-white rounded-btn font-inter text-sm hover:bg-deep-violet/80 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5" />
                播放八度
              </button>
            ) : entry.id === 'note_names' ? (
              <button
                onClick={playNoteNamesDemo}
                className="flex items-center gap-1.5 px-4 py-2 bg-deep-violet text-ghost-white rounded-btn font-inter text-sm hover:bg-deep-violet/80 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5" />
                依次播放
              </button>
            ) : (
              <button
                onClick={() => playNoteDemo(entry.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-deep-violet text-ghost-white rounded-btn font-inter text-sm hover:bg-deep-violet/80 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5" />
                播放音符
              </button>
            )}
          </div>
        );

      case 'interval':
        return (
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => playIntervalRoot(entry.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-echo/20 text-ash-whisper rounded-btn font-inter text-sm hover:bg-slate-echo/30 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5" />
                根音
              </button>
              <button
                onClick={() => playIntervalSecond(entry.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-echo/20 text-ash-whisper rounded-btn font-inter text-sm hover:bg-slate-echo/30 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5" />
                音程音
              </button>
              <button
                onClick={() => playIntervalBoth(entry.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-deep-violet text-ghost-white rounded-btn font-inter text-sm hover:bg-deep-violet/80 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5" />
                播放音程
              </button>
            </div>
            {demo.semitones !== undefined && INTERVAL_NAMES.has(demo.semitones) && (
              <p className="font-inter text-sm text-lavender-haze">
                {INTERVAL_NAMES.get(demo.semitones)} · {demo.semitones} 半音
              </p>
            )}
          </div>
        );

      case 'chord':
        return (
          <div className="space-y-2">
            <button
              onClick={() => playChordDemo(entry.id)}
              className="flex items-center gap-1.5 px-4 py-2 bg-deep-violet text-ghost-white rounded-btn font-inter text-sm hover:bg-deep-violet/80 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              播放和弦
            </button>
            {demo.noteLabels && (
              <div className="flex gap-2 flex-wrap">
                {demo.noteLabels.map((label, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-deep-violet/20 text-lavender-haze rounded-badge font-inter text-sm font-semibold"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case 'scale':
        return (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => playScaleDemo(entry.id)}
              className="flex items-center gap-1.5 px-4 py-2 bg-deep-violet text-ghost-white rounded-btn font-inter text-sm hover:bg-deep-violet/80 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              播放音阶
            </button>
          </div>
        );

      case 'mode': {
        const modeInfo = MODES.find((m) => {
          const demoIntervals = demo.scaleIntervals;
          return demoIntervals && m.intervals.length === demoIntervals.length && m.intervals.every((v, i) => v === demoIntervals[i]);
        });
        return (
          <div className="space-y-2">
            <button
              onClick={() => playScaleDemo(entry.id)}
              className="flex items-center gap-1.5 px-4 py-2 bg-deep-violet text-ghost-white rounded-btn font-inter text-sm hover:bg-deep-violet/80 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              播放调式
            </button>
            {modeInfo && (
              <p className="font-inter text-sm text-lavender-haze">
                情绪: {modeInfo.mood}
              </p>
            )}
          </div>
        );
      }

      case 'rhythm':
        return (
          <div className="space-y-3">
            <button
              onClick={entry.id === 'rhythm_basics' ? playRhythmBasics : playRhythmNoteValues}
              className="flex items-center gap-1.5 px-4 py-2 bg-deep-violet text-ghost-white rounded-btn font-inter text-sm hover:bg-deep-violet/80 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              播放节拍
            </button>
            {entry.id === 'rhythm_basics' && (
              <div className="flex items-center justify-center gap-3 py-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-inter text-sm font-bold transition-all duration-150',
                      activeBeat === i
                        ? 'bg-deep-violet text-ghost-white scale-110 glow-violet'
                        : 'bg-slate-echo/20 text-ash-whisper',
                    )}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            )}
            {entry.id === 'rhythm_note_values' && (
              <div className="flex items-end justify-center gap-2 py-2 flex-wrap">
                {[
                  { label: '全', width: 'w-16', height: 'h-10', idx: 0 },
                  { label: '二分', width: 'w-12', height: 'h-8', idx: 1 },
                  { label: '二分', width: 'w-12', height: 'h-8', idx: 2 },
                  { label: '四分', width: 'w-8', height: 'h-6', idx: 3 },
                  { label: '四分', width: 'w-8', height: 'h-6', idx: 4 },
                  { label: '四分', width: 'w-8', height: 'h-6', idx: 5 },
                  { label: '四分', width: 'w-8', height: 'h-6', idx: 6 },
                ].map((note) => (
                  <div
                    key={note.idx}
                    className={cn(
                      'rounded-badge flex items-center justify-center font-inter text-xs font-semibold transition-all duration-150',
                      note.width,
                      note.height,
                      activeBeat === note.idx
                        ? 'bg-deep-violet text-ghost-white scale-110'
                        : 'bg-slate-echo/20 text-ash-whisper',
                    )}
                  >
                    {note.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const unlockedCount = ENTRIES.filter((e) => isEntryUnlocked(e)).length;

  return (
    <div className="flex flex-col min-h-screen bg-midnight-void relative overflow-hidden">
      <div className="absolute inset-0 bg-noise pointer-events-none" />

      <header className="relative z-10 flex items-center gap-3 px-4 py-3 border-b border-slate-echo/10">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-ash-whisper hover:text-ghost-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <BookOpen className="w-5 h-5 text-deep-violet" />
          <h1 className="font-brand text-lg font-bold text-ghost-white">乐理百科</h1>
        </div>
        <span className="text-ash-whisper font-inter text-xs">
          {unlockedCount}/{ENTRIES.length}
        </span>
      </header>

      <div className="relative z-10 flex gap-2 px-4 py-3 overflow-x-auto">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key)}
            className={cn(
              'px-4 py-1.5 rounded-badge font-inter text-sm whitespace-nowrap transition-all flex-shrink-0',
              activeCategory === tab.key
                ? 'bg-deep-violet text-ghost-white'
                : 'bg-ghost-white/5 text-ash-whisper hover:bg-ghost-white/10',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col gap-3">
          {filteredEntries.map((entry, index) => {
            const unlocked = isEntryUnlocked(entry);
            return (
              <button
                key={entry.id}
                onClick={() => handleEntryClick(entry)}
                disabled={!unlocked}
                className={cn(
                  'rounded-card bg-ghost-white/5 p-4 text-left transition-all w-full animate-slide-in',
                  unlocked
                    ? 'opacity-100 hover:bg-ghost-white/10 active:scale-[0.98]'
                    : 'opacity-40 cursor-not-allowed',
                )}
                style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-badge font-inter font-semibold',
                      CATEGORY_COLORS[entry.category],
                    )}
                  >
                    {CATEGORY_LABELS[entry.category]}
                  </span>
                  <div className="flex-1" />
                  {unlocked ? (
                    <ChevronRight className="w-4 h-4 text-ash-whisper" />
                  ) : (
                    <Lock className="w-4 h-4 text-ash-whisper" />
                  )}
                </div>
                <h3 className="font-brand text-base font-bold text-ghost-white">
                  {entry.title}
                </h3>
                <p className="font-inter text-sm text-ash-whisper mt-1">
                  {unlocked ? entry.description : '继续游戏解锁'}
                </p>
                {!unlocked && (
                  <p className="font-inter text-xs text-lavender-haze/60 mt-1.5">
                    需要 Lv.{entry.unlockLevel}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-void/80 backdrop-blur-sm p-0 md:p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-midnight-void border border-slate-echo/20 rounded-none md:rounded-card w-full md:max-w-lg h-full md:h-auto md:max-h-[90vh] overflow-y-auto animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-midnight-void/95 backdrop-blur-sm z-10 flex items-center justify-between px-4 py-3 border-b border-slate-echo/10">
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-badge font-inter font-semibold',
                  CATEGORY_COLORS[selectedEntry.category],
                )}
              >
                {CATEGORY_LABELS[selectedEntry.category]}
              </span>
              <button
                onClick={handleCloseModal}
                className="p-2 text-ash-whisper hover:text-ghost-white transition-colors"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            <div className="px-4 py-5 space-y-5">
              <h2 className="font-brand text-2xl md:text-3xl font-bold text-ghost-white">
                {selectedEntry.title}
              </h2>

              <p className="font-inter text-ash-whisper leading-relaxed">
                {selectedEntry.description}
              </p>

              <div className="border-t border-slate-echo/10 pt-4 space-y-3">
                <div className="flex items-center gap-2 text-ash-whisper font-inter text-sm">
                  <Lightbulb className="w-4 h-4 text-lavender-haze" />
                  <span>互动试听</span>
                </div>
                {renderCategoryDemo(selectedEntry, ENTRY_DEMOS[selectedEntry.id] ?? { rootIndex: 0, octave: 4, highlighted: [] })}
                <div className="bg-midnight-void/80 rounded-card border border-slate-echo/10 p-2">
                  <PianoKeyboard
                    highlightedNotes={(ENTRY_DEMOS[selectedEntry.id]?.highlighted) ?? []}
                    onNotePlay={handlePianoNotePlay}
                    octave={ENTRY_DEMOS[selectedEntry.id]?.octave ?? 4}
                  />
                </div>
              </div>

              {selectedEntry.relatedGames.length > 0 && (
                <div className="border-t border-slate-echo/10 pt-4">
                  <h4 className="font-inter text-sm text-ash-whisper mb-2">相关游戏</h4>
                  <div className="flex flex-col gap-2">
                    {selectedEntry.relatedGames.map((game) => (
                      <button
                        key={game.route}
                        onClick={() => {
                          handleCloseModal();
                          navigate(game.route);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 bg-ghost-white/5 rounded-card hover:bg-ghost-white/10 transition-all w-full text-left"
                      >
                        <Music className="w-4 h-4 text-deep-violet flex-shrink-0" />
                        <span className="font-inter text-sm text-ghost-white flex-1">
                          {game.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-ash-whisper flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
