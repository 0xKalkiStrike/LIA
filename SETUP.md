# LIA AI — Setup & Architecture

## What Changed

### ✅ Database Migration
- **Old**: SQLite (data/jarvis.db)
- **New**: JSON files in data/ directory

**Benefits**:
- No database dependencies
- Easy to version control
- Human-readable data
- Simple to backup

### ✅ Authentication
- **Old**: Session tokens (stored in Sessions table)
- **New**: JWT tokens (self-contained, 12-hour expiry)

**Benefits**:
- Stateless authentication
- No server-side session storage
- Easier for APIs and mobile apps
- Token contains user_id directly

### ✅ Code Cleanup
Removed:
- core/database.py - SQLite wrapper (replaced by json_db.py)
- core/security.py - Session management (replaced by jwt_security.py)
- Unnecessary .md, .txt, .log files from project root

## New Modules

### core/json_db.py
Simple JSON file database with these operations:
- json_db.get(collection, doc_id) - Get document
- json_db.find(collection, query) - Find documents
- json_db.insert(collection, doc_id, doc) - Create/update
- json_db.delete(collection, doc_id) - Delete
- json_db.delete_many(collection, query) - Delete multiple

### core/jwt_security.py
JWT authentication:
- create_token(user_id) - Generate JWT
- decode_token(token) - Validate JWT
- get_user_id_from_token(token) - Extract user_id

## Collections (JSON Files)

`
data/
├── users.json           # Username, display_name, secret_hash
├── profiles.json        # Character customization per user
├── memories.json        # Long-term memories
├── conversations.json   # Chat history
├── tasks.json          # User tasks
├── notes.json          # User notes
├── calendar_events.json # Calendar events
├── reminders.json      # Reminders
├── voice_settings.json # Voice preferences
├── detections.json     # Vision/telemetry events
└── logs.json           # Event logs
`

## Running the Application

`ash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start backend (port 8001)
python run.py

# 3. Start frontend (in another terminal)
cd frontend
npm run dev
# Frontend runs on port 3000
`

## API Authentication

### Signup
`bash
curl -X POST http://localhost:8001/api/signup \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "alice",
    "display_name": "Alice",
    "secret_word": "my-secret",
    "profile": {"char_name": "LIA"}
  }'
`

**Response**:
`json
{
  "token": "eyJ...",
  "profile": {
    "username": "alice",
    "char_name": "LIA",
    ...
  }
}
`

### Login
`bash
curl -X POST http://localhost:8001/api/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "alice",
    "secret_word": "my-secret"
  }'
`

### Authenticated Request
`bash
curl -X GET http://localhost:8001/api/profile \\
  -H "Authorization: Bearer <token>"
`

## Configuration

Edit config/settings.json:
`json
{
  "host": "127.0.0.1",
  "port": 8001,
  "ollama_url": "http://localhost:11434",
  "ollama_model": "llama3.2"
}
`

## Environment Variables (Optional)

`ash
# Change JWT secret for production
JWT_SECRET_KEY=your-super-secret-key

# Ollama configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
`

## File Structure

`
C:\hacker\LIA\
├── api/
│   └── server.py         # FastAPI backend
├── core/
│   ├── json_db.py        # JSON database
│   ├── jwt_security.py   # JWT auth
│   └── config.py         # Settings loader
├── agents/
│   ├── auth_agent.py     # User management
│   ├── memory_agent.py   # Long-term memory
│   ├── productivity.py   # Notes, Tasks, Calendar
│   └── ...
├── frontend/
│   └── src/
│       ├── app/          # Next.js pages
│       ├── components/   # React components
│       └── context/      # AppContext (state management)
├── data/                 # JSON database files
├── config/               # Configuration files
└── run.py               # Backend launcher
`

## Troubleshooting

### 401 Unauthorized
- Make sure Bearer token is in Authorization header
- Token may be expired (12 hours)
- Re-login to get a new token

### Port already in use
- Change port in config/settings.json
- Update frontend API_BASE in frontend/src/context/AppContext.tsx line 199

### Conversations collection missing
- Run json_db.init_db() to create empty collections
- Collections auto-create on first use

### PyJWT not installed
- Run: `pip install pyjwt`

## Development Notes

### Adding a new user field
1. Update ENUMS in gents/auth_agent.py
2. Update _validate() function
3. Restart backend
4. JSON schema updates automatically

### Adding a new collection
1. Add to COLLECTIONS dict in core/json_db.py
2. Call json_db.init_db() to create file
3. Use json_db.insert(), json_db.find(), etc.

### Custom JSON migrations
- JSON files are in human-readable format
- Edit directly for data fixes
- Restart backend to pick up changes

## Next Steps

1. ✅ JSON database setup
2. ✅ JWT authentication
3. ✅ Clean up old code
4. 🔜 Consider adding:
   - Encryption for sensitive data in JSON
   - Automatic JSON backup
   - Database versioning
   - Export/import utilities

---

**LIA AI** — Smart Assistant with JSON storage and JWT auth
