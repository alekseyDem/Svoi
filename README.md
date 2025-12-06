# Svoi (Свои) — Video Calling for Your People

A simple, barrier-free video calling app to connect with family and friends. Built with React, Node.js, WebRTC, and Socket.io.

## Features

- 1-1 video calls — just share a room code
- Works where other services don't
- Mute/unmute audio
- Turn video on/off
- Clean, modern UI

## Getting Started

### Prerequisites

- Node.js 18+ installed

### Installation

1. Install backend dependencies:
```bash
cd backend
npm install
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

### Running the Application

1. Start the backend server (runs on port 3001):
```bash
cd backend
npm start
```

2. In a new terminal, start the frontend (runs on port 5173):
```bash
cd frontend
npm run dev
```

3. Open http://localhost:5173 in your browser

### Making a Call

1. Enter a room code or click the generate button to create one
2. Click "Join Call"
3. Share the room code with another person
4. They enter the same room code and join
5. The video call will start automatically

## Deploy to Railway (One-Click)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) and create account
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your repo
5. Railway will auto-detect and deploy everything
6. Click **"Generate Domain"** in Settings to get your public URL

That's it! Share the URL with family 🎉

## Tech Stack

- **Frontend**: React 18, Vite
- **Backend**: Node.js, Express, Socket.io
- **Real-time Communication**: WebRTC with STUN servers

# Svoi
# Svoi
