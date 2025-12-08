# 🚀 Deploy to Render.com (FREE)

Deploy both frontend and backend on Render's free tier.

---

## 📋 Prerequisites

1. GitHub account with code pushed to `vraj1091/Breast_Cancer`
2. [Render.com](https://render.com) account (sign up with GitHub)

---

## 🔧 Step 1: Deploy Backend (Web Service)

1. Go to [render.com/dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo: `vraj1091/Breast_Cancer`
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `breast-cancer-backend` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Plan** | `Free` |

5. Click **"Advanced"** → Add Environment Variable:
   ```
   ALLOWED_ORIGINS = *
   ```

6. Click **"Create Web Service"**

7. **Wait 5-10 minutes** for deployment (TensorFlow is large)

8. **Copy your backend URL:** `https://breast-cancer-backend.onrender.com`

---

## 🌐 Step 2: Deploy Frontend (Static Site)

1. Click **"New +"** → **"Static Site"**
2. Connect the same repo: `vraj1091/Breast_Cancer`
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `breast-cancer-frontend` |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `build` |

4. Click **"Advanced"** → Add Environment Variable:
   ```
   REACT_APP_API_BASE_URL = https://breast-cancer-backend.onrender.com
   ```
   (Use your actual backend URL from Step 1)

5. Click **"Create Static Site"**

6. **Wait 2-3 minutes** for deployment

---

## ✅ After Deployment

Your app will be live at:
- **Frontend:** `https://breast-cancer-frontend.onrender.com`
- **Backend:** `https://breast-cancer-backend.onrender.com`
- **API Docs:** `https://breast-cancer-backend.onrender.com/docs`
- **Health Check:** `https://breast-cancer-backend.onrender.com/health`

---

## ⚠️ Important Notes

### Free Tier Limitations
- **Spin Down:** Free services spin down after 15 mins of inactivity
- **Cold Start:** First request after idle takes 30-60 seconds (TensorFlow loading)
- **Build Time:** Initial deploy takes 5-10 minutes (large dependencies)

### Keep Service Warm (Optional)
Use a free cron service like [cron-job.org](https://cron-job.org) to ping your backend every 14 minutes:
```
URL: https://breast-cancer-backend.onrender.com/health
Schedule: Every 14 minutes
```

---

## 🔧 Troubleshooting

### Build Fails
- Check Render logs for errors
- Ensure `requirements.txt` is in `backend/` folder
- Verify Python version compatibility

### Frontend Can't Connect to Backend
1. Check `REACT_APP_API_BASE_URL` is set correctly
2. Verify backend is running (check health endpoint)
3. Check browser console for CORS errors
4. Redeploy frontend after changing environment variables

### Model Loading Error
- Free tier has limited memory (512MB)
- TensorFlow + model may exceed limits
- Consider upgrading to paid tier if issues persist

---

## 💰 Render Pricing

| Plan | Price | RAM | Features |
|------|-------|-----|----------|
| Free | $0 | 512MB | Spins down after 15 mins |
| Starter | $7/mo | 512MB | Always on |
| Standard | $25/mo | 2GB | Better for ML |

---

## 🔄 Auto-Deploy

Render auto-deploys when you push to `main` branch:
```bash
git add .
git commit -m "Update"
git push origin main
# Render automatically redeploys! 🚀
```

---

**Happy Deploying! 🎉**

