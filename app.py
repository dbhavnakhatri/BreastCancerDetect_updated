"""
Breast Cancer Detection API - Backend Only
Hugging Face Spaces Deployment

REST API for breast cancer detection from mammogram images.
Uses deep learning model to classify images as Benign or Malignant.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional
import os
from pathlib import Path
import logging

import numpy as np
from PIL import Image
import io
from tensorflow import keras
import tensorflow as tf

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== APP CONFIGURATION ====================

app = FastAPI(
    title="Breast Cancer Detection API",
    description=(
        "AI-powered breast cancer detection API for mammogram analysis.\n\n"
        "**Features:**\n"
        "- Image classification (Benign/Malignant)\n"
        "- Confidence scores and probabilities\n"
        "- Risk level assessment\n"
        "- Image statistics analysis\n\n"
        "⚠️ **EDUCATIONAL USE ONLY** - Not for medical diagnosis."
    ),
    version="1.0.0",
    docs_url="/",  # Swagger UI at root
    redoc_url="/redoc",
)

# CORS Configuration - Allow all origins for public API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== MODEL LOADING ====================

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "breast_cancer_model.keras"
_model: Optional[keras.Model] = None


def download_model_from_hf():
    """Download model from Hugging Face Hub if not present"""
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 100_000_000:
        logger.info(f"✅ Model already exists: {MODEL_PATH}")
        return True
    
    logger.info("📥 Downloading model from Hugging Face...")
    
    try:
        from huggingface_hub import hf_hub_download
        
        # Your HF repo details
        repo_id = os.environ.get("HF_MODEL_REPO", "Bhavanakhatri/breastcancerdetection")
        
        downloaded_path = hf_hub_download(
            repo_id=repo_id,
            filename="breast_cancer_model.keras",
            local_dir=str(BASE_DIR),
            local_dir_use_symlinks=False
        )
        
        logger.info(f"✅ Model downloaded successfully to {downloaded_path}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Model download failed: {e}")
        return False


def get_model() -> keras.Model:
    """Load model (singleton pattern)"""
    global _model
    
    if _model is None:
        # Try to download if not exists
        if not MODEL_PATH.exists():
            logger.info("Model not found, attempting download...")
            download_model_from_hf()
        
        if not MODEL_PATH.exists():
            raise RuntimeError(
                f"Model file not found at {MODEL_PATH}. "
                "Please upload model to Hugging Face Space."
            )
        
        try:
            logger.info(f"📂 Loading model from {MODEL_PATH}")
            _model = keras.models.load_model(
                str(MODEL_PATH),
                compile=False,
                safe_mode=False
            )
            _model.compile(
                optimizer='adam',
                loss='binary_crossentropy',
                metrics=['accuracy']
            )
            logger.info("✅ Model loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ Model loading failed: {e}")
            raise RuntimeError(f"Failed to load model: {e}")
    
    return _model


# ==================== HELPER FUNCTIONS ====================

def preprocess_image(image: Image.Image) -> np.ndarray:
    """
    Preprocess image for model input
    - Resize to 224x224
    - Convert to RGB
    - Normalize to [0, 1]
    """
    # Resize
    img = image.resize((224, 224), Image.LANCZOS)
    img_array = np.array(img)
    
    # Handle different image formats
    if img_array.ndim == 2:  # Grayscale
        img_array = np.stack([img_array] * 3, axis=-1)
    elif img_array.shape[2] == 4:  # RGBA
        img_array = img_array[:, :, :3]
    
    # Normalize
    img_array = img_array.astype("float32") / 255.0
    
    # Add batch dimension
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array


def get_image_statistics(image: Image.Image) -> Dict[str, float]:
    """Calculate image statistics"""
    img_array = np.array(image)
    
    # Convert to 3 channels if needed
    if img_array.ndim == 2:
        img_array = np.stack([img_array] * 3, axis=-1)
    elif img_array.shape[2] == 4:
        img_array = img_array[:, :, :3]
    
    return {
        "mean_intensity": float(np.mean(img_array)),
        "std_intensity": float(np.std(img_array)),
        "min_intensity": float(np.min(img_array)),
        "max_intensity": float(np.max(img_array)),
        "median_intensity": float(np.median(img_array)),
        "brightness": float(np.mean(img_array) / 255.0 * 100),
        "contrast": float(np.std(img_array) / 255.0 * 100),
    }


def get_risk_level(confidence: float) -> Dict[str, str]:
    """Determine risk level from confidence score"""
    if confidence > 0.5:
        # Malignant
        malignant_prob = confidence * 100
        if malignant_prob >= 90:
            return {"level": "Very High Risk", "icon": "🔴", "color": "#ff0000"}
        elif malignant_prob >= 75:
            return {"level": "High Risk", "icon": "🟠", "color": "#ff6600"}
        elif malignant_prob >= 60:
            return {"level": "Moderate-High Risk", "icon": "🟡", "color": "#ffaa00"}
        else:
            return {"level": "Moderate Risk", "icon": "🟡", "color": "#ffcc00"}
    else:
        # Benign
        benign_prob = (1 - confidence) * 100
        if benign_prob >= 90:
            return {"level": "Very Low Risk", "icon": "🟢", "color": "#00cc00"}
        elif benign_prob >= 75:
            return {"level": "Low Risk", "icon": "🟢", "color": "#33cc33"}
        elif benign_prob >= 60:
            return {"level": "Low-Moderate Risk", "icon": "🟡", "color": "#99cc00"}
        else:
            return {"level": "Moderate Risk", "icon": "🟡", "color": "#cccc00"}


# ==================== API ENDPOINTS ====================

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    
    Returns server status and model availability
    """
    model_status = "not_loaded"
    model_error = None
    
    try:
        if MODEL_PATH.exists():
            _ = get_model()
            model_status = "loaded"
        else:
            model_status = "missing"
            model_error = f"Model file not found at {MODEL_PATH}"
    except Exception as exc:
        model_status = "error"
        model_error = str(exc)
    
    return {
        "status": "healthy",
        "service": "Breast Cancer Detection API",
        "version": "1.0.0",
        "model_status": model_status,
        "model_error": model_error,
        "model_path": str(MODEL_PATH),
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Predict breast cancer from mammogram image
    
    **Input:**
    - file: Image file (JPEG, PNG, etc.)
    
    **Output:**
    - prediction: "Benign" or "Malignant"
    - confidence: Model confidence score (0-1)
    - probabilities: Benign and Malignant probabilities
    - risk_assessment: Risk level and details
    - image_statistics: Image quality metrics
    
    **Example Response:**
    ```json
    {
      "prediction": "Benign",
      "confidence": 0.92,
      "probabilities": {
        "benign": 92.3,
        "malignant": 7.7
      },
      "risk_assessment": {
        "level": "Low Risk",
        "icon": "🟢",
        "color": "#33cc33"
      },
      "image_statistics": {
        "brightness": 45.2,
        "contrast": 18.5
      }
    }
    ```
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an image file (JPEG, PNG, etc.)"
        )
    
    try:
        # Read and open image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        logger.info(f"📸 Processing image: {file.filename}, size: {image.size}")
        
    except Exception as e:
        logger.error(f"❌ Image reading failed: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read image: {str(e)}"
        )
    
    try:
        # Get model
        model = get_model()
        
        # Preprocess image
        preprocessed = preprocess_image(image)
        
        # Get prediction
        prediction_value = float(model.predict(preprocessed, verbose=0)[0][0])
        
        # Calculate probabilities
        benign_prob = (1 - prediction_value) * 100
        malignant_prob = prediction_value * 100
        
        # Determine result
        if prediction_value > 0.5:
            result = "Malignant"
            confidence = prediction_value
        else:
            result = "Benign"
            confidence = 1 - prediction_value
        
        # Get risk assessment
        risk = get_risk_level(prediction_value)
        
        # Get image statistics
        stats = get_image_statistics(image)
        
        # Prepare response
        response = {
            "prediction": result,
            "confidence": round(confidence, 4),
            "probabilities": {
                "benign": round(benign_prob, 2),
                "malignant": round(malignant_prob, 2)
            },
            "risk_assessment": risk,
            "image_statistics": {
                "brightness": round(stats["brightness"], 2),
                "contrast": round(stats["contrast"], 2),
                "mean_intensity": round(stats["mean_intensity"], 2),
                "std_intensity": round(stats["std_intensity"], 2),
            },
            "image_info": {
                "filename": file.filename,
                "size": f"{image.size[0]}x{image.size[1]}",
                "format": image.format or "Unknown"
            },
            "disclaimer": "⚠️ For educational purposes only. Not for medical diagnosis."
        }
        
        logger.info(f"✅ Prediction: {result} ({confidence:.2%})")
        
        return JSONResponse(content=response)
        
    except Exception as e:
        logger.error(f"❌ Prediction failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


@app.post("/batch-predict")
async def batch_predict(files: list[UploadFile] = File(...)):
    """
    Batch prediction for multiple images
    
    **Input:**
    - files: List of image files
    
    **Output:**
    - results: List of predictions for each image
    - summary: Aggregate statistics
    
    **Limits:**
    - Maximum 10 images per request
    """
    if len(files) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 images allowed per batch request"
        )
    
    results = []
    
    for file in files:
        try:
            # Reuse single prediction endpoint logic
            contents = await file.read()
            image = Image.open(io.BytesIO(contents)).convert("RGB")
            
            model = get_model()
            preprocessed = preprocess_image(image)
            prediction_value = float(model.predict(preprocessed, verbose=0)[0][0])
            
            benign_prob = (1 - prediction_value) * 100
            malignant_prob = prediction_value * 100
            
            result = "Malignant" if prediction_value > 0.5 else "Benign"
            confidence = prediction_value if prediction_value > 0.5 else 1 - prediction_value
            
            results.append({
                "filename": file.filename,
                "prediction": result,
                "confidence": round(confidence, 4),
                "probabilities": {
                    "benign": round(benign_prob, 2),
                    "malignant": round(malignant_prob, 2)
                }
            })
            
        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": str(e)
            })
    
    # Calculate summary
    successful = [r for r in results if "error" not in r]
    malignant_count = sum(1 for r in successful if r["prediction"] == "Malignant")
    benign_count = sum(1 for r in successful if r["prediction"] == "Benign")
    
    return {
        "total_images": len(files),
        "successful": len(successful),
        "failed": len(files) - len(successful),
        "summary": {
            "malignant": malignant_count,
            "benign": benign_count
        },
        "results": results
    }


# ==================== STARTUP EVENT ====================

@app.on_event("startup")
async def startup_event():
    """Initialize model on startup"""
    logger.info("🚀 Starting Breast Cancer Detection API...")
    
    try:
        # Preload model
        get_model()
        logger.info("✅ API ready to serve requests")
    except Exception as e:
        logger.warning(f"⚠️  Model preload failed: {e}")
        logger.warning("Model will be loaded on first request")


# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 7860))  # HF Spaces default port
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )

