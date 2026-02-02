"""
Test that the validator REJECTS photos of flowers and objects
"""

from PIL import Image
import numpy as np
from mammogram_validator import validate_mammogram_image


def test_flower_image():
    """
    Simulate a photo of a flower (like in your screenshot)
    This should be REJECTED
    """
    print("=" * 70)
    print("TEST: Photo of a flower (should be REJECTED)")
    print("=" * 70)
    
    # Create an image that simulates a colorful flower
    width, height = 1920, 1080
    
    # Create RGB image with pink/red colors (like a flower)
    img_array = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Background (white/transparent-like)
    img_array[:, :, :] = 240
    
    # Add "flower" area with pink/red colors
    flower_center_y, flower_center_x = height // 2, width // 2
    for y in range(height):
        for x in range(width):
            dist = np.sqrt((x - flower_center_x)**2 + (y - flower_center_y)**2)
            if dist < 300:
                # Pink/red flower
                img_array[y, x, 0] = 255  # Red channel (high)
                img_array[y, x, 1] = int(150 - dist/3)  # Green channel (medium)
                img_array[y, x, 2] = int(180 - dist/3)  # Blue channel (medium)
    
    image = Image.fromarray(img_array, mode='RGB')
    
    is_valid, error = validate_mammogram_image(image, "image/png")
    
    if not is_valid:
        print("✅ CORRECTLY REJECTED!")
        print(f"   Reason: {error}")
        return True
    else:
        print("❌ FAILED - Flower image was incorrectly accepted!")
        return False


def test_transparent_png():
    """
    Test PNG with transparency (should be REJECTED)
    """
    print("\n" + "=" * 70)
    print("TEST: PNG with transparency (should be REJECTED)")
    print("=" * 70)
    
    # Create RGBA image (with alpha channel)
    width, height = 1920, 1080
    img_array = np.zeros((height, width, 4), dtype=np.uint8)
    
    # Semi-transparent background
    img_array[:, :, 3] = 128  # Alpha channel
    
    # Pink flower
    img_array[400:700, 800:1100, 0] = 255
    img_array[400:700, 800:1100, 1] = 150
    img_array[400:700, 800:1100, 2] = 180
    img_array[400:700, 800:1100, 3] = 255
    
    image = Image.fromarray(img_array, mode='RGBA')
    
    is_valid, error = validate_mammogram_image(image, "image/png")
    
    if not is_valid:
        print("✅ CORRECTLY REJECTED!")
        print(f"   Reason: {error}")
        return True
    else:
        print("❌ FAILED - Transparent PNG was incorrectly accepted!")
        return False


def test_colorful_object():
    """
    Test colorful object photo (should be REJECTED)
    """
    print("\n" + "=" * 70)
    print("TEST: Colorful object (should be REJECTED)")
    print("=" * 70)
    
    width, height = 1920, 1080
    
    # Create very colorful image
    img_array = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Rainbow colors
    img_array[:, :width//3, 0] = 255  # Red section
    img_array[:, width//3:2*width//3, 1] = 255  # Green section
    img_array[:, 2*width//3:, 2] = 255  # Blue section
    
    image = Image.fromarray(img_array, mode='RGB')
    
    is_valid, error = validate_mammogram_image(image, "image/jpeg")
    
    if not is_valid:
        print("✅ CORRECTLY REJECTED!")
        print(f"   Reason: {error}")
        return True
    else:
        print("❌ FAILED - Colorful object was incorrectly accepted!")
        return False


if __name__ == "__main__":
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "TESTING REAL-WORLD OBJECT REJECTION" + " " * 18 + "║")
    print("╚" + "=" * 68 + "╝")
    print()
    
    tests = [
        ("Flower Photo", test_flower_image),
        ("Transparent PNG", test_transparent_png),
        ("Colorful Object", test_colorful_object),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            failed += 1
            print(f"❌ {test_name}: ERROR - {e}\n")
    
    print("\n" + "=" * 70)
    print(f"FINAL RESULTS: {passed} passed, {failed} failed")
    print("=" * 70)
    
    if failed == 0:
        print("\n✅ ALL TESTS PASSED! Real-world objects will be rejected! ✅\n")
    else:
        print(f"\n❌ {failed} test(s) failed\n")
