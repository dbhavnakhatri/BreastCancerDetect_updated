# ⚡ Quick Deploy - 5 Minutes

Copy-paste these commands to deploy in 5 minutes:

## 🚀 One-Command Deploy

```bash
chmod +x deploy_to_hf.sh && ./deploy_to_hf.sh
```

**That's it!** ✅

---

## 🔧 Manual Deploy (If Script Doesn't Work)

```bash
# 1. Clone your HF Space
git clone https://huggingface.co/spaces/Bhavanakhatri/breastcancerdetection hf_deploy
cd hf_deploy

# 2. Setup Git LFS
git lfs install && git lfs track "*.keras"

# 3. Copy backend files (adjust paths if needed)
cp ../app.py . && \
cp ../requirements.txt . && \
cp ../README.md . && \
cp ../.gitignore . && \
cp ../.gitattributes . && \
cp ../backend/models/breast_cancer_model.keras .

# 4. Commit and push
git add . && \
git commit -m "Deploy backend-only API" && \
git push origin main
```

---

## ✅ Quick Test After Deploy

```bash
# Wait 10 minutes, then:
curl https://bhavanakhatri-breastcancerdetection.hf.space/health
```

**Expected:**
```json
{"status":"healthy","model_status":"loaded"}
```

---

## 🌐 Your API is Live!

**Swagger UI**: https://bhavanakhatri-breastcancerdetection.hf.space/

**Try it from terminal**:
```bash
curl -X POST \
  "https://bhavanakhatri-breastcancerdetection.hf.space/predict" \
  -F "file=@your_image.jpg"
```

**Or Python**:
```python
import requests

url = "https://bhavanakhatri-breastcancerdetection.hf.space/predict"
files = {"file": open("image.jpg", "rb")}
response = requests.post(url, files=files)
print(response.json())
```

---

**Done! 🎉**

