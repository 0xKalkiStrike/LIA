# Port Forwarding & Server Setup Guide

## Quick Start
Your LIA server runs on **port 8000** and by default only accepts localhost connections. This guide shows how to expose it for external access across all devices (mobile, tablet, TV, desktop, laptop).

---

## Part 1: Server Configuration (Backend)

### Step 1: Allow External Connections

Edit `C:\hacker\LIA\run.py` to accept external connections:

```python
if __name__ == "__main__":
    init_db()
    host = setting("host", "0.0.0.0")  # Changed from 127.0.0.1
    port = setting("port", 8000)
    print(f"\n  LIA online  ->  http://0.0.0.0:{port}\n")
    uvicorn.run("api.server:app", host=host, port=port, reload=False)
```

Or set via environment before running:
```powershell
$env:LIA_HOST = "0.0.0.0"
$env:LIA_PORT = "8000"
python run.py
```

### Step 2: Get Your Machine's IP Address

Run this command:
```powershell
ipconfig | findstr "IPv4"
```

You'll see something like: `192.168.1.100` or `10.0.0.50` — **This is your Local Network IP**

---

## Part 2: Router Port Forwarding (External Access)

### For accessing LIA from outside your home network:

1. **Open your router settings**
   - Type `192.168.1.1` (or `192.168.0.1`) in browser
   - Log in (admin/admin or see router manual)

2. **Find Port Forwarding section** (varies by router)
   - Look for: Port Forwarding, Port Mapping, Virtual Server, etc.

3. **Create forwarding rule:**
   ```
   External Port: 8000 (or any unused port like 7080)
   Internal IP: [Your machine IP from Step 2, e.g., 192.168.1.100]
   Internal Port: 8000
   Protocol: TCP
   ```

4. **Get your public IP:**
   - Visit https://whatismyipaddress.com
   - Now accessible at: `http://YOUR_PUBLIC_IP:8000` from anywhere

---

## Part 3: Updated Frontend Configuration

### Update Frontend Environment

Edit `frontend/.env.local` (or create it):

```env
# Use local IP for LAN access (all devices on same network)
NEXT_PUBLIC_API_URL=http://192.168.1.100:8000

# Or for external access (from outside your network):
# NEXT_PUBLIC_API_URL=http://YOUR_PUBLIC_IP:8000
```

### Update Frontend API Calls

In `frontend/src/context/AppContext.tsx`, update the API base URL:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Usage in fetch calls:
const response = await fetch(`${API_URL}/api/auth/login`, {
  method: 'POST',
  // ... rest of request
});
```

---

## Part 4: Device Access URLs

### On Your Local Network (Laptop, Desktop, Tablet, Mobile, TV):
```
http://192.168.1.100:8000  (replace with your IP from Part 2 Step 2)
```

### From Outside Your Network (Mobile on 4G, Friends' House):
```
http://YOUR_PUBLIC_IP:8000  (from Part 2 Step 4)
```

### Same Machine (Localhost):
```
http://localhost:8000
http://127.0.0.1:8000
```

---

## Part 5: Security (Important!)

### Firewall Setup

**Windows Firewall:**
```powershell
# Allow port 8000
netsh advfirewall firewall add rule name="LIA Server" dir=in action=allow protocol=tcp localport=8000

# To remove:
netsh advfirewall firewall delete rule name="LIA Server"
```

### HTTPS for External Access (Recommended)

For public IP access, use HTTPS with a free cert:

1. **Install certbot:**
   ```powershell
   pip install certbot certbot-dns-cloudflare
   ```

2. **Get certificate (with CloudFlare or other DNS):**
   ```powershell
   certbot certonly --dns-cloudflare -d yourdomain.com
   ```

3. **Update FastAPI to use SSL:**
   ```python
   uvicorn.run(
       "api.server:app",
       host="0.0.0.0",
       port=8000,
       ssl_keyfile="/path/to/privkey.pem",
       ssl_certfile="/path/to/fullchain.pem"
   )
   ```

### Rate Limiting (Protect from abuse):

In `api/server.py`, add middleware:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# Apply to endpoints:
@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginBody):
    # ... your code
```

---

## Part 6: Testing on Different Devices

### Laptop/Desktop:
```
1. Open http://192.168.1.100:8000 in browser
2. Test: Try opening DevTools (F12) → Responsive Design Mode
3. Test different viewport sizes
```

### Tablet/Mobile:
```
1. On same WiFi as your machine
2. Open browser → Type: http://192.168.1.100:8000
3. Test touch interactions
4. Test portrait/landscape orientation
```

### Smart TV:
```
1. Cast from laptop: Use Chrome's cast feature
2. Or open TV's browser: http://192.168.1.100:8000
3. Test navigation with TV remote
```

### External Mobile:
```
1. Switch to 4G/LTE
2. Visit: http://YOUR_PUBLIC_IP:8000
3. Test with network throttling
```

---

## Part 7: Environment Variables Reference

Create `.env` file in root directory:

```
# Backend Settings
HOST=0.0.0.0
PORT=8000

# Frontend (Next.js)
# NEXT_PUBLIC_API_URL=http://192.168.1.100:8000

# Optional: Database
# DATABASE_URL=sqlite:///./data/chroma/chroma.sqlite3

# Optional: CORS
# CORS_ORIGINS=["http://localhost:3000", "http://192.168.1.100:8000"]
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't access from local IP | Check firewall allows port 8000 via `netsh` command above |
| Can't access from external IP | Verify router port forwarding is enabled & correct internal IP |
| Frontend won't load API calls | Ensure `NEXT_PUBLIC_API_URL` matches your server IP:port |
| Mobile shows CORS error | Check `CORSMiddleware` in `api/server.py` allows your IP |
| LIA won't start | Run `.venv\Scripts\python.exe run.py` or `python run.py` |
| Port already in use | See `run.bat` for how to kill existing process |

---

## Next: Responsive UI

Your UI is now **live across all networks!** 

Next step: Run `/responsive-ui` guide to make the interface adapt beautifully to each device size.
