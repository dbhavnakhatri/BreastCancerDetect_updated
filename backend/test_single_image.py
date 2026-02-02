"""
Test script to analyze a single image and see what's happening
"""

import sys
from PIL import Image
from mammogram_validator import validate_mammogram_image

if len(sys.argv) < 2:
    print("Usage: python test_single_image.py <image_path>")
    sys.exit(1)

image_path = sys.argv[1]

print("=" * 70)
print(f"Testing image: {image_path}")
print("=" * 70)
print()

# Load image
try:
    image = Image.open(image_path).convert("RGB")
    print(f"✅ Image loaded: {image.size[0]}x{image.size[1]}")
except Exception as e:
    print(f"❌ Failed to load image: {e}")
    sys.exit(1)

# Validate
print("\nRunning validation...")
try:
    is_valid, error_message = validate_mammogram_image(image, "image/jpeg")
    
    if is_valid:
        print("✅ ✅ ✅ VALIDATION PASSED ✅ ✅ ✅")
        print("This image will be accepted and analyzed")
    else:
        print("❌ ❌ ❌ VALIDATION FAILED ❌ ❌ ❌")
        print(f"\nReason: {error_message}")
        
except Exception as e:
    print(f"⚠️ Validation error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
