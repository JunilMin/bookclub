import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiMic,
  FiMicOff,
  FiPhone,
  FiPhoneOff,
  FiUser,
  FiAlertCircle,
  FiVolume2,
  FiVolumeX,
  FiSettings,
  FiInfo,
  FiVideo,
  FiExternalLink,
  FiWifi,
  FiWifiOff,
  FiAlertTriangle,
} from 'react-icons/fi';
import { RiHandHeartLine, RiChat1Line, RiArrowDownSLine, RiArrowUpSLine } from 'react-icons/ri';
import { RemotePeer, VoiceChatMode, CommunicationMode } from '../../../types/meetRoom';
import './VoiceChat.css';

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface ConnectionQuality {
  peerId: string;
  rtt?: number;
  packetsLost?: number;
  packetsReceived?: number;
  bytesReceived?: number;
  jitter?: number;
}

interface VoiceChatProps {
  // Communication mode (WebRTC vs Google Meet)
  communicationMode: CommunicationMode;
  onCommunicationModeChange: (mode: CommunicationMode) => void;
  meetLink?: string;
  // WebRTC state
  isJoined: boolean;
  isMuted: boolean;
  error: string | null;
  remotePeers: RemotePeer[];
  currentUserId: string;
  currentUsername: string;
  currentPhotoUrl?: string;
  // Voice chat mode (RULES/FREE)
  voiceChatMode: VoiceChatMode;
  isHost: boolean;
  // Rules mode - current speaker and moderator info
  currentSpeakerId?: string | null;
  moderatorId?: string | null;
  // Device management
  audioInputDevices: AudioDevice[];
  audioOutputDevices: AudioDevice[];
  currentInputDeviceId: string | null;
  currentOutputDeviceId: string | null;
  volume: number;
  // New features
  hasSinkIdSupport?: boolean;
  isSpeaking?: boolean;
  peerSpeakingStatus?: Map<string, boolean>;
  connectionQualities?: ConnectionQuality[];
  meshWarning?: string | null;
  isWsConnected?: boolean;
  // Callbacks
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onChangeInputDevice: (deviceId: string) => void;
  onChangeOutputDevice: (deviceId: string) => void;
  onVolumeChange: (volume: number) => void;
  onChangeChatMode: (mode: VoiceChatMode) => void;
  // Audio element registration
  registerAudioElement: (peerId: string, audioElement: HTMLAudioElement) => void;
  unregisterAudioElement: (peerId: string) => void;
}

