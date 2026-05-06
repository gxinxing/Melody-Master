import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { audioEngine } from '@/utils/audioEngine';
import { MODES, NOTE_NAMES, getFrequency } from '@/utils/musicData';
import { useGameStore } from '@/store/gameStore';
import PianoKeyboard from '@/components/PianoKeyboard';
import { ArrowLeft, Play, RotateCcw, Save, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOODS = [
  { word: '欢快', emoji: '😊', modeIndex: 0, label: '大调' },
  { word: '忧伤', emoji: '😢', modeIndex: 5, label: '小调' },
  { word: '紧张', emoji: '😰', modeIndex: 6, label: '洛克利亚' },
  { word: '梦幻', emoji: '✨', modeIndex: 3, label: '利底亚' },
  { word: '蓝调', emoji: '🎵', modeIndex: 4, label: '混合利底亚' },
  { word: '神秘', emoji: '🔮', modeIndex: 2, label: '弗里几亚' },
  { word: '爵士', emoji: '🎷', modeIndex: 1, label: '多利亚' },
];

const TOTAL_BEATS = 16;
const BEAT_DURATION = 0.25;
const CELL_SIZE = 2.5;
const LABEL_WIDTH = 3;

function getModeNotes(modeIndex: number) {
  const mode = MODES[modeIndex];
  const notes: { name: string; octave: number; semitone: number }[] = [];
  let semitone = 0;
  notes.push({ name: 'C', octave: 4, semitone: 0 });
  for (let i = 0; i < mode.intervals.length; i++) {
    semitone += mode.intervals[i];
    const noteIdx = semitone % 12;
    const octave = 4 + Math.floor(semitone / 12);
    notes.push({ name: NOTE_NAMES[noteIdx], octave, semitone });
  }
  return notes;
}

interface ScoreBreakdown {
  modeAdherence: number;
  melodicContour: number;
  rhythmicVariety: number;
  resolution: number;
  length: number;
  total: number;
  feedback: string;
}

function calculateScore(
  grid: Set<string>,
  modeNotes: { name: string; octave: number; semitone: number }[],
): ScoreBreakdown {
  const melody: number[] = [];
  for (let col = 0; col < TOTAL_BEATS; col++) {
    for (let row = modeNotes.length - 1; row >= 0; row--) {
      if (grid.has(`${row}-${col}`)) {
        melody.push(row);
        break;
      }
    }
  }

  const noteCount = melody.length;

  const lengthScore = noteCount >= 8 ? 10 : Math.floor((noteCount / 8) * 10);

  const modeAdherence = noteCount > 0 ? 30 : 0;

  let melodicContour = 0;
  if (melody.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < melody.length; i++) {
      intervals.push(Math.abs(melody[i] - melody[i - 1]));
    }
    const uniqueIntervals = new Set(intervals).size;
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const varietyScore = Math.min(uniqueIntervals / 4, 1) * 15;
    const movementScore = avgInterval > 0 && avgInterval <= 3 ? 10 : avgInterval > 3 ? 5 : 0;
    melodicContour = Math.min(Math.floor(varietyScore + movementScore), 25);
  }

  let rhythmicVariety = 0;
  if (noteCount > 0) {
    const beatPattern: boolean[] = [];
    for (let col = 0; col < TOTAL_BEATS; col++) {
      let hasNote = false;
      for (let row = 0; row < modeNotes.length; row++) {
        if (grid.has(`${row}-${col}`)) {
          hasNote = true;
          break;
        }
      }
      beatPattern.push(hasNote);
    }
    let transitions = 0;
    for (let i = 1; i < beatPattern.length; i++) {
      if (beatPattern[i] !== beatPattern[i - 1]) transitions++;
    }
    const gaps: number[] = [];
    let lastNoteBeat = -1;
    for (let i = 0; i < TOTAL_BEATS; i++) {
      if (beatPattern[i]) {
        if (lastNoteBeat >= 0) gaps.push(i - lastNoteBeat);
        lastNoteBeat = i;
      }
    }
    const uniqueGaps = new Set(gaps).size;
    const transitionScore = Math.min(transitions / 4, 1) * 10;
    const gapScore = Math.min(uniqueGaps / 3, 1) * 10;
    rhythmicVariety = Math.min(Math.floor(transitionScore + gapScore), 20);
  }

  let resolution = 0;
  if (melody.length > 0) {
    const lastNote = melody[melody.length - 1];
    if (lastNote === 0) resolution = 15;
    else if (lastNote === 4) resolution = 12;
    else if (lastNote === 7) resolution = 10;
    else if (lastNote === 2 || lastNote === 5) resolution = 5;
  }

  const total = modeAdherence + melodicContour + rhythmicVariety + resolution + lengthScore;

  let feedback = '';
  if (total >= 90) feedback = '大师级作曲！你对调式有着深刻的理解！';
  else if (total >= 70) feedback = '很棒的旋律！调式运用得当，继续探索更多可能。';
  else if (total >= 50) feedback = '不错的尝试！注意让旋律更有方向感。';
  else if (total >= 30) feedback = '初学者的作品，试试让音符在调式内流动。';
  else feedback = '继续练习！先从简单的音阶开始。';

  return {
    modeAdherence,
    melodicContour,
    rhythmicVariety,
    resolution,
    length: lengthScore,
    total,
    feedback,
  };
}

