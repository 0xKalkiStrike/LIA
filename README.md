# LIA AI — Smart Assistant

A Next.js + FastAPI AI assistant with JWT authentication and JSON-based database.

## Setup

### 1. Install Dependencies

`bash
pip install -r requirements.txt
cd frontend && npm install && cd ..
`

### 2. Start the Backend

`bash
python run.py
`

Backend runs on **http://localhost:8001**

### 3. Start the Frontend (in another terminal)

`bash
cd frontend
npm run dev
`

Frontend runs on **http://localhost:3000**

## Architecture

### Backend (FastAPI on port 8001)
- **Authentication**: JWT tokens (12-hour expiry)
- **Database**: JSON files in data/ directory
- **Key Routes**:
  - POST /api/signup - Create account
  - POST /api/login - Login (returns JWT token)
  - GET /api/profile - Get user profile (requires Bearer token)
  - POST /api/profile - Update profile
  - WebSocket /api/ws - Real-time chat stream

### Frontend (Next.js on port 3000)
- Character creator with customization
- Chat interface with LIA AI
- Productivity suite (Notes, Tasks, Calendar, Reminders)
- Authentication via localStorage

### Database (JSON Files)
Located in data/:
- users.json - User accounts
- profiles.json - Character customization
- memories.json - Long-term memory
- tasks.json, notes.json - Productivity
- calendar_events.json, reminders.json - Calendar
- voice_settings.json - Voice preferences

## Authentication

1. Signup: POST /api/signup → returns JWT token
2. Login: POST /api/login → returns JWT token  
3. Use token: Authorization: Bearer <token> in all requests
4. Token expires after 12 hours

## Getting Started

`bash
# Terminal 1: Start backend
python run.py

# Terminal 2: Start frontend
cd frontend && npm run dev
`

Then visit http://localhost:3000 and create your account!
