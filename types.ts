export enum SubtitleMode {
  HIDDEN = 'HIDDEN',
  ENGLISH = 'ENGLISH',
  BILINGUAL = 'BILINGUAL',
}

export interface DialogueLine {
  id: number;
  speaker: string;
  english: string;
  chinese: string;
  sentiment: string;
}

export interface ScriptData {
  id: string; // Unique ID for history
  timestamp: number; // For sorting/display
  title: string;
  context: string;
  difficulty: string;
  lines: DialogueLine[];
}

export interface VocabularyItem {
  word: string;
  definitionEn: string;
  definitionCn: string;
  example: string;
}

export interface SavedVocabularyItem extends VocabularyItem {
  id: string;
  timestamp: number;
  contextSentence?: string;
}