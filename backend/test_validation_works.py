"""
Quick test to verify validation is working
Run this to test without starting the full server
"""

from PIL import Image
import numpy as np
from mammogram_validator import validate_mammogram_image

print("=" * 70)
print("TESTING VALIDATION - Simulating your screenshot")
print("=" * 70)
print()

# Create an image that simulates the photo of a person in your screenshot
# - High resolution (1920x1080)
# - Color image with skin tones
# - Sharp edges (face features, clothing)
width, height = 1920, 1080

# Create RGB image with skin-tone colors
img_array = np.zeros((height, width, 3), dtype=np.uint8)

# Background (white/light)
img_array[:, :, :] = 240

# Add "person" area with skin tones (R > G > B)
person_area_h = slice(200, 900)
person_area_w = slice(600, 1300)
img_array[person_area_h, person_area_w, 0] = 220  # Red channel (high)
img_array[person_area_h, person_area_w, 1] = 180  # Green channel (medium)
img_array[person_area_h, person_area_w, 2] = 150  # Blue channel (low)

# Add some "clothing" area (darker, different color)
clothing_area = slice(700, 900)
img_array[clothing_area, person_area_w, 0] = 50
img_array[clothing_area, person_area_w, 1] = 50
img_array[clothing_area, person_area_w, 2] = 80

# Add sharp edges (simulate face features)
img_array[400:410, 800:900, :] = 0  # Dark line (eyes)
img_array[600:610, 850:950, :] = 0  # Dark line (mouth)

image = Image.fromarray(img_array, mode='RGB')

print("Testing image similar to your screenshot:")
print(f"  - Size: {width}x{height}")
print(f"  - Type: Color photo with person")
print(f"  - Has skin tones: Yes")
print()

# Test validation
is_valid, error = validate_mammogram_image(image, "image/jpeg")

print("VALIDATION RESULT:")
print("=" * 70)

if not is_valid:
    print("✅ ✅ ✅ SUCCESS! Photo was REJECTED! ✅ ✅ ✅")
    print()
    print("Error message that will be shown to user:")
    print(f"  {error}")
    print()
    print("This means the validation is working correctly!")
    print("Photos of people will now be rejected!")
else:
    print("❌ ❌ ❌ FAILED! Photo was accepted! ❌ ❌ ❌")
    print()
    print("This should not happen. The validation is not working.")

print("=" * 70)
