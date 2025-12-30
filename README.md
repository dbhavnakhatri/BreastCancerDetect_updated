# Breast Cancer Detection System

AI-powered breast cancer detection using deep learning for mammogram analysis.

## 🚀 Quick Start

### Prerequisites
- Python 3.8+ installed
- Node.js 14+ installed
- Git installed

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd Breast_Cancer-main
```

2. **Install Backend Dependencies**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # On Windows
# or
source venv/bin/activate  # On Mac/Linux
pip install -r requirements.txt
```

3. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

### Running the Application

**Option 1: Run Both Servers Together (Recommended)**
```bash
# From project root directory
start_project.bat  # On Windows
```

**Option 2: Run Servers Separately**

Backend:
```bash
cd backend
start_backend.bat  # On Windows
# or
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:
```bash
cd frontend
npm start
```

### Access the Application

- **Frontend UI**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 📁 Project Structure

```
Breast_Cancer-main/
├── backend/
│   ├── main.py                      # FastAPI backend
│   ├── grad_cam.py                  # Grad-CAM visualization
│   ├── report_generator.py          # PDF report generation
│   ├── yolo_detector.py             # YOLO detection
│   ├── models/
│   │   └── breast_cancer_model.keras  # AI model (308 MB)
│   ├── requirements.txt             # Python dependencies
│   └── start_backend.bat            # Backend startup script
├── frontend/
│   ├── src/
│   │   ├── App.js                   # Main React app
│   │   ├── AppContent.js            # Core functionality
│   │   └── components/              # React components
│   ├── package.json                 # Node dependencies
│   └── start_frontend.bat           # Frontend startup script
├── start_project.bat                # Start both servers
└── README.md                        # This file
```

## 🎯 Features

- **AI-Powered Analysis**: Deep learning model for breast cancer detection
- **Grad-CAM Visualization**: Heatmaps showing areas of concern
- **Region Detection**: Automatic detection and classification of suspicious regions
- **BI-RADS Classification**: Medical standard classification system
- **PDF Reports**: Comprehensive medical reports with all findings
- **View Detection**: Automatic CC/MLO view identification
- **User Authentication**: Secure login and user management

## 🔧 Configuration

### Backend Port
Default: `8000`
To change: Edit `backend/start_backend.bat` or `start_project.bat`

### Frontend Port
Default: `3000`
To change: Edit `frontend/package.json` scripts section

### Auto-Connection
The frontend automatically connects to `http://localhost:8000` when running locally.
No manual configuration needed!

## 📊 API Endpoints

- `GET /health` - Health check and model status
- `POST /analyze` - Upload image for analysis
- `POST /report` - Generate PDF report
- `GET /docs` - Interactive API documentation

## 🛠️ Troubleshooting

### Backend won't start
- Ensure Python 3.8+ is installed
- Activate virtual environment
- Install dependencies: `pip install -r requirements.txt`
- Check if port 8000 is available

### Frontend won't start
- Ensure Node.js 14+ is installed
- Install dependencies: `npm install`
- Check if port 3000 is available
- Clear npm cache: `npm cache clean --force`

### Model not found error
- Ensure `backend/models/breast_cancer_model.keras` exists
- File size should be ~308 MB
- Re-download if corrupted

### Connection refused
- Ensure backend is running on port 8000
- Check firewall settings
- Verify CORS is enabled in backend

## ⚠️ Important Notes

- **Educational Use Only**: This system is for educational and research purposes
- **Not for Medical Diagnosis**: Not approved for clinical use
- **Model Size**: The AI model is 308 MB - ensure adequate disk space
- **Processing Time**: Analysis takes 10-15 seconds per image

## 📝 License

Educational and Research Use Only

## 🤝 Support

For issues or questions, please check:
1. API documentation at http://localhost:8000/docs
2. Console logs in browser (F12)
3. Backend terminal for error messages

---

**Version**: 1.0.0  
**Last Updated**: December 2025
