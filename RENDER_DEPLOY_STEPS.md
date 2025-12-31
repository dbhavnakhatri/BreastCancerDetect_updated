# 🚀 Render Deployment - Complete Guide
## Make Your Local Version Work on Render

Your local version works perfectly with all features:
- ✅ 10 Detected Regions
- ✅ Bounding boxes with cancer types  
- ✅ Heatmap visualizations
- ✅ L-MLO View analysis
- ✅ BI-RADS categories

**Follow these exact steps to deploy this working version on Render:**

---

## 🎯 Step 1: Prepare Code for Deployment

### 1.1 Check Model File Status

```bash
# Check if model is in Git LFS
git lfs ls-files

# Should show:
# backend/models/breast_cancer_model.keras
```

### 1.2 Verify Model Size

```powershell
# On Windows PowerShell:
(Get-Item "backend\models\breast_cancer_model.keras").Length / 1MB

# Should be ~308 MB
# If it's < 1 MB, it's just a pointer - you need to download the actual file
```

### 1.3 If Model is Not Tracked by LFS:

```bash
# Initialize Git LFS
git lfs install

# Track the model file
git lfs track "*.keras"

# Add .gitattributes
git add .gitattributes

# Add model file
git add backend/models/breast_cancer_model.keras

# Commit
git commit -m "Add model file via Git LFS"

# Push
git push origin main
```

---

## 🎯 Step 2: Create Render Account & Deploy Backend

### 2.1 Go to Render Dashboard

