import { useEffect, useRef, useState, useCallback } from 'react';
import { IMessage } from '@stomp/stompjs';
import {
  SignalMessage,
  SignalType,
  RemotePeer,
  ICE_SERVERS,
  SessionParticipant,
  detectWebRTCCapabilities,
  MESH_P2P_CONFIG,
} from '../types/meetRoom';
import { webrtcLogger as log } from '../utils/webrtcLogger';

interface UseWebRTCOptions {
  sessionId: string;
  userId: string;
  username: string;
  photoUrl?: string;
  /** Online participants from SpeakingQueue */
  participants: SessionParticipant[];
  /** WebSocket subscribe function from useWebSocket */
  subscribe: (destination: string, callback: (message: IMessage) => void) => () => void;
  /** WebSocket send function from useWebSocket */
  send: (destination: string, body: object) => void;
  /** Is WebSocket connected */
  isWsConnected: boolean;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

/**
 * Quality metrics for WebRTC connections
 */
interface ConnectionQuality {
  peerId: string;
  rtt?: number;           // Round-trip time in ms
  packetsLost?: number;
  packetsReceived?: number;
  bytesReceived?: number;
  jitter?: number;        // Audio jitter in ms
}

interface UseWebRTCReturn {
  /** Whether voice chat is active */
  isJoined: boolean;
  /** Whether local microphone is muted */
  isMuted: boolean;
  /** Error message if any */
  error: string | null;
  /** List of connected remote peers */
  remotePeers: RemotePeer[];
  /** Current input device ID */
  currentInputDeviceId: string | null;
  /** Current output device ID */
  currentOutputDeviceId: string | null;
  /** Available input devices (microphones) */
  audioInputDevices: AudioDevice[];
  /** Available output devices (speakers) */
  audioOutputDevices: AudioDevice[];
  /** Current volume (0-100) */
  volume: number;
  /** Whether the browser supports setSinkId */
  hasSinkIdSupport: boolean;
  /** Whether the current user is speaking */
  isSpeaking: boolean;
  /** Map of peer IDs to speaking status */
  peerSpeakingStatus: Map<string, boolean>;
  /** Connection quality metrics */
  connectionQualities: ConnectionQuality[];
  /** Whether max participants warning is active */
  meshWarning: string | null;
  /** Join voice chat */
  joinVoice: (deviceId?: string) => Promise<void>;
  /** Leave voice chat */
  leaveVoice: () => void;
  /** Toggle local microphone mute */
  toggleMute: () => void;
  /** Change input device (microphone) */
  changeInputDevice: (deviceId: string) => Promise<void>;
  /** Change output device (speaker) */
  changeOutputDevice: (deviceId: string) => Promise<void>;
  /** Set volume (0-100) */
  setVolume: (volume: number) => void;
  /** Refresh available devices */
  refreshDevices: () => Promise<void>;
  /** Register audio element for volume/output control */
  registerAudioElement: (peerId: string, audioElement: HTMLAudioElement) => void;
  /** Unregister audio element */
  unregisterAudioElement: (peerId: string) => void;
}

// Speaking detection threshold (0-1)
const SPEAKING_THRESHOLD = 0.02;
const SPEAKING_CHECK_INTERVAL = 100; // ms

/**
 * Hook for managing WebRTC peer-to-peer voice connections.
 *
 * Architecture:
 * - Mesh P2P topology (max 6 users)
 * - Existing users create offers to newcomers
 * - Uses STOMP for signaling relay
 * - STUN + TURN servers for NAT traversal
 * - ICE restart on connection failure
 * - Speaking detection via AudioContext
 */
export function useWebRTC({
  sessionId,
  userId,
  username,
  photoUrl = '',
  participants,
  subscribe,
  send,
  isWsConnected,
}: UseWebRTCOptions): UseWebRTCReturn {
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [audioInputDevices, setAudioInputDevices] = useState<AudioDevice[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<AudioDevice[]>([]);
  const [currentInputDeviceId, setCurrentInputDeviceId] = useState<string | null>(null);
  const [currentOutputDeviceId, setCurrentOutputDeviceId] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(100);
  const [hasSinkIdSupport, setHasSinkIdSupport] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [peerSpeakingStatus, setPeerSpeakingStatus] = useState<Map<string, boolean>>(new Map());
  const [connectionQualities, setConnectionQualities] = useState<ConnectionQuality[]>([]);
  const [meshWarning, setMeshWarning] = useState<string | null>(null);

  // Refs for stable access in callbacks
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const isJoinedRef = useRef(false);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const volumeRef = useRef(100);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<number | null>(null);
  const peerAnalysersRef = useRef<Map<string, { context: AudioContext; analyser: AnalyserNode }>>(new Map());
  const qualityIntervalRef = useRef<number | null>(null);
  const iceRestartTimeoutsRef = useRef<Map<string, number>>(new Map());

  // Check browser capabilities on mount
  useEffect(() => {
    const caps = detectWebRTCCapabilities();
    setHasSinkIdSupport(caps.hasSinkId);
    if (!caps.hasSinkId) {
      log.warn('Browser does not support setSinkId - output device selection unavailable');
    }
    if (!caps.hasWebRTC) {
      setError('Your browser does not support WebRTC voice chat.');
    }
  }, []);

  /**
   * Send signaling message via WebSocket
   */
  const sendSignal = useCallback((
    type: SignalType,
    toUserId: string | undefined,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit | null
  ) => {
    if (!isWsConnected) {
      log.warn('Cannot send signal - WebSocket not connected');
      return;
    }

    const message: SignalMessage = {
      type,
      sessionId,
      fromUserId: userId,
      toUserId,
      fromUsername: username,
      payload,
    };
    send(`/app/session/${sessionId}/signal`, message);
    log.signal(type, 'sent', toUserId);
  }, [sessionId, userId, username, send, isWsConnected]);

  /**
   * Attempt ICE restart for a peer connection
   */
  const attemptIceRestart = useCallback(async (remoteUserId: string) => {
    const pc = peerConnectionsRef.current.get(remoteUserId);
    if (!pc || pc.connectionState === 'closed') return;

    log.info(`Attempting ICE restart for ${remoteUserId}`);

    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      sendSignal('OFFER', remoteUserId, offer);
      log.info(`ICE restart offer sent to ${remoteUserId}`);
    } catch (err) {
      log.error('ICE restart failed:', err);
    }
  }, [sendSignal]);

  /**
   * Schedule ICE restart with exponential backoff
   */
  const scheduleIceRestart = useCallback((remoteUserId: string, attempt = 1) => {
    // Clear any existing timeout
    const existingTimeout = iceRestartTimeoutsRef.current.get(remoteUserId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Max 3 attempts
    if (attempt > 3) {
      log.warn(`Max ICE restart attempts reached for ${remoteUserId}`);
      return;
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, attempt - 1) * 1000;
    log.debug(`Scheduling ICE restart for ${remoteUserId} in ${delay}ms (attempt ${attempt})`);

    const timeout = window.setTimeout(() => {
      attemptIceRestart(remoteUserId);
      iceRestartTimeoutsRef.current.delete(remoteUserId);
    }, delay);

    iceRestartTimeoutsRef.current.set(remoteUserId, timeout);
  }, [attemptIceRestart]);

  /**
   * Create a new RTCPeerConnection for a remote user
   */
  const createPeerConnection = useCallback((remoteUserId: string, remoteUsername: string): RTCPeerConnection => {
    log.info(`Creating peer connection for ${remoteUsername} (${remoteUserId.slice(0, 8)})`);

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        log.debug(`ICE candidate generated for ${remoteUserId.slice(0, 8)}`);
        sendSignal('ICE', remoteUserId, event.candidate.toJSON());
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      log.iceState(remoteUserId.slice(0, 8), pc.iceConnectionState);

      if (pc.iceConnectionState === 'failed') {
        // Attempt ICE restart
        scheduleIceRestart(remoteUserId, 1);
      } else if (pc.iceConnectionState === 'disconnected') {
        // Wait a bit before attempting restart (might recover)
        scheduleIceRestart(remoteUserId, 1);
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        // Clear any pending restart
        const timeout = iceRestartTimeoutsRef.current.get(remoteUserId);
        if (timeout) {
          clearTimeout(timeout);
          iceRestartTimeoutsRef.current.delete(remoteUserId);
        }
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      log.connectionState(remoteUserId.slice(0, 8), pc.connectionState);

      if (pc.connectionState === 'failed') {
        // Cleanup failed connection after retries exhausted
        if (!iceRestartTimeoutsRef.current.has(remoteUserId)) {
          cleanupPeerConnection(remoteUserId);
        }
      } else if (pc.connectionState === 'closed') {
        cleanupPeerConnection(remoteUserId);
      }
    };

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      log.info(`Received remote track from ${remoteUserId.slice(0, 8)}`);
      const [remoteStream] = event.streams;
      remoteStreamsRef.current.set(remoteUserId, remoteStream);

      // Setup speaking detection for this peer
      setupPeerSpeakingDetection(remoteUserId, remoteStream);

      // Update remote peers state
      setRemotePeers(prev => {
        const existing = prev.find(p => p.odUserId === remoteUserId);
        if (existing) {
          return prev.map(p =>
            p.odUserId === remoteUserId
              ? { ...p, audioStream: remoteStream }
              : p
          );
        }
        // Get photoUrl from participants if available
        const participant = participants.find(p => p.userId === remoteUserId);
        return [...prev, {
          odUserId: remoteUserId,
          username: remoteUsername,
          photoUrl: participant?.photoUrl,
          peerConnection: pc,
          audioStream: remoteStream,
          isMuted: false,
        }];
      });
    };

    peerConnectionsRef.current.set(remoteUserId, pc);
    return pc;
  }, [sendSignal, scheduleIceRestart, participants]);

  /**
   * Setup speaking detection for a peer's audio stream
   */
  const setupPeerSpeakingDetection = useCallback((peerId: string, stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      peerAnalysersRef.current.set(peerId, { context, analyser });
      log.debug(`Speaking detection setup for peer ${peerId.slice(0, 8)}`);
    } catch (err) {
      log.warn('Failed to setup peer speaking detection:', err);
    }
  }, []);

