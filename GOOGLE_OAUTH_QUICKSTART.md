# Google OAuth Quick Start (5 Minutes)

## Step 1: Get Google Client ID (2 minutes)

1. Go to https://console.cloud.google.com/
2. Create new project → Name it "Breast Cancer Detection"
3. Go to APIs & Services → Library
4. Search "Google+ API" → Enable it
5. Go to Credentials → Create OAuth 2.0 Web Application
6. Add URIs:
   - `http://localhost:3000`
   - `http://localhost:3001`
7. Copy the **Client ID**

## Step 2: Configure Environment (1 minute)

**Create `frontend/.env.local`:**
```
REACT_APP_GOOGLE_CLIENT_ID=paste_your_client_id_here
REACT_APP_API_BASE_URL=http://localhost:8001
```

**Update `backend/.env`:**
```
GOOGLE_CLIENT_ID=paste_your_client_id_here
```

## Step 3: Install & Run (2 minutes)

```bash
# Backend
cd backend
pip install -r requirements.txt
python main.py

# Frontend (new terminal)
cd frontend
npm install
npm start
```

## Step 4: Test

1. Go to http://localhost:3000/signup
2. Click "Sign up with Google"
3. Sign in with your Google account
4. Done! ✅

## That's It!

Your app now has Google Sign-Up. Users can:
- Sign up with Google
- Log in with Google
- Use email/password as before

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Button not showing | Check `REACT_APP_GOOGLE_CLIENT_ID` in `.env.local` |
| "Invalid token" | Verify Client ID matches in frontend and backend |
| CORS error | Add your domain to authorized redirect URIs |
| User not created | Check backend logs and database connection |

## Next: Deploy to Production

1. Update authorized redirect URIs with your domain
2. Use HTTPS (required by Google)
3. Update `.env` files with production values
4. Deploy backend and frontend

## Need Help?

See `GOOGLE_OAUTH_SETUP.md` for detailed instructions.
