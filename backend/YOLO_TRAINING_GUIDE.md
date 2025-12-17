# 🎯 YOLO Breast Cancer Detection Training Guide

Complete guide for training YOLOv8 model on breast cancer mammogram images from Kaggle datasets.

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Dataset Download](#dataset-download)
3. [Environment Setup](#environment-setup)
4. [Dataset Preparation](#dataset-preparation)
5. [Training](#training)
6. [Testing & Validation](#testing--validation)
7. [Integration](#integration)
8. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### Hardware Requirements
- **GPU**: NVIDIA GPU with 8GB+ VRAM (recommended)
- **RAM**: 16GB+ RAM
- **Storage**: 50GB+ free space
- **CPU**: Multi-core processor (if no GPU)

### Software Requirements
- Python 3.8+
- CUDA 11.8+ (for GPU training)
- Git

---

## 📥 Dataset Download

### Option 1: CBIS-DDSM (Recommended for beginners)

**Dataset**: Curated Breast Imaging Subset of DDSM
**Link**: https://www.kaggle.com/datasets/awsaf49/cbis-ddsm-breast-cancer-image-dataset

**Features**:
- 2,620 scanned film mammography studies
- Verified lesions with pathology
- Mass and calcification annotations
- DICOM format with ROI coordinates

**Download**:
```bash
# Method 1: Using Kaggle API
kaggle datasets download -d awsaf49/cbis-ddsm-breast-cancer-image-dataset
unzip cbis-ddsm-breast-cancer-image-dataset.zip -d datasets/raw/cbis-ddsm

# Method 2: Manual download
# 1. Go to: https://www.kaggle.com/datasets/awsaf49/cbis-ddsm-breast-cancer-image-dataset
# 2. Click "Download" button
# 3. Extract to datasets/raw/cbis-ddsm
```

### Option 2: VinDr-Mammo (Advanced)

**Dataset**: Vietnamese Digital Mammography Dataset
**Link**: https://www.kaggle.com/competitions/vinbigdata-chest-xray-abnormalities-detection

**Features**:
- 20,000+ images from 5,000 patients
- 5 finding categories
- Expert radiologist annotations
- High-quality digital mammograms

**Download**:
```bash
# Requires competition acceptance
# 1. Accept competition rules on Kaggle
# 2. Download using Kaggle API or manual download
kaggle competitions download -c vinbigdata-chest-xray-abnormalities-detection
```

### Option 3: INbreast Dataset

**Dataset**: Portuguese breast cancer screening program
**Link**: http://medicalresearch.inescporto.pt/breastresearch/index.php/Get_INbreast_Database

**Features**:
- 115 cases (410 images)
- Multiple views (CC, MLO)
- Detailed lesion annotations
- High resolution

---

## 🛠️ Environment Setup

### Step 1: Create Virtual Environment

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv_yolo

# Activate (Windows)
.\venv_yolo\Scripts\activate

# Activate (Linux/Mac)
source venv_yolo/bin/activate
```

### Step 2: Install Dependencies

```bash
# Install YOLO requirements
pip install -r requirements_yolo.txt

# For GPU support (CUDA 11.8)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# For GPU support (CUDA 12.1)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Verify GPU installation
python -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}')"
```

### Step 3: Setup Kaggle API (Optional)

```bash
# Install Kaggle
pip install kaggle

# Configure API token
# 1. Go to: https://www.kaggle.com/account
# 2. Click "Create New API Token"
# 3. Download kaggle.json

# Place kaggle.json:
# Windows: C:\Users\<username>\.kaggle\kaggle.json
# Linux/Mac: ~/.kaggle/kaggle.json

# Set permissions (Linux/Mac only)
chmod 600 ~/.kaggle/kaggle.json
```

---

## 📦 Dataset Preparation

### Auto Preparation (CBIS-DDSM)

```bash
# Run preparation script
python prepare_dataset.py

# Select option 1 for CBIS-DDSM
# Script will:
# 1. Download dataset
# 2. Convert to YOLO format
# 3. Split train/val/test
# 4. Create dataset.yaml
```

### Manual Preparation

```bash
# Create dataset structure
python prepare_dataset.py

# Select option 3 for custom dataset
# This creates:
datasets/breast_cancer/
├── images/
│   ├── train/      # Training images
│   ├── val/        # Validation images
│   └── test/       # Test images
└── labels/
    ├── train/      # Training labels (YOLO format)
    ├── val/        # Validation labels
    └── test/       # Test labels
```

### YOLO Label Format

Each `.txt` file corresponds to an image:
```
<class_id> <x_center> <y_center> <width> <height>
```

**Example** (`image1.txt`):
```
0 0.5 0.3 0.2 0.15    # Mass at center-left
1 0.7 0.6 0.05 0.05   # Calcifications at right
```

**Class IDs**:
- 0: Mass
- 1: Calcifications
- 2: Architectural distortion
- 3: Focal/breast asymmetry
- 4: Skin thickening

**Coordinates** (normalized 0-1):
- `x_center`: Horizontal center (0=left, 1=right)
- `y_center`: Vertical center (0=top, 1=bottom)
- `width`: Box width
- `height`: Box height

---

## 🚀 Training

### Basic Training

```bash
# Start training with default settings
python train_yolo.py
```

### Configuration Options

Edit `train_yolo.py` to customize:

```python
# Model size (nano, small, medium, large, xlarge)
MODEL_SIZE = "yolov8n"  # Fast, good for testing
MODEL_SIZE = "yolov8s"  # Balanced
MODEL_SIZE = "yolov8m"  # Better accuracy
MODEL_SIZE = "yolov8l"  # High accuracy
MODEL_SIZE = "yolov8x"  # Best accuracy (slow)

# Training parameters
EPOCHS = 100        # Number of training epochs
IMG_SIZE = 640      # Image size (640, 1024, 1280)
BATCH_SIZE = 16     # Batch size (adjust for GPU memory)
```

### Training Command with Options

```bash
# Quick test (small model, few epochs)
python train_yolo.py --model yolov8n --epochs 50 --batch 8

# Production training (large model, many epochs)
python train_yolo.py --model yolov8l --epochs 200 --batch 16

# Resume from checkpoint
python train_yolo.py --resume runs/detect/breast_cancer_detector/weights/last.pt
```

### Monitor Training

Training metrics will be saved in `runs/detect/breast_cancer_detector/`:

- **Confusion Matrix**: `confusion_matrix.png`
- **Training Curves**: `results.png`
- **PR Curve**: `PR_curve.png`
- **F1 Curve**: `F1_curve.png`
- **Sample Predictions**: `val_batch0_pred.jpg`

### Expected Training Time

| Model    | GPU         | Images | Epochs | Time      |
|----------|-------------|--------|--------|-----------|
| YOLOv8n  | RTX 3060    | 2000   | 100    | ~2 hours  |
| YOLOv8s  | RTX 3060    | 2000   | 100    | ~3 hours  |
| YOLOv8m  | RTX 3080    | 2000   | 100    | ~4 hours  |
| YOLOv8l  | RTX 4090    | 2000   | 200    | ~8 hours  |

---

## ✅ Testing & Validation

### Test Trained Model

```bash
# Create test script
python test_yolo.py
```

`test_yolo.py` content:
```python
from ultralytics import YOLO
from PIL import Image

# Load trained model
model = YOLO('runs/detect/breast_cancer_detector/weights/best.pt')

# Test on image
results = model.predict('test_images/sample.png', conf=0.25)

# Show results
results[0].show()
results[0].save('predictions.jpg')

# Print metrics
print(f"Detected {len(results[0].boxes)} regions")
```

### Evaluate on Test Set

```bash
# Run validation
from ultralytics import YOLO

model = YOLO('runs/detect/breast_cancer_detector/weights/best.pt')
metrics = model.val(data='datasets/breast_cancer/dataset.yaml')

print(f"mAP50: {metrics.box.map50:.4f}")
print(f"mAP50-95: {metrics.box.map:.4f}")
```

---

## 🔌 Integration with Backend

### Step 1: Copy Trained Model

```bash
# Create models directory
mkdir -p models

# Copy best model
cp runs/detect/breast_cancer_detector/weights/best.pt models/breast_cancer_yolo.pt
```

### Step 2: Update Backend to Use YOLO

Edit `backend/main.py`:

```python
# Add imports
from yolo_detector import YOLOCancerDetector

# Initialize YOLO detector
yolo_detector = YOLOCancerDetector(
    model_path="models/breast_cancer_yolo.pt",
    confidence_threshold=0.25
)

# In predict endpoint, replace Grad-CAM with YOLO:
@app.post("/predict")
async def predict_image(file: UploadFile = File(...)):
    # ... (existing code for loading image) ...
    
    # Use YOLO instead of Grad-CAM
    detections = yolo_detector.detect(original_image)
    findings = yolo_detector.generate_findings(detections, confidence)
    
    # Create visualizations
    bbox_image = yolo_detector.visualize_detections(original_image, detections)
    overlay_image, heatmap = yolo_detector.create_heatmap_overlay(original_image, detections)
    
    # ... (rest of the code remains same) ...
```

### Step 3: Restart Backend

```bash
# Restart backend server
cd backend
.\venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

---

## 🐛 Troubleshooting

### Issue 1: CUDA Out of Memory

**Solution**:
```python
# Reduce batch size
BATCH_SIZE = 8  # or 4

# Reduce image size
IMG_SIZE = 416  # instead of 640
```

### Issue 2: Slow Training (No GPU)

**Solution**:
```python
# Use smaller model
MODEL_SIZE = "yolov8n"

# Use Google Colab (free GPU):
# 1. Upload code to Google Drive
# 2. Open in Colab
# 3. Enable GPU: Runtime > Change runtime type > GPU
```

### Issue 3: Poor Detection Results

**Solutions**:
1. **More data**: Add more training images
2. **Data augmentation**: Increase augmentation parameters
3. **Longer training**: Increase epochs
4. **Larger model**: Use yolov8m or yolov8l
5. **Adjust confidence**: Lower confidence threshold

### Issue 4: Class Imbalance

**Solution**:
```python
# In train_yolo.py, add class weights
results = model.train(
    # ... other params ...
    cls=1.5,  # Class loss weight
    # Oversample minority classes
)
```

---

## 📊 Performance Benchmarks

### Expected Metrics (after 100 epochs on CBIS-DDSM)

| Model    | mAP50 | mAP50-95 | Precision | Recall | FPS  |
|----------|-------|----------|-----------|--------|------|
| YOLOv8n  | 0.65  | 0.42     | 0.68      | 0.62   | 120  |
| YOLOv8s  | 0.72  | 0.49     | 0.74      | 0.69   | 90   |
| YOLOv8m  | 0.78  | 0.55     | 0.79      | 0.74   | 60   |
| YOLOv8l  | 0.82  | 0.60     | 0.83      | 0.78   | 40   |

---

## 🎓 Next Steps

1. **Fine-tuning**: Adjust hyperparameters for better results
2. **Ensemble**: Combine multiple models
3. **Post-processing**: Add NMS refinement
4. **Clinical validation**: Work with radiologists
5. **Deployment**: Optimize for production

---

## 📚 Resources

- **YOLOv8 Documentation**: https://docs.ultralytics.com/
- **CBIS-DDSM Paper**: https://www.nature.com/articles/sdata2017177
- **Medical Imaging Guide**: https://www.cancerimagingarchive.net/

---

## ⚠️ Disclaimer

This is an AI research tool for educational purposes. **NOT** for clinical use without proper validation and regulatory approval.

Always consult qualified healthcare professionals for medical diagnosis.

---

**Happy Training! 🚀**

