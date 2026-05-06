import { useNavigate } from 'react-router-dom';
import { Music, Grid3X3, PenTool, Headphones, BookOpen, ChevronRight } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

const modes = [
  {
    icon: Music,
    title: '音符跑酷',
    description: '跟随节拍，认识音名',
    route: '/note-runner',
    getStat: (state: ReturnType<typeof useGameStore.getState>) => `最高分: ${state.noteRunner.highScore}`,
  },
  {
    icon: Grid3X3,
    title: '和弦拼图',
    description: '拼出和弦，理解构成',
    route: '/chord-puzzle',
    getStat: (state: ReturnType<typeof useGameStore.getState>) => `关卡: ${state.chordPuzzle.level}`,
  },
  {
    icon: PenTool,
    title: '调式作曲',
    description: '用调式表达情绪',
    route: '/mode-composer',
    getStat: (state: ReturnType<typeof useGameStore.getState>) => `创作: ${state.modeComposer.compositions.length}首`,
  },
  {
    icon: Headphones,
    title: '听力挑战',
    description: '聆听辨别音程与和弦',
    route: '/ear-training',
    getStat: (state: ReturnType<typeof useGameStore.getState>) => `最佳连击: ${state.earTraining.bestStreak}`,
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { level, xp } = useGameStore();
  const state = useGameStore.getState();

  const xpNeeded = (level + 1) * 100;
  const xpProgress = (xp / xpNeeded) * 100;

  const scrollToModes = () => {
    document.getElementById('mode-selection')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-midnight-void text-ghost-white overflow-hidden">
      <section className="relative safe-top flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-2rem)] px-4 py-8">
        <div
          className="absolute top-[-10%] right-[-5%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] rounded-full bg-deep-violet opacity-20 blur-[120px] pointer-events-none"
          style={{
            animation: 'orbDrift1 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute bottom-[-10%] left-[-5%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] rounded-full bg-lavender-haze opacity-15 blur-[100px] pointer-events-none"
          style={{
            animation: 'orbDrift2 10s ease-in-out infinite',
          }}
        />

        <style>{`
          @keyframes orbDrift1 {
            0%, 100% { transform: translate(0, 0); }
            25% { transform: translate(-30px, 20px); }
            50% { transform: translate(10px, 40px); }
            75% { transform: translate(20px, -10px); }
          }
          @keyframes orbDrift2 {
            0%, 100% { transform: translate(0, 0); }
            25% { transform: translate(20px, -30px); }
            50% { transform: translate(-15px, -20px); }
            75% { transform: translate(-25px, 15px); }
          }
        `}</style>

        <div className="relative z-10 flex flex-col items-center gap-6 text-center">
          <h1 className="font-brand text-5xl md:text-7xl font-extrabold text-gradient-violet">
            音律奇境
          </h1>
          <p className="font-inter text-lg md:text-xl text-ash-whisper">
            在游戏中探索乐理的奥秘
          </p>
          <button
            onClick={scrollToModes}
            className="bg-deep-violet text-ghost-white rounded-btn px-8 py-3 hover:scale-105 transition-transform glow-violet font-inter font-semibold text-base"
          >
            开始探索
          </button>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-2">
          <span className="bg-deep-violet text-ghost-white text-sm font-brand font-bold px-3 py-1 rounded-badge">
            Lv.{level}
          </span>
          <div className="flex-1 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-midnight-void border border-slate-echo/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-deep-violet transition-all duration-500"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <span className="text-ash-whisper text-sm font-inter whitespace-nowrap">
              {xp} / {xpNeeded} XP
            </span>
          </div>
        </div>
      </section>

      <section id="mode-selection" className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modes.map((mode, index) => {
            const Icon = mode.icon;
            return (
              <div
                key={mode.route}
                onClick={() => navigate(mode.route)}
                className="bg-ghost-white rounded-card p-4 md:p-6 cursor-pointer border-2 border-transparent hover:border-deep-violet transition-all animate-slide-in"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-badge bg-deep-violet/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-deep-violet" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-brand text-base md:text-lg font-bold text-midnight-void mb-1">
                      {mode.title}
                    </h3>
                    <p className="font-inter text-sm text-slate-echo mb-2">
                      {mode.description}
                    </p>
                    <span className="inline-block text-xs font-inter font-semibold text-deep-violet bg-deep-violet/10 px-2 py-0.5 rounded-badge">
                      {mode.getStat(state)}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-echo flex-shrink-0 mt-1" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-6 safe-bottom pb-16 md:pb-12">
        <button
          onClick={() => navigate('/encyclopedia')}
          className="flex items-center gap-2 text-ash-whisper hover:text-lavender-haze transition-colors font-inter text-sm mx-auto"
        >
          <BookOpen className="w-4 h-4" />
          <span>乐理百科</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
}
