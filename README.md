---
title: Breast Cancer Detection API
emoji: 🩺
colorFrom: pink
colorTo: purple
sdk: docker
pinned: false
license: other
---

# 🩺 Breast Cancer Detection API

**Backend-only REST API** for AI-powered breast cancer detection from mammogram images.

[![Deploy on HF Spaces](https://huggingface.co/datasets/huggingface/badges/raw/main/deploy-on-spaces-md.svg)](https://huggingface.co/spaces/Bhavanakhatri/breastcancerdetection)

---

## 🚀 API Endpoints

### Base URL
```
https://bhavanakhatri-breastcancerdetection.hf.space
```

### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "Breast Cancer Detection API",
  "version": "1.0.0",
  "model_status": "loaded"
}
```

---

### 2. Single Prediction
```http
POST /predict
Content-Type: multipart/form-data

file: <image_file>
```

**cURL Example:**
```bash
curl -X POST "https://bhavanakhatri-breastcancerdetection.hf.space/predict" \
  -F "file=@mammogram.jpg"
```

**Python Example:**
```python
import requests

url = "https://bhavanakhatri-breastcancerdetection.hf.space/predict"
files = {"file": open("mammogram.jpg", "rb")}
response = requests.post(url, files=files)
print(response.json())
```

**Response:**
```json
{
  "prediction": "Benign",
  "confidence": 0.9234,
  "probabilities": {
    "benign": 92.34,
    "malignant": 7.66
  },
  "risk_assessment": {
    "level": "Low Risk",
    "icon": "🟢",
    "color": "#33cc33"
  },
  "image_statistics": {
    "brightness": 45.2,
    "contrast": 18.5,
    "mean_intensity": 115.3,
    "std_intensity": 47.2
  },
  "image_info": {
    "filename": "mammogram.jpg",
    "size": "1024x768",
    "format": "JPEG"
  },
  "disclaimer": "⚠️ For educational purposes only. Not for medical diagnosis."
}
```

---

### 3. Batch Prediction
```http
POST /batch-predict
Content-Type: multipart/form-data

files: <image_file_1>
files: <image_file_2>
...
```

**Python Example:**
```python
import requests

url = "https://bhavanakhatri-breastcancerdetection.hf.space/batch-predict"
files = [
    ("files", open("image1.jpg", "rb")),
    ("files", open("image2.jpg", "rb")),
    ("files", open("image3.jpg", "rb"))
]
response = requests.post(url, files=files)
print(response.json())
```

**Response:**
```json
{
  "total_images": 3,
  "successful": 3,
  "failed": 0,
  "summary": {
    "malignant": 1,
    "benign": 2
  },
  "results": [
    {
      "filename": "image1.jpg",
      "prediction": "Benign",
      "confidence": 0.89,
      "probabilities": {
        "benign": 89.0,
        "malignant": 11.0
      }
    },
    {
      "filename": "image2.jpg",
      "prediction": "Malignant",
      "confidence": 0.76,
      "probabilities": {
        "benign": 24.0,
        "malignant": 76.0
      }
    },
    {
      "filename": "image3.jpg",
      "prediction": "Benign",
      "confidence": 0.94,
      "probabilities": {
        "benign": 94.0,
        "malignant": 6.0
      }
    }
  ]
}
```

**Limits:**
- Maximum 10 images per batch request

---

## 📚 Interactive API Documentation

Once deployed, visit:
- **Swagger UI**: https://bhavanakhatri-breastcancerdetection.hf.space/
- **ReDoc**: https://bhavanakhatri-breastcancerdetection.hf.space/redoc

---

## 🛠️ Technical Details

### Model
- **Architecture**: CNN (Convolutional Neural Network)
- **Input**: 224x224 RGB images
- **Output**: Binary classification (Benign/Malignant)
- **Framework**: TensorFlow/Keras

### API Framework
- **FastAPI**: High-performance async API
- **Uvicorn**: ASGI server
- **CORS**: Enabled for all origins

### Preprocessing
- Resize to 224x224
- RGB conversion
- Normalization [0, 1]

---

## 🚦 Risk Levels

| Probability | Risk Level | Icon |
|-------------|------------|------|
| ≥ 90% Malignant | Very High Risk | 🔴 |
| 75-90% Malignant | High Risk | 🟠 |
| 60-75% Malignant | Moderate-High Risk | 🟡 |
| 40-60% | Moderate Risk | 🟡 |
| ≥ 90% Benign | Very Low Risk | 🟢 |
| 75-90% Benign | Low Risk | 🟢 |

---

## ⚠️ Disclaimer

**This API is for educational and research purposes only.**

- ❌ Not approved for clinical use
- ❌ Not a replacement for professional medical diagnosis
- ❌ Do not make medical decisions based on these predictions
- ✅ Always consult qualified healthcare professionals

---

## 📊 Error Handling

### 400 Bad Request
- Invalid file type
- Missing file
- Too many files in batch (>10)

### 500 Internal Server Error
- Model loading failure
- Prediction error
- Processing error

**Error Response Format:**
```json
{
  "detail": "Error message description"
}
```

---

## 🔧 Development

### Local Setup

1. **Clone repository**
   ```bash
   git clone https://huggingface.co/spaces/Bhavanakhatri/breastcancerdetection
   cd breastcancerdetection
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run API**
   ```bash
   python app.py
   ```

4. **Test API**
   ```bash
   curl http://localhost:7860/health
   ```

---

## 📝 License

Educational Use Only

---

## 👤 Author

**Bhavna Khatri**
- Hugging Face: [@Bhavanakhatri](https://huggingface.co/Bhavanakhatri)

---

## 🤝 Support

For issues or questions:
1. Check API documentation at `/` (Swagger UI)
2. View `/health` endpoint for system status
3. Open an issue on Hugging Face Space

---

**Version**: 1.0.0  
**Last Updated**: December 31, 2025
