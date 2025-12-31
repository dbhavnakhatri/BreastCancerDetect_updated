# 🚀 Render Deployment Guide - Breast Cancer Detection

## ✅ Model File Included via Git LFS

The model file (`breast_cancer_model.keras`, ~308 MB) is tracked using **Git LFS** (Large File Storage), so it will automatically be deployed with your code!

---

## 📋 Quick Deployment Steps

### Step 1: Push Code to GitHub

Make sure all your code including the model file is pushed to GitHub:

```bash
# Check status
git status

# Add all files (model is already tracked by Git LFS)
git add .

# Commit
git commit -m "Ready for Render deployment with Git LFS model"

# Push to GitHub
git push origin main
```

**Important:** Make sure your GitHub repository has **Git LFS enabled**. Most GitHub accounts have it by default.

---

### Step 2: Deploy Backend on Render

1. **Go to [Render.com](https://render.com)** and sign in

2. Click **"New +"** → **"Web Service"**

3. **Connect your GitHub repository**

4. **Configure the service:**

   **Basic Settings:**
   - **Name**: `breast-cancer-backend` (or your choice)
   - **Region**: Choose closest to you
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   
   **Build Command:**
   ```bash
   pip install -r requirements.txt
   ```
   
   **Start Command:**
   ```bash
   chmod +x start.sh && ./start.sh
   ```

5. **Environment Variables** (Optional):
   
   Click **"Advanced"** and add:
   
   | Key | Value |
   |-----|-------|
   | `PYTHON_VERSION` | `3.11.0` |

6. **Click "Create Web Service"**

7. **Wait for deployment** (10-15 minutes - Git LFS will download the model)

8. Once deployed, you'll get a URL like:
   ```
   https://breast-cancer-backend-xxxx.onrender.com
   ```

---

### Step 3: Verify Deployment

**Test Backend Health:**

Open in browser or use curl:
```bash
curl https://your-backend-url.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "model_status": "loaded",
  "model_error": null,
  "model_path": "/opt/render/project/src/backend/models/breast_cancer_model.keras"
}
```

**Test API Documentation:**
```
https://your-backend-url.onrender.com/docs
```

---

### Step 4: Update Frontend

Update the backend URL in your frontend:

**File:** `frontend/src/AppContent.js` (Line ~29)

```javascript
// Change this line to your actual Render backend URL
const productionUrl = "https://your-actual-backend-url.onrender.com";
```

**Or set environment variable:**

Create `frontend/.env.production`:
```env
REACT_APP_API_BASE_URL=https://your-backend-url.onrender.com
```

---

### Step 5: Deploy Frontend (Optional)

If you want to deploy frontend on Render:

1. **New Web Service** → **"Static Site"**
2. **Root Directory**: `frontend`
3. **Build Command**:
   ```bash
   npm install && npm run build
   ```
4. **Publish Directory**: `build`
5. **Environment Variables**:
   ```
   REACT_APP_API_BASE_URL=https://your-backend-url.onrender.com
   ```

---

## 🐛 Troubleshooting

### ❌ "Model file not found" error

**Possible causes:**
1. Git LFS not enabled on Render
2. Model file not properly pushed via Git LFS

**Solution:**

**Check if model is in Git LFS:**
```bash
git lfs ls-files
```

You should see:
```
backend/models/breast_cancer_model.keras
```

**Check file size locally:**
```bash
ls -lh backend/models/breast_cancer_model.keras
```

Should be ~308 MB. If it's only a few KB, the file is a pointer, not the actual file.

**Re-push model:**
```bash
git lfs track "*.keras"
git add .gitattributes
git add backend/models/breast_cancer_model.keras
git commit -m "Add model via Git LFS"
git push origin main
```

---

### ❌ Model file is a text pointer (not the actual file)

If the model file shows as only 100-200 bytes instead of 308 MB:

**Pull the actual file:**
```bash
git lfs pull
```

**Verify:**
```bash
git lfs ls-files
# Should show a checkmark (✓) or asterisk (*) next to the file
```

---

### ❌ Out of memory error on Render

**Problem:** TensorFlow + model requires significant RAM

**Solution:**
- Render **Free tier** (512 MB) is **too small** ❌
- Upgrade to **Starter plan** (1 GB RAM) - $7/month ✅
- Or use **Standard plan** (2 GB RAM) - $25/month ✅ (Recommended)

---

### ❌ Build timeout

**Problem:** Deployment takes too long (>15 min on free tier)

**Solution:**
1. Upgrade to paid plan (longer build time)
2. Or optimize dependencies in `requirements.txt`

---

### ❌ Git LFS bandwidth limit exceeded (GitHub)

**Problem:** GitHub has LFS bandwidth limits (1 GB/month free)

**Solutions:**
1. **Use GitLab** instead (10 GB LFS free)
2. **Use Bitbucket** (1 GB LFS free but less restrictive)
3. **Upgrade GitHub** ($5/month for 50 GB)

---

## 💡 Alternative Git Providers

### Using GitLab (Better for Large Files)

GitLab offers more generous LFS limits:
- **10 GB storage** (vs GitHub's 1 GB)
- Better for large model files

**Steps:**
1. Create repo on GitLab
2. Enable Git LFS (automatic)
3. Push code
4. Connect to Render from GitLab

### Using Bitbucket

Bitbucket also supports Git LFS:
1. Create Bitbucket repo
2. Enable LFS in repo settings
3. Push code
4. Connect to Render

---

## 💰 Render Pricing

| Plan | RAM | CPU | Price | Suitable? |
|------|-----|-----|-------|-----------|
| Free | 512 MB | Shared | $0 | ❌ Too small |
| Starter | 1 GB | 0.5 CPU | $7/mo | ✅ Minimum |
| Standard | 2 GB | 1 CPU | $25/mo | ✅✅ Recommended |
| Pro | 4 GB | 2 CPU | $85/mo | ✅ Best performance |

**Recommendation:** Start with **Starter** ($7/mo), upgrade to **Standard** if needed.

---

## 📊 Git LFS Status Check

**Verify Git LFS is working:**

```bash
# Check LFS status
git lfs status

# List LFS tracked files
git lfs ls-files

# Check if file is actually in LFS (not a pointer)
file backend/models/breast_cancer_model.keras
# Should say: "data" not "text" or "ASCII"
```

**On Windows:**
```powershell
# Check file size
(Get-Item "backend\models\breast_cancer_model.keras").Length / 1MB
# Should be ~308 MB, not 0.1 MB
```

---

## 🔍 Debugging Deployment

**View Render Logs:**
1. Go to Render dashboard
2. Select your service
3. Click **"Logs"** tab
4. Look for:
   ```
   📥 Checking for model file...
   ✅ Model file found! (Size: 308M)
   🌐 Starting FastAPI server...
   ```

**If you see:**
```
❌ ERROR: Model file not found
```

Then Git LFS didn't work. Check:
1. Model file pushed correctly (`git lfs ls-files`)
2. Render pulled the LFS files (check logs for LFS messages)
3. Try re-deploying

---

## ✅ Success Checklist

Before deploying, verify:

- [ ] Git LFS installed locally (`git lfs version`)
- [ ] Model tracked by LFS (`git lfs ls-files` shows the model)
- [ ] Model file is ~308 MB (not just a text pointer)
- [ ] Code pushed to GitHub/GitLab (`git push origin main`)
- [ ] Render service created with correct root directory (`backend`)
- [ ] Start command set: `chmod +x start.sh && ./start.sh`
- [ ] Plan has enough RAM (minimum 1 GB)
- [ ] `/health` endpoint returns `model_status: "loaded"`

---

## 🎯 Quick Test

After deployment, test with curl:

```bash
# Health check
curl https://your-app.onrender.com/health

# Should return:
# {"status":"ok","model_status":"loaded",...}
```

Or open in browser:
```
https://your-app.onrender.com/docs
```

Try uploading a test image through the Swagger UI!

---

## 📞 Need Help?

**Common Issues:**
1. **Model not found** → Check Git LFS (`git lfs ls-files`)
2. **Out of memory** → Upgrade Render plan to 1 GB+
3. **Build timeout** → Use paid plan or optimize dependencies
4. **LFS bandwidth** → Switch to GitLab (10 GB free)

**Logs to check:**
- Render deployment logs
- Render runtime logs
- Git LFS status locally

---

**Happy Deploying! 🚀**

---

## 📚 Additional Resources

- [Git LFS Documentation](https://git-lfs.github.com/)
- [Render Deployment Guide](https://render.com/docs)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
