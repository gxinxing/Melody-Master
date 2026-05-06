import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { audioEngine } from '@/utils/audioEngine';
import { getFrequency } from '@/utils/musicData';
import { useGameStore } from '@/store/gameStore';
import { ArrowLeft, Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FallingNote {
  id: number;
  noteName: string;
  octave: number;
  lane: number;
  y: number;
  speed: number;
  hit: boolean;
  hitResult?: 'perfect' | 'good' | 'miss';
  hitTime?: number;
}

const GAME_DURATION = 30;
const HIT_ZONE_Y = 0.85;
const NOTE_SPEED = 0.3;
const PERFECT_WINDOW = 0.02;
const GOOD_WINDOW = 0.065;
const SPAWN_INTERVAL_START = 900;
const SPAWN_INTERVAL_MIN = 500;

const GAME_NOTES = ['C', 'D', 'E', 'F'] as const;
const LANE_COUNT = GAME_NOTES.length;

const LANE_COLORS = [
  { bg: 'bg-rose-500', glow: 'shadow-rose-500/40' },
  { bg: 'bg-amber-500', glow: 'shadow-amber-500/40' },
  { bg: 'bg-emerald-500', glow: 'shadow-emerald-500/40' },
  { bg: 'bg-sky-500', glow: 'shadow-sky-500/40' },
];

const LANE_COLORS_CSS = ['#f43f5e', '#f59e0b', '#10b981', '#0ea5e9'];

export default function NoteRunner() {
  const navigate = useNavigate();
  const { addXp, updateNoteRunner } = useGameStore();

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'ended'>('idle');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [perfectCount, setPerfectCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [comboBounce, setComboBounce] = useState(false);
  const [hitEffects, setHitEffects] = useState<Array<{ id: number; type: 'perfect' | 'good'; lane: number }>>([]);
  const [activeLane, setActiveLane] = useState<number | null>(null);
  const [, setRenderTick] = useState(0);

  const notesRef = useRef<FallingNote[]>([]);
  const nextIdRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const gameStartRef = useRef(0);
  const lastFrameRef = useRef(0);
  const animFrameRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const perfectRef = useRef(0);
  const goodRef = useRef(0);
  const missRef = useRef(0);
  const storeUpdatedRef = useRef(false);
  const comboBounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const gameLoopFnRef = useRef<((ts: number) => void) | null>(null);
  const pauseStartRef = useRef(0);
  const activeLaneTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const processHit = useCallback((note: FallingNote) => {
    if (note.hit) return;

    const dist = Math.abs(note.y - HIT_ZONE_Y);
    if (dist > GOOD_WINDOW) return;

    note.hit = true;
    note.hitTime = performance.now();

    if (dist <= PERFECT_WINDOW) {
      note.hitResult = 'perfect';
      perfectRef.current++;
      setPerfectCount(perfectRef.current);
      scoreRef.current += 100;
    } else {
      note.hitResult = 'good';
      goodRef.current++;
      setGoodCount(goodRef.current);
      scoreRef.current += 50;
    }

    comboRef.current++;
    setCombo(comboRef.current);
    setScore(scoreRef.current);

    if (comboRef.current > maxComboRef.current) {
      maxComboRef.current = comboRef.current;
      setMaxCombo(maxComboRef.current);
    }

    setComboBounce(true);
    if (comboBounceTimerRef.current) clearTimeout(comboBounceTimerRef.current);
    comboBounceTimerRef.current = setTimeout(() => setComboBounce(false), 400);

    const freq = getFrequency(note.noteName, note.octave);
    audioEngine.playNote(freq, 0.3, 'sine');

    setHitEffects(prev => [
      ...prev,
      { id: note.id, type: note.hitResult as 'perfect' | 'good', lane: note.lane },
    ]);
    const effectId = note.id;
    setTimeout(() => {
      setHitEffects(prev => prev.filter(e => e.id !== effectId));
    }, 500);
  }, []);

  const handleHitByLane = useCallback(
    (laneIndex: number) => {
      if (gameState !== 'playing') return;

      setActiveLane(laneIndex);
      if (activeLaneTimerRef.current) clearTimeout(activeLaneTimerRef.current);
      activeLaneTimerRef.current = setTimeout(() => setActiveLane(null), 150);

      const candidates = notesRef.current.filter(n => !n.hit && n.lane === laneIndex);
      if (candidates.length === 0) return;

      let closest: FallingNote | null = null;
      let closestDist = Infinity;
      for (const n of candidates) {
        const d = Math.abs(n.y - HIT_ZONE_Y);
        if (d < closestDist) {
          closestDist = d;
          closest = n;
        }
      }
      if (closest) processHit(closest);
    },
    [gameState, processHit],
  );

  const startGame = useCallback(async () => {
    await audioEngine.init();

    notesRef.current = [];
    nextIdRef.current = 0;
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    perfectRef.current = 0;
    goodRef.current = 0;
    missRef.current = 0;
    storeUpdatedRef.current = false;

    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectCount(0);
    setGoodCount(0);
    setMissCount(0);
    setTimeLeft(GAME_DURATION);
    setHitEffects([]);
    setActiveLane(null);
    setGameState('playing');

    const now = performance.now();
    gameStartRef.current = now;
    lastSpawnRef.current = now;
    lastFrameRef.current = 0;

    const loop = (timestamp: number) => {
      if (lastFrameRef.current === 0) {
        lastFrameRef.current = timestamp;
      }

      const dt = Math.min((timestamp - lastFrameRef.current) / 1000, 0.1);
      lastFrameRef.current = timestamp;

      const elapsed = (timestamp - gameStartRef.current) / 1000;
      const remaining = GAME_DURATION - elapsed;

      if (remaining <= 0) {
        setGameState('ended');
        setTimeLeft(0);
        audioEngine.stopAll();
        if (!storeUpdatedRef.current) {
          updateNoteRunner(scoreRef.current, maxComboRef.current);
          addXp(Math.floor(scoreRef.current / 10));
          storeUpdatedRef.current = true;
        }
        return;
      }

      setTimeLeft(Math.ceil(remaining));

      for (const note of notesRef.current) {
        if (!note.hit) {
          note.y += note.speed * dt;
        }
      }

      for (const note of notesRef.current) {
        if (!note.hit && note.y > HIT_ZONE_Y + GOOD_WINDOW + 0.02) {
          note.hit = true;
          note.hitResult = 'miss';
          note.hitTime = performance.now();
          missRef.current++;
          setMissCount(missRef.current);
          comboRef.current = 0;
          setCombo(0);
        }
      }

      notesRef.current = notesRef.current.filter(n => {
        if (n.hit && n.hitTime && performance.now() - n.hitTime > 500) return false;
        if (n.y > 1.3) return false;
        return true;
      });

      const progress = elapsed / GAME_DURATION;
      const spawnInterval =
        SPAWN_INTERVAL_START - progress * (SPAWN_INTERVAL_START - SPAWN_INTERVAL_MIN);
      if (timestamp - lastSpawnRef.current > spawnInterval) {
        const noteName = GAME_NOTES[Math.floor(Math.random() * GAME_NOTES.length)];
        const lane = GAME_NOTES.indexOf(noteName);
        notesRef.current.push({
          id: nextIdRef.current++,
          noteName,
          octave: 4,
          lane,
          y: -0.05,
          speed: NOTE_SPEED,
          hit: false,
        });
        lastSpawnRef.current = timestamp;
      }

      setRenderTick(t => t + 1);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    gameLoopFnRef.current = loop;
    animFrameRef.current = requestAnimationFrame(loop);
  }, [updateNoteRunner, addXp]);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      cancelAnimationFrame(animFrameRef.current);
      pauseStartRef.current = performance.now();
      setGameState('paused');
    } else if (gameState === 'paused') {
      const pauseDuration = performance.now() - pauseStartRef.current;
      gameStartRef.current += pauseDuration;
      lastSpawnRef.current += pauseDuration;
      lastFrameRef.current = 0;
      setGameState('playing');
      if (gameLoopFnRef.current) {
        animFrameRef.current = requestAnimationFrame(gameLoopFnRef.current);
      }
    }
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (comboBounceTimerRef.current) clearTimeout(comboBounceTimerRef.current);
      if (activeLaneTimerRef.current) clearTimeout(activeLaneTimerRef.current);
      audioEngine.stopAll();
    };
  }, []);

  const handlePlayAreaPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (gameState !== 'playing') return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const laneWidth = rect.width / LANE_COUNT;
      const laneIndex = Math.min(Math.floor(x / laneWidth), LANE_COUNT - 1);
      if (laneIndex >= 0) handleHitByLane(laneIndex);
    },
    [gameState, handleHitByLane],
  );

  const laneWidthPct = 100 / LANE_COUNT;

  if (gameState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-midnight-void px-4">
        <h1 className="font-brand text-5xl md:text-7xl text-gradient-violet mb-6">音符跑酷</h1>
        <p className="font-inter text-ash-whisper text-center max-w-md mb-4 text-lg leading-relaxed">
          音符从天而降，在正确的时机点击它们！
        </p>
        <div className="flex gap-3 mb-8">
          {GAME_NOTES.map((note, i) => (
            <div
              key={note}
              className="w-12 h-12 rounded-xl flex items-center justify-center font-brand text-xl text-white font-bold"
              style={{ backgroundColor: LANE_COLORS_CSS[i] }}
            >
              {note}
            </div>
          ))}
        </div>
        <p className="font-inter text-ash-whisper/60 text-center max-w-sm mb-10 text-sm">
          四个音轨 · 点击屏幕或底部按钮 · 考验你的节奏感
        </p>
        <button
          onClick={startGame}
          className="flex items-center gap-3 bg-deep-violet hover:bg-lavender-haze text-ghost-white font-brand text-xl px-10 py-5 rounded-btn transition-colors glow-violet-strong active:scale-95"
        >
          <Play size={28} fill="currentColor" />
          开始游戏
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-midnight-void overflow-hidden select-none">
      <div className="flex items-center justify-between px-3 py-2 md:px-6 md:py-3 border-b border-slate-echo/20 shrink-0 safe-top">
        <button
          onClick={() => {
            audioEngine.stopAll();
            navigate('/');
          }}
          className="text-ash-whisper hover:text-ghost-white transition-colors p-1"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="flex items-center gap-5 md:gap-8">
          <div className="text-center">
            <div className="font-brand text-2xl md:text-3xl text-ghost-white">{score}</div>
            <div className="font-inter text-[10px] md:text-xs text-ash-whisper uppercase tracking-wider">
              分数
            </div>
          </div>
          <div className="text-center">
            <div
              className={cn(
                'font-brand text-2xl md:text-3xl text-deep-violet transition-transform',
                comboBounce && 'animate-combo-bounce',
              )}
            >
              {combo}x
            </div>
            <div className="font-inter text-[10px] md:text-xs text-ash-whisper uppercase tracking-wider">
              连击
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {gameState === 'playing' || gameState === 'paused' ? (
            <button
              onClick={togglePause}
              className="text-ash-whisper hover:text-ghost-white transition-colors p-1"
            >
              {gameState === 'paused' ? <Play size={22} /> : <Pause size={22} />}
            </button>
          ) : null}
          <div className="text-center min-w-[36px]">
            <div
              className={cn(
                'font-brand text-2xl md:text-3xl',
                timeLeft <= 5 ? 'text-red-400' : 'text-ghost-white',
              )}
            >
              {timeLeft}
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex-1 relative overflow-hidden touch-none"
        onPointerDown={handlePlayAreaPointerDown}
      >
        {Array.from({ length: LANE_COUNT - 1 }, (_, i) => (
          <div
            key={`lane-${i}`}
            className="absolute top-0 bottom-0 border-r border-slate-echo/10 pointer-events-none"
            style={{ left: `${(i + 1) * laneWidthPct}%` }}
          />
        ))}

        {GAME_NOTES.map((note, i) => (
          <div
            key={`label-${note}`}
            className="absolute font-inter text-xs md:text-sm text-center pointer-events-none"
            style={{
              left: `${i * laneWidthPct}%`,
              width: `${laneWidthPct}%`,
              top: `${HIT_ZONE_Y * 100 + 2}%`,
              color: `${LANE_COLORS_CSS[i]}66`,
            }}
          >
            {note}4
          </div>
        ))}

        <div
          className="absolute left-0 right-0 h-[3px] bg-deep-violet glow-violet-strong pointer-events-none"
          style={{ top: `${HIT_ZONE_Y * 100}%` }}
        />
        <div
          className="absolute left-0 right-0 bg-deep-violet/5 pointer-events-none"
          style={{
            top: `${(HIT_ZONE_Y - GOOD_WINDOW) * 100}%`,
            height: `${GOOD_WINDOW * 2 * 100}%`,
          }}
        />

        {notesRef.current.map(note => {
          const noteHeightPct = 5;
          const leftPct = note.lane * laneWidthPct + laneWidthPct * 0.1;
          const widthPct = laneWidthPct * 0.8;

          return (
            <div
              key={note.id}
              className={cn(
                'absolute rounded-xl flex items-center justify-center font-brand font-bold text-white pointer-events-auto text-base md:text-lg',
                note.hit &&
                  (note.hitResult === 'perfect' || note.hitResult === 'good') &&
                  'animate-note-hit',
                note.hit && note.hitResult === 'miss' && 'opacity-20',
                !note.hit && 'cursor-pointer',
              )}
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                top: `${note.y * 100}%`,
                height: `${noteHeightPct}%`,
                minHeight: '44px',
                backgroundColor: note.hit ? undefined : LANE_COLORS_CSS[note.lane],
                boxShadow: note.hit ? undefined : `0 2px 12px ${LANE_COLORS_CSS[note.lane]}55`,
              }}
              onPointerDown={e => {
                e.stopPropagation();
                if (note.hit || gameState !== 'playing') return;
                processHit(note);
              }}
            >
              {note.noteName}{note.octave}
            </div>
          );
        })}

        {hitEffects.map(effect => (
          <div
            key={effect.id}
            className={cn(
              'absolute font-brand text-sm md:text-lg font-bold pointer-events-none animate-slide-in',
              effect.type === 'perfect' ? 'text-yellow-300' : 'text-green-300',
            )}
            style={{
              left: `${effect.lane * laneWidthPct + laneWidthPct / 2}%`,
              top: `${(HIT_ZONE_Y - 0.06) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {effect.type === 'perfect' ? 'Perfect!' : 'Good!'}
          </div>
        ))}

        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-midnight-void/70 flex flex-col items-center justify-center z-20">
            <p className="font-brand text-3xl text-ghost-white mb-6">暂停</p>
            <button
              onClick={togglePause}
              className="flex items-center gap-2 bg-deep-violet hover:bg-lavender-haze text-ghost-white font-brand text-lg px-8 py-3 rounded-btn transition-colors"
            >
              <Play size={20} fill="currentColor" />
              继续
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-echo/20 safe-bottom">
        <div className="grid grid-cols-4 gap-1 p-1.5">
          {GAME_NOTES.map((note, i) => (
            <button
              key={note}
              className={cn(
                'h-16 md:h-20 rounded-xl font-brand text-xl md:text-2xl text-white font-bold transition-all active:scale-95',
                LANE_COLORS[i].bg,
                activeLane === i && 'scale-95 brightness-125',
              )}
              style={{
                boxShadow: activeLane === i
                  ? `0 0 20px ${LANE_COLORS_CSS[i]}66`
                  : `0 2px 8px ${LANE_COLORS_CSS[i]}33`,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                handleHitByLane(i);
              }}
            >
              {note}
            </button>
          ))}
        </div>
      </div>

      {gameState === 'ended' && (
        <div className="fixed inset-0 bg-midnight-void/80 flex items-center justify-center z-50 p-4 safe-bottom">
          <div className="bg-ghost-white rounded-card p-6 md:p-8 max-w-sm w-full text-midnight-void animate-pop">
            <h2 className="font-brand text-2xl md:text-3xl text-center mb-6">游戏结束</h2>
            <div className="space-y-3 font-inter">
              <div className="flex justify-between text-lg">
                <span>得分</span>
                <span className="font-bold text-deep-violet">{score}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span>最高连击</span>
                <span className="font-bold text-deep-violet">{maxCombo}x</span>
              </div>
              <div className="border-t border-slate-echo/20 pt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-yellow-500">Perfect</span>
                  <span className="font-semibold">{perfectCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-500">Good</span>
                  <span className="font-semibold">{goodCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-500">Miss</span>
                  <span className="font-semibold">{missCount}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={startGame}
                className="flex items-center justify-center gap-2 bg-deep-violet hover:bg-lavender-haze text-ghost-white font-brand py-3 rounded-btn transition-colors"
              >
                <RotateCcw size={18} />
                再来一次
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center justify-center gap-2 bg-slate-echo/20 hover:bg-slate-echo/30 text-midnight-void font-brand py-3 rounded-btn transition-colors"
              >
                <ArrowLeft size={18} />
                返回主页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