  /**
   * Cleanup speaking detection for a peer
   */
  const cleanupPeerSpeakingDetection = useCallback((peerId: string) => {
    const peerAnalyser = peerAnalysersRef.current.get(peerId);
    if (peerAnalyser) {
      peerAnalyser.context.close();
      peerAnalysersRef.current.delete(peerId);
    }
    setPeerSpeakingStatus(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  /**
   * Cleanup a peer connection
   */
  const cleanupPeerConnection = useCallback((remoteUserId: string) => {
    log.info(`Cleaning up connection for ${remoteUserId.slice(0, 8)}`);

    // Clear any pending ICE restart
    const timeout = iceRestartTimeoutsRef.current.get(remoteUserId);
    if (timeout) {
      clearTimeout(timeout);
      iceRestartTimeoutsRef.current.delete(remoteUserId);
    }

    const pc = peerConnectionsRef.current.get(remoteUserId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(remoteUserId);
    }

    remoteStreamsRef.current.delete(remoteUserId);
    pendingCandidatesRef.current.delete(remoteUserId);
    cleanupPeerSpeakingDetection(remoteUserId);

    setRemotePeers(prev => prev.filter(p => p.odUserId !== remoteUserId));
  }, [cleanupPeerSpeakingDetection]);

  /**
   * Handle incoming signaling messages
   */
  const handleSignalMessage = useCallback(async (message: SignalMessage) => {
    const { type, fromUserId, fromUsername, payload } = message;

    // Ignore our own messages
    if (fromUserId === userId) return;

    log.signal(type, 'received', fromUserId);

    switch (type) {
      case 'JOIN': {
        // New user joined - we (existing user) create offer
        if (!isJoinedRef.current) return;

        // Check mesh limit
        const currentPeerCount = peerConnectionsRef.current.size;
        if (currentPeerCount >= MESH_P2P_CONFIG.maxParticipants - 1) {
          log.warn(`Mesh limit reached (${currentPeerCount + 1} peers), cannot add more`);
          setMeshWarning(`Maximum ${MESH_P2P_CONFIG.maxParticipants} participants reached`);
          return;
        }

        let pc = peerConnectionsRef.current.get(fromUserId);
        if (!pc) {
          pc = createPeerConnection(fromUserId, fromUsername || 'Unknown');
        }

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal('OFFER', fromUserId, offer);
          log.debug(`Sent offer to ${fromUserId.slice(0, 8)}`);
        } catch (err) {
          log.error('Error creating offer:', err);
        }
        break;
      }

      case 'OFFER': {
        // Received offer - create answer
        let pc = peerConnectionsRef.current.get(fromUserId);
        if (!pc) {
          pc = createPeerConnection(fromUserId, fromUsername || 'Unknown');
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));

          // Apply any pending ICE candidates
          const pending = pendingCandidatesRef.current.get(fromUserId) || [];
          for (const candidate of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current.delete(fromUserId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal('ANSWER', fromUserId, answer);
          log.debug(`Sent answer to ${fromUserId.slice(0, 8)}`);
        } catch (err) {
          log.error('Error handling offer:', err);
        }
        break;
      }

      case 'ANSWER': {
        // Received answer
        const pc = peerConnectionsRef.current.get(fromUserId);
        if (!pc) {
          log.warn('No peer connection for answer from', fromUserId.slice(0, 8));
          return;
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));

          // Apply any pending ICE candidates
          const pending = pendingCandidatesRef.current.get(fromUserId) || [];
          for (const candidate of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current.delete(fromUserId);

          log.debug(`Set remote description from ${fromUserId.slice(0, 8)}`);
        } catch (err) {
          log.error('Error handling answer:', err);
        }
        break;
      }

      case 'ICE': {
        // Received ICE candidate
        const pc = peerConnectionsRef.current.get(fromUserId);
        const candidate = payload as RTCIceCandidateInit;

        if (!pc || !pc.remoteDescription) {
          // Queue candidate until remote description is set
          const pending = pendingCandidatesRef.current.get(fromUserId) || [];
          pending.push(candidate);
          pendingCandidatesRef.current.set(fromUserId, pending);
          log.debug(`Queued ICE candidate for ${fromUserId.slice(0, 8)}`);
          return;
        }

        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          log.debug(`Added ICE candidate from ${fromUserId.slice(0, 8)}`);
        } catch (err) {
          log.error('Error adding ICE candidate:', err);
        }
        break;
      }

      case 'LEAVE': {
        // User left - cleanup their connection
        cleanupPeerConnection(fromUserId);
        break;
      }
    }
  }, [userId, createPeerConnection, cleanupPeerConnection, sendSignal]);

