# 🚀 Migrate to GitLab for Better LFS Support

## Why GitLab?
- **10 GB LFS storage** (vs GitHub's 1 GB)
- **Better bandwidth limits** for model files
- **Free tier** is generous
- Works perfectly with Render

---

## Quick Migration Steps

### 1. Create GitLab Account
- Go to: https://gitlab.com
- Sign up (free account)

### 2. Create New Repository
- Click **"New project"**
- Choose **"Create blank project"**
- Name: `breast-cancer-detection` (or any name)
- Visibility: **Private** or **Public**
- Click **"Create project"**

### 3. Add GitLab as Remote
```bash
# Add GitLab remote
git remote add gitlab https://gitlab.com/YOUR_USERNAME/breast-cancer-detection.git

# Or if you want to replace GitHub:
git remote set-url origin https://gitlab.com/YOUR_USERNAME/breast-cancer-detection.git
```

### 4. Push to GitLab
```bash
# Push everything including LFS files
git push gitlab main --force

# Or if you changed origin:
git push origin main --force
```

### 5. Deploy on Render from GitLab
- Go to Render dashboard
- **New Web Service**
- Connect **GitLab** (not GitHub)
- Select your repository
- Same settings as before:
  - Root Directory: `backend`
  - Build: `pip install -r requirements.txt`
  - Start: `chmod +x start.sh && ./start.sh`

---

## ✅ Done! GitLab has better LFS limits so deployment will work!


