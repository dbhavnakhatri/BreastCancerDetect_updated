"""
Dataset Preparation Script for YOLO Training
Converts Kaggle breast cancer datasets to YOLO format
"""

import os
import shutil
import json
import pandas as pd
from pathlib import Path
from PIL import Image
import numpy as np
from tqdm import tqdm

# Kaggle datasets to use
DATASETS = {
    "CBIS-DDSM": {
        "url": "https://www.kaggle.com/datasets/awsaf49/cbis-ddsm-breast-cancer-image-dataset",
        "classes": ["mass", "calcification"]
    },
    "VinDr-Mammo": {
        "url": "https://www.kaggle.com/datasets/vinbigdata-chest-xray-abnormalities-detection",
        "classes": ["mass", "suspicious_calcification", "architectural_distortion", "asymmetry", "focal_asymmetry"]
    }
}

# YOLO class mapping
CLASS_MAPPING = {
    "mass": 0,
    "calcification": 1,
    "suspicious_calcification": 1,
    "microcalcifications": 1,
    "architectural_distortion": 2,
    "architectural distortion": 2,
    "asymmetry": 3,
    "focal_asymmetry": 3,
    "focal asymmetry": 3,
    "skin_thickening": 4,
    "skin thickening": 4
}

def download_from_kaggle(dataset_name):
    """
    Download dataset from Kaggle using Kaggle API
    """
    print(f"\n📥 Downloading {dataset_name} from Kaggle...")
    
    # Make sure kaggle API is installed
    try:
        import kaggle
    except ImportError:
        print("❌ Kaggle API not installed. Install with: pip install kaggle")
        print("\n📝 Setup Kaggle API:")
        print("   1. Create account on kaggle.com")
        print("   2. Go to Account > API > Create New API Token")
        print("   3. Place kaggle.json in ~/.kaggle/ (Linux/Mac) or C:\\Users\\<user>\\.kaggle\\ (Windows)")
        return False
    
    if dataset_name == "CBIS-DDSM":
        os.system("kaggle datasets download -d awsaf49/cbis-ddsm-breast-cancer-image-dataset")
        os.system("unzip cbis-ddsm-breast-cancer-image-dataset.zip -d datasets/raw/cbis-ddsm")
    elif dataset_name == "VinDr-Mammo":
        print("VinDr-Mammo requires competition acceptance. Please download manually.")
        return False
    
    print("✅ Download complete!")
    return True


def convert_to_yolo_format(image_path, annotations, output_dir):
    """
    Convert annotations to YOLO format
    YOLO format: <class_id> <x_center> <y_center> <width> <height> (normalized 0-1)
    """
    # Create output directories
    os.makedirs(os.path.join(output_dir, 'images'), exist_ok=True)
    os.makedirs(os.path.join(output_dir, 'labels'), exist_ok=True)
    
    # Get image dimensions
    img = Image.open(image_path)
    img_width, img_height = img.size
    
    # Copy image
    img_name = os.path.basename(image_path)
    shutil.copy(image_path, os.path.join(output_dir, 'images', img_name))
    
    # Convert annotations
    yolo_annotations = []
    for ann in annotations:
        class_name = ann['class'].lower().replace(' ', '_')
        class_id = CLASS_MAPPING.get(class_name, 0)
        
        # Get bounding box (x, y, width, height in pixels)
        x, y, w, h = ann['bbox']
        
        # Convert to YOLO format (normalized center coordinates)
        x_center = (x + w / 2) / img_width
        y_center = (y + h / 2) / img_height
        width = w / img_width
        height = h / img_height
        
        # Ensure values are within 0-1
        x_center = max(0, min(1, x_center))
        y_center = max(0, min(1, y_center))
        width = max(0, min(1, width))
        height = max(0, min(1, height))
        
        yolo_annotations.append(f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}")
    
    # Save labels
    label_name = os.path.splitext(img_name)[0] + '.txt'
    label_path = os.path.join(output_dir, 'labels', label_name)
    with open(label_path, 'w') as f:
        f.write('\n'.join(yolo_annotations))
    
    return len(yolo_annotations)