const VoiceChat: React.FC<VoiceChatProps> = ({
  communicationMode,
  onCommunicationModeChange,
  meetLink,
  isJoined,
  isMuted,
  error,
  remotePeers,
  currentUserId,
  currentUsername,
  currentPhotoUrl,
  voiceChatMode,
  isHost,
  currentSpeakerId: _currentSpeakerId,
  moderatorId,
  audioInputDevices,
  audioOutputDevices,
  currentInputDeviceId,
  currentOutputDeviceId,
  volume,
  hasSinkIdSupport = true,
  isSpeaking = false,
  peerSpeakingStatus,
  connectionQualities = [],
  meshWarning,
  isWsConnected = true,
  onJoin,
  onLeave,
  onToggleMute,
  onChangeInputDevice,
  onChangeOutputDevice,
  onVolumeChange,
  onChangeChatMode,
  registerAudioElement,
  unregisterAudioElement,
}) => {
  const { t } = useTranslation();
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);

  // Toggle speaker on/off
  const handleToggleSpeaker = () => {
    const newEnabled = !isSpeakerEnabled;
    setIsSpeakerEnabled(newEnabled);
    // Mute/unmute all audio elements
    audioRefs.current.forEach((audio) => {
      audio.muted = !newEnabled;
    });
  };

  // Rules mode: Check if user can unmute
  const isModerator = moderatorId === currentUserId;

  // In RULES mode, only the moderator can manually unmute
  // (Current speaker is auto-unmuted when their turn starts)
  const canUnmute = voiceChatMode === 'FREE' || isModerator;

  // Get reason why mute is disabled
  const getMuteDisabledReason = (): string => {
    if (voiceChatMode !== 'RULES') return '';
    if (isModerator) return '';
    return t('voice_chat_rules_mute_locked') || 'Only moderator can unmute in Rules mode';
  };

  // Get quality indicator for a peer
  const getQualityIndicator = (peerId: string): { color: string; label: string } => {
    const quality = connectionQualities.find(q => q.peerId === peerId);
    if (!quality) return { color: '#94a3b8', label: 'Unknown' };

    const rtt = quality.rtt || 0;
    const lossRate = quality.packetsLost && quality.packetsReceived
      ? (quality.packetsLost / (quality.packetsReceived + quality.packetsLost)) * 100
      : 0;

    if (rtt < 100 && lossRate < 1) {
      return { color: '#10b981', label: 'Excellent' };
    } else if (rtt < 200 && lossRate < 5) {
      return { color: '#f59e0b', label: 'Good' };
    } else {
      return { color: '#ef4444', label: 'Poor' };
    }
  };

  // Attach remote streams to audio elements
  useEffect(() => {
    remotePeers.forEach(peer => {
      if (peer.audioStream) {
        let audio = audioRefs.current.get(peer.odUserId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audioRefs.current.set(peer.odUserId, audio);
          registerAudioElement(peer.odUserId, audio);
        }
        if (audio.srcObject !== peer.audioStream) {
          audio.srcObject = peer.audioStream;
        }
      }
    });

    // Cleanup disconnected peers
    audioRefs.current.forEach((audio, odUserId) => {
      if (!remotePeers.find(p => p.odUserId === odUserId)) {
        audio.srcObject = null;
        audioRefs.current.delete(odUserId);
        unregisterAudioElement(odUserId);
      }
    });
  }, [remotePeers, registerAudioElement, unregisterAudioElement]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRefs.current.forEach((audio, odUserId) => {
        audio.srcObject = null;
        unregisterAudioElement(odUserId);
      });
      audioRefs.current.clear();
    };
  }, [unregisterAudioElement]);

  const handleOpenMeet = () => {
    if (meetLink) {
      window.open(meetLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="voice-chat">
      <div className="voice-chat-header">
        <h3 className="voice-chat-title">
          <FiMic size={16} />
          {t('voice_chat_title') || 'Voice Chat'}
        </h3>
        {communicationMode === 'webrtc' && isJoined && (
          <span className="voice-chat-status connected">
            {t('voice_chat_connected') || 'Connected'}
          </span>
        )}
      </div>

      {/* Communication Mode Selection */}
      <div className="comm-mode-section">
        <h4 className="comm-mode-title">
          {t('voice_comm_mode_title') || 'Voice Chat Mode'}
        </h4>
        <div className="comm-mode-buttons">
          <button
            className={`comm-mode-btn ${communicationMode === 'webrtc' ? 'active' : ''}`}
            onClick={() => onCommunicationModeChange('webrtc')}
          >
            <span className="comm-mode-icon">🎤</span>
            <span className="comm-mode-label">
              {t('voice_comm_mode_webrtc') || 'Built-in Voice'}
            </span>
            <span className="comm-mode-beta">Beta</span>
          </button>
          <button
            className={`comm-mode-btn ${communicationMode === 'google-meet' ? 'active' : ''}`}
            onClick={() => onCommunicationModeChange('google-meet')}
          >
            <span className="comm-mode-icon">📹</span>
            <span className="comm-mode-label">
              {t('voice_comm_mode_meet') || 'Google Meet'}
            </span>
          </button>
        </div>
      </div>

      {/* ============================================ */}
      {/* Google Meet Mode */}
      {/* ============================================ */}
      {communicationMode === 'google-meet' && (
        <>
          {/* Meet Link Button */}
          <div className="meet-link-section">
            {meetLink ? (
              <>
                <button className="meet-join-btn" onClick={handleOpenMeet}>
                  <FiVideo size={18} />
                  {t('meet_join_google_meet') || 'Join Google Meet'}
                  <FiExternalLink size={14} />
                </button>
                <p className="meet-link-hint">
                  {t('meet_join_hint') || 'Opens video conference in new tab'}
                </p>
              </>
            ) : (
              <div className="meet-link-error">
                <FiAlertCircle size={16} />
                <span>{t('meeting_no_link') || 'Meet link is not available'}</span>
              </div>
            )}
          </div>

          {/* Discussion Rules */}
          <div className="voice-rules-card">
            <h4 className="voice-rules-title">
              <FiInfo size={14} />
              {t('meet_discussion_rules') || 'Discussion Rules'}
            </h4>
            <ul className="voice-rules-list">
              <li><span className="voice-rules-bullet">•</span>{t('meet_rule_1') || 'One speaker at a time'}</li>
              <li><span className="voice-rules-bullet">•</span>{t('meet_rule_2') || 'Moderator controls the flow'}</li>
              <li><span className="voice-rules-bullet">•</span>{t('meet_rule_3') || 'Raise hand to speak next'}</li>
              <li><span className="voice-rules-bullet">•</span>{t('meet_rule_4') || '3-minute speaking limit'}</li>
            </ul>
          </div>
        </>
      )}

      {/* ============================================ */}
      {/* WebRTC Mode */}
      {/* ============================================ */}
      {communicationMode === 'webrtc' && (
        <>
          {/* WebSocket connection warning */}
          {!isWsConnected && (
            <div className="voice-chat-warning">
              <FiWifiOff size={16} />
              <span>{t('voice_chat_ws_disconnected') || 'Connection lost. Reconnecting...'}</span>
            </div>
          )}

          {/* Mesh limit warning */}
          {meshWarning && (
            <div className="voice-chat-warning">
              <FiAlertTriangle size={16} />
              <span>{meshWarning}</span>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="voice-chat-error">
              <FiAlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Voice Chat Mode Selection (RULES/FREE) */}
          <div className="voice-mode-section">
            <h4 className="voice-mode-title">
              <FiSettings size={14} />
              {t('voice_chat_mode_title') || 'Discussion Mode'}
            </h4>
            <div className="voice-mode-buttons">
              <button
                className={`voice-mode-btn ${voiceChatMode === 'RULES' ? 'active' : ''}`}
                onClick={() => isHost && onChangeChatMode('RULES')}
                disabled={!isHost}
                title={!isHost ? (t('voice_chat_mode_host_only') || 'Only moderator can change') : ''}
              >
                <div className="voice-mode-btn-content">
                  <div className="voice-mode-icon">
                    <RiHandHeartLine size={16} />
                  </div>
                  <span className="voice-mode-label">{t('voice_chat_mode_rules') || 'Rules Mode'}</span>
                </div>
                <p className="voice-mode-desc">{t('voice_chat_mode_rules_desc') || 'Only hand-raised speakers'}</p>
              </button>
              <button
                className={`voice-mode-btn ${voiceChatMode === 'FREE' ? 'active' : ''}`}
                onClick={() => isHost && onChangeChatMode('FREE')}
                disabled={!isHost}
                title={!isHost ? (t('voice_chat_mode_host_only') || 'Only moderator can change') : ''}
              >
                <div className="voice-mode-btn-content">
                  <div className="voice-mode-icon">
                    <RiChat1Line size={16} />
                  </div>
                  <span className="voice-mode-label">{t('voice_chat_mode_free') || 'Free Mode'}</span>
                </div>
                <p className="voice-mode-desc">{t('voice_chat_mode_free_desc') || 'Everyone can speak freely'}</p>
              </button>
            </div>
          </div>

          {/* Not joined state */}
          {!isJoined && (
            <div className="voice-chat-join-section">
              <p className="voice-chat-hint">
                {t('voice_chat_hint') || 'Join voice chat to talk with other participants'}
              </p>
              <button
                className="voice-chat-join-btn"
                onClick={onJoin}
                disabled={!!error || !isWsConnected}
              >
                <FiPhone size={18} />
                {t('voice_chat_join') || 'Join Voice'}
              </button>
              {!isWsConnected && (
                <p className="voice-chat-hint-warning">
                  {t('voice_chat_wait_connection') || 'Waiting for connection...'}
                </p>
              )}
            </div>
          )}

          {/* Joined state */}
          {isJoined && (
            <>
              {/* Audio Controls Card */}
              <div className={`voice-controls-card ${isControlsExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="voice-controls-header" onClick={() => setIsControlsExpanded(!isControlsExpanded)}>
                  <h4 className="voice-controls-title">{t('voice_chat_audio_controls') || 'Audio Controls'}</h4>
                  <button className="voice-controls-toggle">
                    {isControlsExpanded ? <RiArrowUpSLine size={20} /> : <RiArrowDownSLine size={20} />}
                  </button>
                </div>

                <div className="voice-controls-content">
                  <div className="voice-controls-inner">
                  {/* Mic and Leave buttons */}
                  <div className="voice-chat-controls">
                    <div className="voice-control-row">
                      <div className="voice-control-label">
                        {isMuted ? <FiMicOff size={18} /> : <FiMic size={18} />}
                        <span>{t('voice_chat_microphone') || 'Microphone'}</span>
                      </div>
                      <button
                        className={`voice-toggle-btn ${isMuted ? 'off' : 'on'} ${!canUnmute && isMuted ? 'disabled' : ''}`}
                        onClick={onToggleMute}
                        disabled={!canUnmute && isMuted}
                        title={!canUnmute && isMuted ? getMuteDisabledReason() : ''}
                      >
                        {isMuted ? 'OFF' : 'ON'}
                      </button>
                    </div>
                    {/* Rules mode warning when mute is locked */}
                    {voiceChatMode === 'RULES' && !canUnmute && isMuted && (
                      <div className="voice-control-warning">
                        <FiAlertCircle size={14} />
                        <span>{getMuteDisabledReason()}</span>
                      </div>
                    )}

                    <div className="voice-control-row">
                      <div className="voice-control-label">
                        {isSpeakerEnabled ? <FiVolume2 size={18} /> : <FiVolumeX size={18} />}
                        <span>{t('voice_chat_speaker') || 'Speaker'}</span>
                      </div>
                      <button
                        className={`voice-toggle-btn ${isSpeakerEnabled ? 'on' : 'off'}`}
                        onClick={handleToggleSpeaker}
                      >
                        {isSpeakerEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {/* Volume Slider */}
                    <div className="voice-volume-row">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => onVolumeChange(Number(e.target.value))}
                        className="voice-volume-slider"
                      />
                      <span className="voice-volume-value">{volume}%</span>
                    </div>
                  </div>

                  {/* Device Selection */}
                  <div className="voice-device-section">
                    {/* Input Device (Microphone) */}
                    <div className="voice-device-group">
                      <label className="voice-device-label">
                        <FiMic size={14} />
                        {t('voice_chat_input_device') || 'Microphone'}
                      </label>
                      <select
                        className="voice-device-select"
                        value={currentInputDeviceId || ''}
                        onChange={(e) => onChangeInputDevice(e.target.value)}
                      >
                        {audioInputDevices.map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Output Device (Speaker) */}
                    {audioOutputDevices.length > 0 && (
                      <div className="voice-device-group">
                        <label className="voice-device-label">
                          <FiVolume2 size={14} />
                          {t('voice_chat_output_device') || 'Speaker'}
                        </label>
                        {hasSinkIdSupport ? (
                          <select
                            className="voice-device-select"
                            value={currentOutputDeviceId || ''}
                            onChange={(e) => onChangeOutputDevice(e.target.value)}
                          >
                            {audioOutputDevices.map(device => (
                              <option key={device.deviceId} value={device.deviceId}>
                                {device.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="voice-device-unsupported">
                            {t('voice_chat_output_not_supported') || 'Output device selection not supported in this browser'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Leave Button */}
                  <button
                    className="voice-leave-btn"
                    onClick={onLeave}
                  >
                    <FiPhoneOff size={18} />
                    {t('voice_chat_leave') || 'Leave Voice Chat'}
                  </button>
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div className="voice-chat-participants">
                <h4 className="voice-participants-title">
                  <FiUser size={14} />
                  {t('voice_chat_participants') || 'Voice Participants'} ({remotePeers.length + 1})
                </h4>

                {/* Current user */}
                <div className={`voice-chat-participant ${isMuted ? 'muted' : ''} ${isSpeaking && !isMuted ? 'speaking' : ''}`}>
                  <div className="voice-participant-avatar">
                    {currentPhotoUrl ? (
                      <img src={currentPhotoUrl} alt={currentUsername} />
                    ) : (
                      <FiUser size={16} />
                    )}
                    {isSpeaking && !isMuted && <span className="speaking-indicator" />}
                  </div>
                  <span className="voice-participant-name">
                    {currentUsername} {t('voice_chat_you') || '(You)'}
                  </span>
                  {isMuted && <FiMicOff size={14} className="voice-participant-muted" />}
                </div>

                {/* Remote peers */}
                {remotePeers.map(peer => {
                  const isPeerSpeaking = peerSpeakingStatus?.get(peer.odUserId) || false;
                  const quality = getQualityIndicator(peer.odUserId);

                  return (
                    <div
                      key={peer.odUserId}
                      className={`voice-chat-participant ${peer.isMuted ? 'muted' : ''} ${isPeerSpeaking ? 'speaking' : ''}`}
                    >
                      <div className="voice-participant-avatar">
                        {peer.photoUrl ? (
                          <img src={peer.photoUrl} alt={peer.username} />
                        ) : (
                          <FiUser size={16} />
                        )}
                        {isPeerSpeaking && <span className="speaking-indicator" />}
                      </div>
                      <span className="voice-participant-name">{peer.username}</span>
                      <span
                        className="voice-quality-dot"
                        style={{ backgroundColor: quality.color }}
                        title={`${quality.label} connection`}
                      />
                      {peer.isMuted && <FiMicOff size={14} className="voice-participant-muted" />}
                    </div>
                  );
                })}

                {/* Empty state */}
                {remotePeers.length === 0 && (
                  <p className="voice-chat-empty">
                    {t('voice_chat_waiting') || 'Waiting for others to join...'}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Discussion Rules - only shown in RULES mode */}
          {voiceChatMode === 'RULES' && (
            <div className="voice-rules-card">
              <h4 className="voice-rules-title">
                <FiInfo size={14} />
                {t('meet_discussion_rules') || 'Discussion Rules'}
              </h4>
              <ul className="voice-rules-list">
                <li><span className="voice-rules-bullet">•</span>{t('meet_rule_1') || 'One speaker at a time'}</li>
                <li><span className="voice-rules-bullet">•</span>{t('meet_rule_2') || 'Moderator controls the flow'}</li>
                <li><span className="voice-rules-bullet">•</span>{t('meet_rule_3') || 'Raise hand to speak next'}</li>
                <li><span className="voice-rules-bullet">•</span>{t('meet_rule_4') || '3-minute speaking limit'}</li>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VoiceChat;