  /**
   * Setup local speaking detection
   */
  const setupLocalSpeakingDetection = useCallback((stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        log.warn('AudioContext not available - speaking detection disabled');
        return;
      }

      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = context;
      analyserRef.current = analyser;

      // Start speaking detection interval
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      speakingIntervalRef.current = window.setInterval(() => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = average / 255;

        setIsSpeaking(normalized > SPEAKING_THRESHOLD);
      }, SPEAKING_CHECK_INTERVAL);

      log.debug('Local speaking detection started');
    } catch (err) {
      log.warn('Failed to setup speaking detection:', err);
    }
  }, []);

  /**
   * Check speaking status of all peers
   */
  const checkPeerSpeakingStatus = useCallback(() => {
    peerAnalysersRef.current.forEach((value, peerId) => {
      const { analyser } = value;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const normalized = average / 255;
      const isSpeakingNow = normalized > SPEAKING_THRESHOLD;

      setPeerSpeakingStatus(prev => {
        const current = prev.get(peerId);
        if (current === isSpeakingNow) return prev;
        const next = new Map(prev);
        next.set(peerId, isSpeakingNow);
        return next;
      });
    });
  }, []);

  /**
   * Refresh available audio devices
   */
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const inputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
        }));

      const outputs = devices
        .filter(d => d.kind === 'audiooutput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
        }));

      setAudioInputDevices(inputs);
      setAudioOutputDevices(outputs);

      log.info(`Found ${inputs.length} input devices, ${outputs.length} output devices`);
    } catch (err) {
      log.error('Error enumerating devices:', err);
    }
  }, []);

  /**
   * Collect connection quality metrics
   */
  const collectQualityMetrics = useCallback(async () => {
    const qualities: ConnectionQuality[] = [];

    for (const [peerId, pc] of peerConnectionsRef.current) {
      try {
        const stats = await pc.getStats();
        let quality: ConnectionQuality = { peerId };

        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            quality.packetsLost = report.packetsLost;
            quality.packetsReceived = report.packetsReceived;
            quality.bytesReceived = report.bytesReceived;
            quality.jitter = report.jitter ? Math.round(report.jitter * 1000) : undefined;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            quality.rtt = report.currentRoundTripTime
              ? Math.round(report.currentRoundTripTime * 1000)
              : undefined;
          }
        });

        qualities.push(quality);
      } catch (err) {
        log.debug(`Failed to get stats for ${peerId}:`, err);
      }
    }

    setConnectionQualities(qualities);
  }, []);

  /**
   * Join voice chat
   */
  const joinVoice = useCallback(async (deviceId?: string) => {
    if (isJoinedRef.current) return;

    // WS connection guard
    if (!isWsConnected) {
      setError('Cannot join voice chat - connection not ready. Please wait and try again.');
      log.warn('Join attempt blocked - WebSocket not connected');
      return;
    }

    // Check mesh limit
    const onlineCount = participants.filter(p => p.isOnline).length;
    if (onlineCount >= MESH_P2P_CONFIG.maxParticipants) {
      setError(`Voice chat is full (maximum ${MESH_P2P_CONFIG.maxParticipants} participants)`);
      log.warn(`Join blocked - mesh limit reached (${onlineCount} online)`);
      return;
    }

    // Check for mesh warning threshold
    if (onlineCount >= MESH_P2P_CONFIG.warnThreshold) {
      setMeshWarning(`${onlineCount} participants - audio quality may be affected with more users`);
    }

    try {
      setError(null);
      log.time('joinVoice');
      log.info('Joining voice chat...');

      // Request permission first to get device labels
      await refreshDevices();

      let stream: MediaStream;

      // Build audio constraints with ideal (not exact) values for flexibility
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
      };

      if (deviceId) {
        audioConstraints.deviceId = { ideal: deviceId };
      }

      try {
        // Try with preferred constraints
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch (constraintErr: any) {
        // Fallback to basic audio if constraints fail
        log.warn('Constraints failed, falling back to basic audio:', constraintErr.message);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch (fallbackErr: any) {
          // Handle autoplay policy / user gesture requirement
          if (fallbackErr.name === 'NotAllowedError') {
            throw new Error('PERMISSION_DENIED');
          }
          throw fallbackErr;
        }
      }

      localStreamRef.current = stream;

      // Setup speaking detection
      setupLocalSpeakingDetection(stream);

      // Get actual device ID used
      const audioTrack = stream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      if (settings.deviceId) {
        setCurrentInputDeviceId(settings.deviceId);
      }

      // Refresh devices again to get labels (after permission granted)
      await refreshDevices();

      isJoinedRef.current = true;
      setIsJoined(true);

      // Notify others that we joined
      sendSignal('JOIN', undefined, null);

      // Start quality metrics collection
      qualityIntervalRef.current = window.setInterval(collectQualityMetrics, 5000);

      // Start peer speaking detection
      const peerSpeakingInterval = window.setInterval(checkPeerSpeakingStatus, SPEAKING_CHECK_INTERVAL);
      speakingIntervalRef.current = peerSpeakingInterval;

      log.timeEnd('joinVoice');
      log.info('Joined voice chat, notified others');
    } catch (err: any) {
      log.error('Error joining voice:', err);
      if (err.message === 'PERMISSION_DENIED' || err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError') {
        setError('Microphone is in use by another application. Please close other apps using the microphone.');
      } else if (err.name === 'OverconstrainedError') {
        setError('Selected microphone is not available. Please choose a different device.');
      } else {
        setError(`Failed to join voice chat: ${err.message}`);
      }
    }
  }, [sendSignal, refreshDevices, isWsConnected, participants, setupLocalSpeakingDetection, collectQualityMetrics, checkPeerSpeakingStatus]);

  /**
   * Leave voice chat
   */
  const leaveVoice = useCallback(() => {
    if (!isJoinedRef.current) return;

    log.info('Leaving voice chat...');

    // Notify others
    sendSignal('LEAVE', undefined, null);

    // Stop speaking detection
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    // Cleanup audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    // Stop quality metrics collection
    if (qualityIntervalRef.current) {
      clearInterval(qualityIntervalRef.current);
      qualityIntervalRef.current = null;
    }

    // Clear all ICE restart timeouts
    iceRestartTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    iceRestartTimeoutsRef.current.clear();

    // Cleanup peer analysers
    peerAnalysersRef.current.forEach(({ context }) => context.close());
    peerAnalysersRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidatesRef.current.clear();

    isJoinedRef.current = false;
    setIsJoined(false);
    setRemotePeers([]);
    setError(null);
    setIsSpeaking(false);
    setPeerSpeakingStatus(new Map());
    setConnectionQualities([]);
    setMeshWarning(null);

    log.info('Left voice chat');
  }, [sendSignal]);

  /**
   * Toggle local microphone mute
   */
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        log.info(`Mute toggled: ${!audioTrack.enabled ? 'muted' : 'unmuted'}`);
      }
    }
  }, []);

  /**
   * Change input device (microphone)
   */
  const changeInputDevice = useCallback(async (deviceId: string) => {
    if (!isJoinedRef.current) return;

    try {
      log.info(`Changing input device to ${deviceId.slice(0, 8)}`);

      let newStream: MediaStream;

      try {
        // Try with exact device ID first
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          },
          video: false,
        });
      } catch (constraintErr: any) {
        // Fallback to ideal device ID if exact fails
        log.warn('Exact device constraint failed, trying ideal:', constraintErr.message);
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { ideal: deviceId },
          },
          video: false,
        });
      }

      const newTrack = newStream.getAudioTracks()[0];

      // Replace track in all peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          sender.replaceTrack(newTrack);
        }
      });

      // Stop old tracks and update stream ref
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      localStreamRef.current = newStream;

      // Re-setup speaking detection with new stream
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      setupLocalSpeakingDetection(newStream);

      // Preserve mute state
      newTrack.enabled = !isMuted;

      setCurrentInputDeviceId(deviceId);
      log.info(`Input device changed to ${deviceId.slice(0, 8)}`);
    } catch (err: any) {
      log.error('Error changing input device:', err);
      setError(`Failed to change microphone: ${err.message}`);
    }
  }, [isMuted, setupLocalSpeakingDetection]);

  /**
   * Change output device (speaker)
   */
  const changeOutputDevice = useCallback(async (deviceId: string) => {
    if (!hasSinkIdSupport) {
      log.warn('Cannot change output device - setSinkId not supported');
      setError('Your browser does not support output device selection.');
      return;
    }

    try {
      log.info(`Changing output device to ${deviceId.slice(0, 8)}`);

      // Update all audio elements
      const promises: Promise<void>[] = [];
      audioElementsRef.current.forEach((audio) => {
        if ('setSinkId' in audio) {
          promises.push((audio as any).setSinkId(deviceId));
        }
      });

      await Promise.all(promises);

      setCurrentOutputDeviceId(deviceId);
      log.info(`Output device changed to ${deviceId.slice(0, 8)}`);
    } catch (err: any) {
      log.error('Error changing output device:', err);
      setError(`Failed to change speaker: ${err.message}`);
    }
  }, [hasSinkIdSupport]);

  /**
   * Set volume (0-100)
   */
  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, newVolume));
    volumeRef.current = clampedVolume;
    setVolumeState(clampedVolume);

    // Update all audio elements
    audioElementsRef.current.forEach(audio => {
      audio.volume = clampedVolume / 100;
    });

    log.debug(`Volume set to ${clampedVolume}`);
  }, []);

  /**
   * Register audio element for a remote peer
   */
  const registerAudioElement = useCallback((peerId: string, audioElement: HTMLAudioElement) => {
    audioElementsRef.current.set(peerId, audioElement);
    audioElement.volume = volumeRef.current / 100;

    // Set output device if specified and supported
    if (currentOutputDeviceId && hasSinkIdSupport && 'setSinkId' in audioElement) {
      (audioElement as any).setSinkId(currentOutputDeviceId).catch((err: any) => {
        log.warn(`Failed to set sink ID for peer ${peerId}:`, err);
      });
    }

    // Handle autoplay policy
    audioElement.play().catch((err) => {
      if (err.name === 'NotAllowedError') {
        log.warn('Autoplay blocked - user interaction required');
        // Will be retried on user interaction
      }
    });
  }, [currentOutputDeviceId, hasSinkIdSupport]);

  /**
   * Unregister audio element for a remote peer
   */
  const unregisterAudioElement = useCallback((peerId: string) => {
    audioElementsRef.current.delete(peerId);
  }, []);

  /**
   * Device change listener
   */
  useEffect(() => {
    const handleDeviceChange = () => {
      log.info('Audio devices changed - refreshing list');
      refreshDevices();
    };

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshDevices]);

  /**
   * Subscribe to signaling messages
   */
  useEffect(() => {
    if (!isWsConnected || !sessionId || !userId) return;

    // Subscribe to personal signal channel
    const unsubPersonal = subscribe(
      `/topic/session/${sessionId}/signal/${userId}`,
      (message: IMessage) => {
        try {
          const signal: SignalMessage = JSON.parse(message.body);
          handleSignalMessage(signal);
        } catch (err) {
          log.error('Error parsing signal message:', err);
        }
      }
    );

    // Subscribe to broadcast signal channel (for JOIN notifications)
    const unsubBroadcast = subscribe(
      `/topic/session/${sessionId}/signal`,
      (message: IMessage) => {
        try {
          const signal: SignalMessage = JSON.parse(message.body);
          if (signal.type === 'JOIN' || signal.type === 'LEAVE') {
            handleSignalMessage(signal);
          }
        } catch (err) {
          log.error('Error parsing broadcast signal:', err);
        }
      }
    );

    return () => {
      unsubPersonal();
      unsubBroadcast();
    };
  }, [isWsConnected, sessionId, userId, subscribe, handleSignalMessage]);

  /**
   * Handle participant changes (detect users leaving via queue updates)
   */
  useEffect(() => {
    if (!isJoinedRef.current) return;

    const currentPeerIds = new Set(peerConnectionsRef.current.keys());
    const onlineParticipantIds = new Set(
      participants
        .filter(p => p.isOnline && p.userId !== userId)
        .map(p => p.userId)
    );

    // Cleanup connections for users who went offline
    currentPeerIds.forEach(peerId => {
      if (!onlineParticipantIds.has(peerId)) {
        log.info(`Participant ${peerId.slice(0, 8)} went offline, cleaning up`);
        cleanupPeerConnection(peerId);
      }
    });

    // Update mesh warning
    const onlineCount = participants.filter(p => p.isOnline).length;
    if (onlineCount >= MESH_P2P_CONFIG.warnThreshold && onlineCount < MESH_P2P_CONFIG.maxParticipants) {
      setMeshWarning(`${onlineCount} participants - audio quality may be affected with more users`);
    } else if (onlineCount >= MESH_P2P_CONFIG.maxParticipants) {
      setMeshWarning(`Maximum ${MESH_P2P_CONFIG.maxParticipants} participants reached`);
    } else {
      setMeshWarning(null);
    }

    // Update remote peer photos from participants
    setRemotePeers(prev =>
      prev.map(peer => {
        const participant = participants.find(p => p.userId === peer.odUserId);
        if (participant && participant.photoUrl !== peer.photoUrl) {
          return { ...peer, photoUrl: participant.photoUrl };
        }
        return peer;
      })
    );
  }, [participants, userId, cleanupPeerConnection]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Stop intervals
      if (speakingIntervalRef.current) {
        clearInterval(speakingIntervalRef.current);
      }
      if (qualityIntervalRef.current) {
        clearInterval(qualityIntervalRef.current);
      }

      // Clear ICE restart timeouts
      iceRestartTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));

      // Cleanup audio contexts
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      peerAnalysersRef.current.forEach(({ context }) => context.close());

      if (isJoinedRef.current) {
        // Stop local stream
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        // Close all connections
        peerConnectionsRef.current.forEach(pc => pc.close());
      }
    };
  }, []);

  return {
    isJoined,
    isMuted,
    error,
    remotePeers,
    currentInputDeviceId,
    currentOutputDeviceId,
    audioInputDevices,
    audioOutputDevices,
    volume,
    hasSinkIdSupport,
    isSpeaking,
    peerSpeakingStatus,
    connectionQualities,
    meshWarning,
    joinVoice,
    leaveVoice,
    toggleMute,
    changeInputDevice,
    changeOutputDevice,
    setVolume,
    refreshDevices,
    registerAudioElement,
    unregisterAudioElement,
  };
}
