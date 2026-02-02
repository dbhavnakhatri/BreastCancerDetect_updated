# 🏥 Breast Cancer Detection System - Complete Guide

## 🚀 Quick Start

### Easiest Way (Recommended):

**Just double-click:**
```
START_PROJECT.bat
```

This will:
1. ✅ Start backend (Port 8001)
2. ✅ Start frontend (Port 3001)
3. ✅ Open browser automatically

---

## 📦 What's Included

### Backend Features:
- ✅ AI-powered mammogram analysis
- ✅ Grad-CAM heatmap visualization
- ✅ YOLO-based cancer detection
- ✅ **Strict validation system** (NEW!)
- ✅ PDF report generation
- ✅ Patient management
- ✅ Analysis history

### Frontend Features:
- ✅ Modern React UI
- ✅ Image upload interface
- ✅ Real-time analysis results
- ✅ Interactive visualizations
- ✅ Report download
- ✅ Patient management

### Validation System (NEW!):
- ✅ **Rejects photos of people**
- ✅ **Rejects flowers/objects**
- ✅ **Rejects color images**
- ✅ **Rejects screenshots**
- ✅ **Only accepts medical mammograms**

---

## 🎯 How It Works

### Upload Flow:

```
User uploads image
    ↓
🔍 VALIDATION (8 checks)
    ├─ Transparency check
    ├─ Resolution check
    ├─ Aspect ratio check
    ├─ Color detection
    ├─ Saturation check
    ├─ Skin tone detection
    ├─ Edge density
    └─ Histogram analysis
    ↓
✅ Valid mammogram → Analysis proceeds
    ├─ AI model prediction
    ├─ Grad-CAM heatmap
    ├─ YOLO detection
    ├─ Risk assessment
    └─ Results displayed
    
❌ Invalid image → Rejected with error message
```

---

## 🧪 Testing

### Test 1: Real Mammogram
```
Upload: mammogram.jpg
Result: ✅ Analyzed successfully
Shows: Heatmap, bounding boxes, risk level
```

### Test 2: Photo of Person
```
Upload: person.jpg
Result: ❌ Rejected
Error: "This appears to be a PHOTOGRAPH of a person..."
```

### Test 3: Flower/Object
```
Upload: flower.png
Result: ❌ Rejected
Error: "This is a COLORFUL IMAGE (flower, object, etc.)..."
```

### Test 4: Screenshot
```
Upload: screenshot.png
Result: ❌ Rejected
Error: "Image is too bright to be a mammogram..."
```

---

## 🔧 Manual Setup

### Prerequisites:
- Python 3.8+
- Node.js 14+
- npm or yarn

### Backend Setup:

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend Setup:

```bash
cd frontend

# Install dependencies
npm install

# Start server
npm start
```

---

## 📊 API Endpoints

### Main Endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | Analyze mammogram image |
| POST | `/report` | Generate PDF report |
| GET | `/health` | Health check |
| GET | `/docs` | API documentation |

### Example Request:

```javascript
const formData = new FormData();
formData.append('file', imageFile);

fetch('http://localhost:8001/analyze', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

---

## 🛡️ Validation Details

### 8-Layer Validation System:

1. **Transparency Check**
   - Rejects PNG with alpha channel
   - Catches graphics, logos, cutouts

2. **Resolution Check**
   - Minimum: 800x800 pixels
   - Ensures medical-grade quality

3. **Aspect Ratio Check**
   - Range: 0.3 to 3.0
   - Matches mammogram dimensions

4. **Color Detection**
   - Max variance: 10
   - Ensures pure grayscale

5. **Saturation Check**
   - Max saturation: 20
   - Detects colorful images

6. **Skin Tone Detection**
   - Detects R > G > B patterns
   - Catches photos of people

7. **Edge Density**
   - Max density: 0.25
   - Photos have sharp edges

8. **Histogram Analysis**
   - Max extremes: 60%
   - Validates intensity distribution

---

## 🐛 Troubleshooting

### Backend won't start:

```bash
# Check if port is in use
netstat -ano | findstr :8001

# Kill process
taskkill /F /PID <PID>

# Reinstall dependencies
cd backend
pip install -r requirements.txt
```

### Frontend won't start:

```bash
# Check if port is in use
netstat -ano | findstr :3001

# Kill process
taskkill /F /PID <PID>

# Reinstall dependencies
cd frontend
rm -rf node_modules
npm install
```

### Validation not working:

```bash
# Test validation
cd backend
python test_flower_rejection.py

# Should show all tests passing
```

---

## 📁 Project Structure

```
BreastCancerDetect_updated/
│
├── backend/
│   ├── main.py                    # Main API
│   ├── mammogram_validator.py    # Validation logic ⭐
│   ├── grad_cam.py                # Grad-CAM
│   ├── yolo_detector.py           # YOLO detection
│   ├── database.py                # Database
│   ├── auth.py                    # Authentication
│   └── requirements.txt           # Dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── pages/                 # Pages
│   │   └── App.js                 # Main app
│   ├── public/                    # Static files
│   └── package.json               # Dependencies
│
├── START_PROJECT.bat              # Quick start ⭐
├── HOW_TO_RUN_PROJECT.md          # Detailed guide
└── QUICK_START.txt                # Quick reference
```

---

## 🎓 Key Files

### Backend:
- `main.py` - Main API with validation
- `mammogram_validator.py` - 8-layer validation system
- `grad_cam.py` - Heatmap generation
- `yolo_detector.py` - Cancer detection

### Frontend:
- `src/App.js` - Main application
- `src/components/` - UI components
- `package.json` - Dependencies

### Scripts:
- `START_PROJECT.bat` - Start everything
- `RESTART_BACKEND_FIXED.bat` - Restart backend
- `FIX_AND_RESTART.bat` - Fix and restart

---

## 📝 Environment Variables

### Backend (.env):
```env
DATABASE_URL=sqlite:///./breast_cancer.db
SECRET_KEY=your-secret-key
```

### Frontend (.env):
```env
REACT_APP_API_URL=http://localhost:8001
```

---

## 🚀 Deployment

### Backend (Production):
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8001
```

### Frontend (Build):
```bash
cd frontend
npm run build
# Serve the build/ folder
```

---

## 📞 Support

### Common Issues:

1. **Port already in use** → Kill the process
2. **Module not found** → Reinstall dependencies
3. **Validation not working** → Restart backend
4. **Images not uploading** → Check file size/format

### Test Commands:

```bash
# Test validation
cd backend
python test_flower_rejection.py

# Test single image
python test_single_image.py path/to/image.jpg

# Test API
python test_api.py
```

---

## ✅ Summary

**To Run:**
```
Double-click: START_PROJECT.bat
```

**URLs:**
- Frontend: http://localhost:3001
- Backend: http://localhost:8001
- API Docs: http://localhost:8001/docs

**Validation:**
- ✅ Mammograms → Analyzed
- ❌ Photos/objects → Rejected

**Status:**
- ✅ Backend ready
- ✅ Frontend ready
- ✅ Validation active
- ✅ Ready to use!

---

**🎉 Project is ready to run!**
