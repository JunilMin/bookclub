import { useState, useRef, useCallback } from 'react';

interface UseUtteranceRecorderOptions {
  /**
   * Callback when recording completes successfully
   */
  onRecordingComplete: (audioBlob: Blob, startAt: Date, endAt: Date) => void;
  /**
   * Callback when recording fails
   */
  onError?: (error: string) => void;
}

interface UseUtteranceRecorderReturn {
  /** Whether recording is currently active */
  isRecording: boolean;
  /** Recording start time */
  recordingStartTime: Date | null;
  /** Elapsed time in seconds */
  elapsedSeconds: number;
  /** Start recording */
  startRecording: () => Promise<void>;
  /** Stop recording and trigger onRecordingComplete (returns Promise that resolves when recording fully stops) */
  stopRecording: () => Promise<void>;
  /** Cancel recording without callback */
  cancelRecording: () => void;
  /** Current error message */
  error: string | null;
}

/**
 * Hook for recording audio from the user's microphone.
 * Used for capturing utterances in RULES mode.
 */
export function useUtteranceRecorder({
  onRecordingComplete,
  onError,
}: UseUtteranceRecorderOptions): UseUtteranceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<Date | null>(null);
  const timerRef = useRef<number | null>(null);
  const isCancelledRef = useRef(false);
  const stopResolveRef = useRef<(() => void) | null>(null);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async () => {
    console.log('[UtteranceRecorder] startRecording called');
    try {
      setError(null);
      isCancelledRef.current = false;

      console.log('[UtteranceRecorder] Requesting microphone access...');
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimal for Whisper
        },
      });
      console.log('[UtteranceRecorder] Microphone access granted');

      streamRef.current = stream;

      // Determine supported MIME type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let browser choose
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
      });

      chunksRef.current = [];
      startTimeRef.current = new Date();
      setRecordingStartTime(startTimeRef.current);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[UtteranceRecorder] MediaRecorder stopped');
        const endTime = new Date();

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // If cancelled, don't trigger callback
        if (isCancelledRef.current) {
          console.log('[UtteranceRecorder] Recording was cancelled, skipping callback');
          chunksRef.current = [];
          // Resolve the stop promise
          if (stopResolveRef.current) {
            stopResolveRef.current();
            stopResolveRef.current = null;
          }
          return;
        }

        // Create blob and trigger callback
        if (chunksRef.current.length > 0 && startTimeRef.current) {
          const audioBlob = new Blob(chunksRef.current, {
            type: mimeType || 'audio/webm',
          });
          console.log('[UtteranceRecorder] Recording complete, blob size:', audioBlob.size);
          onRecordingComplete(audioBlob, startTimeRef.current, endTime);
        } else {
          console.warn('[UtteranceRecorder] No audio chunks recorded');
        }

        chunksRef.current = [];

        // Resolve the stop promise
        if (stopResolveRef.current) {
          stopResolveRef.current();
          stopResolveRef.current = null;
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Capture in 1-second chunks

      // Start elapsed time counter
      setElapsedSeconds(0);
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      setIsRecording(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      onError?.(errorMessage);

      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, [onRecordingComplete, onError]);

  /**
   * Stop recording and trigger onRecordingComplete callback.
   * Returns a Promise that resolves when the recording has fully stopped
   * and the onRecordingComplete callback has been called.
   */
  const stopRecording = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        console.log('[UtteranceRecorder] stopRecording called');
        isCancelledRef.current = false;
        stopResolveRef.current = resolve;
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        setElapsedSeconds(0);
        setRecordingStartTime(null);
      } else {
        console.log('[UtteranceRecorder] stopRecording called but not recording');
        resolve();
      }
    });
  }, [isRecording]);

  /**
   * Cancel recording without triggering callback
   */
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      isCancelledRef.current = true;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setElapsedSeconds(0);
      setRecordingStartTime(null);
    }
  }, [isRecording]);

  return {
    isRecording,
    recordingStartTime,
    elapsedSeconds,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
  };
}

/**
 * Format seconds to MM:SS display
 */
export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
