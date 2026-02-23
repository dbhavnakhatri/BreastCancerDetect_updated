# How the Breast Cancer Model is Imported

## Overview

The model is imported in **two stages**:

1. **Download Stage** - `download_model.py` downloads the model file
2. **Load Stage** - `main.py` loads the model into memory

## Stage 1: Download Model (`backend/download_model.py`)

### How It Works

```python
def download_model():
    """Download model file if not present"""
    model_path = Path(__file__).parent / "models" / "breast_cancer_model.keras"
    
    # Skip if model already exists
    if model_path.exists() and model_path.stat().st_size > 100_000_000:
        print(f"✓ Model already exists at {model_path}")
        return True
```

### Three Download Methods (in order of priority)

**Method 1: Hugging Face Hub**
```python
hf_repo = os.environ.get("HF_MODEL_REPO")
if hf_repo:
    from huggingface_hub import hf_hub_download
    downloaded_path = hf_hub_download(
        repo_id=hf_repo,
        filename="breast_cancer_model.keras",
        cache_dir=str(model_path.parent)
    )
```

**Method 2: Direct URL**
```python
model_url = os.environ.get("MODEL_URL")
if model_url:
    import urllib.request
    urllib.request.urlretrieve(model_url, str(model_path))
```

**Method 3: Google Drive**
```python
gdrive_id = os.environ.get("GDRIVE_FILE_ID")
if gdrive_id:
    import gdown
    url = f"https://drive.google.com/uc?id={gdrive_id}"
    gdown.download(url, str(model_path), quiet=False)
```

### Environment Variables

Set one of these in `backend/.env`:

```bash
# Option 1: Hugging Face
HF_MODEL_REPO=username/model-name

# Option 2: Direct URL
MODEL_URL=https://example.com/breast_cancer_model.keras

# Option 3: Google Drive
GDRIVE_FILE_ID=your_file_id_here
```

## Stage 2: Load Model (`backend/main.py`)

### Model Path Configuration

```python
BASE_DIR = Path(__file__).resolve().parent

# Check environment variable first
MODEL_PATH_ENV = os.environ.get("MODEL_PATH")
if MODEL_PATH_ENV:
    MODEL_PATH = Path(MODEL_PATH_ENV)
else:
    # Try local path
    local_path = BASE_DIR / "models" / "breast_cancer_model.keras"
    if local_path.exists():
        MODEL_PATH = local_path
    else:
        # Fallback for Render deployment
        MODEL_PATH = Path("/opt/render/project/src/models/breast_cancer_model.keras")
```

### Model Loading Function

```python
def get_model():
    """Load model from local file."""
    from tensorflow import keras
    
    global _model
    if _model is None:
        # Check if model exists
        if not check_model_exists():
            raise RuntimeError(f"Model file not found at {MODEL_PATH}")
        
        try:
            # Load with Keras
            _model = keras.models.load_model(
                MODEL_PATH, 
                compile=False, 
                safe_mode=False
            )
            
            # Compile model
            _model.compile(
                optimizer='adam',
                loss='binary_crossentropy',
                metrics=['accuracy']
            )
            
            # Free memory
            gc.collect()
            
        except TypeError as e:
            # Handle Keras version mismatch
            if "batch_shape" in str(e) or "safe_mode" in str(e):
                _model = _create_compatible_model()
                _load_weights_from_keras_file(_model, MODEL_PATH)
            else:
                raise e
    
    return _model
```

### Model Usage in Analysis

```python
def run_full_analysis(image: Image.Image, filename: str = None):
    """Run analysis using the loaded model"""
    model = get_model()  # Get the loaded model
    
    # Preprocess image
    preprocessed = preprocess_image(image)
    
    # Make prediction
    prediction = float(model.predict(preprocessed, verbose=0)[0][0])
    
    # Rest of analysis...
```

## File Structure

```
backend/
├── models/
│   └── breast_cancer_model.keras    ← Model file (downloaded here)
├── download_model.py                 ← Downloads model on startup
├── main.py                           ← Loads model when needed
└── ...
```

## Startup Flow

