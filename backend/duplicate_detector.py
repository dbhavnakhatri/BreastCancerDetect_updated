"""
Duplicate image detection using perceptual hashing
Detects when the same image is uploaded multiple times, even with different filenames
"""

import hashlib
import numpy as np
from PIL import Image
from typing import Tuple
import io


class DuplicateDetector:
    """Detects duplicate images using file hash and perceptual hash"""
    
    def __init__(self):
        self.uploaded_hashes = {}  # Store hashes of uploaded images
        self.uploaded_phashes = {}  # Store perceptual hashes
    
    @staticmethod
    def get_file_hash(image_data: bytes) -> str:
        """
        Generate SHA-256 hash of image file content
        
        Args:
            image_data: Raw image bytes
            
        Returns:
            Hex string of the hash
        """
        return hashlib.sha256(image_data).hexdigest()
    
    @staticmethod
    def get_perceptual_hash(image: Image.Image) -> str:
        """
        Generate perceptual hash of image (detects similar images)
        Uses 8x8 grayscale approach
        
        Args:
            image: PIL Image object
            
        Returns:
            Hex string of the perceptual hash
        """
        # Resize to 8x8
        img_small = image.resize((8, 8), Image.Resampling.LANCZOS)
        
        # Convert to grayscale
        img_gray = img_small.convert('L')
        
        # Get pixel data
        pixels = np.array(img_gray)
        
        # Calculate average pixel value
        avg = pixels.mean()
        
        # Create binary hash: 1 if pixel > avg, 0 otherwise
        hash_bits = (pixels > avg).flatten()
        
        # Convert to hex
        hash_int = int(''.join(hash_bits.astype(int).astype(str)), 2)
        return format(hash_int, '016x')
    
    @staticmethod
    def hamming_distance(hash1: str, hash2: str) -> int:
        """
        Calculate Hamming distance between two hex hashes
        Lower distance = more similar images
        
        Args:
            hash1: First hash (hex string)
            hash2: Second hash (hex string)
            
        Returns:
            Hamming distance (0-64 for 64-bit hashes)
        """
        if len(hash1) != len(hash2):
            return float('inf')
        
        # Convert hex to binary and count differing bits
        bin1 = bin(int(hash1, 16))[2:].zfill(64)
        bin2 = bin(int(hash2, 16))[2:].zfill(64)
        
        distance = sum(b1 != b2 for b1, b2 in zip(bin1, bin2))
        return distance
    
    def check_duplicate(self, image_data: bytes, image: Image.Image, filename: str) -> Tuple[bool, str]:
        """
        Check if image is a duplicate of previously uploaded images
        
        Args:
            image_data: Raw image bytes
            image: PIL Image object
            filename: Original filename
            
        Returns:
            Tuple of (is_duplicate, reason_message)
        """
        try:
            # If no images have been uploaded yet, this is the first one
            if not self.uploaded_hashes and not self.uploaded_phashes:
                # Store this image's hashes for future comparisons
                file_hash = self.get_file_hash(image_data)
                phash = self.get_perceptual_hash(image)
                self.uploaded_hashes[file_hash] = filename
                self.uploaded_phashes[phash] = filename
                return False, ""
            
            # Get file hash (exact duplicate detection)
            file_hash = self.get_file_hash(image_data)
            
            # Check against previously uploaded file hashes
            for prev_hash, prev_filename in self.uploaded_hashes.items():
                if file_hash == prev_hash:
                    return True, f"❌ Exact duplicate detected: This image matches '{prev_filename}'. Please upload a different mammogram."
            
            # Get perceptual hash (similar image detection)
            phash = self.get_perceptual_hash(image)
            
            # Check against previously uploaded perceptual hashes
            for prev_phash, prev_filename in self.uploaded_phashes.items():
                distance = self.hamming_distance(phash, prev_phash)
                
                # Threshold: distance <= 3 means very similar (same image, possibly compressed differently)
                # This is stricter than the frontend (<=5) to reduce false positives
                if distance <= 3:
                    return True, f"❌ Duplicate detected: This image is very similar to '{prev_filename}' (similarity: {64-distance}/64). Please upload a different mammogram."
            
            # Store this image's hashes for future comparisons
            self.uploaded_hashes[file_hash] = filename
            self.uploaded_phashes[phash] = filename
            
            return False, ""
            
        except Exception as e:
            print(f"⚠️ Error checking for duplicates: {e}")
            import traceback
            traceback.print_exc()
            # Fail-safe: allow image through if duplicate check fails
            return False, ""
    
    def clear(self):
        """Clear stored hashes (call after analysis session ends)"""
        self.uploaded_hashes.clear()
        self.uploaded_phashes.clear()


# Global instance for the application
duplicate_detector = DuplicateDetector()
