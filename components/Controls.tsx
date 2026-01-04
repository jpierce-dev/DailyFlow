import React, { useRef } from 'react';
import { SubtitleMode } from '../types';

interface ControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    subtitleMode: SubtitleMode;
    onToggleSubtitle: () => void;
    isAudioLoading: boolean;
    onComplete: () => void;
    hasContent: boolean;
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
}

const Controls: React.FC<ControlsProps> = ({
    isPlaying,
    onPlayPause,
    subtitleMode,
    onToggleSubtitle,
    isAudioLoading,
    onComplete,
    hasContent,
    currentTime,
    duration,
    onSeek
}) => {
    const progressBarRef = useRef<HTMLInputElement>(null);

    if (!hasContent) return null;

    const getSubtitleText = () => {
        switch (subtitleMode) {
            case SubtitleMode.HIDDEN: return 'No Subs';
            case SubtitleMode.ENGLISH: return 'English';
            case SubtitleMode.BILINGUAL: return 'Bilingual';
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        onSeek(time);
    };

    // Calculate percentage for gradient background of slider
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#050505] border-t border-white/10 animate-slide-up pb-[env(safe-area-inset-bottom)]">

            {/* Progress Bar (Absolute Top) */}
            <div className="absolute -top-1.5 left-0 right-0 h-3 group cursor-pointer">
                {/* Track */}
                <div className="absolute top-1.5 left-0 right-0 h-0.5 bg-white/10 w-full"></div>
                {/* Native Range Input (Invisible but interactive) */}
                <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeekChange}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                />
                {/* Custom Progress Visuals */}
                <div
                    className="absolute top-1.5 left-0 h-0.5 bg-cube-accent pointer-events-none transition-all duration-100 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                >
                    {/* Thumb/Handle */}
                    <div className="absolute right-0 -top-[5px] w-3 h-3 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform"></div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-3 md:px-6 h-24 flex items-center justify-between gap-2 md:gap-4">

                {/* Play/Pause */}
                <button
                    onClick={onPlayPause}
                    disabled={isAudioLoading}
                    className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 ${isAudioLoading
                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                        : 'bg-white text-black'
                        }`}
                >
                    {isAudioLoading ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : isPlaying ? (
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    ) : (
                        <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    )}
                </button>

                {/* Time Info */}
                <div className="text-[10px] md:text-xs font-mono text-cube-text-muted w-24 md:w-20 text-center">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>

                {/* Control Group */}
                <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-1 shadow-lg backdrop-blur-md justify-center">

                    {/* Subtitle Toggle */}
                    <button
                        onClick={onToggleSubtitle}
                        className="group flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-full hover:bg-white/10 transition-all duration-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                        <span className="text-xs md:text-sm font-medium text-zinc-300 group-hover:text-white transition-colors min-w-[50px] md:min-w-[60px] text-left">
                            {getSubtitleText()}
                        </span>
                    </button>

                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    {/* Done Button */}
                    <button
                        onClick={onComplete}
                        className="group flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-full hover:bg-cube-accent text-zinc-300 hover:text-white transition-all duration-200"
                    >
                        <span className="text-xs md:text-sm font-medium">Done</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 group-hover:scale-110 transition-transform">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Controls;