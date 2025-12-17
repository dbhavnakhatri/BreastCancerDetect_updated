"""
YOLO Training Script for Breast Cancer Detection
Dataset: CBIS-DDSM or VinDr-Mammo from Kaggle
"""

import os
import yaml
from pathlib import Path
from ultralytics import YOLO
import torch

# Check GPU availability
print(f"CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")

# Configuration
DATASET_PATH = "datasets/breast_cancer"  # Update with your dataset path
MODEL_SIZE = "yolov8n"  # Options: yolov8n, yolov8s, yolov8m, yolov8l, yolov8x
EPOCHS = 100
IMG_SIZE = 640
BATCH_SIZE = 16  # Adjust based on GPU memory

# Cancer types to detect
CANCER_CLASSES = {
    0: "Mass",
    1: "Calcifications",
    2: "Architectural_distortion",
    3: "Asymmetry",
    4: "Skin_thickening"
}

def create_dataset_yaml():
    """
    Create dataset.yaml for YOLO training
    """
    dataset_config = {
        'path': str(Path(DATASET_PATH).absolute()),
        'train': 'images/train',
        'val': 'images/val',
        'test': 'images/test',
        'names': CANCER_CLASSES
    }
    
    yaml_path = os.path.join(DATASET_PATH, 'dataset.yaml')
    with open(yaml_path, 'w') as f:
        yaml.dump(dataset_config, f, default_flow_style=False)
    
    print(f"✓ Dataset config created: {yaml_path}")
    return yaml_path


def train_yolo_model():
    """
    Train YOLOv8 model for breast cancer detection
    """
    print("\n" + "="*60)
    print("🚀 Starting YOLO Training for Breast Cancer Detection")
    print("="*60 + "\n")
    
    # Create dataset configuration
    yaml_path = create_dataset_yaml()
    
    # Load pretrained YOLOv8 model
    model = YOLO(f'{MODEL_SIZE}.pt')
    
    print(f"\n📊 Training Configuration:")
    print(f"   Model: {MODEL_SIZE}")
    print(f"   Epochs: {EPOCHS}")
    print(f"   Image Size: {IMG_SIZE}")
    print(f"   Batch Size: {BATCH_SIZE}")
    print(f"   Classes: {len(CANCER_CLASSES)}")
    
    # Train the model
    results = model.train(
        data=yaml_path,
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH_SIZE,
        name='breast_cancer_detector',
        project='runs/detect',
        
        # Optimization parameters
        patience=20,  # Early stopping
        save=True,
        save_period=10,  # Save every 10 epochs
        
        # Data augmentation
        hsv_h=0.015,  # HSV-Hue augmentation
        hsv_s=0.7,    # HSV-Saturation augmentation
        hsv_v=0.4,    # HSV-Value augmentation
        degrees=10.0,  # Rotation
        translate=0.1, # Translation
        scale=0.2,     # Scaling
        shear=0.0,     # Shear
        perspective=0.0,
        flipud=0.5,    # Vertical flip
        fliplr=0.5,    # Horizontal flip
        mosaic=1.0,    # Mosaic augmentation
        mixup=0.1,     # Mixup augmentation
        
        # Performance
        workers=8,
        device=0 if torch.cuda.is_available() else 'cpu',
        verbose=True,
        
        # Validation
        val=True,
        plots=True,
    )
    
    print("\n" + "="*60)
    print("✅ Training Complete!")
    print("="*60)
    
    # Validate the model
    print("\n📊 Running Validation...")
    metrics = model.val()
    
    print(f"\n📈 Validation Metrics:")
    print(f"   mAP50: {metrics.box.map50:.4f}")
    print(f"   mAP50-95: {metrics.box.map:.4f}")
    print(f"   Precision: {metrics.box.mp:.4f}")
    print(f"   Recall: {metrics.box.mr:.4f}")
    
    # Export model
    print("\n💾 Exporting model...")
    model.export(format='onnx')  # Export to ONNX for faster inference
    
    print("\n✅ Model saved to: runs/detect/breast_cancer_detector/weights/best.pt")
    return model


if __name__ == "__main__":
    # Check dataset exists
    if not os.path.exists(DATASET_PATH):
        print(f"❌ Error: Dataset not found at {DATASET_PATH}")
        print("\n📥 Please download dataset from Kaggle:")
        print("   1. CBIS-DDSM: https://www.kaggle.com/datasets/awsaf49/cbis-ddsm-breast-cancer-image-dataset")
        print("   2. VinDr-Mammo: https://www.kaggle.com/competitions/vinbigdata-chest-xray-abnormalities-detection")
        print("\n   Or use: kaggle datasets download -d awsaf49/cbis-ddsm-breast-cancer-image-dataset")
        exit(1)
    
    # Start training
    trained_model = train_yolo_model()
    
    print("\n🎉 Training pipeline completed successfully!")
    print("\n📝 Next steps:")
    print("   1. Check training results in: runs/detect/breast_cancer_detector/")
    print("   2. Review metrics and plots")
    print("   3. Test model with: python test_yolo.py")
    print("   4. Integrate with backend: python integrate_yolo.py")

