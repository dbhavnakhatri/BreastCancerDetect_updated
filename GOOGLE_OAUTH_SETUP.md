# Google OAuth Setup Guide

This guide explains how to set up Google Sign-Up functionality for your Breast Cancer Detection application.

## Prerequisites

- Google Cloud Project
- Frontend and Backend running

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - `http://localhost:3000` (for local development)
   - `http://localhost:3001` (if using different port)
   - Your production domain (e.g., `https://yourdomain.com`)
5. Click "Create"
6. Copy your **Client ID** (you'll need this)

## Step 3: Configure Frontend

Add your Google Client ID to `.env.local` in the frontend directory:

```bash
# frontend/.env.local
REACT_APP_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
```

Replace `YOUR_GOOGLE_CLIENT_ID_HERE` with the Client ID from Step 2.

## Step 4: Configure Backend

Add your Google Client ID to `.env` in the backend directory:

```bash
# backend/.env
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
```

## Step 5: Install Dependencies

### Frontend
```bash
cd frontend
npm install
```

### Backend
```bash
cd backend
pip install -r requirements.txt
```

The new dependencies added:
- `google-auth` - Google authentication library
- `google-auth-oauthlib` - OAuth support
- `google-auth-httplib2` - HTTP support

## Step 6: Restart Services

1. **Backend**: Restart your FastAPI server
   ```bash
   python backend/main.py
   ```

2. **Frontend**: Restart your React development server
   ```bash
   npm start
   ```

## Step 7: Test Google Sign-Up

1. Go to the Sign-Up page
2. You should see a "Sign up with Google" button
3. Click it and follow the Google authentication flow
4. You should be automatically logged in and redirected to the upload page

## How It Works

### Frontend Flow
1. User clicks "Sign up with Google" button
2. Google Sign-In dialog appears
3. User authenticates with Google
4. Google returns an ID token
5. Frontend sends token to backend `/auth/google` endpoint
6. User is logged in and redirected

### Backend Flow
1. Backend receives Google ID token
2. Verifies token with Google's servers
3. Extracts user email and name
4. Checks if user exists in database
5. If new user: Creates account with random password
6. If existing user: Logs them in
7. Returns JWT access token
8. Frontend stores token and redirects to app

## Environment Variables

### Frontend (.env.local)
```
REACT_APP_GOOGLE_CLIENT_ID=your_client_id
REACT_APP_API_BASE_URL=http://localhost:8001
```

### Backend (.env)
```
GOOGLE_CLIENT_ID=your_client_id
DATABASE_URL=your_database_url
```

## Troubleshooting

### Issue: "Google Sign-In button not appearing"
- Check that `REACT_APP_GOOGLE_CLIENT_ID` is set in `.env.local`
- Verify the Client ID is correct
- Check browser console for errors

### Issue: "Invalid Google token"
- Ensure the Client ID in backend `.env` matches frontend
- Check that Google+ API is enabled in Google Cloud Console
- Verify the token hasn't expired

### Issue: "User already exists"
- This is normal if the email is already registered
- The user will be logged in instead of creating a new account

### Issue: "CORS error"
- Make sure backend CORS is configured correctly
- Check that frontend URL is in authorized redirect URIs

## Security Notes

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Keep Client ID secret** - Don't expose in public repositories
3. **Use HTTPS in production** - Google OAuth requires HTTPS
4. **Validate tokens on backend** - Always verify tokens server-side
5. **Use secure session storage** - Tokens are stored in sessionStorage (cleared on browser close)

## Files Modified

### Frontend
- `frontend/src/context/AuthContext.js` - Added `googleSignup` function
- `frontend/src/components/Signup.js` - Added Google Sign-In button
- `frontend/src/components/Auth.css` - Added styling for Google button

### Backend
- `backend/api_routes.py` - Added `/auth/google` endpoint
- `backend/requirements.txt` - Added Google auth libraries

## Next Steps

1. Test the Google Sign-Up flow
2. Verify user data is saved correctly
3. Test on different browsers
4. Deploy to production with proper HTTPS
5. Update authorized redirect URIs for production domain

## Support

For issues with Google OAuth:
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Sign-In for Web](https://developers.google.com/identity/sign-in/web)
- [Google Cloud Console Help](https://cloud.google.com/docs)

## Additional Features to Consider

1. **Link existing accounts** - Allow users to link Google to existing accounts
2. **Profile picture** - Use Google profile picture
3. **Social login for other providers** - Add GitHub, Microsoft, etc.
4. **Account linking** - Let users connect multiple auth methods
5. **Two-factor authentication** - Add extra security layer
