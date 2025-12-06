import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import './App.css'

// For local development: 'http://localhost:3001'
// For public access: replace with your ngrok backend URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

function App() {
  const [roomId, setRoomId] = useState('')
  const [inCall, setInCall] = useState(false)
  const [connected, setConnected] = useState(false)
  const [remoteConnected, setRemoteConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  const socketRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const localStreamRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const otherUserRef = useRef(null)

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(iceServers)

    pc.onicecandidate = (event) => {
      if (event.candidate && otherUserRef.current) {
        socketRef.current.emit('ice-candidate', {
          to: otherUserRef.current,
          candidate: event.candidate
        })
      }
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
        setRemoteConnected(true)
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteConnected(false)
      }
    }

    return pc
  }, [])

  const startCall = useCallback(async (userId) => {
    otherUserRef.current = userId
    peerConnectionRef.current = createPeerConnection()

    localStreamRef.current.getTracks().forEach(track => {
      peerConnectionRef.current.addTrack(track, localStreamRef.current)
    })

    const offer = await peerConnectionRef.current.createOffer()
    await peerConnectionRef.current.setLocalDescription(offer)

    socketRef.current.emit('offer', { to: userId, offer })
  }, [createPeerConnection])

  const handleOffer = useCallback(async ({ from, offer }) => {
    otherUserRef.current = from
    peerConnectionRef.current = createPeerConnection()

    localStreamRef.current.getTracks().forEach(track => {
      peerConnectionRef.current.addTrack(track, localStreamRef.current)
    })

    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peerConnectionRef.current.createAnswer()
    await peerConnectionRef.current.setLocalDescription(answer)

    socketRef.current.emit('answer', { to: from, answer })
  }, [createPeerConnection])

  const handleAnswer = useCallback(async ({ answer }) => {
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
  }, [])

  const handleIceCandidate = useCallback(async ({ candidate }) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
    }
  }, [])

  const joinRoom = async () => {
    if (!roomId.trim()) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })

      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      socketRef.current = io(SOCKET_URL)

      socketRef.current.on('connect', () => {
        setConnected(true)
        socketRef.current.emit('join-room', roomId)
      })

      socketRef.current.on('other-user', (userId) => {
        startCall(userId)
      })

      socketRef.current.on('user-joined', (userId) => {
        otherUserRef.current = userId
      })

      socketRef.current.on('offer', handleOffer)
      socketRef.current.on('answer', handleAnswer)
      socketRef.current.on('ice-candidate', handleIceCandidate)

      socketRef.current.on('user-left', () => {
        setRemoteConnected(false)
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close()
          peerConnectionRef.current = null
        }
        otherUserRef.current = null
      })

      socketRef.current.on('room-full', () => {
        alert('Комната занята. Только 2 человека могут участвовать в звонке.')
        leaveCall()
      })

      setInCall(true)
    } catch (error) {
      console.error('Error accessing media devices:', error)
      alert('Не удалось получить доступ к камере/микрофону. Проверьте разрешения.')
    }
  }

  const leaveCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
    if (socketRef.current) {
      socketRef.current.disconnect()
    }

    localStreamRef.current = null
    peerConnectionRef.current = null
    socketRef.current = null
    otherUserRef.current = null

    setInCall(false)
    setConnected(false)
    setRemoteConnected(false)
    setIsMuted(false)
    setIsVideoOff(false)
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOff(!videoTrack.enabled)
      }
    }
  }

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8)
    setRoomId(id)
  }

  useEffect(() => {
    return () => {
      leaveCall()
    }
  }, [])

  if (!inCall) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15.5 10.5l4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25z"/>
              </svg>
            </div>
            <h1>Svoi</h1>
          </div>
          <p className="subtitle">Видеозвонки для своих</p>
          
          <div className="input-group">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Код комнаты"
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            />
            <button className="generate-btn" onClick={generateRoomId} title="Generate code">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
          
          <button className="join-btn" onClick={joinRoom} disabled={!roomId.trim()}>
            Позвонить
          </button>
          
          <p className="hint">Отправьте код комнаты тому, с кем хотите поговорить</p>
        </div>
      </div>
    )
  }

  return (
    <div className="call-container">
      <div className="videos-wrapper">
        <div className={`video-box remote ${remoteConnected ? 'active' : ''}`}>
          <video ref={remoteVideoRef} autoPlay playsInline />
          {!remoteConnected && (
            <div className="waiting">
              <div className="waiting-animation">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>Ждём второго участника...</p>
              <p className="room-code">Комната: <strong>{roomId}</strong></p>
            </div>
          )}
        </div>
        
        <div className={`video-box local ${isVideoOff ? 'video-off' : ''}`}>
          <video ref={localVideoRef} autoPlay playsInline muted />
          {isVideoOff && (
            <div className="video-off-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15.5 10.5l4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25z"/>
                <line x1="2" y1="2" x2="22" y2="22"/>
              </svg>
            </div>
          )}
          <span className="you-label">Вы</span>
        </div>
      </div>

      <div className="controls">
        <button 
          className={`control-btn ${isMuted ? 'off' : ''}`} 
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </button>

        <button 
          className={`control-btn ${isVideoOff ? 'off' : ''}`} 
          onClick={toggleVideo}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15.5 10.5l4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25z"/>
              <line x1="2" y1="2" x2="22" y2="22"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15.5 10.5l4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25z"/>
            </svg>
          )}
        </button>

        <button className="control-btn end-call" onClick={leaveCall} title="Leave call">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 5.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.59 10.4a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 23 16.92z" transform="rotate(135 12 12)"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default App

