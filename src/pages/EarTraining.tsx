import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { audioEngine } from '@/utils/audioEngine';
import { INTERVAL_NAMES, CHORD_TYPES, MODES, NOTE_NAMES, getFrequency } from '@/utils/musicData';
import { useGameStore } from '@/store/gameStore';
import PianoKeyboard from '@/components/PianoKeyboard';
import { ArrowLeft, Play, Volume2, Check, X, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOTAL_ROUNDS = 10;
const DIFFICULTY_LABELS = { easy: '初级', medium: '中级', hard: '高级' } as const;

interface QuestionBase {
  correctAnswer: string;
  options: string[];
  rootNote: string;
  rootNoteIndex: number;
  rootOctave: number;
  highlightedNotes: string[];
  rootFreq: number;
}

type Question =
  | (QuestionBase & { type: 'interval'; semitones: number })
  | (QuestionBase & { type: 'chord'; chordFreqs: number[] })
  | (QuestionBase & { type: 'mode'; modeIntervals: number[] });

function midiToNoteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function playQuestionAudio(q: Question) {
  if (q.type === 'interval') {
    audioEngine.playInterval(q.rootFreq, q.semitones, 1.5);
  } else if (q.type === 'chord') {
    audioEngine.playChord(q.chordFreqs, 2, 'triangle');
  } else {
    audioEngine.playScale(q.rootFreq, q.modeIntervals, 3);
  }
}

function generateQuestion(difficulty: 'easy' | 'medium' | 'hard'): Question {
  const rootNoteIndex = Math.floor(Math.random() * 10);
  const rootOctave = 4;
  const rootNote = NOTE_NAMES[rootNoteIndex];
  const rootMidi = (rootOctave + 1) * 12 + rootNoteIndex;
  const rootFreq = getFrequency(rootNote, rootOctave);
  const base = { rootNote: `${rootNote}${rootOctave}`, rootNoteIndex, rootOctave, rootFreq };

  if (difficulty === 'easy') {
    const semitones = 2 + Math.floor(Math.random() * 11);
    const correctAnswer = INTERVAL_NAMES.get(semitones)!;
    const available = Array.from(INTERVAL_NAMES.entries()).filter(([k]) => k >= 2 && k <= 12 && k !== semitones);
    const wrong = shuffle(available).slice(0, 3).map(([, v]) => v);
    const options = shuffle([correctAnswer, ...wrong]);
    const highlightedNotes = [midiToNoteName(rootMidi), midiToNoteName(rootMidi + semitones)];
    return { ...base, type: 'interval', correctAnswer, options, highlightedNotes, semitones };
  }

  if (difficulty === 'medium') {
    const basicChords = CHORD_TYPES.slice(0, 4);
    const chordType = basicChords[Math.floor(Math.random() * basicChords.length)];
    const correctAnswer = chordType.name;
    const options = shuffle(basicChords.map(c => c.name));
    const highlightedNotes = chordType.intervals.map(i => midiToNoteName(rootMidi + i));
    const chordFreqs = chordType.intervals.map(i => {
      const noteIdx = (rootNoteIndex + i) % 12;
      const oct = rootOctave + Math.floor((rootNoteIndex + i) / 12);
      return getFrequency(NOTE_NAMES[noteIdx], oct);
    });
    return { ...base, type: 'chord', correctAnswer, options, highlightedNotes, chordFreqs };
  }

  const modeInfo = MODES[Math.floor(Math.random() * MODES.length)];
  const correctAnswer = modeInfo.name;
  const otherModes = MODES.filter(m => m.name !== modeInfo.name);
  const wrong = shuffle(otherModes).slice(0, 3).map(m => m.name);
  const options = shuffle([correctAnswer, ...wrong]);
  let cumulative = 0;
  const highlightedNotes = [midiToNoteName(rootMidi)];
  for (const interval of modeInfo.intervals) {
    cumulative += interval;
    highlightedNotes.push(midiToNoteName(rootMidi + cumulative));
  }
  return { ...base, type: 'mode', correctAnswer, options, highlightedNotes, modeIntervals: modeInfo.intervals };
}

export default function EarTraining() {
  const navigate = useNavigate();
  const addXp = useGameStore(s => s.addXp);
  const updateEarTraining = useGameStore(s => s.updateEarTraining);
  const setEarTrainingDifficulty = useGameStore(s => s.setEarTrainingDifficulty);
  const storeDifficulty = useGameStore(s => s.earTraining.difficulty);

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'result'>('idle');
  const [currentRound, setCurrentRound] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [streak, setStreak] = useState(0);
  const [gameBestStreak, setGameBestStreak] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRoundRef = useRef(1);
  const totalCorrectRef = useRef(0);
  const streakRef = useRef(0);
  const gameBestStreakRef = useRef(0);

  currentRoundRef.current = currentRound;
  totalCorrectRef.current = totalCorrect;
  streakRef.current = streak;
  gameBestStreakRef.current = gameBestStreak;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      audioEngine.stopAll();
    };
  }, []);

  const playAudio = useCallback(() => {
    if (!currentQuestion) return;
    playQuestionAudio(currentQuestion);
  }, [currentQuestion]);

  const advanceToNextRound = useCallback(() => {
    const nextRound = currentRoundRef.current + 1;
    if (nextRound > TOTAL_ROUNDS) {
      addXp(totalCorrectRef.current * 15);
      setGameState('result');
      return;
    }
    const diff = useGameStore.getState().earTraining.difficulty;
    const question = generateQuestion(diff);
    setCurrentQuestion(question);
    setCurrentRound(nextRound);
    currentRoundRef.current = nextRound;
    setSelectedAnswer(null);
    setShowFeedback(false);
    setTimeout(() => playQuestionAudio(question), 300);
  }, [addXp]);

  const startGame = useCallback(async () => {
    await audioEngine.init();
    const diff = useGameStore.getState().earTraining.difficulty;
    const question = generateQuestion(diff);
    setCurrentQuestion(question);
    setCurrentRound(1);
    currentRoundRef.current = 1;
    setStreak(0);
    streakRef.current = 0;
    setGameBestStreak(0);
    gameBestStreakRef.current = 0;
    setTotalCorrect(0);
    totalCorrectRef.current = 0;
    setSelectedAnswer(null);
    setShowFeedback(false);
    setGameState('playing');
    setTimeout(() => playQuestionAudio(question), 300);
  }, []);

  const handleAnswer = useCallback((answer: string) => {
    if (showFeedback || !currentQuestion) return;
    setSelectedAnswer(answer);
    setShowFeedback(true);
    const isCorrect = answer === currentQuestion.correctAnswer;
    if (isCorrect) {
      const newStreak = streakRef.current + 1;
      setStreak(newStreak);
      streakRef.current = newStreak;
      if (newStreak > gameBestStreakRef.current) {
        setGameBestStreak(newStreak);
        gameBestStreakRef.current = newStreak;
      }
      const newTotal = totalCorrectRef.current + 1;
      setTotalCorrect(newTotal);
      totalCorrectRef.current = newTotal;
    } else {
      setStreak(0);
      streakRef.current = 0;
    }
    updateEarTraining(isCorrect);
    timeoutRef.current = setTimeout(() => advanceToNextRound(), 1500);
  }, [showFeedback, currentQuestion, updateEarTraining, advanceToNextRound]);

  const handleDifficultyChange = useCallback((diff: 'easy' | 'medium' | 'hard') => {
    setEarTrainingDifficulty(diff);
    if (gameState === 'playing') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const question = generateQuestion(diff);
      setCurrentQuestion(question);
      setCurrentRound(1);
      currentRoundRef.current = 1;
      setStreak(0);
      streakRef.current = 0;
      setGameBestStreak(0);
      gameBestStreakRef.current = 0;
      setTotalCorrect(0);
      totalCorrectRef.current = 0;
      setSelectedAnswer(null);
      setShowFeedback(false);
      setTimeout(() => playQuestionAudio(question), 300);
    }
  }, [gameState, setEarTrainingDifficulty]);

  const handleBack = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    audioEngine.stopAll();
    navigate('/');
  }, [navigate]);

  const renderDifficultyTabs = () => (
    <div className="flex gap-1 bg-slate-echo/10 rounded-btn p-1">
      {(['easy', 'medium', 'hard'] as const).map(d => (
        <button
          key={d}
          onClick={() => handleDifficultyChange(d)}
          className={cn(
            'px-4 py-2 rounded-btn font-inter text-sm transition-all',
            storeDifficulty === d
              ? 'bg-deep-violet text-ghost-white'
              : 'text-ash-whisper hover:text-ghost-white',
          )}
        >
          {DIFFICULTY_LABELS[d]}
        </button>
      ))}
    </div>
  );

  if (gameState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-midnight-void px-6">
        <div className="w-20 h-20 rounded-full bg-deep-violet/20 flex items-center justify-center mb-6 animate-pulse-glow">
          <Volume2 className="w-10 h-10 text-deep-violet" />
        </div>
        <h1 className="font-brand text-4xl md:text-5xl font-bold text-gradient-violet mb-4">
          听力挑战
        </h1>
        <p className="text-ash-whisper text-center max-w-md mb-2 font-inter leading-relaxed">
          锻炼你的耳朵，辨别音程、和弦与调式
        </p>
        <p className="text-ash-whisper/60 text-center max-w-sm mb-8 font-inter text-sm">
          听音频，选择正确的答案，挑战你的听力极限
        </p>
        <div className="mb-8">{renderDifficultyTabs()}</div>
        <button
          onClick={startGame}
          className="flex items-center gap-2 px-8 py-3 bg-deep-violet text-ghost-white rounded-btn font-inter font-semibold text-lg hover:bg-deep-violet/80 transition-all glow-violet active:scale-95"
        >
          <Play className="w-5 h-5" fill="currentColor" />
          开始挑战
        </button>
      </div>
    );
  }

  if (gameState === 'result') {
    const accuracy = Math.round((totalCorrect / TOTAL_ROUNDS) * 100);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-midnight-void px-6">
        <div className="w-20 h-20 rounded-full bg-deep-violet/20 flex items-center justify-center mb-6">
          <Trophy className="w-10 h-10 text-lavender-haze" />
        </div>
        <h2 className="font-brand text-3xl md:text-4xl font-bold text-ghost-white mb-6">
          挑战结束
        </h2>
        <div className="space-y-3 font-inter w-full max-w-xs mb-8">
          <div className="flex justify-between text-lg text-ash-whisper">
            <span>正确</span>
            <span className="font-bold text-ghost-white">{totalCorrect}/{TOTAL_ROUNDS}</span>
          </div>
          <div className="flex justify-between text-lg text-ash-whisper">
            <span>最佳连击</span>
            <span className="font-bold text-lavender-haze">{gameBestStreak}</span>
          </div>
          <div className="flex justify-between text-lg text-ash-whisper">
            <span>准确率</span>
            <span className={cn(
              'font-bold',
              accuracy >= 80 ? 'text-[#22c55e]' : accuracy >= 50 ? 'text-yellow-400' : 'text-[#ef4444]',
            )}>
              {accuracy}%
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={startGame}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-deep-violet text-ghost-white rounded-btn font-inter font-semibold text-lg hover:bg-deep-violet/80 transition-all glow-violet active:scale-95"
          >
            <Play className="w-5 h-5" fill="currentColor" />
            再来一次
          </button>
          <button
            onClick={handleBack}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-slate-echo/20 text-ash-whisper rounded-btn font-inter font-semibold text-lg hover:bg-slate-echo/30 transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
            返回主页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-midnight-void relative overflow-hidden">
      <div className="absolute inset-0 bg-noise pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-slate-echo/10">
        <button
          onClick={handleBack}
          className="p-2 text-ash-whisper hover:text-ghost-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 font-inter text-sm">
          <span className="text-ash-whisper">
            <span className="text-ghost-white font-semibold">{currentRound}</span>/{TOTAL_ROUNDS}
          </span>
          {streak > 0 && (
            <span className="px-2.5 py-0.5 bg-deep-violet/20 text-lavender-haze rounded-badge text-xs font-semibold flex items-center gap-1">
              🔥 {streak}
            </span>
          )}
        </div>
        <div className="w-8" />
      </header>

      <div className="relative z-10 px-4 py-2">
        {renderDifficultyTabs()}
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-4 gap-5">
        <button
          onClick={playAudio}
          className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-deep-violet flex items-center justify-center hover:bg-deep-violet/80 transition-all active:scale-95 animate-pulse-glow"
        >
          <Volume2 className="w-10 h-10 md:w-12 md:h-12 text-ghost-white" />
        </button>

        <p className="text-ash-whisper/60 font-inter text-sm">点击播放音频</p>

        {showFeedback && (
          <div className="flex items-center gap-2 animate-slide-in">
            {selectedAnswer === currentQuestion?.correctAnswer ? (
              <>
                <Check className="w-4 h-4 text-[#22c55e]" />
                <span className="text-[#22c55e] font-inter text-sm font-semibold">正确!</span>
              </>
            ) : (
              <>
                <X className="w-4 h-4 text-[#ef4444]" />
                <span className="text-[#ef4444] font-inter text-sm font-semibold">错误</span>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          {currentQuestion?.options.map(option => {
            const isSelected = selectedAnswer === option;
            const isCorrect = option === currentQuestion?.correctAnswer;
            let cardClass = 'bg-ghost-white/10 text-ghost-white border border-transparent hover:border-deep-violet';
            if (showFeedback) {
              if (isSelected && isCorrect) cardClass = 'bg-[#22c55e] text-white border border-[#22c55e]';
              else if (isSelected && !isCorrect) cardClass = 'bg-[#ef4444] text-white border border-[#ef4444]';
              else if (!isSelected && isCorrect) cardClass = 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40';
              else cardClass = 'bg-ghost-white/5 text-ash-whisper/40 border border-transparent';
            }
            return (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                disabled={showFeedback}
                className={cn(
                  'rounded-card py-4 px-3 font-inter font-semibold text-base md:text-lg transition-all duration-200 min-h-[56px]',
                  cardClass,
                  !showFeedback && 'active:scale-95',
                  showFeedback && 'pointer-events-none',
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 px-4 py-2 pb-4 md:pb-4">
        <div className="bg-midnight-void/80 rounded-card border border-slate-echo/10 p-2">
          <PianoKeyboard
            highlightedNotes={currentQuestion?.highlightedNotes ?? []}
            octave={4}
          />
        </div>
      </div>
    </div>
  );
}
