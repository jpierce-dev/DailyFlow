import { useState, useRef, useEffect, useCallback } from 'react';

export interface AudioPlayerState {
    isPlaying: boolean;
    isLoading: boolean;
    duration: number;
    currentTime: number; // Add currentTime to state for UI sync if needed, though we mainly use getter
}

export const useAudioPlayer = () => {
    const [state, setState] = useState<AudioPlayerState>({
        isPlaying: false,
        isLoading: false,
        duration: 0,
        currentTime: 0,
    });

    const contextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const bufferRef = useRef<AudioBuffer | null>(null);

    // Track timing accurately
    const startTimeRef = useRef<number>(0);
    const pauseTimeRef = useRef<number>(0);

    const getContext = () => {
        if (!contextRef.current) {
            contextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return contextRef.current;
    };

    const loadAudio = useCallback(async (base64: string) => {
        setState(prev => ({ ...prev, isLoading: true }));
        try {
            const ctx = getContext();

            // Decode base64
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const sampleRate = 24000;
            const dataInt16 = new Int16Array(bytes.buffer);
            const audioBuffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < dataInt16.length; i++) {
                channelData[i] = dataInt16[i] / 32768.0;
            }

            bufferRef.current = audioBuffer;
            pauseTimeRef.current = 0;

            setState(prev => ({
                ...prev,
                isLoading: false,
                duration: audioBuffer.duration,
                currentTime: 0
            }));

        } catch (error) {
            console.error("Audio load error:", error);
            setState(prev => ({ ...prev, isLoading: false }));
            throw error;
        }
    }, []);

    const playAudioSource = (offset: number, onEnded?: () => void) => {
        const ctx = getContext();
        if (!bufferRef.current) return;

        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch (e) { }
        }

        const source = ctx.createBufferSource();
        source.buffer = bufferRef.current;
        source.connect(ctx.destination);

        source.start(0, offset);
        startTimeRef.current = ctx.currentTime - offset;
        sourceRef.current = source;

        source.onended = () => {
            const elapsed = ctx.currentTime - startTimeRef.current;
            const duration = bufferRef.current?.duration || 0;
            // Natural finish check
            if (Math.abs(elapsed - duration) < 0.2) {
                pauseTimeRef.current = 0;
                setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
                if (onEnded) onEnded();
            }
        };
    };

    const play = useCallback((onEnded?: () => void) => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const offset = pauseTimeRef.current % (bufferRef.current?.duration || 1);
        playAudioSource(offset, onEnded);

        setState(prev => ({ ...prev, isPlaying: true }));
    }, []);

    const pause = useCallback(() => {
        const ctx = getContext();
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch (e) { }
            sourceRef.current = null;
        }

        if (state.isPlaying) {
            pauseTimeRef.current = ctx.currentTime - startTimeRef.current;
        }

        setState(prev => ({ ...prev, isPlaying: false }));
    }, [state.isPlaying]);

    const stop = useCallback(() => {
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch (e) { }
            sourceRef.current = null;
        }
        pauseTimeRef.current = 0;
        setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    }, []);

    const reset = useCallback(() => {
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch (e) { }
            sourceRef.current = null;
        }
        bufferRef.current = null;
        pauseTimeRef.current = 0;
        startTimeRef.current = 0;
        setState({
            isPlaying: false,
            isLoading: false,
            duration: 0,
            currentTime: 0,
        });
    }, []);

    const seek = useCallback((time: number, onEnded?: () => void) => {
        const ctx = getContext();
        const safeTime = Math.max(0, Math.min(time, bufferRef.current?.duration || 0));

        pauseTimeRef.current = safeTime;

        if (state.isPlaying) {
            playAudioSource(safeTime, onEnded);
            // State remains playing
        } else {
            // Just update the visual state/internal ref
            setState(prev => ({ ...prev, currentTime: safeTime }));
        }
    }, [state.isPlaying]);

    const getCurrentTime = useCallback(() => {
        const ctx = contextRef.current;
        if (!ctx) return 0;

        if (state.isPlaying) {
            return ctx.currentTime - startTimeRef.current;
        }
        return pauseTimeRef.current;
    }, [state.isPlaying]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (sourceRef.current) {
                try { sourceRef.current.stop(); } catch (e) { }
            }
            if (contextRef.current) contextRef.current.close();
        };
    }, []);

    return {
        ...state,
        loadAudio,
        play,
        pause,
        stop,
        seek,
        reset,
        getCurrentTime,
        getDuration: () => bufferRef.current?.duration || 0
    };
};