import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SessionUtterance,
  UtteranceProcessingState,
  UtteranceProcessingStatus,
} from '../types/meetRoom';
import {
  getUtterances,
  uploadUtterance,
  markUtteranceInserted,
  getAutoInsertSetting,
  setAutoInsertSetting,
} from '../api/utterances';

interface UseUtterancesOptions {
  sessionId: string;
  accessToken: string | null;
  /**
   * WebSocket subscribe function from useWebSocket hook
   */
  subscribe: (topic: string, callback: (message: any) => void) => () => void;
  /**
   * Whether WebSocket is connected
   */
  isWsConnected?: boolean;
  /**
   * Callback when a new utterance should be auto-inserted to notes
   */
  onAutoInsert?: (utterance: SessionUtterance) => void;
}

interface UseUtterancesReturn {
  /** List of all utterances for this session */
  utterances: SessionUtterance[];
  /** Current processing state */
  processingState: UtteranceProcessingState;
  /** Whether auto-insert to notes is enabled */
  autoInsertEnabled: boolean;
  /** Upload audio and start processing */
  uploadAndProcess: (
    audioBlob: Blob,
    speakerId: string,
    speakerName: string,
    speakerPhotoUrl: string,
    startAt: Date,
    endAt: Date,
    language: string
  ) => Promise<void>;
  /** Mark an utterance as inserted to notes */
  markAsInserted: (utteranceIndex: number) => Promise<void>;
  /** Toggle auto-insert setting */
  toggleAutoInsert: () => Promise<void>;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Hook for managing utterances in a session.
 * Handles fetching, uploading, and WebSocket subscriptions.
 */
export function useUtterances({
  sessionId,
  accessToken,
  subscribe,
  isWsConnected = false,
  onAutoInsert,
}: UseUtterancesOptions): UseUtterancesReturn {
  const [utterances, setUtterances] = useState<SessionUtterance[]>([]);
  const [processingState, setProcessingState] = useState<UtteranceProcessingState>({
    status: 'idle',
    progress: 0,
  });
  const [autoInsertEnabled, setAutoInsertEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onAutoInsertRef = useRef(onAutoInsert);
  onAutoInsertRef.current = onAutoInsert;

  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  // Load initial data
  useEffect(() => {
    if (!sessionId || !accessToken) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load utterances and settings in parallel
        const [utterancesData, autoInsert] = await Promise.all([
          getUtterances(sessionId, accessToken),
          getAutoInsertSetting(sessionId, accessToken).catch(() => false),
        ]);

        setUtterances(utterancesData);
        setAutoInsertEnabled(autoInsert);
      } catch (err) {
        console.error('Failed to load utterances:', err);
        setError('Failed to load utterances');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [sessionId, accessToken]);

  // WebSocket subscriptions
  useEffect(() => {
    // Only subscribe when WebSocket is connected
    if (!sessionId || !isWsConnected) {
      console.log('[useUtterances] Skipping subscription - sessionId:', sessionId, 'isWsConnected:', isWsConnected);
      return;
    }

    console.log('[useUtterances] Setting up WebSocket subscriptions for session:', sessionId);

    // Subscribe to new utterances
    const unsubUtterance = subscribe(
      `/topic/session/${sessionId}/utterance`,
      (message) => {
        console.log('[useUtterances] Received utterance message:', message.body?.substring?.(0, 100));
        try {
          const data = JSON.parse(message.body);

          if (data.type === 'new_utterance' && data.utterance) {
            console.log('[useUtterances] New utterance received:', data.utterance.utteranceIndex);
            const newUtterance: SessionUtterance = data.utterance;

            // Check if auto-insert is enabled and callback exists
            const shouldAutoInsert = data.autoInsert && onAutoInsertRef.current;

            setUtterances((prev) => {
              // Check if already exists
              if (prev.some((u) => u.id === newUtterance.id)) {
                console.log('[useUtterances] Utterance already exists, skipping');
                return prev;
              }
              console.log('[useUtterances] Adding new utterance to state');

              // If auto-insert is enabled, mark as inserted immediately
              const utteranceToAdd = shouldAutoInsert
                ? { ...newUtterance, insertedToNotes: true, insertedAt: new Date().toISOString() }
                : newUtterance;

              return [...prev, utteranceToAdd];
            });

            // Reset processing state
            setProcessingState({ status: 'complete', progress: 100 });

            // Trigger auto-insert if enabled
            if (shouldAutoInsert) {
              console.log('[useUtterances] Auto-inserting utterance:', newUtterance.utteranceIndex);
              onAutoInsertRef.current!(newUtterance);

              // Also call API to persist the inserted state
              if (accessTokenRef.current) {
                markUtteranceInserted(sessionId, newUtterance.utteranceIndex, accessTokenRef.current).catch((err) => {
                  console.error('[useUtterances] Failed to mark auto-inserted utterance:', err);
                });
              }
            }
          }
        } catch (err) {
          console.error('[useUtterances] Error parsing utterance message:', err);
        }
      }
    );

    // Subscribe to processing status updates
    const unsubProcessing = subscribe(
      `/topic/session/${sessionId}/utterance-processing`,
      (message) => {
        console.log('[useUtterances] Received processing message:', message.body);
        try {
          const data = JSON.parse(message.body);

          if (data.type === 'processing') {
            console.log('[useUtterances] Processing status:', data.status, 'progress:', data.progress);
            setProcessingState({
              status: data.status as UtteranceProcessingStatus,
              progress: data.progress || 0,
              error: data.error,
            });
          }
        } catch (err) {
          console.error('[useUtterances] Error parsing processing message:', err);
        }
      }
    );

    // Subscribe to settings updates
    const unsubSettings = subscribe(
      `/topic/session/${sessionId}/utterance-settings`,
      (message) => {
        try {
          const data = JSON.parse(message.body);

          if (data.type === 'settings') {
            if (typeof data.autoInsertToNotes === 'boolean') {
              setAutoInsertEnabled(data.autoInsertToNotes);
            }
          }
        } catch (err) {
          console.error('[useUtterances] Error parsing settings message:', err);
        }
      }
    );

    console.log('[useUtterances] WebSocket subscriptions set up successfully');

    return () => {
      console.log('[useUtterances] Cleaning up WebSocket subscriptions');
      unsubUtterance();
      unsubProcessing();
      unsubSettings();
    };
  }, [sessionId, subscribe, isWsConnected]);

  // Upload and process utterance
  const uploadAndProcess = useCallback(
    async (
      audioBlob: Blob,
      speakerId: string,
      speakerName: string,
      speakerPhotoUrl: string,
      startAt: Date,
      endAt: Date,
      language: string
    ) => {
      console.log('[useUtterances] uploadAndProcess called', {
        blobSize: audioBlob.size,
        speakerId,
        speakerName,
        language,
      });

      if (!accessToken) {
        console.error('[useUtterances] Not authenticated');
        setError('Not authenticated');
        return;
      }

      try {
        setProcessingState({ status: 'uploading', progress: 10 });
        setError(null);

        console.log('[useUtterances] Calling uploadUtterance API...');
        await uploadUtterance(
          sessionId,
          audioBlob,
          speakerId,
          speakerName,
          speakerPhotoUrl,
          startAt,
          endAt,
          language,
          accessToken
        );
        console.log('[useUtterances] Upload API call completed');

        // Processing continues server-side, status updates via WebSocket
      } catch (err) {
        console.error('[useUtterances] Failed to upload utterance:', err);
        setProcessingState({
          status: 'error',
          progress: 0,
          error: 'Upload failed',
        });
        setError('Failed to upload utterance');
      }
    },
    [sessionId, accessToken]
  );

  // Mark utterance as inserted to notes
  const markAsInserted = useCallback(
    async (utteranceIndex: number) => {
      if (!accessToken) return;

      try {
        await markUtteranceInserted(
          sessionId,
          utteranceIndex,
          accessToken
        );

        setUtterances((prev) =>
          prev.map((u) =>
            u.utteranceIndex === utteranceIndex
              ? { ...u, insertedToNotes: true, insertedAt: new Date().toISOString() }
              : u
          )
        );
      } catch (err) {
        console.error('Failed to mark utterance as inserted:', err);
      }
    },
    [sessionId, accessToken]
  );

  // Toggle auto-insert setting
  const toggleAutoInsert = useCallback(async () => {
    if (!accessToken) return;

    const newValue = !autoInsertEnabled;

    try {
      await setAutoInsertSetting(sessionId, newValue, accessToken);
      setAutoInsertEnabled(newValue);
    } catch (err) {
      console.error('Failed to update auto-insert setting:', err);
    }
  }, [sessionId, accessToken, autoInsertEnabled]);

  return {
    utterances,
    processingState,
    autoInsertEnabled,
    uploadAndProcess,
    markAsInserted,
    toggleAutoInsert,
    isLoading,
    error,
  };
}
