# 🤗 Hugging Face Spaces Deployment Guide

## Complete Step-by-Step Instructions

---

## 📋 Prerequisites

- ✅ Hugging Face account created
- ✅ Space created: https://huggingface.co/spaces/Bhavanakhatri/breastcancerdetection
- ✅ Git LFS installed (`git lfs version`)
- ✅ Model file available locally

---

## 🚀 Deployment Steps

### Step 1: Clone Your HF Space

```bash
# Clone the space
git clone https://huggingface.co/spaces/Bhavanakhatri/breastcancerdetection
cd breastcancerdetection

# Initialize Git LFS
git lfs install
git lfs track "*.keras"
```

### Step 2: Copy Backend Files

Copy these files to your HF Space directory:

```bash
# Required files
cp app.py <your-hf-space-directory>/
cp requirements.txt <your-hf-space-directory>/
cp README.md <your-hf-space-directory>/
cp .gitignore <your-hf-space-directory>/
cp .gitattributes <your-hf-space-directory>/

# Optional
cp Dockerfile <your-hf-space-directory>/
```

### Step 3: Copy Model File

```bash
# Copy model to HF Space root
cp backend/models/breast_cancer_model.keras <your-hf-space-directory>/

# Verify file size (should be ~294 MB)
ls -lh <your-hf-space-directory>/breast_cancer_model.keras
```

### Step 4: Commit and Push

```bash
cd <your-hf-space-directory>

# Add files
git add .gitattributes
git add .gitignore
git add app.py
git add requirements.txt
git add README.md
git add Dockerfile  # optional

# Add model with Git LFS
git add breast_cancer_model.keras

# Commit
git commit -m "Deploy backend-only API with FastAPI"

# Push to HF Space
git push origin main
```

---

## ⏱️ Deployment Timeline

1. **Push**: ~5 minutes (uploading model with Git LFS)
2. **Build**: ~5-10 minutes (installing dependencies)
3. **Start**: ~1-2 minutes (loading model)
4. **Total**: ~15-20 minutes

---

## 🧪 Testing After Deployment

### 1. Check Health

```bash
curl https://bhavanakhatri-breastcancerdetection.hf.space/health
```

**Expected:**
```json
{
  "status": "healthy",
  "model_status": "loaded"
}
```

### 2. Test Prediction

```bash
curl -X POST \
  "https://bhavanakhatri-breastcancerdetection.hf.space/predict" \
  -F "file=@test_image.jpg"
```

### 3. Open Swagger UI

Visit: https://bhavanakhatri-breastcancerdetection.hf.space/

---

## 🎯 Space Configuration

HF Space settings (on Hugging Face website):

1. **Space Name**: breastcancerdetection
2. **SDK**: Docker (automatic if Dockerfile present) or Python
3. **Hardware**: CPU Basic (free) ✅
4. **Visibility**: Public or Private (your choice)

---

## 🐛 Troubleshooting

### ❌ "Model file not found"

**Check:**
```bash
# Verify model is tracked by Git LFS
git lfs ls-files

# Should show:
# breast_cancer_model.keras
```

**Fix:**
```bash
git lfs track "*.keras"
git add .gitattributes
git add breast_cancer_model.keras --force
git commit -m "Add model via Git LFS"
git push origin main
```

### ❌ "Out of memory"

HF Spaces free tier has 16 GB RAM - should be enough!

If still issues:
- Upgrade to better hardware (Settings → Hardware)
- Use CPU optimized TensorFlow (`tensorflow-cpu`)

### ❌ "Application not starting"

**Check logs:**
1. Go to HF Space page
2. Click "Logs" tab
3. Look for errors

**Common fixes:**
- Check `requirements.txt` syntax
- Verify `app.py` has no syntax errors
- Ensure port 7860 is used (HF default)

### ❌ Git LFS Bandwidth Exceeded

HF Spaces has generous limits, but if exceeded:
- Use smaller model
- Or contact HF support for more bandwidth

---

## 📊 File Structure

```
breastcancerdetection/  (HF Space root)
├── app.py                      # Main FastAPI application
├── requirements.txt            # Python dependencies
├── README.md                   # API documentation
├── breast_cancer_model.keras   # ML model (294 MB)
├── .gitignore                  # Git ignore rules
├── .gitattributes              # Git LFS tracking
└── Dockerfile                  # Optional Docker config
```

---

## 🔧 Alternative: Upload Model Separately

If Git LFS is problematic, upload model via HF Hub:

```python
from huggingface_hub import HfApi

api = HfApi()

# Upload model file
api.upload_file(
    path_or_fileobj="backend/models/breast_cancer_model.keras",
    path_in_repo="breast_cancer_model.keras",
    repo_id="Bhavanakhatri/breastcancerdetection",
    repo_type="space",
)
```

Then the app will auto-download on startup!

---

## 💡 Tips

1. **Test locally first**: Run `python app.py` before pushing
2. **Check logs**: Always monitor HF Space logs during deployment
3. **Use .gitignore**: Don't upload unnecessary files
4. **Documentation**: README.md shows up on your Space page
5. **Swagger UI**: Automatic at root URL (`/`)

---

## 🎉 Success Checklist

- [ ] HF Space created
- [ ] Git LFS installed and configured
- [ ] All files copied to HF Space directory
- [ ] Model file added via Git LFS
- [ ] Pushed to HF Space
- [ ] Deployment completed (check logs)
- [ ] Health endpoint returns "loaded"
- [ ] Swagger UI accessible
- [ ] Test prediction works

---

## 📞 Support

**HF Community:**
- Forum: https://discuss.huggingface.co/
- Discord: https://hf.co/join/discord

**Space Issues:**
- Check Space logs
- Verify all files present
- Test locally first

---

**Good Luck! 🚀**

