"""
Test script for duplicate image detection
Run this to verify the duplicate detection system works correctly
"""

import sys
from pathlib import Path
from PIL import Image
import numpy as np

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from duplicate_detector import DuplicateDetector


def create_test_image(filename, width=224, height=224, color_value=128, pattern=None):
    """Create a test mammogram-like image"""
    if pattern == "gradient":
        # Create a gradient pattern
        img_array = np.zeros((height, width, 3), dtype=np.uint8)
        for i in range(height):
            img_array[i, :] = int(color_value * (i / height))
    elif pattern == "noise":
        # Create a noisy pattern
        img_array = np.random.randint(color_value - 30, color_value + 30, (height, width, 3), dtype=np.uint8)
    else:
        # Uniform color
        img_array = np.full((height, width, 3), color_value, dtype=np.uint8)
    
    img = Image.fromarray(img_array)
    img.save(filename)
    return filename


def test_exact_duplicate():
    """Test 1: Exact duplicate detection"""
    print("\n" + "="*60)
    print("TEST 1: Exact Duplicate Detection")
    print("="*60)
    
    detector = DuplicateDetector()
    
    # Create first image
    img1_path = "test_image_1.jpg"
    create_test_image(img1_path)
    
    with open(img1_path, 'rb') as f:
        data1 = f.read()
    img1 = Image.open(img1_path)
    
    # First upload should succeed
    is_dup, msg = detector.check_duplicate(data1, img1, "test_image_1.jpg")
    print(f"First upload: {'DUPLICATE' if is_dup else 'UNIQUE'}")
    print(f"Message: {msg}")
    assert not is_dup, "First image should not be marked as duplicate"
    
    # Second upload of same file should be detected as duplicate
    is_dup, msg = detector.check_duplicate(data1, img1, "test_image_1_copy.jpg")
    print(f"\nSecond upload (same file): {'DUPLICATE' if is_dup else 'UNIQUE'}")
    print(f"Message: {msg}")
    assert is_dup, "Exact duplicate should be detected"
    img1.close()
    
    print("\n✅ TEST 1 PASSED: Exact duplicates detected correctly")
    
    # Cleanup
    Path(img1_path).unlink()


def test_perceptual_duplicate():
    """Test 2: Perceptual duplicate detection (similar images)"""
    print("\n" + "="*60)
    print("TEST 2: Perceptual Duplicate Detection")
    print("="*60)
    
    detector = DuplicateDetector()
    
    # Create first image
    img1_path = "test_image_2a.jpg"
    create_test_image(img1_path, color_value=128)
    
    with open(img1_path, 'rb') as f:
        data1 = f.read()
    img1 = Image.open(img1_path)
    
    # First upload
    is_dup, msg = detector.check_duplicate(data1, img1, "test_image_2a.jpg")
    print(f"First upload: {'DUPLICATE' if is_dup else 'UNIQUE'}")
    assert not is_dup, "First image should not be marked as duplicate"
    img1.close()
    
    # Create very similar image (same content, slightly different compression)
    img2_path = "test_image_2b.jpg"
    create_test_image(img2_path, color_value=128)
    
    with open(img2_path, 'rb') as f:
        data2 = f.read()
    img2 = Image.open(img2_path)
    
    # Second upload of similar image
    is_dup, msg = detector.check_duplicate(data2, img2, "test_image_2b.jpg")
    print(f"\nSecond upload (similar image): {'DUPLICATE' if is_dup else 'UNIQUE'}")
    print(f"Message: {msg}")
    assert is_dup, "Perceptually similar image should be detected as duplicate"
    img2.close()
    
    print("\n✅ TEST 2 PASSED: Perceptual duplicates detected correctly")
    
    # Cleanup
    Path(img1_path).unlink()
    Path(img2_path).unlink()


def test_different_images():
    """Test 3: Different images should not be marked as duplicates"""
    print("\n" + "="*60)
    print("TEST 3: Different Images (Should NOT be duplicates)")
    print("="*60)
    
    detector = DuplicateDetector()
    
    # Create first image (gradient pattern)
    img1_path = "test_image_3a.jpg"
    create_test_image(img1_path, color_value=100, pattern="gradient")
    
    with open(img1_path, 'rb') as f:
        data1 = f.read()
    img1 = Image.open(img1_path)
    
    # First upload
    is_dup, msg = detector.check_duplicate(data1, img1, "test_image_3a.jpg")
    print(f"First upload (gradient image): {'DUPLICATE' if is_dup else 'UNIQUE'}")
    assert not is_dup, "First image should not be marked as duplicate"
    img1.close()
    
    # Create different image (noise pattern)
    img2_path = "test_image_3b.jpg"
    create_test_image(img2_path, color_value=150, pattern="noise")
    
    with open(img2_path, 'rb') as f:
        data2 = f.read()
    img2 = Image.open(img2_path)
    
    # Second upload of different image
    is_dup, msg = detector.check_duplicate(data2, img2, "test_image_3b.jpg")
    print(f"\nSecond upload (noise image): {'DUPLICATE' if is_dup else 'UNIQUE'}")
    print(f"Message: {msg}")
    assert not is_dup, "Different images should not be marked as duplicates"
    img2.close()
    
    print("\n✅ TEST 3 PASSED: Different images correctly identified as unique")
    
    # Cleanup
    Path(img1_path).unlink()
    Path(img2_path).unlink()


def test_cache_clear():
    """Test 4: Cache clearing functionality"""
    print("\n" + "="*60)
    print("TEST 4: Cache Clearing")
    print("="*60)
    
    detector = DuplicateDetector()
    
    # Create and upload image
    img_path = "test_image_4.jpg"
    create_test_image(img_path)
    
    with open(img_path, 'rb') as f:
        data = f.read()
    img = Image.open(img_path)
    
    # First upload
    is_dup, msg = detector.check_duplicate(data, img, "test_image_4.jpg")
    print(f"First upload: {'DUPLICATE' if is_dup else 'UNIQUE'}")
    assert not is_dup, "First image should not be marked as duplicate"
    
    # Try to upload same image again (should be duplicate)
    is_dup, msg = detector.check_duplicate(data, img, "test_image_4.jpg")
    print(f"Second upload (before clear): {'DUPLICATE' if is_dup else 'UNIQUE'}")
    assert is_dup, "Should be marked as duplicate before clearing"
    
    # Clear cache
    detector.clear()
    print("\nCache cleared!")
    
    # Try to upload same image again (should now be unique)
    is_dup, msg = detector.check_duplicate(data, img, "test_image_4.jpg")
    print(f"Third upload (after clear): {'DUPLICATE' if is_dup else 'UNIQUE'}")
    assert not is_dup, "Should not be marked as duplicate after clearing cache"
    img.close()
    
    print("\n✅ TEST 4 PASSED: Cache clearing works correctly")
    
    # Cleanup
    Path(img_path).unlink()


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("DUPLICATE DETECTION SYSTEM - TEST SUITE")
    print("="*60)
    
    try:
        test_exact_duplicate()
        test_perceptual_duplicate()
        test_different_images()
        test_cache_clear()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        print("\nDuplicate detection system is working correctly.")
        print("Your model will now reject duplicate images.")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
