# 🚀 Update Hugging Face Deployment - Complete Guide

## Problem
Hugging Face deployment shows "Image not available" because the deployed version doesn't have the full Grad-CAM and visualization code.

## Solution
Deploy the complete working backend (from `backend/` folder) to Hugging Face.

---

## 📋 Step-by-Step Instructions

### Step 1: Go to Your Hugging Face Space

1. Open: https://huggingface.co/spaces/Bhavanakhatri/breastcancerdetection
2. Click **"Files and versions"** tab

### Step 2: Update/Upload These Files

Upload these files from your local `backend/` folder:

#### **File 1: `app.py`** (Main Application)
- Source: `backend/main.py`
- Destination: `app.py` (rename when uploading)
- This has all the `/analyze` endpoint logic with full features

#### **File 2: `grad_cam.py`** (Visualization)
- Source: `backend/grad_cam.py`  
- Destination: `grad_cam.py`
- This generates all the heatmaps, bounding boxes, region detection

#### **File 3: `requirements.txt`**
- Source: `backend/requirements.txt`
- Destination: `requirements.txt`
- Make sure it includes all dependencies

#### **File 4: `breast_cancer_model.keras`**
- Source: `backend/models/breast_cancer_model.keras`
- Destination: `breast_cancer_model.keras`
- Model file (already there, but verify it's correct)

### Step 3: Modify `app.py` for HF Deployment

After uploading `backend/main.py` as `app.py`, make these changes:

#### Change 1: Update imports (Line ~25)
```python
# Change FROM:
from grad_cam import create_gradcam_visualization, generate_mammogram_view_analysis
from report_generator import generate_report_pdf

# Change TO:
from grad_cam import create_gradcam_visualization, generate_mammogram_view_analysis
# Remove report_generator import (not needed for HF)
```

#### Change 2: Update model path (Line ~204)
```python
# Change FROM:
MODEL_PATH = Path(os.environ.get("MODEL_PATH", BASE_DIR / "models" / "breast_cancer_model.keras"))

# Change TO:
MODEL_PATH = BASE_DIR / "breast_cancer_model.keras"  # Model in root directory on HF
```

#### Change 3: Remove `/report` endpoint
Comment out or remove the `/report` endpoint (lines ~550-631) since PDF generation isn't needed on HF.

#### Change 4: Update endpoint from `/analyze` to `/predict`
```python
# Line ~510: Change FROM:
@app.post("/analyze")

# Change TO:
@app.post("/predict")
```

#### Change 5: Update port for HF Spaces
At the bottom of file, ensure:
```python
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))  # HF Spaces uses 7860
    uvicorn.run(app, host="0.0.0.0", port=port)
```

### Step 4: Verify Dependencies

Make sure `requirements.txt` includes:
```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
python-multipart==0.0.9
pillow==10.4.0
numpy>=1.24.0,<2.0.0
opencv-python-headless==4.8.1.78
matplotlib>=3.8.0
scipy>=1.11.0
tensorflow>=2.16.0
```

### Step 5: Wait for Rebuild

1. After uploading files, HF will automatically rebuild
2. Wait 5-10 minutes
3. Check build logs for any errors

### Step 6: Test Deployment

```bash
# Test health endpoint
curl https://bhavanakhatri-breastcancerdetection.hf.space/health

# Should return:
# {"status":"healthy","model_status":"loaded",...}

# Test prediction with image
curl -X POST "https://bhavanakhatri-breastcancerdetection.hf.space/predict" \
  -F "file=@your_test_image.jpg"
```

---

## 🔧 Alternative: Quick Fix Without Full Redeployment

If you want to keep using current HF deployment but fix images:

### Option 1: Use Local Backend Only

Update `frontend/src/AppContent.js` line 29:
```javascript
// Comment out HF URL, force local backend
const productionUrl = "http://localhost:8000";  // Always use local
```

### Option 2: Create New HF Space with Full Code

1. Create new space: `breastcancerdetection-full`
2. Upload complete backend code
3. Update frontend URL to new space

---

## ✅ Expected Results After Fix

After properly deploying, you should see:

### On Frontend:
- ✅ **Heatmap Overlay** - Colored visualization
- ✅ **Heatmap Only** - Pure activation map
- ✅ **Region Detection (BBox)** - Bounding boxes with labels
- ✅ **Type of Cancer detection** - Different cancer types marked
- ✅ **10 Detected Regions** - With confidence scores
- ✅ **BI-RADS categories** - 4A, 4B, 4C, 5
- ✅ **Clinical Significance** - For each region
- ✅ **Comprehensive Image Analysis** - Full breakdown

### API Response Format:
```json
{
  "result": "Malignant",
  "confidence": 0.515,
  "benign_prob": 48.5,
  "malignant_prob": 51.5,
  "risk_level": "Moderate Risk",
  "stats": {...},
  "images": {
    "original": "base64...",
    "overlay": "base64...",
    "heatmap_only": "base64...",
    "bbox": "base64...",
    "cancer_type": "base64..."
  },
  "findings": {
    "regions": [...],
    "num_regions": 10,
    "summary": "..."
  }
}
```

---

## 🎯 Recommended Approach

**Best Option:** Keep using **local backend** for now since it works perfectly!

**Why?**
- ✅ All features working
- ✅ Fast development
- ✅ No deployment delays
- ✅ Easy to debug

**For Production:** Deploy full backend to Render.com or Railway (better than HF for this use case)

---

## 📞 Need Help?

If you get stuck:
1. Check HF build logs
2. Verify all files uploaded correctly
3. Test `/health` endpoint first
4. Use local backend as fallback

---

**TL;DR:** 
Upload complete `backend/main.py` → rename to `app.py` → change `/analyze` to `/predict` → upload `grad_cam.py` → rebuild → test!

