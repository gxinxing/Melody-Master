export interface NoteInfo {
  name: string;
  frequency: number;
  midiNumber: number;
  octave: number;
}

export interface ChordInfo {
  name: string;
  symbol: string;
  intervals: number[];
  quality: string;
}

export interface ModeInfo {
  name: string;
  intervals: number[];
  mood: string;
}

export interface EncyclopediaEntry {
  id: string;
  title: string;
  category: 'note' | 'interval' | 'chord' | 'scale' | 'rhythm' | 'mode';
  description: string;
  animationType: string;
  relatedGames: string[];
}

export interface Composition {
  id: string;
  name: string;
  notes: { note: string; octave: number; startBeat: number; duration: number }[];
  mode: string;
  mood: string;
  score: number;
  createdAt: number;
}

export interface GameSettings {
  volume: number;
  waveType: OscillatorType;
}

export interface NoteRunnerState {
  highScore: number;
  bestCombo: number;
  gamesPlayed: number;
}

export interface ChordPuzzleState {
  highScore: number;
  level: number;
  gamesPlayed: number;
}

export interface EarTrainingState {
  streak: number;
  bestStreak: number;
  difficulty: 'easy' | 'medium' | 'hard';
  gamesPlayed: number;
}
