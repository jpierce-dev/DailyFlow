import React, { useState, useEffect, useRef } from 'react';
import { DialogueLine, SubtitleMode, VocabularyItem, SavedVocabularyItem } from '../types';
import { getWordDefinition } from '../services/gemini';

interface TranscriptProps {
  lines: DialogueLine[];
  subtitleMode: SubtitleMode;
  isPlaying: boolean;
  activeLineId: number | null;
  savedWords: SavedVocabularyItem[];
  onSaveWord: (item: VocabularyItem, context: string) => void;
  onRemoveWord: (word: string) => void;
  onLineClick: (lineId: number) => void;
}

const Transcript: React.FC<TranscriptProps> = ({ 
    lines = [], 
    subtitleMode, 
    activeLineId,
    savedWords,
    onSaveWord,
    onRemoveWord,
    onLineClick
}) => {
  const [selectedWord, setSelectedWord] = useState<{item: VocabularyItem, context: string} | null>(null);
  const [loadingWord, setLoadingWord] = useState<string | null>(null);
  const [revealedLines, setRevealedLines] = useState<Set<number>>(new Set());
  
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      setRevealedLines(new Set());
  }, [lines, subtitleMode]);

  useEffect(() => {
    if (activeLineId && activeLineRef.current) {
        activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
            setSelectedWord(null);
            setLoadingWord(null);
        }
    };

    if (selectedWord || loadingWord) {
        document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedWord, loadingWord]);

  const handleWordClick = async (word: string, context: string) => {
    const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"");
    if (!cleanWord) return;
    
    setLoadingWord(cleanWord);
    setSelectedWord(null);
    try {
      const definition = await getWordDefinition(cleanWord, context);
      setSelectedWord({ item: definition, context: context });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWord(null);
    }
  };

  const toggleLineReveal = (id: number) => {
      if (subtitleMode !== SubtitleMode.HIDDEN) return;
      
      setRevealedLines(prev => {
          const next = new Set(prev);
          if (next.has(id)) {
              next.delete(id);
          } else {
              next.add(id);
          }
          return next;
      });
  };

  const handleLineInteraction = (lineId: number) => {
      if (subtitleMode === SubtitleMode.HIDDEN) {
          toggleLineReveal(lineId);
      } else {
          // In English/Bilingual mode, clicking line seeks to audio
          onLineClick(lineId);
      }
  };

  const renderEnglishText = (text: string, context: string, lineId: number) => {
    if (!text) return null; 
    
    // HIDDEN MODE LOGIC
    if (subtitleMode === SubtitleMode.HIDDEN && !revealedLines.has(lineId)) {
       return (
         <div className="w-full cursor-pointer py-1">
            <div className="flex flex-wrap gap-2">
                {[...Array(Math.min(text.split(' ').length, 8))].map((_, i) => (
                    <div key={i} className="h-4 bg-white/10 rounded animate-pulse" style={{ width: `${Math.random() * 40 + 30}px`}}></div>
                ))}
            </div>
            <span className="text-xs text-cube-text-muted mt-2 block opacity-0 group-hover:opacity-100 transition-opacity">
                Tap to reveal
            </span>
         </div>
       )
    }

    // REVEALED / VISIBLE LOGIC
    return (
        <span>
            {text.split(" ").map((word, idx) => (
            <span 
                key={idx} 
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    handleWordClick(word, text);
                }}
                className="cursor-pointer hover:text-cube-accent hover:underline decoration-2 underline-offset-4 transition-colors inline-block mr-1.5"
            >
                {word}
            </span>
            ))}
        </span>
    );
  };
  
  const isSaved = (word: string) => {
      return savedWords.some(w => w.word.toLowerCase() === word.toLowerCase());
  };

  const handleToggleSave = () => {
      if (!selectedWord) return;
      const word = selectedWord.item.word;
      if (isSaved(word)) {
          onRemoveWord(word);
      } else {
          onSaveWord(selectedWord.item, selectedWord.context);
      }
  };

  if (!lines) return null;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-32">
      <div className="space-y-6">
        {lines.map((line) => {
          const isActive = line.id === activeLineId;
          const isRevealed = revealedLines.has(line.id);
          
          return (
            <div 
                key={line.id} 
                ref={isActive ? activeLineRef : null}
                onClick={() => handleLineInteraction(line.id)}
                className={`group transition-all duration-300 rounded-2xl p-5 border border-transparent cursor-pointer ${
                    isActive 
                    ? 'bg-white/5 border-white/10 shadow-xl scale-[1.01]' 
                    : 'hover:bg-white/5 opacity-80 hover:opacity-100'
                }`}
            >
                <div className="flex items-start gap-4">
                    {/* Avatar / Speaker Indicator */}
                    <div className={`mt-1 flex flex-col items-center min-w-[3rem]`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-display uppercase transition-colors ${
                            isActive 
                            ? 'bg-cube-accent text-white' 
                            : 'bg-white/10 text-cube-text-muted'
                        }`}>
                            {line.speaker.slice(0, 1)}
                        </div>
                        {isActive && <div className="h-full w-0.5 bg-gradient-to-b from-cube-accent to-transparent mt-2 rounded-full opacity-50"></div>}
                    </div>

                    <div className="flex-1 min-w-0">
                         <div className="text-xs font-bold text-cube-text-muted mb-1 uppercase tracking-wider flex justify-between">
                            <span>{line.speaker}</span>
                            {/* Play Icon Hint on Hover */}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-cube-accent">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </span>
                         </div>

                        <div className={`text-lg md:text-xl font-light leading-relaxed transition-colors ${isActive ? 'text-white' : 'text-gray-300'}`}>
                            {renderEnglishText(line.english || "", line.english || "", line.id)}
                        </div>
                        
                        {(subtitleMode === SubtitleMode.BILINGUAL || (subtitleMode === SubtitleMode.HIDDEN && isRevealed)) && (
                            <div className="mt-2 text-sm text-cube-text-muted font-light animate-fade-in">
                                {line.chinese}
                            </div>
                        )}
                    </div>
                </div>
            </div>
          );
        })}
      </div>

      {/* Vocabulary Modal - Responsive: Bottom Sheet on Mobile, Popup on Desktop */}
      {(selectedWord || loadingWord) && (
        <>
            {/* Backdrop for mobile */}
            <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => { setSelectedWord(null); setLoadingWord(null); }}></div>
            
            <div 
                ref={popupRef}
                className={`
                    fixed z-50 bg-[#121212] border border-white/10 shadow-2xl backdrop-blur-xl 
                    
                    /* Mobile: Bottom Sheet */
                    bottom-0 left-0 right-0 rounded-t-2xl p-6 pb-10 animate-slide-up
                    
                    /* Desktop: Floating Popup */
                    md:bottom-32 md:right-10 md:left-auto md:w-80 md:rounded-2xl md:pb-6
                `}
            >
                {/* Mobile Drag Handle */}
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>

                {loadingWord ? (
                    <div className="flex flex-col items-center justify-center py-6 space-y-4">
                        <div className="w-8 h-8 border-2 border-cube-accent border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-cube-text-muted font-medium">Looking up "{loadingWord}"...</span>
                    </div>
                ) : selectedWord && (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-2xl font-display font-bold text-white capitalize tracking-tight">{selectedWord.item.word}</h3>
                            <button 
                                onClick={handleToggleSave}
                                className={`transition-all p-2 rounded-full ${isSaved(selectedWord.item.word) ? 'text-yellow-400 bg-yellow-400/10' : 'text-white/20 hover:text-white hover:bg-white/10'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                    <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-base text-gray-300 leading-snug">{selectedWord.item.definitionEn}</p>
                            </div>
                            <div>
                                <span className="text-xs uppercase tracking-widest text-cube-text-muted block mb-1">Meaning</span>
                                <p className="text-lg text-cube-accent font-medium">{selectedWord.item.definitionCn}</p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <span className="text-xs uppercase tracking-widest text-cube-text-muted block mb-2">Example</span>
                                <p className="text-sm text-gray-200 italic leading-relaxed">"{selectedWord.item.example}"</p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
      )}
    </div>
  );
};

export default Transcript;