export default function ModeComposer() {
  const navigate = useNavigate();
  const addXp = useGameStore((s) => s.addXp);
  const addComposition = useGameStore((s) => s.addComposition);

  const [gameState, setGameState] = useState<'idle' | 'composing'>('idle');
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [grid, setGrid] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number>(-1);
  const [highlightedNotes, setHighlightedNotes] = useState<string[]>([]);
  const [tempo, setTempo] = useState(1);
  const [scoreResult, setScoreResult] = useState<ScoreBreakdown | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const playbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const modeNotes = useMemo(() => selectedMood !== null ? getModeNotes(MOODS[selectedMood].modeIndex) : [], [selectedMood]);
  const currentMode = selectedMood !== null ? MODES[MOODS[selectedMood].modeIndex] : null;

  useEffect(() => {
    return () => {
      if (playbackRef.current) clearTimeout(playbackRef.current);
      audioEngine.stopAll();
    };
  }, []);

  useEffect(() => {
    if (currentBeat >= 0 && scrollRef.current) {
      const cellLeft = LABEL_WIDTH + currentBeat * CELL_SIZE;
      const containerWidth = scrollRef.current.clientWidth / 16;
      const scrollLeft = scrollRef.current.scrollLeft;
      const cellPx = cellLeft * 16;
      const visibleStart = scrollLeft;
      const visibleEnd = scrollLeft + scrollRef.current.clientWidth;
      if (cellPx < visibleStart || cellPx > visibleEnd - containerWidth) {
        scrollRef.current.scrollTo({
          left: Math.max(0, cellPx - scrollRef.current.clientWidth / 2),
          behavior: 'smooth',
        });
      }
    }
  }, [currentBeat]);

  useEffect(() => {
    if (showModal && scoreResult) {
      setAnimatedScore(0);
      const step = scoreResult.total / 30;
      let current = 0;
      const interval = setInterval(() => {
        current += step;
        if (current >= scoreResult.total) {
          current = scoreResult.total;
          clearInterval(interval);
        }
        setAnimatedScore(Math.floor(current));
      }, 33);
      return () => clearInterval(interval);
    }
  }, [showModal, scoreResult]);

  const startComposing = useCallback(async () => {
    await audioEngine.init();
    setGameState('composing');
  }, []);

  const selectMood = useCallback((index: number) => {
    if (playbackRef.current) clearTimeout(playbackRef.current);
    setSelectedMood(index);
    setGrid(new Set());
    setCurrentBeat(-1);
    setHighlightedNotes([]);
    setIsPlaying(false);
    setScoreResult(null);
    setShowModal(false);
    const mode = MODES[MOODS[index].modeIndex];
    const rootFreq = getFrequency('C', 4);
    audioEngine.playScale(rootFreq, mode.intervals, 2);
  }, []);

  const toggleCell = useCallback(
    (row: number, col: number) => {
      if (isPlaying) return;
      const key = `${row}-${col}`;
      setGrid((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
          const note = modeNotes[row];
          if (note) {
            const freq = getFrequency(note.name, note.octave);
            audioEngine.playNote(freq, 0.3, 'triangle');
          }
        }
        return next;
      });
    },
    [isPlaying, modeNotes],
  );

  const playMelody = useCallback(() => {
    if (isPlaying || modeNotes.length === 0) return;
    setIsPlaying(true);

    const playBeat = (beat: number) => {
      if (beat >= TOTAL_BEATS) {
        setIsPlaying(false);
        setCurrentBeat(-1);
        setHighlightedNotes([]);
        return;
      }

      setCurrentBeat(beat);
      const playingNotes: string[] = [];

      for (let row = 0; row < modeNotes.length; row++) {
        if (grid.has(`${row}-${beat}`)) {
          const note = modeNotes[row];
          const freq = getFrequency(note.name, note.octave);
          audioEngine.playNote(freq, BEAT_DURATION * tempo, 'triangle');
          playingNotes.push(`${note.name}${note.octave}`);
        }
      }

      setHighlightedNotes(playingNotes);

      playbackRef.current = setTimeout(() => {
        playBeat(beat + 1);
      }, BEAT_DURATION * tempo * 1000);
    };

    playBeat(0);
  }, [isPlaying, modeNotes, grid, tempo]);

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) clearTimeout(playbackRef.current);
    setIsPlaying(false);
    setCurrentBeat(-1);
    setHighlightedNotes([]);
    audioEngine.stopAll();
  }, []);

  const resetGrid = useCallback(() => {
    stopPlayback();
    setGrid(new Set());
    setScoreResult(null);
  }, [stopPlayback]);

  const handleSubmit = useCallback(() => {
    if (grid.size === 0 || selectedMood === null) return;
    stopPlayback();
    const result = calculateScore(grid, modeNotes);
    setScoreResult(result);
    setShowModal(true);
    addXp(result.total);
  }, [grid, selectedMood, modeNotes, stopPlayback, addXp]);

  const handleSave = useCallback(() => {
    if (!scoreResult || selectedMood === null) return;

    const notes: { note: string; octave: number; startBeat: number; duration: number }[] = [];
    grid.forEach((key) => {
      const [rowStr, colStr] = key.split('-');
      const row = parseInt(rowStr);
      const col = parseInt(colStr);
      const modeNote = modeNotes[row];
      if (modeNote) {
        notes.push({
          note: modeNote.name,
          octave: modeNote.octave,
          startBeat: col,
          duration: 1,
        });
      }
    });

    addComposition({
      id: crypto.randomUUID(),
      name: `${MOODS[selectedMood].word}旋律 - ${currentMode?.name}`,
      notes,
      mode: currentMode?.name ?? '',
      mood: MOODS[selectedMood].word,
      score: scoreResult.total,
      createdAt: Date.now(),
    });

    setShowModal(false);
  }, [scoreResult, selectedMood, grid, modeNotes, currentMode, addComposition]);

  const handleRestart = useCallback(() => {
    setShowModal(false);
    setScoreResult(null);
    setGrid(new Set());
    setCurrentBeat(-1);
    setHighlightedNotes([]);
  }, []);

  const handleBack = useCallback(() => {
    stopPlayback();
    navigate(-1);
  }, [stopPlayback, navigate]);

  const playScale = useCallback(() => {
    if (!currentMode) return;
    const rootFreq = getFrequency('C', 4);
    audioEngine.playScale(rootFreq, currentMode.intervals, 2);
  }, [currentMode]);

  const handlePianoNote = useCallback((noteName: string, octave: number) => {
    const freq = getFrequency(noteName, octave);
    audioEngine.playNote(freq, 0.3, 'triangle');
  }, []);

  if (gameState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-midnight-void px-6 safe-top safe-bottom">
        <div className="w-20 h-20 rounded-full bg-deep-violet/20 flex items-center justify-center mb-6 animate-pulse-glow">
          <Sparkles className="w-10 h-10 text-deep-violet" />
        </div>
        <h1 className="font-brand text-4xl md:text-5xl font-bold text-gradient-violet mb-4">
          调式作曲
        </h1>
        <p className="text-ash-whisper text-center max-w-md mb-2 font-inter leading-relaxed">
          选择一种情绪，用对应的调式创作属于你的旋律
        </p>
        <p className="text-ash-whisper/60 text-center max-w-sm mb-8 font-inter text-sm">
          探索不同调式的色彩，学习音乐理论，获得AI评分
        </p>
        <button
          onClick={startComposing}
          className="px-8 py-3 bg-deep-violet text-ghost-white rounded-btn font-inter font-semibold text-lg hover:bg-deep-violet/80 transition-all glow-violet active:scale-95"
        >
          开始创作
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-midnight-void relative overflow-hidden">
      <div className="absolute inset-0 bg-noise pointer-events-none" />

      <header className="relative z-10 safe-top flex items-center justify-between px-4 py-3 border-b border-slate-echo/10">
        <button
          onClick={handleBack}
          className="p-2 text-ash-whisper hover:text-ghost-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-brand text-lg text-ghost-white">调式作曲</h1>
        <div className="w-9" />
      </header>

      <div className="relative z-10 py-3">
        <div className="flex gap-2 px-4 overflow-x-auto pb-2">
          {MOODS.map((mood, idx) => (
            <button
              key={idx}
              onClick={() => selectMood(idx)}
              className={cn(
                'flex-shrink-0 px-3 py-2 md:px-4 md:py-2.5 rounded-card font-inter text-sm font-medium transition-all active:scale-95',
                selectedMood === idx
                  ? 'bg-deep-violet text-ghost-white glow-violet'
                  : 'bg-ghost-white/10 text-ash-whisper hover:bg-ghost-white/20',
              )}
            >
              <span className="mr-1.5">{mood.emoji}</span>
              {mood.word}
            </button>
          ))}
        </div>
      </div>

      {selectedMood !== null && currentMode && (
        <div className="relative z-10 px-4 pb-3">
          <div className="bg-ghost-white/5 rounded-card border border-slate-echo/10 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-brand text-ghost-white text-base">
                {currentMode.name} ({MOODS[selectedMood].label})
              </span>
              <button
                onClick={playScale}
                className="px-3 py-1 bg-deep-violet/20 text-lavender-haze rounded-badge font-inter text-xs font-medium hover:bg-deep-violet/30 transition-all active:scale-95 flex items-center gap-1"
              >
                <Play className="w-3 h-3" />
                播放音阶
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {modeNotes.map((note, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'font-inter text-xs px-1.5 py-0.5 rounded',
                    idx === 0 || idx === modeNotes.length - 1
                      ? 'bg-deep-violet/20 text-lavender-haze'
                      : 'text-ash-whisper',
                  )}
                >
                  {note.name}
                  {note.octave}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedMood === null ? (
        <div className="relative z-10 flex-1 flex items-center justify-center px-4">
          <p className="text-ash-whisper/50 font-inter text-sm text-center">
            ↑ 选择一种情绪开始创作
          </p>
        </div>
      ) : (
        <div className="relative z-10 flex-1 px-4 pb-2 overflow-hidden flex flex-col">
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto overflow-y-auto rounded-card border border-slate-echo/10 relative"
          >
            <div className="relative">
              {currentBeat >= 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-lavender-haze/70 z-20 pointer-events-none transition-all duration-150"
                  style={{
                    left: `${LABEL_WIDTH + currentBeat * CELL_SIZE + CELL_SIZE / 2}rem`,
                  }}
                />
              )}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `${LABEL_WIDTH}rem repeat(${TOTAL_BEATS}, ${CELL_SIZE}rem)`,
                  gridTemplateRows: `repeat(${modeNotes.length}, ${CELL_SIZE}rem)`,
                }}
              >
                {modeNotes
                  .slice()
                  .reverse()
                  .map((note, displayIdx) => {
                    const row = modeNotes.length - 1 - displayIdx;
                    return (
                      <React.Fragment key={row}>
                        <div
                          className={cn(
                            'sticky left-0 z-10 flex items-center justify-end pr-2 font-inter text-xs whitespace-nowrap border-r border-b border-slate-echo/10',
                            row === 0
                              ? 'bg-deep-violet/10 text-lavender-haze'
                              : 'bg-midnight-void text-ash-whisper',
                          )}
                        >
                          {note.name}
                          {note.octave}
                        </div>
                        {Array.from({ length: TOTAL_BEATS }, (_, col) => {
                          const key = `${row}-${col}`;
                          const isActive = grid.has(key);
                          const isCurrentBeat = col === currentBeat;
                          return (
                            <button
                              key={col}
                              onClick={() => toggleCell(row, col)}
                              className={cn(
                                'border-b border-r transition-all active:scale-90',
                                col % 4 === 0 && 'border-l border-l-slate-echo/20',
                                isActive
                                  ? 'bg-deep-violet border-deep-violet/30 hover:bg-deep-violet/80'
                                  : isCurrentBeat
                                    ? 'bg-lavender-haze/15 border-slate-echo/10'
                                    : 'bg-ghost-white/[0.02] border-slate-echo/5 hover:bg-ghost-white/10',
                              )}
                            />
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 px-4 py-2">
        <div className="bg-midnight-void/80 safe-bottom rounded-card border border-slate-echo/10 p-2">
          <PianoKeyboard
            highlightedNotes={highlightedNotes}
            onNotePlay={handlePianoNote}
            octave={4}
          />
        </div>
      </div>

      <div className="relative z-10 px-4 py-2">
        <div className="flex items-center justify-center gap-3">
          <span className="text-ash-whisper text-xs font-inter">速度</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.25"
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
            className="w-20 h-1 accent-deep-violet cursor-pointer"
          />
          <span className="text-ghost-white text-xs font-inter w-8">{tempo}x</span>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-center gap-2 md:gap-3 px-4 py-3 pb-6 md:pb-4">
        <button
          onClick={resetGrid}
          className="flex-1 min-w-0 px-3 py-2 md:px-4 md:py-2.5 bg-slate-echo/20 text-ash-whisper rounded-btn font-inter text-sm hover:bg-slate-echo/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
        <button
          onClick={isPlaying ? stopPlayback : playMelody}
          disabled={grid.size === 0}
          className={cn(
            'flex-1 min-w-0 px-3 py-2 md:px-4 md:py-2.5 bg-deep-violet text-ghost-white rounded-btn font-inter font-semibold transition-all flex items-center justify-center gap-1.5',
            grid.size > 0
              ? 'glow-violet hover:bg-deep-violet/80 active:scale-95'
              : 'opacity-50 cursor-not-allowed',
          )}
        >
          <Play className="w-4 h-4" />
          {isPlaying ? '停止' : '播放'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={grid.size === 0 || isPlaying}
          className={cn(
            'flex-1 min-w-0 px-3 py-2 md:px-4 md:py-2.5 bg-gradient-violet text-ghost-white rounded-btn font-inter font-semibold transition-all flex items-center justify-center gap-1.5',
            grid.size > 0 && !isPlaying
              ? 'hover:opacity-90 active:scale-95'
              : 'opacity-50 cursor-not-allowed',
          )}
        >
          <Sparkles className="w-4 h-4" />
          提交评分
        </button>
      </div>

      {showModal && scoreResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-void/80 backdrop-blur-sm px-4">
          <div className="bg-midnight-void safe-bottom border border-slate-echo/20 rounded-card p-6 max-w-sm w-full animate-slide-in">
            <div className="flex justify-center mb-5">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#55525733"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#a238ff"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(animatedScore / 100) * 264} 264`}
                    className="transition-all duration-100 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-brand text-3xl text-ghost-white">
                    {animatedScore}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 mb-5">
              {[
                { label: '调式遵循', score: scoreResult.modeAdherence, max: 30 },
                { label: '旋律轮廓', score: scoreResult.melodicContour, max: 25 },
                { label: '节奏变化', score: scoreResult.rhythmicVariety, max: 20 },
                { label: '终止式', score: scoreResult.resolution, max: 15 },
                { label: '长度', score: scoreResult.length, max: 10 },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between font-inter text-sm"
                >
                  <span className="text-ash-whisper">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-echo/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-deep-violet rounded-full transition-all duration-700"
                        style={{ width: `${(item.score / item.max) * 100}%` }}
                      />
                    </div>
                    <span className="text-ghost-white w-10 text-right">
                      {item.score}/{item.max}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-lavender-haze font-inter text-sm mb-6">
              {scoreResult.feedback}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleRestart}
                className="flex-1 px-4 py-2.5 bg-slate-echo/20 text-ash-whisper rounded-btn font-inter text-sm hover:bg-slate-echo/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                重新创作
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-deep-violet text-ghost-white rounded-btn font-inter font-semibold text-sm glow-violet hover:bg-deep-violet/80 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                保存作品
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
