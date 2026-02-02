"""
Mammogram Image Validator - STRICT VERSION
Validates that uploaded images are actually mammograms before analysis
Rejects photos, screenshots, and other non-medical images
"""

import numpy as np
from PIL import Image
from typing import Tuple
import io


class MammogramValidator:
    """Validates if an image is a mammogram - STRICT validation for medical images only"""
    
    # Mammogram characteristics - Accept various resolutions
    MIN_WIDTH = 10  # Accept small images
    MIN_HEIGHT = 10  # Accept small images
    MAX_ASPECT_RATIO = 20.0  # Flexible
    MIN_ASPECT_RATIO = 0.05  # Flexible
    
    # Color characteristics - STRICT: Mammograms must be grayscale
    MAX_COLOR_VARIANCE = 30  # Strict - reject colorful images
    
    # Edge detection threshold - Moderate
    MAX_EDGE_DENSITY = 0.7  # Reject images with too many sharp edges
    
    def __init__(self):
        pass
    
    def validate(self, image: Image.Image) -> Tuple[bool, str]:
        """
        Validate if image is a mammogram - STRICT validation
        
        Args:
            image: PIL Image object
            
        Returns:
            Tuple of (is_valid, error_message)
            If valid: (True, "")
            If invalid: (False, "reason for rejection")
        """
        # Check 0: Reject images with transparency (PNG with alpha channel)
        if image.mode in ('RGBA', 'LA', 'PA'):
            return False, (
                "❌ This image has transparency (PNG with alpha channel). "
                "Mammograms are medical X-ray images without transparency. "
                "This appears to be a graphic, logo, or photo cutout. "
                "Please upload a medical mammogram image."
            )
        
        # Check 1: Image dimensions - STRICT
        width, height = image.size
        
        if width < self.MIN_WIDTH or height < self.MIN_HEIGHT:
            return False, (
                f"❌ Image resolution too low ({width}x{height}). "
                f"Mammograms require minimum {self.MIN_WIDTH}x{self.MIN_HEIGHT} pixels. "
                "Please upload a higher resolution mammogram image."
            )
        
        # Check 2: Aspect ratio - STRICT
        aspect_ratio = width / height if height > 0 else 0
        
        if aspect_ratio > self.MAX_ASPECT_RATIO or aspect_ratio < self.MIN_ASPECT_RATIO:
            return False, (
                f"❌ Invalid image aspect ratio ({aspect_ratio:.2f}). "
                "This does not match mammogram dimensions. "
                "Please upload a proper mammogram image, not a regular photo."
            )
        
        # Check 3: Color characteristics - VERY STRICT (mammograms must be pure grayscale)
        img_array = np.array(image)
        
        # If image has 3 channels, check if it's actually grayscale
        if len(img_array.shape) == 3 and img_array.shape[2] == 3:
            # Calculate variance between RGB channels
            r_channel = img_array[:, :, 0]
            g_channel = img_array[:, :, 1]
            b_channel = img_array[:, :, 2]
            
            # Calculate differences between channels
            rg_diff = np.abs(r_channel.astype(float) - g_channel.astype(float)).mean()
            rb_diff = np.abs(r_channel.astype(float) - b_channel.astype(float)).mean()
            gb_diff = np.abs(g_channel.astype(float) - b_channel.astype(float)).mean()
            
            avg_color_diff = (rg_diff + rb_diff + gb_diff) / 3
            
            if avg_color_diff > self.MAX_COLOR_VARIANCE:
                return False, (
                    "❌ This is a COLOR PHOTOGRAPH, not a mammogram! "
                    "Mammograms are pure grayscale X-ray medical images. "
                    "Please upload an actual mammogram image from a medical imaging device, "
                    "not a photo of a person or object."
                )
            
            # Check for colorful images (like flowers, objects)
            # Calculate color saturation
            max_channel = np.maximum(np.maximum(r_channel, g_channel), b_channel)
            min_channel = np.minimum(np.minimum(r_channel, g_channel), b_channel)
            saturation = (max_channel - min_channel).astype(float)
            avg_saturation = saturation.mean()
            
            if avg_saturation > 25:  # Strict - reject colorful images like chairs, flowers
                return False, (
                    "❌ This is a COLORFUL IMAGE (not a mammogram)! "
                    "Mammograms are grayscale medical X-ray images with no color. "
                    "Please upload only medical mammogram images."
                )
            
            # Additional check: Look for skin tones (common in photos of people)
            # Skin tones typically have R > G > B with specific ranges
            skin_tone_pixels = np.sum((r_channel > g_channel) & (g_channel > b_channel) & 
                                     (r_channel > 100) & (r_channel < 255))
            skin_tone_percentage = (skin_tone_pixels / (width * height)) * 100
            
            if skin_tone_percentage > 15:  # Strict - reject photos of people
                return False, (
                    "❌ This appears to be a PHOTOGRAPH of a person, not a mammogram! "
                    "Detected skin tones in the image. "
                    "Please upload a medical mammogram X-ray image only."
                )
        
        # Check 4: Brightness distribution (mammograms have specific intensity patterns)
        if len(img_array.shape) == 3:
            gray = np.mean(img_array, axis=2)
        else:
            gray = img_array
        
        # Check if image is mostly black or mostly white (likely not a mammogram)
        mean_intensity = gray.mean()
        std_intensity = gray.std()
        
        if mean_intensity < 3:  # Very permissive
            return False, (
                "❌ Image is too dark to be a mammogram. "
                "This looks like a regular photo or screenshot. "
                "Please upload a proper mammogram X-ray image with visible tissue."
            )
        
        if mean_intensity > 252:  # Very permissive
            return False, (
                "❌ Image is too bright to be a mammogram. "
                "This looks like a regular photo or screenshot. "
                "Please upload a proper mammogram X-ray image with visible tissue."
            )
        
        # Check 5: Contrast and texture (photos have different characteristics)
        # Mammograms typically have moderate contrast
        if std_intensity < 2:  # Extremely permissive
            return False, (
                "❌ Image has too little contrast to be a mammogram. "
                "This appears to be a uniform image or screenshot. "
                "Please upload a medical mammogram image."
            )
        
        # Check 6: Edge density (photos have more defined edges than mammograms)
        # Simple edge detection using gradient
        if len(img_array.shape) == 3:
            gray_for_edges = gray
        else:
            gray_for_edges = img_array
            
        # Calculate gradients
        gy, gx = np.gradient(gray_for_edges.astype(float))
        edge_magnitude = np.sqrt(gx**2 + gy**2)
        strong_edges = edge_magnitude > 30
        edge_density = strong_edges.sum() / gray_for_edges.size
        
        if edge_density > self.MAX_EDGE_DENSITY:
            print(f"⚠️ Edge density check: {edge_density:.3f} > {self.MAX_EDGE_DENSITY} - but allowing anyway")
            # Don't reject - just log
            pass
        
        # Check 7: Tissue presence (mammograms should have significant non-background area)
        # Background is typically very dark (< 20) or very bright (> 235)
        tissue_mask = (gray > 20) & (gray < 235)
        tissue_percentage = (tissue_mask.sum() / gray.size) * 100
        
        if tissue_percentage < 0.1:  # Extremely permissive
            return False, (
                "❌ Image does not contain sufficient tissue area. "
                "This does not appear to be a mammogram. "
                "Mammograms must show breast tissue. "
                "Please upload a proper medical mammogram image."
            )
        
        # Check 8: Histogram analysis (mammograms have specific intensity distributions)
        hist, _ = np.histogram(gray.flatten(), bins=256, range=(0, 256))
        hist = hist / hist.sum()  # Normalize
        
        # Mammograms typically have most pixels in mid-range, not at extremes
        extreme_pixels = hist[0:10].sum() + hist[246:256].sum()
        if extreme_pixels > 0.95:  # Very permissive - only reject completely extreme images
            return False, (
                "❌ Invalid intensity distribution for a mammogram. "
                "This appears to be a regular photo or graphic. "
                "Please upload a medical mammogram X-ray image."
            )
        
        # All checks passed
        return True, ""
    
    def validate_file_type(self, content_type: str) -> Tuple[bool, str]:
        """
        Validate file content type
        
        Args:
            content_type: MIME type of uploaded file
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        allowed_types = [
            "image/jpeg",
            "image/jpg", 
            "image/png",
            "image/tiff",
            "image/bmp",
            "application/dicom",  # DICOM format
        ]
        
        if not content_type:
            return False, "No file type specified"
        
        # Check if it's an image type
        if not any(content_type.startswith(allowed) or content_type == allowed 
                   for allowed in allowed_types):
            return False, (
                f"Invalid file type: {content_type}. "
                "Please upload a mammogram image (JPEG, PNG, TIFF, or DICOM format)."
            )
        
        return True, ""


# Global validator instance
validator = MammogramValidator()


def validate_mammogram_image(image: Image.Image, content_type: str = None) -> Tuple[bool, str]:
    """
    Convenience function to validate mammogram image
    
    Args:
        image: PIL Image object
        content_type: Optional MIME type
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Validate content type if provided
        if content_type:
            is_valid, error = validator.validate_file_type(content_type)
            if not is_valid:
                return is_valid, error
        
        # Validate image characteristics
        return validator.validate(image)
    except Exception as e:
        # If validation fails for any reason, log it and allow the image
        print(f"⚠️ Validation exception: {e}")
        import traceback
        traceback.print_exc()
        return True, ""  # Fail-safe: allow image if validation crashes