1. Visit [https://render.com](https://render.com)
2. Sign up or log in
3. Click **"New +"** → **"Web Service"**

### 2.2 Connect Your GitHub Repository

1. Connect your GitHub account
2. Select your repository: `Breast_Cancer-main`
3. Click **"Connect"**

### 2.3 Configure Backend Service

**Fill in these settings:**

| Setting | Value |
|---------|-------|
| **Name** | `breast-cancer-backend` |
| **Region** | Choose closest to your location |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `chmod +x start.sh && ./start.sh` |

### 2.4 Set Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.11.0` |
| `PORT` | `8000` |

### 2.5 Choose Plan

**⚠️ IMPORTANT:** Free tier (512 MB RAM) is **NOT ENOUGH**

Choose:
- **Starter Plan** ($7/month) - 1 GB RAM ✅ Minimum
- **Standard Plan** ($25/month) - 2 GB RAM ✅✅ Recommended

Why? TensorFlow + Model needs at least 1 GB RAM.

### 2.6 Deploy

1. Click **"Create Web Service"**
2. Wait 10-15 minutes for deployment
3. Watch the logs - should see:
   ```
   ✅ Model file found! (Size: 308M)
   🌐 Starting FastAPI server...
   ```

### 2.7 Get Your Backend URL

After deployment, you'll get a URL like:
```
https://breast-cancer-backend-xxxx.onrender.com
```

**Save this URL!** You'll need it for the frontend.

---

## 🎯 Step 3: Test Backend Deployment

### 3.1 Test Health Endpoint

Open in browser or use PowerShell:

```powershell
curl https://breast-cancer-backend-xxxx.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "model_status": "loaded",
  "model_error": null
}
```

### 3.2 Test API Documentation

Open in browser:
```
https://breast-cancer-backend-xxxx.onrender.com/docs
```

You should see Swagger UI with endpoints:
- `/health` - Health check
- `/analyze` - Image analysis (POST)
- `/report` - Generate PDF report (POST)

### 3.3 Test Image Upload

1. Go to `/docs`
2. Click on **POST /analyze**
3. Click **"Try it out"**
4. Upload a test mammogram image
5. Click **"Execute"**

Should return detailed results with:
- ✅ Prediction (Malignant/Benign)
- ✅ Confidence scores
- ✅ Detected regions
- ✅ Heatmap images (base64)
- ✅ View analysis (L-MLO/RCC etc.)

---

## 🎯 Step 4: Update Frontend to Use Render Backend

### 4.1 Update API URL in Frontend

**File:** `frontend/src/AppContent.js`

Find this line (around line 29):

```javascript
const productionUrl = "https://bhavanakhatri-breastcancerdetection.hf.space";
```

**Change it to your Render backend URL:**

```javascript
const productionUrl = "https://breast-cancer-backend-xxxx.onrender.com";
```

**Replace `xxxx` with your actual Render URL!**

### 4.2 Commit and Push Changes

```bash
git add frontend/src/AppContent.js
git commit -m "Update backend URL to Render deployment"
git push origin main
```

---

## 🎯 Step 5: Deploy Frontend on Render (Optional)

If you want to deploy frontend on Render:

### 5.1 Create New Static Site

1. Render Dashboard → **"New +"** → **"Static Site"**
2. Connect same GitHub repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `breast-cancer-frontend` |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `build` |

### 5.2 Add Environment Variable

| Key | Value |
|-----|-------|
| `REACT_APP_API_BASE_URL` | `https://breast-cancer-backend-xxxx.onrender.com` |

### 5.3 Deploy

Click **"Create Static Site"**

You'll get a frontend URL like:
```
https://breast-cancer-frontend-xxxx.onrender.com
```

---

## 🎯 Step 6: Test Complete System

### 6.1 Open Frontend

If deployed on Render:
```
https://breast-cancer-frontend-xxxx.onrender.com
```

Or keep using local frontend:
```
http://localhost:3001
```

### 6.2 Upload Test Image

1. Login/Signup
2. Upload a mammogram image (e.g., `L-MLO.jpg`)
3. Wait for analysis

### 6.3 Verify Results Match Local Version

Check that you see:
- ✅ **10 Detected Regions** (or similar)
- ✅ **Bounding boxes** with cancer types (Mass, Calcifications, etc.)
- ✅ **Heatmap Overlay** tab working
- ✅ **Region Detection (BBox)** tab showing colored boxes
- ✅ **L-MLO View** badge and analysis
- ✅ **Comprehensive Image Analysis** section
- ✅ **BI-RADS categories** (4A, 4B, 4C, etc.)
- ✅ **Clinical Significance** for each region
- ✅ **Recommended Actions**

---

## 🐛 Troubleshooting

### ❌ Problem: "Image not available" in Visual Analysis

**Cause:** Backend not returning images properly

**Solution:**
1. Check Render logs - look for errors
2. Verify `/analyze` endpoint returns `images` object
3. Test with small image first (< 1 MB)

### ❌ Problem: "Model file not found" error

**Cause:** Git LFS didn't work

**Solutions:**
1. Check Render logs for model size
2. If model is < 100 MB in logs, LFS failed
3. Use fallback: Set environment variable on Render:
   ```
   MODEL_URL=https://your-direct-download-link.com/model.keras
   ```
4. Or upload model to Google Drive and use `GDRIVE_FILE_ID`

### ❌ Problem: Out of memory error

**Cause:** Free tier has only 512 MB RAM

**Solution:** Upgrade to Starter ($7/mo) or Standard ($25/mo) plan

### ❌ Problem: Different results than local

**Cause:** Different versions of code

**Solution:**
1. Make sure latest code is pushed to GitHub
2. Check Git commit hash in Render logs
3. Force redeploy: Render Dashboard → "Manual Deploy" → "Clear build cache & deploy"

### ❌ Problem: Slow response times

**Cause:** Free/Starter plans have limited resources

**Solutions:**
1. Upgrade to Standard plan (2 GB RAM, 1 CPU)
2. Add caching for frequently uploaded images
3. Optimize model loading (already done in `start.sh`)

---

## ✅ Success Checklist

Before considering deployment complete, verify:

- [ ] Backend `/health` returns `model_status: "loaded"`
- [ ] Backend `/docs` shows all 3 endpoints
- [ ] Backend `/analyze` accepts image and returns detailed results
- [ ] Frontend connects to Render backend (check browser console)
- [ ] Upload test image shows all features:
  - [ ] 10 Detected Regions (or similar count)
  - [ ] Bounding boxes with labels
  - [ ] Heatmap visualizations
  - [ ] L-MLO/RCC view detection
  - [ ] BI-RADS categories
  - [ ] Comprehensive Image Analysis
- [ ] PDF report downloads successfully
- [ ] No errors in Render logs
- [ ] No errors in browser console

---

## 💡 Tips for Best Results

### 1. Use Standard Plan ($25/month)

Better performance = better user experience:
- Faster analysis (< 5 seconds vs 15+ seconds)
- No cold starts (free tier sleeps after inactivity)
- More reliable (won't crash on large images)

### 2. Monitor Render Logs

Check logs regularly for:
- Memory usage warnings
- Model loading time
- API response times
- Any errors

### 3. Test with Multiple Images

Upload various images:
- Different views (MLO, CC)
- Different sizes
- Different formats (PNG, JPG, DICOM)

### 4. Keep Local and Render in Sync

Whenever you update code locally:
```bash
# Test locally first
# Make sure it works on http://localhost:3001

# Then push to GitHub
git add .
git commit -m "Update: [description]"
git push origin main

# Render will auto-deploy (if enabled)
# Or manually redeploy from Render dashboard
```

---

## 📞 Need Help?

**If deployment fails:**

1. **Check Render Logs:**
   - Render Dashboard → Your Service → "Logs" tab
   - Look for error messages (red text)

2. **Check Model Status:**
   ```bash
   curl https://your-backend.onrender.com/health
   ```

3. **Check Frontend Connection:**
   - Open browser developer tools (F12)
   - Go to Console tab
   - Look for API errors

4. **Common Errors:**
   - `Model not found` → Git LFS issue
   - `Out of memory` → Upgrade plan
   - `Image not available` → Backend not returning images
   - `CORS error` → Backend CORS settings

---

## 🎉 You're Done!

Once all checks pass, your Render deployment will work **exactly like your local version**!

**Your working features:**
- ✅ Multiple cancer type detection (Mass, Calcifications, Asymmetry)
- ✅ Bounding boxes with confidence percentages
- ✅ Grad-CAM heatmap visualizations
- ✅ Mammogram view detection (L-MLO, RCC, etc.)
- ✅ BI-RADS classification (4A, 4B, 4C, 5)
- ✅ Clinical significance analysis
- ✅ Recommended actions for each region
- ✅ Comprehensive image analysis
- ✅ PDF report generation
- ✅ Detailed region cards with morphology

**Deployment URLs:**
- Backend: `https://breast-cancer-backend-xxxx.onrender.com`
- Frontend: `https://breast-cancer-frontend-xxxx.onrender.com` (or local)

Enjoy your deployed application! 🚀🩺

