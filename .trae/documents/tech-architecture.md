## 1. 架构设计

```mermaid
flowchart TD
    "前端 React SPA" --> "Web Audio API 音频引擎"
    "前端 React SPA" --> "localStorage 进度存储"
    "前端 React SPA" --> "Canvas/CSS 动画渲染"
    "Web Audio API 音频引擎" --> "OscillatorNode 音符合成"
    "Web Audio API 音频引擎" --> "GainNode 音量控制"
    "Web Audio API 音频引擎" --> "AnalyserNode 音频分析"
    "localStorage 进度存储" --> "游戏进度数据"
    "localStorage 进度存储" --> "乐理百科解锁状态"
    "localStorage 进度存储" --> "用户设置"
```

## 2. 技术说明
- **前端**：React@18 + TypeScript + Tailwind CSS@3 + Vite
- **初始化工具**：vite-init (react-ts 模板)
- **后端**：无（纯前端应用）
- **数据库**：localStorage（进度持久化）
- **音频**：Web Audio API（实时音频合成）
- **状态管理**：Zustand
- **路由**：React Router DOM
- **图标**：lucide-react

## 3. 路由定义
| 路由 | 用途 |
|------|------|
| `/` | 主页面 - 游戏入口、模式选择、进度总览 |
| `/note-runner` | 音符跑酷 - 节奏打击游戏 |
| `/chord-puzzle` | 和弦拼图 - 选项消消乐 |
| `/mode-composer` | 调式作曲 - 情绪创作+AI评分 |
| `/ear-training` | 听力挑战 - 听音辨别 |
| `/encyclopedia` | 乐理百科 - 词条系统 |

## 4. 核心模块设计

### 4.1 音频引擎 (AudioEngine)
- 单例模式，全局共享 AudioContext
- `playNote(frequency, duration, type)` - 播放单个音符
- `playChord(frequencies, duration)` - 播放和弦
- `playInterval(rootFreq, intervalSemitones)` - 播放音程
- `playScale(rootFreq, mode)` - 播放音阶/调式
- 支持波形类型：sine, triangle, square, sawtooth
- ADSR包络控制音色

### 4.2 钢琴键盘组件 (PianoKeyboard)
- 2个八度（C3-B4）可交互键盘
- 白键/黑键正确比例渲染
- 点击/触摸播放对应音符
- 高亮模式：标记当前音符/和弦
- 响应式：桌面端完整显示，移动端可滚动

### 4.3 游戏状态管理 (Zustand Store)
```typescript
interface GameState {
  level: number;
  xp: number;
  noteRunner: { highScore: number; unlocked: boolean; bestCombo: number };
  chordPuzzle: { highScore: number; unlocked: boolean; level: number };
  modeComposer: { compositions: Composition[]; unlocked: boolean };
  earTraining: { streak: number; bestStreak: number; unlocked: boolean; difficulty: 'easy' | 'medium' | 'hard' };
  encyclopedia: { unlockedEntries: string[] };
}
```

### 4.4 乐理数据模型
```typescript
interface NoteInfo {
  name: string;
  frequency: number;
  midiNumber: number;
  octave: number;
}

interface ChordInfo {
  name: string;
  symbol: string;
  intervals: number[];
  quality: 'major' | 'minor' | 'diminished' | 'augmented' | 'dominant7' | 'major7' | 'minor7';
}

interface ModeInfo {
  name: string;
  intervals: number[];
  mood: string;
  rootNote: string;
}

interface EncyclopediaEntry {
  id: string;
  title: string;
  category: 'note' | 'interval' | 'chord' | 'scale' | 'rhythm' | 'mode';
  description: string;
  animationType: string;
  relatedGames: string[];
}
```

## 5. 数据模型

### 5.1 localStorage 数据结构
```json
{
  "melodyquest_progress": {
    "level": 1,
    "xp": 0,
    "noteRunner": { "highScore": 0, "bestCombo": 0 },
    "chordPuzzle": { "highScore": 0, "level": 1 },
    "modeComposer": { "compositions": [] },
    "earTraining": { "streak": 0, "bestStreak": 0, "difficulty": "easy" },
    "encyclopedia": { "unlockedEntries": ["note_basics", "interval_basics"] },
    "settings": { "volume": 0.7, "waveType": "triangle" }
  }
}
```

### 5.2 乐理常量数据
- 12个半音的频率映射（A4=440Hz基准）
- 大小调音阶的音程模式
- 常用和弦构成（三和弦、七和弦）
- 7种教会调式（Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian）
- 音程名称与半音数对照表