```
1. Backend starts
   ↓
2. download_model.py runs (if called)
   ↓
3. Checks if model exists at backend/models/breast_cancer_model.keras
   ↓
4. If not exists, downloads from:
   - Hugging Face Hub, OR
   - Direct URL, OR
   - Google Drive
   ↓
5. main.py starts FastAPI server
   ↓
6. When /analyze endpoint is called:
   - get_model() is called
   - Model is loaded into memory (lazy loading)
   - Prediction is made
```

## Lazy Loading

The model uses **lazy loading** - it's only loaded when first needed:

```python
_model: Optional[Any] = None  # Not loaded yet

def get_model():
    global _model
    if _model is None:  # Only load if not already loaded
        _model = keras.models.load_model(MODEL_PATH, ...)
    return _model
```

**Benefits:**
- Faster server startup
- Memory only used when needed
- Model cached in memory for subsequent requests

## Error Handling

### Model Not Found

```python
def check_model_exists():
    if MODEL_PATH.exists():
        size_mb = MODEL_PATH.stat().st_size / (1024 * 1024)
        if size_mb > 10:  # Valid model should be > 10 MB
            print(f"✅ Model exists ({size_mb:.1f} MB)")
            return True
    
    print(f"❌ Model file not found at {MODEL_PATH}")
    # Lists directory contents for debugging
    return False
```

### Keras Version Mismatch

```python
try:
    _model = keras.models.load_model(MODEL_PATH, compile=False, safe_mode=False)
except TypeError as e:
    if "batch_shape" in str(e) or "safe_mode" in str(e):
        # Rebuild model architecture if version mismatch
        _model = _create_compatible_model()
        _load_weights_from_keras_file(_model, MODEL_PATH)
```

## Setup Instructions

### Local Development

1. **Place model file** in `backend/models/breast_cancer_model.keras`
   - Or set `MODEL_PATH` environment variable

2. **Start backend**:
   ```bash
   python backend/main.py
   ```

3. **Model loads on first request** to `/analyze` endpoint

### Production (Render)

1. **Set environment variable** in Render dashboard:
   ```
   HF_MODEL_REPO=username/model-name
   # OR
   MODEL_URL=https://example.com/model.keras
   # OR
   GDRIVE_FILE_ID=your_file_id
   ```

2. **Add to start script** (`render_start.sh`):
   ```bash
   python backend/download_model.py
   python backend/main.py
   ```

3. **Model downloads on deployment**, then loads on first request

## Model Specifications

- **Format**: `.keras` (TensorFlow/Keras format)
- **Size**: > 100 MB (typically 200-500 MB)
- **Input**: 224x224x3 RGB image
- **Output**: Binary classification (0-1 probability)
- **Framework**: TensorFlow/Keras
- **Optimizer**: Adam
- **Loss**: Binary Crossentropy
- **Metrics**: Accuracy

## Troubleshooting

### Issue: "Model file not found"

**Solution 1**: Place model in correct location
```bash
backend/models/breast_cancer_model.keras
```

**Solution 2**: Set MODEL_PATH environment variable
```bash
export MODEL_PATH=/path/to/breast_cancer_model.keras
```

**Solution 3**: Configure download method
```bash
export HF_MODEL_REPO=username/model-name
# Then run: python backend/download_model.py
```

### Issue: "Model file too small"

**Cause**: Incomplete download

**Solution**:
1. Delete incomplete file
2. Re-download using one of the methods above

### Issue: "Keras version mismatch"

**Cause**: Different TensorFlow/Keras version

**Solution**: 
- The code automatically rebuilds the model
- Or update TensorFlow: `pip install --upgrade tensorflow`

## Performance

- **Model Load Time**: 5-10 seconds (first request)
- **Prediction Time**: 1-2 seconds per image
- **Memory Usage**: 500 MB - 1 GB
- **Caching**: Model stays in memory after first load

## Security

- Model file is not exposed to frontend
- Only predictions are returned to client
- Model weights are protected
- No model download links in frontend code

## References

- [TensorFlow Model Loading](https://www.tensorflow.org/guide/keras/saving_and_serializing)
- [Hugging Face Hub](https://huggingface.co/docs/hub/security)
- [Google Drive Download](https://github.com/wkentaro/gdown)