def prepare_cbis_ddsm(raw_path, output_path):
    """
    Prepare CBIS-DDSM dataset for YOLO training
    """
    print("\n🔧 Processing CBIS-DDSM dataset...")
    
    # Read annotations
    csv_files = list(Path(raw_path).glob("**/*.csv"))
    
    if not csv_files:
        print("❌ No CSV files found. Please check dataset structure.")
        return
    
    train_count = 0
    val_count = 0
    
    for csv_file in csv_files:
        df = pd.read_csv(csv_file)
        
        for idx, row in tqdm(df.iterrows(), total=len(df), desc=f"Processing {csv_file.name}"):
            try:
                image_path = os.path.join(raw_path, row['image_path'])
                
                if not os.path.exists(image_path):
                    continue
                
                # Create annotation
                annotations = [{
                    'class': row['pathology'] if 'pathology' in row else row['abnormality_type'],
                    'bbox': [
                        row['ROI_xmin'] if 'ROI_xmin' in row else row['x'],
                        row['ROI_ymin'] if 'ROI_ymin' in row else row['y'],
                        row['ROI_width'] if 'ROI_width' in row else row['width'],
                        row['ROI_height'] if 'ROI_height' in row else row['height']
                    ]
                }]
                
                # Split train/val (80/20)
                split = 'train' if np.random.rand() < 0.8 else 'val'
                output_dir = os.path.join(output_path, split)
                
                ann_count = convert_to_yolo_format(image_path, annotations, output_dir)
                
                if split == 'train':
                    train_count += ann_count
                else:
                    val_count += ann_count
                    
            except Exception as e:
                print(f"Error processing row {idx}: {e}")
                continue
    
    print(f"\n✅ Dataset prepared!")
    print(f"   Training samples: {train_count}")
    print(f"   Validation samples: {val_count}")


def create_sample_dataset():
    """
    Create a sample dataset structure for testing
    """
    print("\n📦 Creating sample dataset structure...")
    
    base_path = "datasets/breast_cancer"
    for split in ['train', 'val', 'test']:
        os.makedirs(f"{base_path}/images/{split}", exist_ok=True)
        os.makedirs(f"{base_path}/labels/{split}", exist_ok=True)
    
    print(f"✅ Sample structure created at: {base_path}")
    print("\n📝 Dataset Structure:")
    print("   datasets/breast_cancer/")
    print("   ├── images/")
    print("   │   ├── train/")
    print("   │   ├── val/")
    print("   │   └── test/")
    print("   └── labels/")
    print("       ├── train/")
    print("       ├── val/")
    print("       └── test/")
    print("\n📥 Place your images and labels in respective folders")


if __name__ == "__main__":
    print("="*60)
    print("🏥 Breast Cancer Dataset Preparation for YOLO")
    print("="*60)
    
    print("\n🎯 Supported Datasets:")
    print("   1. CBIS-DDSM (Curated Breast Imaging Subset of DDSM)")
    print("   2. VinDr-Mammo (Vietnam Digital Mammography)")
    print("   3. Custom dataset")
    
    choice = input("\nSelect option (1/2/3): ").strip()
    
    if choice == "1":
        download_from_kaggle("CBIS-DDSM")
        prepare_cbis_ddsm("datasets/raw/cbis-ddsm", "datasets/breast_cancer")
    elif choice == "2":
        print("\n📝 Please download VinDr-Mammo manually from Kaggle")
        print("   Then run this script again")
    elif choice == "3":
        create_sample_dataset()
        print("\n📝 Manual Setup Required:")
        print("   1. Place images in images/train, images/val folders")
        print("   2. Create YOLO format labels in labels/train, labels/val")
        print("   3. Label format: <class_id> <x_center> <y_center> <width> <height>")
        print("   4. All values should be normalized (0-1)")
    else:
        print("Invalid choice")
    
    print("\n✅ Setup complete! Ready for training.")

