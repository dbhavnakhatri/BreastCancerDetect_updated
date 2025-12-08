# 🚀 Deployment Guide - Breast Cancer Detection

This project uses a **split deployment** architecture for optimal performance:

| Component | Platform | Why |
|-----------|----------|-----|
| **Frontend** | Vercel | Fast global CDN, free tier |
| **Backend** | Railway | No size limits, handles TensorFlow ~500MB |

---

## 📋 Prerequisites

1. GitHub account with this repository pushed
2. [Vercel account](https://vercel.com) (free)
3. [Railway account](https://railway.app) (free $5/month credit)

---

## 🔧 Step 1: Deploy Backend to Railway

### Option A: Railway Dashboard (Easiest)

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. After it starts deploying, click on your service
5. Go to **Settings** tab:
   - **Root Directory**: `backend`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Go to **Variables** tab and add:
   ```
   ALLOWED_ORIGINS=*
   ```
7. Click **"Generate Domain"** to get your public URL
8. **Copy your Railway URL** (e.g., `https://breastcancerdetect-production.up.railway.app`)

### Option B: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to backend folder
cd backend

# Initialize and deploy
railway init
railway up

# Generate public domain
railway domain
```

### ✅ Test Backend

```bash
# Health check
curl https://YOUR-RAILWAY-URL.railway.app/health

# Should return: {"status":"ok","model_loaded":true}

# Test API docs
# Open in browser: https://YOUR-RAILWAY-URL.railway.app/docs
```

---

## 🌐 Step 2: Deploy Frontend to Vercel

### Option A: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"** → Import your repository
3. Configure project:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App
4. Add **Environment Variable**:
   ```
   REACT_APP_API_BASE_URL = https://YOUR-RAILWAY-URL.railway.app
   ```
5. Click **"Deploy"**

### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Navigate to frontend folder
cd frontend

# Deploy
vercel

# For production
vercel --prod
```

---

## 🔗 Step 3: Connect Frontend to Backend

After both are deployed:

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add or update:
   ```
   Name: REACT_APP_API_BASE_URL
   Value: https://YOUR-RAILWAY-URL.railway.app
   ```
3. **Redeploy** the frontend (Deployments → ... → Redeploy)

---

## 📊 Final Architecture

```
┌─────────────────────────────────┐
│         User's Browser          │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│      Vercel (Frontend)          │
│   your-app.vercel.app           │
│   - React App                   │
│   - Static files                │
│   - Global CDN                  │
└───────────────┬─────────────────┘
                │ API calls
                ↓
┌─────────────────────────────────┐
│      Railway (Backend)          │
│   your-app.railway.app          │
│   - FastAPI                     │
│   - TensorFlow + Model          │
│   - PDF Report Generation       │
└─────────────────────────────────┘
```

---

## 🧪 Post-Deployment Testing

### 1. Test Backend Health
```bash
curl https://YOUR-RAILWAY-URL.railway.app/health
```

### 2. Test Image Analysis
```bash
curl -X POST https://YOUR-RAILWAY-URL.railway.app/analyze \
  -F "file=@test_image.png"
```

### 3. Test Frontend
- Open `https://your-app.vercel.app` in browser
- Sign up/Login
- Upload a test image
- Verify analysis results appear

---

## ⚙️ Environment Variables Reference

### Backend (Railway)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALLOWED_ORIGINS` | No | `*` | CORS allowed origins |
| `MODEL_PATH` | No | `models/breast_cancer_model.keras` | Model file path |
| `PORT` | Auto | - | Railway sets automatically |

### Frontend (Vercel)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REACT_APP_API_BASE_URL` | **Yes** | `/api` | Railway backend URL |

---

## 🔧 Troubleshooting

### Railway Build Fails
- Check build logs in Railway dashboard
- Verify `requirements.txt` exists in backend folder
- Check Python compatibility (uses Python 3.11)

### Frontend Can't Reach Backend
1. Check `REACT_APP_API_BASE_URL` is set correctly (no trailing slash)
2. Verify CORS is configured: `ALLOWED_ORIGINS=*`
3. Check browser console for specific errors
4. **Redeploy** frontend after adding environment variables

### Model Not Loading
- Check Railway logs: `railway logs`
- Verify model file exists at `backend/models/breast_cancer_model.keras`
- Ensure model file is committed to git (check `.gitignore`)

### Cold Start Issues
- First request may take 10-30 seconds (model loading)
- Railway keeps container warm with activity
- Consider a cron job to ping `/health` every 5 minutes

---

## 💰 Cost Estimates

### Railway (Backend)
- **Free tier**: $5 credit/month (usually enough)
- **Hobby**: ~$3-5/month with moderate usage

### Vercel (Frontend)
- **Free tier**: Unlimited for personal projects
- **Pro**: $20/month (usually not needed)

---

## 🔄 Continuous Deployment

Both platforms auto-deploy on git push:

```bash
# Make changes
git add .
git commit -m "Update feature"
git push origin main

# Both Railway and Vercel auto-deploy! 🎉
```

---

## 🆘 Need Help?

- [Railway Docs](https://docs.railway.app/)
- [Vercel Docs](https://vercel.com/docs)
- [Railway Discord](https://discord.gg/railway)

---

**Happy Deploying! 🚀**

