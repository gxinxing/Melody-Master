import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Composition,
  GameSettings,
  NoteRunnerState,
  ChordPuzzleState,
  EarTrainingState,
} from '../types';

interface GameState {
  level: number;
  xp: number;
  noteRunner: NoteRunnerState;
  chordPuzzle: ChordPuzzleState;
  modeComposer: { compositions: Composition[] };
  earTraining: EarTrainingState;
  encyclopedia: { unlockedEntries: string[] };
  settings: GameSettings;

  addXp: (amount: number) => void;
  updateNoteRunner: (score: number, combo: number) => void;
  updateChordPuzzle: (score: number) => void;
  incrementChordPuzzleLevel: () => void;
  updateEarTraining: (correct: boolean) => void;
  setEarTrainingDifficulty: (difficulty: 'easy' | 'medium' | 'hard') => void;
  addComposition: (composition: Composition) => void;
  unlockEncyclopediaEntry: (entryId: string) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  resetProgress: () => void;
}

const initialState = {
  level: 1,
  xp: 0,
  noteRunner: { highScore: 0, bestCombo: 0, gamesPlayed: 0 },
  chordPuzzle: { highScore: 0, level: 1, gamesPlayed: 0 },
  modeComposer: { compositions: [] as Composition[] },
  earTraining: {
    streak: 0,
    bestStreak: 0,
    difficulty: 'easy' as const,
    gamesPlayed: 0,
  },
  encyclopedia: { unlockedEntries: [] as string[] },
  settings: { volume: 0.5, waveType: 'sine' as OscillatorType },
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      ...initialState,

      addXp: (amount) =>
        set((state) => {
          let { level, xp } = state;
          xp += amount;
          while (xp >= (level + 1) * 100) {
            xp -= (level + 1) * 100;
            level += 1;
          }
          return { level, xp };
        }),

      updateNoteRunner: (score, combo) =>
        set((state) => ({
          noteRunner: {
            highScore: Math.max(state.noteRunner.highScore, score),
            bestCombo: Math.max(state.noteRunner.bestCombo, combo),
            gamesPlayed: state.noteRunner.gamesPlayed + 1,
          },
        })),

      updateChordPuzzle: (score) =>
        set((state) => ({
          chordPuzzle: {
            ...state.chordPuzzle,
            highScore: Math.max(state.chordPuzzle.highScore, score),
            gamesPlayed: state.chordPuzzle.gamesPlayed + 1,
          },
        })),

      incrementChordPuzzleLevel: () =>
        set((state) => ({
          chordPuzzle: {
            ...state.chordPuzzle,
            level: state.chordPuzzle.level + 1,
          },
        })),

      updateEarTraining: (correct) =>
        set((state) => {
          const streak = correct ? state.earTraining.streak + 1 : 0;
          return {
            earTraining: {
              ...state.earTraining,
              streak,
              bestStreak: Math.max(state.earTraining.bestStreak, streak),
              gamesPlayed: state.earTraining.gamesPlayed + 1,
            },
          };
        }),

      setEarTrainingDifficulty: (difficulty) =>
        set((state) => ({
          earTraining: { ...state.earTraining, difficulty },
        })),

      addComposition: (composition) =>
        set((state) => ({
          modeComposer: {
            compositions: [...state.modeComposer.compositions, composition],
          },
        })),

      unlockEncyclopediaEntry: (entryId) =>
        set((state) => {
          if (state.encyclopedia.unlockedEntries.includes(entryId)) {
            return state;
          }
          return {
            encyclopedia: {
              unlockedEntries: [...state.encyclopedia.unlockedEntries, entryId],
            },
          };
        }),

      updateSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),

      resetProgress: () => set(initialState),
    }),
    {
      name: 'melodyquest_progress',
    },
  ),
);
