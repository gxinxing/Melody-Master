export interface NoteInfo {
  name: string;
  octave: number;
  frequency: number;
  midi: number;
}

export interface ChordInfo {
  name: string;
  symbol: string;
  intervals: number[];
  quality: 'major' | 'minor' | 'diminished' | 'augmented' | 'dominant' | 'suspended';
}

export interface ModeInfo {
  name: string;
  intervals: number[];
  mood: string;
}

export const NOTE_NAMES: string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

export const NOTE_FREQUENCIES: Map<string, number> = new Map();

for (let midi = 48; midi <= 83; midi++) {
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const noteName = `${NOTE_NAMES[noteIndex]}${octave}`;
  NOTE_FREQUENCIES.set(noteName, frequency);
}

export const CHORD_TYPES: ChordInfo[] = [
  { name: 'Major', symbol: 'maj', intervals: [0, 4, 7], quality: 'major' },
  { name: 'Minor', symbol: 'min', intervals: [0, 3, 7], quality: 'minor' },
  { name: 'Diminished', symbol: 'dim', intervals: [0, 3, 6], quality: 'diminished' },
  { name: 'Augmented', symbol: 'aug', intervals: [0, 4, 8], quality: 'augmented' },
  { name: 'Dominant 7th', symbol: '7', intervals: [0, 4, 7, 10], quality: 'dominant' },
  { name: 'Major 7th', symbol: 'maj7', intervals: [0, 4, 7, 11], quality: 'major' },
  { name: 'Minor 7th', symbol: 'min7', intervals: [0, 3, 7, 10], quality: 'minor' },
  { name: 'Suspended 2nd', symbol: 'sus2', intervals: [0, 2, 7], quality: 'suspended' },
  { name: 'Suspended 4th', symbol: 'sus4', intervals: [0, 5, 7], quality: 'suspended' },
];

export const MODES: ModeInfo[] = [
  { name: 'Ionian', intervals: [2, 2, 1, 2, 2, 2, 1], mood: 'happy' },
  { name: 'Dorian', intervals: [2, 1, 2, 2, 2, 1, 2], mood: 'jazzy' },
  { name: 'Phrygian', intervals: [1, 2, 2, 2, 1, 2, 2], mood: 'dark' },
  { name: 'Lydian', intervals: [2, 2, 2, 1, 2, 2, 1], mood: 'dreamy' },
  { name: 'Mixolydian', intervals: [2, 2, 1, 2, 2, 1, 2], mood: 'bluesy' },
  { name: 'Aeolian', intervals: [2, 1, 2, 2, 1, 2, 2], mood: 'sad' },
  { name: 'Locrian', intervals: [1, 2, 2, 1, 2, 2, 2], mood: 'tense' },
];

export const INTERVAL_NAMES: Map<number, string> = new Map([
  [0, 'Unison'],
  [1, 'Minor 2nd'],
  [2, 'Major 2nd'],
  [3, 'Minor 3rd'],
  [4, 'Major 3rd'],
  [5, 'Perfect 4th'],
  [6, 'Tritone'],
  [7, 'Perfect 5th'],
  [8, 'Minor 6th'],
  [9, 'Major 6th'],
  [10, 'Minor 7th'],
  [11, 'Major 7th'],
  [12, 'Octave'],
]);

export function noteNameToIndex(name: string): number {
  const index = NOTE_NAMES.indexOf(name);
  if (index === -1) {
    throw new Error(`Invalid note name: ${name}`);
  }
  return index;
}

export function getMidiNumber(noteName: string, octave: number): number {
  const noteIndex = noteNameToIndex(noteName);
  return (octave + 1) * 12 + noteIndex;
}

export function getFrequency(noteName: string, octave: number): number {
  const midi = getMidiNumber(noteName, octave);
  return 440 * Math.pow(2, (midi - 69) / 12);
}
