import React, { useState, useEffect, useRef, useCallback } from 'react';
import Controls from './components/Controls';
import Transcript from './components/Transcript';
import HistoryDrawer from './components/HistoryDrawer';
import { generateDailyScript, generateAudioFromScript } from './services/gemini';
import { saveAudioToCache, getAudioFromCache, deleteAudioFromCache } from './services/audioCache';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { ScriptData, SubtitleMode, VocabularyItem, SavedVocabularyItem } from './types';
import {
  signInWithGoogle,
  logout,
  subscribeToAuthChanges,
  subscribeToHistory,
  saveScriptToCloud,
  deleteScriptFromCloud,
  saveWordToCloud,
  deleteWordFromCloud,
  subscribeToVocabulary
} from './services/firebase';

import confetti from 'canvas-confetti';

const App: React.FC = () => {
  const [script, setScript] = useState<ScriptData | null>(null);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>(SubtitleMode.HIDDEN);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string>('Intermediate');

  // Audio Hook
  const {
    isPlaying,
    isLoading: isAudioLoading,
    duration,
    loadAudio,
    play,
    pause,
    stop,
    seek,
    getCurrentTime,
    reset
  } = useAudioPlayer();

  // Local state to track API generation phase (before audio is decoded)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // Ref to track the currently active script ID to prevent audio race conditions
  const currentScriptIdRef = useRef<string | null>(null);



  // Highlighting State
  const [uiCurrentTime, setUiCurrentTime] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  const [activeLineId, setActiveLineId] = useState<number | null>(null);
  const [lineTimings, setLineTimings] = useState<{ id: number, start: number, end: number }[]>([]);

  // Auth & Data State
  const [user, setUser] = useState<any | null>(null);
  const [history, setHistory] = useState<ScriptData[]>([]);
  const [vocabulary, setVocabulary] = useState<SavedVocabularyItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);



  // Initialize Auth
  useEffect(() => {
    const unsubscribeAuth = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser);
    });

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      unsubscribeAuth();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!script) return;
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [script, isPlaying, isAudioLoading, isGeneratingAudio]);

  // Main Animation Loop: Updates Only When Line Changes
  useEffect(() => {
    const updateLoop = () => {
      const t = getCurrentTime();

      // Determine active line
      if (lineTimings.length > 0) {
        const active = lineTimings.find(l => t >= l.start && t < l.end);

        // ONLY update state if line changed (or at start/end)
        // This makes the progress bar "jump" after each line, which is what the user asked for.
        if (active && active.id !== activeLineId) {
          setActiveLineId(active.id);
          setUiCurrentTime(t); // Update progress bar to jump to current time
        } else if (!active && t >= duration - 0.1 && activeLineId !== null) {
          setActiveLineId(null);
          setUiCurrentTime(duration);
        }
      }

      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(updateLoop);
      }
    };

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updateLoop);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, lineTimings, duration, getCurrentTime, activeLineId]);


  const getStorageUid = (currentUser: any) => {
    if (!currentUser) return null;
    if (currentUser.isAnonymous) return 'shared_testing_guest_v1';
    return currentUser.uid;
  };

  const sanitizeScriptData = (data: ScriptData): ScriptData => {
    return {
      id: data.id,
      timestamp: data.timestamp,
      title: data.title,
      context: data.context,
      difficulty: data.difficulty,
      lines: data.lines.map(line => ({
        id: line.id,
        speaker: line.speaker,
        english: line.english,
        chinese: line.chinese,
        sentiment: line.sentiment
      }))
    };
  };

  // Sync Logic
  // Changed dependency to user.uid to ensure strict updates on login/switch
  useEffect(() => {
    let unsubscribeHistory: (() => void) | undefined;
    let unsubscribeVocabulary: (() => void) | undefined;

    if (user) {
      const storageUid = getStorageUid(user);

      // Migration Logic
      const localData = localStorage.getItem('dailyflow_history');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          if (parsed.length > 0 && storageUid) {
            parsed.forEach((item: ScriptData) => saveScriptToCloud(storageUid, sanitizeScriptData(item)));
            localStorage.removeItem('dailyflow_history');
          }
        } catch (e) { }
      }
      const localVocab = localStorage.getItem('dailyflow_vocabulary');
      if (localVocab) {
        try {
          const parsed = JSON.parse(localVocab);
          if (parsed.length > 0 && storageUid) {
            parsed.forEach((item: SavedVocabularyItem) => saveWordToCloud(storageUid, item));
            localStorage.removeItem('dailyflow_vocabulary');
          }
        } catch (e) { }
      }

      if (storageUid) {
        unsubscribeHistory = subscribeToHistory(storageUid, (newHistory) => {
          setHistory(newHistory);
        });
        unsubscribeVocabulary = subscribeToVocabulary(storageUid, setVocabulary);
      }
    } else {
      // Local Mode
      try { setHistory(JSON.parse(localStorage.getItem('dailyflow_history') || '[]')); } catch (e) { setHistory([]); }
      try { setVocabulary(JSON.parse(localStorage.getItem('dailyflow_vocabulary') || '[]')); } catch (e) { setVocabulary([]); }
    }

    return () => {
      if (unsubscribeHistory) unsubscribeHistory();
      if (unsubscribeVocabulary) unsubscribeVocabulary();
    };
  }, [user?.uid, user?.isAnonymous]); // Explicit dependencies on ID

  const saveToHistory = (item: ScriptData) => {
    const cleanItem = sanitizeScriptData(item);
    if (history.find(h => h.id === cleanItem.id)) return;

    if (user) {
      const storageUid = getStorageUid(user);
      if (storageUid) saveScriptToCloud(storageUid, cleanItem);
    } else {
      const newHistory = [cleanItem, ...history];
      setHistory(newHistory);
      localStorage.setItem('dailyflow_history', JSON.stringify(newHistory));
    }
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAudioFromCache(id);

    if (user) {
      const storageUid = getStorageUid(user);
      if (storageUid) deleteScriptFromCloud(storageUid, id);
    } else {
      const newHistory = history.filter(h => h.id !== id);
      setHistory(newHistory);
      localStorage.setItem('dailyflow_history', JSON.stringify(newHistory));
    }

    if (script?.id === id) {
      handleStopSession();
    }
  };

  const handleStopSession = () => {
    currentScriptIdRef.current = null; // Invalidate current session
    setScript(null);
    stop();
    reset(); // Clear audio buffer
    setActiveLineId(null);
    setUiCurrentTime(0);
    setIsGeneratingAudio(false);
  }

  const handleSaveWord = useCallback((item: VocabularyItem, context: string) => {
    const savedItem: SavedVocabularyItem = {
      ...item,
      id: item.word.toLowerCase().trim(),
      timestamp: Date.now(),
      contextSentence: context
    };
    if (user) {
      const storageUid = getStorageUid(user);
      if (storageUid) saveWordToCloud(storageUid, savedItem);
    } else {
      // Functional state update to avoid dependency on 'vocabulary'
      setVocabulary(prev => {
        if (prev.some(v => v.word.toLowerCase() === savedItem.word.toLowerCase())) return prev;
        const newVocab = [savedItem, ...prev];
        localStorage.setItem('dailyflow_vocabulary', JSON.stringify(newVocab));
        return newVocab;
      });
    }
  }, [user]);

  const handleDeleteWord = useCallback((word: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (user) {
      const storageUid = getStorageUid(user);
      if (storageUid) deleteWordFromCloud(storageUid, word);
    } else {
      setVocabulary(prev => {
        const newVocab = prev.filter(v => v.word.toLowerCase() !== word.toLowerCase());
        localStorage.setItem('dailyflow_vocabulary', JSON.stringify(newVocab));
        return newVocab;
      });
    }
  }, [user]);

  // Re-calculate timings with heuristic logic
  useEffect(() => {
    if (script && duration > 0) {
      calculateTimings(script, duration);
    }
  }, [duration, script]);

  const calculateTimings = (currentScript: ScriptData, dur: number) => {
    const linesWithWeight = currentScript.lines.map(line => ({
      ...line,
      weight: line.english.length + 10
    }));

    const totalWeight = linesWithWeight.reduce((acc, l) => acc + l.weight, 0);

    let currentTime = 0;
    const timings = linesWithWeight.map(line => {
      const lineDuration = (line.weight / totalWeight) * dur;
      const start = currentTime;
      const end = currentTime + lineDuration;
      currentTime = end;
      return { id: line.id, start, end };
    });
    setLineTimings(timings);
  };

  const loadAudioForScript = async (lines: any[], targetScript: ScriptData) => {
    setIsGeneratingAudio(true);

    try {
      // RACE CONDITION CHECK 1: Before Async
      if (currentScriptIdRef.current !== targetScript.id) return;

      let audioBase64 = await getAudioFromCache(targetScript.id);

      // RACE CONDITION CHECK 2: After Cache Fetch
      if (currentScriptIdRef.current !== targetScript.id) return;

      if (!audioBase64) {
        console.log("Audio cache miss, generating...");
        audioBase64 = await generateAudioFromScript(lines);

        // RACE CONDITION CHECK 3: After API Generation
        if (currentScriptIdRef.current !== targetScript.id) return;

        if (audioBase64) await saveAudioToCache(targetScript.id, audioBase64);
      }

      // RACE CONDITION CHECK 4: Before Loading into Player
      if (currentScriptIdRef.current !== targetScript.id) return;

      if (audioBase64) {
        await loadAudio(audioBase64);
        setIsGeneratingAudio(false);
      }
    } catch (e) {
      // Only log error if we are still on the same script
      if (currentScriptIdRef.current === targetScript.id) {
        console.error("Audio error", e);
        // Do NOT unset isGeneratingAudio here to maintain infinite loading on error
      }
    }
  };

  const handleGenerate = async () => {
    if (!user) {
      setError("Please sign in to start a session.");
      return;
    }
    setIsLoading(true);
    setError(null);
    if (isPlaying) pause();
    reset(); // Clear previous audio immediately
    currentScriptIdRef.current = null; // Invalidate audio loading for previous

    setActiveLineId(null);
    setUiCurrentTime(0);
    setIsGeneratingAudio(false);

    try {
      const newScriptData = await generateDailyScript(difficulty);
      const newScript: ScriptData = {
        ...newScriptData,
        id: Date.now().toString(),
        timestamp: Date.now()
      };

      setScript(newScript);
      currentScriptIdRef.current = newScript.id; // Set new active ID

      setSubtitleMode(SubtitleMode.HIDDEN);
      setIsLoading(false);

      await loadAudioForScript(newScript.lines, newScript);
    } catch (err: any) {
      setError("Failed to load lesson. Please check API key/quota.");
      setIsLoading(false);
    }
  };

  const handleSelectHistory = (item: ScriptData) => {
    if (script?.id === item.id) {
      setIsHistoryOpen(false);
      return;
    }
    stop();
    reset(); // Clear previous audio
    currentScriptIdRef.current = item.id; // Set new active ID right away to block previous loads

    setActiveLineId(null);
    setUiCurrentTime(0);
    setIsGeneratingAudio(false);

    setScript(item);
    setSubtitleMode(SubtitleMode.BILINGUAL);
    setIsHistoryOpen(false);

    loadAudioForScript(item.lines, item);
  };

  const handleComplete = () => {
    if (script) {
      saveToHistory(script);
      try {
        if (typeof confetti === 'function') {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#3B82F6', '#ffffff', '#22c55e']
          });
        }
      } catch (e) { }
    }
    stop();
    setScript(null);
    currentScriptIdRef.current = null;
    setActiveLineId(null);
    setUiCurrentTime(0);
    setIsGeneratingAudio(false);
  };

  const handlePlayPause = () => {
    if (isAudioLoading || isGeneratingAudio) return;
    if (isPlaying) {
      pause();
    } else {
      play(() => setActiveLineId(null));
    }
  };

  // Wrap handleSeek in useCallback as well since it's a dependency
  const handleSeek = useCallback((time: number) => {
    seek(time, () => setActiveLineId(null));
    setUiCurrentTime(time); // Update UI immediately on seek
  }, [seek]);

  const handleLineJump = useCallback((lineId: number) => {
    const timing = lineTimings.find(t => t.id === lineId);
    if (timing) {
      handleSeek(timing.start);
      setActiveLineId(lineId);
    }
  }, [lineTimings, handleSeek, setActiveLineId]);

  const toggleSubtitles = useCallback(() => {
    setSubtitleMode(prev => {
      if (prev === SubtitleMode.HIDDEN) return SubtitleMode.ENGLISH;
      if (prev === SubtitleMode.ENGLISH) return SubtitleMode.BILINGUAL;
      return SubtitleMode.HIDDEN;
    });
  }, [setSubtitleMode]);

  const handleLogin = useCallback(async () => {
    try { setError(null); await signInWithGoogle(); } catch (err: any) { setError(err.message || "Failed to sign in"); }
  }, [signInWithGoogle]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  return (
    <div className="min-h-screen bg-cube-black text-gray-100 font-sans selection:bg-cube-accent selection:text-white overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>
      </div>

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        vocabulary={vocabulary}
        onSelectHistory={handleSelectHistory}
        onDeleteHistory={deleteFromHistory}
        onDeleteWord={handleDeleteWord}
      />

      <div className={`relative z-10 flex flex-col min-h-screen transition-transform duration-300 ${isHistoryOpen ? '-translate-x-4 opacity-50' : ''}`}>

        {/* Header */}
        <header className="px-6 py-6 md:px-12 flex justify-between items-center border-b border-white/5 bg-cube-black/50 backdrop-blur-sm sticky top-0 z-20">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-white">DailyFlow</h1>
          </div>
          <div className="flex items-center space-x-4">
            {script && (
              <div className="hidden md:block text-right mr-4">
                <div className="text-[10px] uppercase tracking-widest text-cube-text-muted">Current Mode</div>
                <div className={`font-mono text-sm ${script.difficulty === 'Advanced' ? 'text-purple-400' : script.difficulty === 'Beginner' ? 'text-green-400' : 'text-cube-accent'}`}>
                  {script.difficulty}
                </div>
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-white/20" title={user.displayName} />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-700 to-green-600 border border-white/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                )}
                <button onClick={logout} className="text-xs text-cube-text-muted hover:text-white transition-colors">Log Out</button>
              </div>
            ) : (
              <button onClick={handleLogin} className="flex items-center space-x-2 text-sm font-display text-white bg-white/10 hover:bg-white/20 transition-colors px-3 py-2 rounded-lg">
                <span>Sign In</span>
              </button>
            )}



            <button onClick={() => setIsHistoryOpen(true)} className="flex items-center space-x-2 text-sm font-display hover:text-white text-cube-text-muted transition-colors px-3 py-2 rounded-lg hover:bg-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="hidden md:inline">Dashboard</span>
            </button>

            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="flex items-center space-x-2 text-sm font-display text-white bg-cube-accent/20 hover:bg-cube-accent/40 border border-cube-accent/30 transition-all px-3 py-2 rounded-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                <span className="hidden md:inline">Install App</span>
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 pb-32">
          {error && (
            <div className="bg-red-900/20 border border-red-500/50 text-red-200 px-6 py-4 rounded-lg mb-8 max-w-md text-center">
              <span className="font-bold block mb-1">Error</span>
              {error}
              <button onClick={() => setError(null)} className="block w-full mt-4 bg-red-800/50 hover:bg-red-800 py-1 rounded text-xs uppercase">Dismiss</button>
            </div>
          )}

          {!script && !isLoading && !error && (
            <div className="text-center space-y-6 max-w-lg animate-fade-in">
              <div className="inline-block p-5 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 mb-4 shadow-2xl border border-white/5">
                <svg className="w-10 h-10 text-cube-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
              </div>
              <h2 className="text-3xl font-display font-medium text-white">Daily Immersion</h2>
              <p className="text-cube-text-muted text-lg font-light leading-relaxed">
                Generate a unique conversation scene. <br />
                Listen blindly, define words, and master the flow of English.
              </p>

              <div className="my-8">
                <div className="inline-flex items-center bg-white/5 p-1.5 rounded-full border border-white/5 backdrop-blur-sm">
                  {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`px-6 py-2 rounded-full text-sm font-display font-medium transition-all duration-300 ${difficulty === level ? 'bg-white text-black shadow-lg scale-105' : 'text-zinc-400 hover:text-white'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={user ? handleGenerate : handleLogin}
                className={`group relative inline-flex items-center justify-center px-8 py-4 font-display font-bold text-white transition-all duration-200 rounded-full offset-black ${!user ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-cube-accent hover:bg-blue-600'}`}
              >
                {user && <span className="absolute w-full h-full rounded-full opacity-0 group-hover:opacity-20 bg-white animate-ping"></span>}
                <span>{user ? 'Start Session' : 'Sign in to Start'}</span>
              </button>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center space-y-4 animate-pulse">
              <div className="w-16 h-16 border-4 border-cube-accent border-t-transparent rounded-full animate-spin"></div>
              <p className="text-lg font-display tracking-wide">Writing script...</p>
              <div className="text-sm text-cube-text-muted flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cube-accent"></span>
                <span>Target Level: {difficulty}</span>
              </div>
            </div>
          )}

          {script && !isLoading && (
            <div className="w-full max-w-3xl animate-fade-in">
              <div className="mb-10 text-center">
                <div className="flex justify-center gap-2 mb-4">
                  <span className="inline-block px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] uppercase tracking-widest text-cube-accent">
                    {new Date(script.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 text-white leading-tight">{script.title}</h2>
                <p className="text-cube-text-muted italic text-lg font-light">"{script.context}"</p>
              </div>

              <Transcript
                lines={script.lines}
                subtitleMode={subtitleMode}
                isPlaying={isPlaying}
                activeLineId={activeLineId}
                savedWords={vocabulary}
                onSaveWord={handleSaveWord}
                onRemoveWord={handleDeleteWord}
                onLineClick={handleLineJump}
              />
            </div>
          )}
        </main>

        <Controls
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          subtitleMode={subtitleMode}
          onToggleSubtitle={toggleSubtitles}
          isAudioLoading={isAudioLoading || isGeneratingAudio}
          onComplete={handleComplete}
          hasContent={!!script}
          currentTime={uiCurrentTime}
          duration={duration}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
};

export default App;