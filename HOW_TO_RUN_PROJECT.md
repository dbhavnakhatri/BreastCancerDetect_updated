# 🚀 How to Run the Breast Cancer Detection Project

## Quick Start (Easiest Way)

**Just double-click this file:**
```
START_PROJECT.bat
```

This will automatically:
1. ✅ Start the backend server (Port 8001)
2. ✅ Start the frontend server (Port 3001)
3. ✅ Open the application in your browser

---

## Manual Start (Step by Step)

### Step 1: Start Backend

Open a terminal and run:

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
INFO:     Application startup complete.
```

**Backend URLs:**
- API: http://localhost:8001
- API Documentation: http://localhost:8001/docs

### Step 2: Start Frontend

Open a **NEW** terminal and run:

```bash
cd frontend
npm start
```

You should see:
```
Compiled successfully!
You can now view breast-cancer-detection-frontend in the browser.
Local: http://localhost:3001
```

The browser will open automatically to http://localhost:3001

---

## Verification

### Check Backend is Running:

1. Open: http://localhost:8001/docs
2. You should see the FastAPI documentation page

### Check Frontend is Running:

1. Open: http://localhost:3001
2. You should see the Breast Cancer Detection interface

---

## Testing the Validation

### Test 1: Upload a Real Mammogram
- ✅ Should be accepted and analyzed
- ✅ Shows results with heatmap, bounding boxes, etc.

### Test 2: Upload a Photo of a Person
- ❌ Should be rejected
- ❌ Error: "This appears to be a PHOTOGRAPH of a person..."

### Test 3: Upload a Flower/Object Photo
- ❌ Should be rejected
- ❌ Error: "This is a COLORFUL IMAGE (flower, object, etc.)..."

### Test 4: Upload a Screenshot
- ❌ Should be rejected
- ❌ Error: "Image is too bright to be a mammogram..."

---

## Troubleshooting

### Issue 1: "Port 8001 already in use"

**Solution:**
```bash
# Kill the process on port 8001
taskkill /F /IM python.exe

# Or find and kill specific process
netstat -ano | findstr :8001
taskkill /F /PID <PID_NUMBER>
```

### Issue 2: "Port 3001 already in use"

**Solution:**
```bash
# Kill the process on port 3001
netstat -ano | findstr :3001
taskkill /F /PID <PID_NUMBER>
```

### Issue 3: Backend crashes on startup

**Check dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

### Issue 4: Frontend won't start

**Install dependencies:**
```bash
cd frontend
npm install
```

### Issue 5: "Module not found" errors

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

---

## Project Structure

```
BreastCancerDetect_updated/
├── backend/                    # FastAPI backend
│   ├── main.py                # Main API file
│   ├── mammogram_validator.py # Validation logic
│   ├── grad_cam.py            # Grad-CAM visualization
│   ├── yolo_detector.py       # YOLO cancer detection
│   └── requirements.txt       # Python dependencies
│
├── frontend/                   # React frontend
│   ├── src/                   # Source code
│   ├── public/                # Static files
│   └── package.json           # Node dependencies
│
└── START_PROJECT.bat          # Quick start script
```

---

## URLs Reference

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3001 | Main application UI |
| **Backend API** | http://localhost:8001 | REST API endpoint |
| **API Docs** | http://localhost:8001/docs | Interactive API documentation |

---

## Features

### ✅ What Works:

1. **Mammogram Analysis**
   - Upload mammogram images
   - AI-powered cancer detection
   - Grad-CAM heatmap visualization
   - Bounding box detection
   - Risk assessment
   - Detailed findings

2. **Validation System** (NEW!)
   - Rejects photos of people
   - Rejects flowers/objects
   - Rejects color images
   - Rejects screenshots
   - Only accepts medical mammograms

3. **Report Generation**
   - PDF reports with patient info
   - Detailed analysis results
   - Multiple visualization types

---

## Stopping the Servers

### If using START_PROJECT.bat:
- Close both terminal windows that opened

### If started manually:
- Press `Ctrl+C` in each terminal window

### Force stop all:
```bash
taskkill /F /IM python.exe
taskkill /F /IM node.exe
```

---

## Development Mode

Both servers run in development mode with hot-reload:

- **Backend**: Changes to Python files auto-reload
- **Frontend**: Changes to React files auto-reload

---

## Production Build

### Backend:
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

### Frontend:
```bash
cd frontend
npm run build
# Serve the build folder with a static server
```

---

## Environment Variables

### Backend (.env):
```
DATABASE_URL=sqlite:///./breast_cancer.db
```

### Frontend (.env):
```
REACT_APP_API_URL=http://localhost:8001
```

---

## Summary

**Quick Start:**
```
Double-click: START_PROJECT.bat
```

**Manual Start:**
```bash
# Terminal 1 - Backend
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001

# Terminal 2 - Frontend
cd frontend
npm start
```

**Access:**
- Frontend: http://localhost:3001
- Backend: http://localhost:8001
- API Docs: http://localhost:8001/docs

**Validation:**
- ✅ Mammograms accepted
- ❌ Photos/objects rejected

---

**Ready to use!** 🎉
