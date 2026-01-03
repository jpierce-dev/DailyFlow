import React, { useState } from 'react';
import { ScriptData, SavedVocabularyItem } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: ScriptData[];
  vocabulary: SavedVocabularyItem[];
  onSelectHistory: (item: ScriptData) => void;
  onDeleteHistory: (id: string, e: React.MouseEvent) => void;
  onDeleteWord: (word: string, e: React.MouseEvent) => void;
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ 
    isOpen, 
    onClose, 
    history, 
    vocabulary, 
    onSelectHistory, 
    onDeleteHistory,
    onDeleteWord
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'vocabulary'>('history');

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-full sm:w-[28rem] bg-[#0A0A0A] border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/40">
            <div className="flex space-x-6">
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`text-lg font-display font-bold transition-colors ${activeTab === 'history' ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                >
                    History
                </button>
                <button 
                    onClick={() => setActiveTab('vocabulary')}
                    className={`text-lg font-display font-bold transition-colors ${activeTab === 'vocabulary' ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                >
                    Word Bank
                </button>
            </div>
          
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          
          {/* HISTORY TAB */}
          {activeTab === 'history' && (
              <>
                {history.length === 0 ? (
                    <div className="text-center text-cube-text-muted mt-10">
                    <p>No history yet.</p>
                    <p className="text-sm">Complete a session to save it here.</p>
                    </div>
                ) : (
                    history.map((item) => (
                    <div 
                        key={item.id} 
                        onClick={() => onSelectHistory(item)}
                        className="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cube-accent/50 rounded-xl p-4 cursor-pointer transition-all"
                    >
                        <div className="flex justify-between items-start mb-1">
                        <h3 className="font-display font-medium text-white group-hover:text-cube-accent transition-colors truncate pr-6">
                            {item.title}
                        </h3>
                        <button
                            onClick={(e) => onDeleteHistory(item.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-white/40 transition-all absolute top-3 right-3"
                            title="Delete"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                        </button>
                        </div>
                        <p className="text-sm text-cube-text-muted line-clamp-2 mb-2">{item.context}</p>
                        <div className="flex items-center justify-between text-xs text-white/30 uppercase tracking-wider">
                        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                        <span className={`px-2 py-0.5 rounded ${item.difficulty === 'Advanced' ? 'bg-purple-500/20 text-purple-300' : 'bg-green-500/20 text-green-300'}`}>
                            {item.difficulty}
                        </span>
                        </div>
                    </div>
                    ))
                )}
              </>
          )}

          {/* VOCABULARY TAB */}
          {activeTab === 'vocabulary' && (
              <>
                {vocabulary.length === 0 ? (
                    <div className="text-center text-cube-text-muted mt-10">
                    <p>No words saved.</p>
                    <p className="text-sm">Tap words in the transcript to define and save them.</p>
                    </div>
                ) : (
                    vocabulary.map((item) => (
                    <div 
                        key={item.id} 
                        className="group relative bg-white/5 border border-white/5 rounded-xl p-4 transition-all hover:bg-white/10"
                    >
                        <div className="flex justify-between items-start">
                             <div className="mb-2">
                                <h3 className="text-xl font-display font-bold text-cube-accent capitalize inline-block mr-2">{item.word}</h3>
                             </div>
                             <button
                                onClick={(e) => onDeleteWord(item.word, e)}
                                className="p-1 hover:text-red-400 text-white/40 transition-colors"
                                title="Remove from Word Bank"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                             <div>
                                 <p className="text-sm text-gray-300 italic">{item.definitionEn}</p>
                                 <p className="text-sm text-white font-medium">{item.definitionCn}</p>
                             </div>
                             {item.example && (
                                <div className="text-xs text-cube-text-muted border-l-2 border-white/10 pl-2 mt-2">
                                    "{item.example}"
                                </div>
                             )}
                        </div>
                        
                    </div>
                    ))
                )}
              </>
          )}

        </div>
      </div>
    </>
  );
};

export default HistoryDrawer;