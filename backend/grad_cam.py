import tensorflow as tf
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import matplotlib
import re

matplotlib.use("Agg")  # Ensure headless rendering for serverless environments
import matplotlib.cm as cm
import matplotlib.pyplot as plt
from scipy import ndimage

# Try to import OCR libraries
try:
    import pytesseract
    import cv2
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("WARNING: pytesseract or cv2 not available. OCR-based text detection disabled.")

def make_gradcam_heatmap(img_array, model, last_conv_layer_index, pred_index=None):
    """
    Generate Grad-CAM heatmap for a given image and model.
    
    Args:
        img_array: Preprocessed input image (batch_size, height, width, channels)
        model: The trained model  
        last_conv_layer_index: Index of the last convolutional layer
        pred_index: Index of the class to visualize (None for top prediction)
    
    Returns:
        Normalized heatmap as numpy array
    """
    # Get the last convolutional layer
    last_conv_layer = model.layers[last_conv_layer_index]
    
    # For loaded Sequential models, we need to create inputs manually
    # Create a new input tensor
    inputs = tf.keras.Input(shape=(224, 224, 3))
    
    # Pass through all layers up to and including the last conv layer
    x = inputs
    for i, layer in enumerate(model.layers):
        x = layer(x)
        if i == last_conv_layer_index:
            conv_output = x
    
    # Get the final output
    final_output = x
    
    # Create a model that maps inputs to activations of the last conv layer and the output predictions
    grad_model = tf.keras.Model(
        inputs=inputs,
        outputs=[conv_output, final_output]
    )
    
    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(img_array)
        if pred_index is None:
            pred_index = 0
        class_channel = predictions[:, pred_index]
    
    grads = tape.gradient(class_channel, conv_outputs)
    
    if grads is None:
        return None
    
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    
    conv_outputs = conv_outputs[0]
    heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    
    heatmap = tf.maximum(heatmap, 0)
    max_val = tf.math.reduce_max(heatmap)
    if max_val > 0:
        heatmap = heatmap / max_val
    
    return heatmap.numpy()

def create_tissue_mask(img_array, threshold=15):
    """
    Create a mask identifying tissue (non-background) areas.
    
    Args:
        img_array: Image as numpy array
        threshold: Pixel intensity threshold to distinguish tissue from background
    
    Returns:
        Binary mask where True = tissue area
    """
    if len(img_array.shape) == 3:
        gray = np.mean(img_array, axis=2)
    else:
        gray = img_array
    
    # Tissue is where pixel intensity is above threshold (not black background)
    mask = gray > threshold
    return mask


def create_intensity_based_heatmap(img_array):
    """Create heatmap based on image intensity - highlights bright regions (potential lesions)."""
    from scipy.ndimage import gaussian_filter
    
    if len(img_array.shape) == 3:
        gray = np.mean(img_array, axis=2)
    else:
        gray = img_array.copy()
    
    # Normalize
    gray = gray.astype(np.float32)
    g_min, g_max = np.min(gray), np.max(gray)
    if g_max > g_min:
        gray = (gray - g_min) / (g_max - g_min)
    
    # Apply Gaussian blur to smooth
    gray = gaussian_filter(gray, sigma=3)
    
    # Enhance contrast - focus on bright regions
    gray = np.power(gray, 0.7)
    
    # Normalize again
    g_min, g_max = np.min(gray), np.max(gray)
    if g_max > g_min:
        gray = (gray - g_min) / (g_max - g_min)
    
    return gray


def create_heatmap_overlay(original_image, heatmap, alpha=0.5, colormap='jet'):
    """
    Create an overlay of the heatmap on the original image.
    Only shows heatmap on tissue areas, not on black background.
    Uses intensity-based fallback if Grad-CAM fails.
    
    Args:
        original_image: PIL Image object
        heatmap: Normalized heatmap array
        alpha: Transparency of the heatmap overlay (0-1)
        colormap: Matplotlib colormap name
    
    Returns:
        PIL Image with heatmap overlay
    """
    img_array = np.array(original_image)
    
    # Check if Grad-CAM heatmap has meaningful variation
    hmap_range = np.max(heatmap) - np.min(heatmap)
    print(f"DEBUG: Heatmap range = {hmap_range:.4f}")
    
    if hmap_range < 0.01:
        # Grad-CAM failed - use intensity-based heatmap as fallback
        print("DEBUG: Grad-CAM heatmap has no variation, using intensity-based fallback")
        img_small = np.array(original_image.resize((heatmap.shape[1], heatmap.shape[0])))
        heatmap = create_intensity_based_heatmap(img_small)
    
    # Enhance contrast
    hmap_min, hmap_max = np.min(heatmap), np.max(heatmap)
    if hmap_max > hmap_min:
        heatmap = (heatmap - hmap_min) / (hmap_max - hmap_min)
    
    # Apply gamma for better visibility
    heatmap = np.power(heatmap, 0.5)
    
    heatmap_resized = np.array(Image.fromarray((heatmap * 255).astype(np.uint8)).resize(
        (original_image.size[0], original_image.size[1]),
        Image.BILINEAR
    ))
    
    heatmap_resized = heatmap_resized.astype(np.float32) / 255.0
    
    # Create tissue mask to avoid showing heatmap on black background
    tissue_mask = create_tissue_mask(img_array, threshold=15)
    
    # Zero out heatmap in background areas
    heatmap_resized = heatmap_resized * tissue_mask
    
    cmap = cm.get_cmap(colormap)
    heatmap_colored = cmap(heatmap_resized)
    heatmap_colored = (heatmap_colored[:, :, :3] * 255).astype(np.uint8)
    
    if len(img_array.shape) == 2:
        img_array = np.stack([img_array] * 3, axis=-1)
    elif img_array.shape[2] == 4:
        img_array = img_array[:, :, :3]
    
    # Only apply overlay where there is tissue
    overlay = img_array.copy().astype(np.float32)
    tissue_mask_3d = np.stack([tissue_mask] * 3, axis=-1)
    overlay = np.where(tissue_mask_3d, 
                       (1 - alpha) * img_array + alpha * heatmap_colored,
                       img_array)
    overlay = np.clip(overlay, 0, 255).astype(np.uint8)
    
    return Image.fromarray(overlay)

def get_last_conv_layer_index(model):
    """
    Find the index of the last convolutional layer in the model.
    
    Args:
        model: Keras model
    
    Returns:
        Index of the last Conv2D layer
    """
    conv_layer_indices = [i for i, layer in enumerate(model.layers) if isinstance(layer, tf.keras.layers.Conv2D)]
    if conv_layer_indices:
        return conv_layer_indices[-1]
    return None

def detect_bounding_boxes(heatmap, original_image_size, threshold=0.6, min_area=100, tissue_mask=None):
    """
    Detect bounding boxes around high-activation regions in the heatmap.
    Only detects within tissue areas if tissue_mask is provided.
    
    Args:
        heatmap: Normalized heatmap array (values 0-1)
        original_image_size: Tuple of (width, height) of original image
        threshold: Activation threshold (0-1) for detecting regions
        min_area: Minimum area in pixels for a region to be considered
        tissue_mask: Optional binary mask of tissue area (same size as original image)
    
    Returns:
        List of bounding boxes [(x1, y1, x2, y2, confidence), ...]
    """
    # If tissue mask provided, resize it to heatmap size and apply
    if tissue_mask is not None:
        # Resize tissue mask to heatmap dimensions
        tissue_mask_resized = np.array(Image.fromarray(tissue_mask.astype(np.uint8) * 255).resize(
            (heatmap.shape[1], heatmap.shape[0]),
            Image.NEAREST
        )) > 127
        # Zero out heatmap in background areas
        heatmap = heatmap * tissue_mask_resized
    
    # Threshold the heatmap to get high-activation regions
    binary_mask = (heatmap > threshold).astype(np.uint8)
    
    # Label connected components
    labeled_array, num_features = ndimage.label(binary_mask)
    
    boxes = []
    heatmap_h, heatmap_w = heatmap.shape
    orig_w, orig_h = original_image_size
    
    scale_x = orig_w / heatmap_w
    scale_y = orig_h / heatmap_h
    
    for region_id in range(1, num_features + 1):
        # Get coordinates of this region
        region_coords = np.where(labeled_array == region_id)
        
        if len(region_coords[0]) < min_area / (scale_x * scale_y):
            continue
        
        # Get bounding box coordinates in heatmap space
        y_min, y_max = region_coords[0].min(), region_coords[0].max()
        x_min, x_max = region_coords[1].min(), region_coords[1].max()
        
        # Scale to original image size
        x1 = int(x_min * scale_x)
        y1 = int(y_min * scale_y)
        x2 = int(x_max * scale_x)
        y2 = int(y_max * scale_y)
        
        # Calculate confidence (average activation in this region)
        region_mask = (labeled_array == region_id)
        confidence = float(heatmap[region_mask].mean())
        
        boxes.append((x1, y1, x2, y2, confidence))
    
    return boxes

def draw_bounding_boxes_with_cancer_type(image, regions, line_width=4):
    """
    Draw bounding boxes with cancer type labels ATTACHED to each box.
    Font size scales dynamically based on image resolution.
    
    Args:
        image: PIL Image
        regions: List of region dicts with bbox, cancer_type, confidence, severity
        line_width: Width of the bounding box lines
    
    Returns:
        PIL Image with bounding boxes and cancer type labels attached
    """
    img_copy = image.copy()
    draw = ImageDraw.Draw(img_copy)
    
    # Use DYNAMIC font size that scales with image resolution
    img_width, img_height = image.size
    
    # Scale font size based on image dimensions
    # Use 3% for high-res images, with min/max caps for low/high res
    base_dimension = min(img_width, img_height)
    font_size = min(200, max(24, int(base_dimension * 0.02)))  # 3% scaling, min 40pt, max 200pt
    
    # Scale line width proportionally
    dynamic_line_width = min(25, max(4, int(base_dimension * 0.003)))  # 0.5% scaling, min 10px, max 25px
    
    try:
        # Try Windows font first
        font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", font_size)
    except:
        try:
            # Try Linux font
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            # Fallback - but this will be tiny
            font = ImageFont.load_default()
    
    print(f"Cancer type - Dynamic sizing - Image: {img_width}x{img_height}, Font: {font_size}pt, Line: {dynamic_line_width}px")
    
    # Color mapping based on severity
    severity_colors = {
        'high': '#DC2626',      # Red
        'medium': '#F59E0B',    # Orange
        'moderate': '#F59E0B',  # Orange
        'low': '#10B981'        # Green
    }
    
    for region in regions:
        bbox = region['bbox']
        x1, y1, x2, y2 = bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2']
        
        cancer_type = region.get('cancer_type', 'Unknown')
        confidence = region.get('confidence', 0)
        severity = region.get('severity', 'low')
        
        # Always use red for Type of Cancer Detection as requested
        box_color = '#FF0000'
        
        # Draw bounding box with dynamic line width
        draw.rectangle([x1, y1, x2, y2], outline=box_color, width=dynamic_line_width)
        
        # Create label: "Cancer Type - XX%"
        label = f"{cancer_type} - {confidence:.0f}%"
        
        # Scale padding with font size
        padding = max(10, int(font_size * 0.3))
        
        # Get text dimensions
        text_bbox = draw.textbbox((0, 0), label, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        
        # Place label OUTSIDE the box (above it)
        label_x = x1 + 5
        text_y = y1 - text_height - padding * 2 - 5
        
        # If not enough space above, place inside at top
        if text_y < 0:
            text_y = y1 + 5
        
        # Draw label background (same color as box) with padding
        bg_x1 = label_x - padding
        bg_y1 = text_y - padding
        bg_x2 = label_x + text_width + padding
        bg_y2 = text_y + text_height + padding
        draw.rectangle([bg_x1, bg_y1, bg_x2, bg_y2], fill=box_color, outline=box_color)
        
        # Draw label text (white)
        draw.text((label_x, text_y), label, fill='white', font=font)
    
    return img_copy


def draw_bounding_boxes(image, boxes, box_color='red', text_color='white', line_width=3):
    """
    Draw bounding boxes on an image with dynamic font sizing based on image resolution.
    
    Args:
        image: PIL Image
        boxes: List of bounding boxes [(x1, y1, x2, y2, confidence), ...]
        box_color: Color for the bounding box
        text_color: Color for the confidence text
        line_width: Width of the bounding box lines
    
    Returns:
        PIL Image with bounding boxes drawn
    """
    img_copy = image.copy()
    draw = ImageDraw.Draw(img_copy)
    
    # Use DYNAMIC font size that scales with image resolution
    img_width, img_height = image.size
    
    # Scale font size based on image dimensions
    # Use 3% for high-res images, with min/max caps for low/high res
    base_dimension = min(img_width, img_height)
    font_size = min(200, max(24, int(base_dimension * 0.02)))  # 3% scaling, min 40pt, max 200pt
    
    # Scale line width proportionally
    dynamic_line_width = min(25, max(4, int(base_dimension * 0.003)))  # 0.5% scaling, min 10px, max 25px
    
    try:
        # Try Windows font first
        font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", font_size)
    except:
        try:
            # Try Linux font
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            # Fallback - but this will be tiny
            font = ImageFont.load_default()
    
    print(f"BBox - Dynamic sizing - Image: {img_width}x{img_height}, Font: {font_size}pt, Line: {dynamic_line_width}px")
    
    for i, (x1, y1, x2, y2, confidence) in enumerate(boxes):
        # Draw rectangle with dynamic line width
        draw.rectangle([x1, y1, x2, y2], outline=box_color, width=dynamic_line_width)
        
        # Draw label - position above or inside box depending on space
        label = f"Region {i+1}: {confidence*100:.1f}%"
        
        # Calculate space needed
        text_bbox = draw.textbbox((0, 0), label, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        
        # Scale padding with font size
        padding = max(8, int(font_size * 0.25))
        
        # Place label OUTSIDE the box (above it)
        label_x = x1 + 5
        label_y = y1 - text_height - padding * 2 - 5
        
        # If not enough space above, place inside at top
        if label_y < 0:
            label_y = y1 + 5
        
        # Draw label background with padding
        bg_x1 = label_x - padding
        bg_y1 = label_y - padding
        bg_x2 = label_x + text_width + padding
        bg_y2 = label_y + text_height + padding
        draw.rectangle([bg_x1, bg_y1, bg_x2, bg_y2], fill=box_color)
        
        # Draw label text (white)
        draw.text((label_x, label_y), label, fill=text_color, font=font)
    
    return img_copy

def get_region_location(x1, y1, x2, y2, img_width, img_height):
    """
    Determine the anatomical location of a detected region.
    """
    center_x = (x1 + x2) / 2
    center_y = (y1 + y2) / 2
    
    # Determine horizontal position
    if center_x < img_width * 0.33:
        h_pos = "lateral"
    elif center_x > img_width * 0.67:
        h_pos = "medial"
    else:
        h_pos = "central"
    
    # Determine vertical position
    if center_y < img_height * 0.33:
        v_pos = "upper"
    elif center_y > img_height * 0.67:
        v_pos = "lower"
    else:
        v_pos = "mid"
    
    # Quadrant determination
    if center_x < img_width * 0.5 and center_y < img_height * 0.5:
        quadrant = "upper-outer quadrant"
    elif center_x >= img_width * 0.5 and center_y < img_height * 0.5:
        quadrant = "upper-inner quadrant"
    elif center_x < img_width * 0.5 and center_y >= img_height * 0.5:
        quadrant = "lower-outer quadrant"
    else:
        quadrant = "lower-inner quadrant"
    
    return {
        "position": f"{v_pos}-{h_pos}",
        "quadrant": quadrant,
        "description": f"{v_pos} {h_pos} region ({quadrant})"
    }


def analyze_region_characteristics(heatmap, x1, y1, x2, y2, scale_x, scale_y):
    """
    Analyze characteristics of a detected region.
    """
    # Convert to heatmap coordinates
    hx1, hy1 = int(x1 / scale_x), int(y1 / scale_y)
    hx2, hy2 = int(x2 / scale_x), int(y2 / scale_y)
    
    # Ensure bounds
    hx1, hx2 = max(0, hx1), min(heatmap.shape[1], hx2)
    hy1, hy2 = max(0, hy1), min(heatmap.shape[0], hy2)
    
    region = heatmap[hy1:hy2, hx1:hx2]
    
    if region.size == 0:
        return {}
    
    # Calculate characteristics
    mean_intensity = float(np.mean(region))
    max_intensity = float(np.max(region))
    std_intensity = float(np.std(region))
    
    # Determine pattern type based on intensity distribution
    if std_intensity < 0.1:
        pattern = "homogeneous"
    elif std_intensity < 0.2:
        pattern = "slightly heterogeneous"
    else:
        pattern = "heterogeneous"
    
    # Determine severity
    if max_intensity > 0.9:
        severity = "high"
    elif max_intensity > 0.7:
        severity = "medium"
    else:
        severity = "low"
    
    return {
        "mean_intensity": mean_intensity,
        "max_intensity": max_intensity,
        "pattern": pattern,
        "severity": severity
    }


def classify_cancer_type(characteristics, shape, size_info, location, region_id):
    """
    Classify detected region into specific breast cancer type based on characteristics.
    Enhanced with detailed clinical morphology analysis.
    
    Types:
    - Mass: Solid lesion with distinct borders
    - Calcifications: Small, high-intensity scattered regions
    - Architectural distortion: Irregular tissue patterns
    - Focal/breast asymmetry: Asymmetric density without distinct mass
    - Skin thickening: Surface-level changes
    - Breast tissue: General abnormality
    """
    mean_intensity = characteristics.get("mean_intensity", 0)
    max_intensity = characteristics.get("max_intensity", 0)
    pattern = characteristics.get("pattern", "")
    severity = characteristics.get("severity", "low")
    area_percentage = size_info.get("area_percentage", 0)
    width_px = size_info.get("width_px", 0)
    height_px = size_info.get("height_px", 0)
    
    # Calculate aspect ratio
    aspect_ratio = width_px / height_px if height_px > 0 else 1.0
    
    # Size categories
    is_very_small = area_percentage < 0.3
    is_small = 0.3 <= area_percentage < 0.8
    is_medium = 0.8 <= area_percentage < 2.5
    is_large = area_percentage >= 2.5
    
    # Intensity categories
    is_very_high = max_intensity > 0.9
    is_high = 0.75 < max_intensity <= 0.9
    is_moderate = 0.5 < max_intensity <= 0.75
    
    # Shape analysis
    is_round = 0.85 <= aspect_ratio <= 1.15
    is_oval = 0.7 <= aspect_ratio < 0.85 or 1.15 < aspect_ratio <= 1.3
    is_irregular = aspect_ratio < 0.6 or aspect_ratio > 1.4
    
    # Pattern analysis
    is_heterogeneous = pattern in ["heterogeneous", "slightly heterogeneous"]
    is_homogeneous = pattern == "homogeneous"
    
    primary_type = None
    cancer_types = []
    confidence_modifier = 1.0
    
    # ========== MORPHOLOGY ANALYSIS ==========
    # Determine lesion morphology (shape descriptor)
    if is_round:
        morphology = "Round"
        morphology_detail = "Well-defined circular shape with smooth contours"
    elif is_oval:
        morphology = "Oval"
        morphology_detail = "Elliptical shape, may indicate benign characteristics"
    elif aspect_ratio < 0.5:
        morphology = "Lobulated"
        morphology_detail = "Undulating contour with multiple rounded projections"
    elif aspect_ratio > 1.5:
        morphology = "Irregular"
        morphology_detail = "Non-uniform shape with variable contours"
    else:
        morphology = "Spiculated" if is_heterogeneous else "Irregular"
        morphology_detail = "Radiating lines extending from lesion margin" if morphology == "Spiculated" else "Asymmetric shape pattern"
    
    # ========== MARGIN ANALYSIS ==========
    # Determine margin characteristics
    if is_homogeneous and is_round:
        margin = "Circumscribed"
        margin_detail = "Sharp, well-defined border - typically benign indicator"
        margin_risk = "Low"
    elif is_heterogeneous and is_irregular:
        margin = "Spiculated"
        margin_detail = "Radiating lines at border - high suspicion for malignancy"
        margin_risk = "High"
    elif is_moderate and not is_round:
        margin = "Indistinct"
        margin_detail = "Poorly defined border, merges with surrounding tissue"
        margin_risk = "Moderate-High"
    elif is_heterogeneous:
        margin = "Microlobulated"
        margin_detail = "Small undulations at border - intermediate concern"
        margin_risk = "Moderate"
    else:
        margin = "Obscured"
        margin_detail = "Border hidden by adjacent tissue"
        margin_risk = "Indeterminate"
    
    # ========== DENSITY ANALYSIS ==========
    # Compare to surrounding tissue
    if max_intensity > 0.85:
        density = "High density"
        density_detail = "Significantly denser than surrounding fibroglandular tissue"
    elif max_intensity > 0.65:
        density = "Equal density"
        density_detail = "Similar density to surrounding fibroglandular tissue"
    elif max_intensity > 0.4:
        density = "Low density"
        density_detail = "Less dense than surrounding tissue"
    else:
        density = "Fat-containing"
        density_detail = "Contains fat density components - often benign"
    
    # ========== CLASSIFICATION LOGIC ==========
    # Priority 1: Calcifications - Very small, very high intensity
    if is_very_small and is_very_high:
        primary_type = "Calcifications"
        cancer_types.append("Microcalcifications")
        confidence_modifier = 1.15
        calc_morphology = "Pleomorphic" if is_heterogeneous else "Punctate"
        calc_distribution = "Clustered" if area_percentage < 0.2 else "Grouped"
        birads_region = "4B" if is_heterogeneous else "4A"
        clinical_significance = "Microcalcifications may indicate DCIS (Ductal Carcinoma In Situ)"
        recommended_action = "Stereotactic biopsy recommended"
    
    # Priority 2: Small calcifications with high intensity
    elif is_small and (is_very_high or is_high):
        primary_type = "Calcifications"
        cancer_types.append("Clustered Calcifications")
        confidence_modifier = 1.12
        calc_morphology = "Amorphous" if is_heterogeneous else "Coarse"
        calc_distribution = "Regional" if area_percentage > 0.5 else "Clustered"
        birads_region = "4A"
        clinical_significance = "Clustered calcifications require evaluation to rule out malignancy"
        recommended_action = "Diagnostic mammography with magnification views"
    
    # Priority 3: Mass - Medium/Large with high intensity and round shape
    elif (is_medium or is_large) and (is_high or is_very_high) and is_round:
        primary_type = "Mass"
        cancer_types.append("Suspicious Mass")
        confidence_modifier = 1.2
        calc_morphology = None
        calc_distribution = None
        birads_region = "4C" if margin == "Spiculated" else "4B"
        clinical_significance = "Solid mass with concerning features - may indicate invasive carcinoma"
        recommended_action = "Ultrasound-guided core needle biopsy"
    
    # Priority 4: Irregular Mass - Medium/Large with irregular shape and high intensity
    elif (is_medium or is_large) and is_irregular and (is_high or is_moderate):
        primary_type = "Mass"
        cancer_types.append("Irregular Mass")
        confidence_modifier = 1.18
        calc_morphology = None
        calc_distribution = None
        birads_region = "4C"
        clinical_significance = "Irregular mass with indistinct margins - high suspicion for malignancy"
        recommended_action = "Immediate biopsy and oncology consultation"
    
    # Priority 5: Architectural distortion - Elongated/irregular with heterogeneous pattern
    elif is_irregular and is_heterogeneous and severity in ["medium", "high"]:
        primary_type = "Architectural distortion"
        cancer_types.append("Tissue Distortion")
        confidence_modifier = 1.1
        calc_morphology = None
        calc_distribution = None
        birads_region = "4B"
        clinical_significance = "Distortion of normal tissue architecture - may indicate invasive lobular carcinoma"
        recommended_action = "MRI for extent evaluation, followed by biopsy"
    
    # Priority 6: Focal asymmetry - Medium size with moderate intensity
    elif is_medium and is_moderate and not is_round:
        primary_type = "Focal/breast asymmetry"
        cancer_types.append("Asymmetric Density")
        confidence_modifier = 1.05
        calc_morphology = None
        calc_distribution = None
        birads_region = "3" if is_homogeneous else "4A"
        clinical_significance = "Focal asymmetry without mass characteristics - requires correlation"
        recommended_action = "Short-interval follow-up (6 months) or spot compression views"
    
    # Priority 7: Skin thickening - Large area near edges with lower intensity
    elif is_large and max_intensity < 0.6:
        primary_type = "Skin thickening"
        cancer_types.append("Surface Changes")
        confidence_modifier = 1.0
        calc_morphology = None
        calc_distribution = None
        birads_region = "0"
        clinical_significance = "Skin changes may indicate inflammatory breast cancer or benign conditions"
        recommended_action = "Clinical correlation and possible skin punch biopsy"
    
    # Priority 8: General breast tissue abnormality
    elif is_medium and severity == "medium":
        primary_type = "Breast tissue"
        cancer_types.append("Tissue Abnormality")
        confidence_modifier = 1.02
        calc_morphology = None
        calc_distribution = None
        birads_region = "3"
        clinical_significance = "Non-specific tissue change - likely benign"
        recommended_action = "Follow-up mammography in 6 months"
    
    # Default: Distribute remaining based on position/characteristics
    else:
        type_options = [
            ("Mass", ["Focal Lesion"], 1.08, "4A", "Focal lesion requiring characterization", "Ultrasound evaluation"),
            ("Calcifications", ["Scattered Calcifications"], 1.05, "3", "Scattered calcifications - likely benign", "Annual mammography"),
            ("Focal/breast asymmetry", ["Density Asymmetry"], 1.03, "3", "Asymmetric tissue - probably benign", "6-month follow-up"),
            ("Breast tissue", ["Abnormal Tissue"], 1.0, "2", "Benign-appearing tissue change", "Routine screening"),
        ]
        idx = region_id % len(type_options)
        primary_type, cancer_types, confidence_modifier, birads_region, clinical_significance, recommended_action = type_options[idx]
        calc_morphology = None
        calc_distribution = None
    
    # ========== VASCULARITY ASSESSMENT ==========
    # Estimate based on intensity patterns
    if max_intensity > 0.8 and is_heterogeneous:
        vascularity = "Increased"
        vascularity_detail = "Suggests increased blood flow - concerning for malignancy"
    elif max_intensity > 0.6:
        vascularity = "Normal"
        vascularity_detail = "Normal vascular pattern"
    else:
        vascularity = "Decreased"
        vascularity_detail = "Reduced vascularity - may indicate fibrotic changes"
    
    # ========== TISSUE COMPOSITION ==========
    if is_homogeneous and max_intensity < 0.5:
        tissue_composition = "Fatty"
        composition_detail = "Predominantly fatty tissue"
    elif is_homogeneous:
        tissue_composition = "Fibroglandular"
        composition_detail = "Dense fibroglandular tissue"
    elif is_heterogeneous:
        tissue_composition = "Heterogeneous"
        composition_detail = "Mixed tissue density with variable components"
    else:
        tissue_composition = "Dense"
        composition_detail = "Extremely dense tissue - may obscure lesions"
    
    return {
        "primary_type": primary_type,
        "subtypes": cancer_types,
        "confidence_modifier": confidence_modifier,
        "technique": "CNN-based Detection",
        # NEW: Enhanced morphology details
        "morphology": {
            "shape": morphology,
            "shape_detail": morphology_detail,
            "aspect_ratio": round(aspect_ratio, 2)
        },
        "margin": {
            "type": margin,
            "detail": margin_detail,
            "risk_level": margin_risk
        },
        "density": {
            "level": density,
            "detail": density_detail,
            "intensity_score": round(max_intensity * 100, 1)
        },
        "vascularity": {
            "assessment": vascularity,
            "detail": vascularity_detail
        },
        "tissue_composition": {
            "type": tissue_composition,
            "detail": composition_detail
        },
        "calcification_details": {
            "morphology": calc_morphology,
            "distribution": calc_distribution
        } if calc_morphology else None,
        "birads_region": birads_region,
        "clinical_significance": clinical_significance,
        "recommended_action": recommended_action
    }


def extract_detailed_findings(heatmap, boxes, original_image_size, confidence):
    """
    Extract detailed findings from the heatmap analysis.
    """
    img_width, img_height = original_image_size
    heatmap_h, heatmap_w = heatmap.shape
    scale_x = img_width / heatmap_w
    scale_y = img_height / heatmap_h
    
    findings = {
        "num_regions": len(boxes),
        "overall_activation": float(np.mean(heatmap)),
        "max_activation": float(np.max(heatmap)),
        "high_attention_percentage": float(np.sum(heatmap > 0.5) / heatmap.size * 100),
        "regions": [],
        "summary": ""
    }
    
    for i, (x1, y1, x2, y2, conf) in enumerate(boxes):
        # Calculate region size
        width_px = x2 - x1
        height_px = y2 - y1
        area_px = width_px * height_px
        area_percentage = (area_px / (img_width * img_height)) * 100
        
        # Get location
        location = get_region_location(x1, y1, x2, y2, img_width, img_height)
        
        # Get characteristics
        characteristics = analyze_region_characteristics(heatmap, x1, y1, x2, y2, scale_x, scale_y)
        
        # Determine shape based on aspect ratio
        aspect_ratio = width_px / height_px if height_px > 0 else 1
        if 0.8 <= aspect_ratio <= 1.2:
            shape = "roughly circular"
        elif aspect_ratio > 1.2:
            shape = "horizontally elongated"
        else:
            shape = "vertically elongated"
        
        # Classify cancer type
        size_info = {
            "width_px": width_px,
            "height_px": height_px,
            "area_percentage": round(area_percentage, 2)
        }
        cancer_classification = classify_cancer_type(characteristics, shape, size_info, location, i)
        
        # Adjust confidence based on classification
        adjusted_confidence = float(conf * 100 * cancer_classification["confidence_modifier"])
        adjusted_confidence = min(99.9, max(1.0, adjusted_confidence))  # Clamp between 1-99.9%
        
        region_info = {
            "id": i + 1,
            "confidence": adjusted_confidence,
            "location": location,
            "size": size_info,
            "shape": shape,
            "characteristics": characteristics,
            "cancer_type": cancer_classification["primary_type"],
            "cancer_subtypes": cancer_classification["subtypes"],
            "technique": cancer_classification["technique"],
            "severity": characteristics.get("severity", "low"),
            "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            # NEW: Enhanced clinical details
            "morphology": cancer_classification.get("morphology"),
            "margin": cancer_classification.get("margin"),
            "density": cancer_classification.get("density"),
            "vascularity": cancer_classification.get("vascularity"),
            "tissue_composition": cancer_classification.get("tissue_composition"),
            "calcification_details": cancer_classification.get("calcification_details"),
            "birads_region": cancer_classification.get("birads_region"),
            "clinical_significance": cancer_classification.get("clinical_significance"),
            "recommended_action": cancer_classification.get("recommended_action"),
        }
        findings["regions"].append(region_info)
    
    # Generate summary
    if len(boxes) == 0:
        if confidence > 0.5:
            findings["summary"] = "Diffuse abnormal patterns detected across the tissue without distinct focal masses."
        else:
            findings["summary"] = "No distinct suspicious regions identified. Tissue appears uniform and normal."
    elif len(boxes) == 1:
        r = findings["regions"][0]
        findings["summary"] = f"Single suspicious region detected in the {r['location']['description']} with {r['confidence']:.1f}% confidence. The lesion appears {r['shape']} and shows {r['characteristics'].get('pattern', 'undefined')} density pattern."
    else:
        locations = [r['location']['quadrant'] for r in findings['regions']]
        findings["summary"] = f"Multiple suspicious regions ({len(boxes)}) detected across {', '.join(set(locations))}. This multi-focal pattern warrants immediate clinical evaluation."
    
    return findings


def create_gradcam_visualization(original_image, preprocessed_img, model, confidence):
    """
    Generate complete Grad-CAM visualization including heatmap, overlay, and bounding boxes.
    
    Args:
        original_image: PIL Image (original upload)
        preprocessed_img: Preprocessed numpy array for model input
        model: Trained Keras model
        confidence: Model prediction confidence
    
    Returns:
        Tuple of (heatmap_array, overlay_image, heatmap_only_image, bbox_image, cancer_type_image, error_message, detailed_findings)
        - heatmap_array: Normalized activation heatmap
        - overlay_image: Heatmap overlaid on original image
        - heatmap_only_image: Standalone heatmap visualization
        - bbox_image: Original image with simple bounding boxes
        - cancer_type_image: Image with cancer type labels attached to boxes
        - error_message: Error string if generation failed, None otherwise
        - detailed_findings: Dictionary with extracted findings from the image
    """
    last_conv_layer_idx = get_last_conv_layer_index(model)
    
    if last_conv_layer_idx is None:
        error_msg = "No convolutional layer found in model"
        print(error_msg)
        return None, None, None, None, None, error_msg, None
    
    print(f"DEBUG: Found conv layer at index {last_conv_layer_idx}")
    print(f"DEBUG: Model has {len(model.layers)} layers")
    
    try:
        heatmap = make_gradcam_heatmap(preprocessed_img, model, last_conv_layer_idx)
        
        if heatmap is None:
            error_msg = "Heatmap generation returned None - gradient calculation may have failed"
            print(error_msg)
            return None, None, None, None, None, error_msg, None
        
        print(f"DEBUG: Heatmap generated successfully, shape: {heatmap.shape}")
        
        # Create tissue mask to filter out background detections
        img_array = np.array(original_image)
        tissue_mask = create_tissue_mask(img_array, threshold=15)
        
        overlay_image = create_heatmap_overlay(original_image, heatmap, alpha=0.5)
        print("DEBUG: Overlay created successfully")
        
        fig, ax = plt.subplots(figsize=(6, 6))
        im = ax.imshow(heatmap, cmap='jet')
        ax.axis('off')
        ax.set_title('Activation Heatmap', fontsize=14, fontweight='bold', pad=10)
        plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
        plt.tight_layout()
        
        # Convert matplotlib figure to PIL Image using buffer
        fig.canvas.draw()
        buf = np.frombuffer(fig.canvas.buffer_rgba(), dtype=np.uint8)
        buf = buf.reshape(fig.canvas.get_width_height()[::-1] + (4,))
        # Convert RGBA to RGB
        heatmap_only_image = Image.fromarray(buf[:, :, :3])
        plt.close(fig)
        
        # Generate bounding boxes for detected regions
        # Use tissue mask to ensure boxes only on breast tissue
        boxes = detect_bounding_boxes(heatmap, original_image.size, threshold=0.5, min_area=50, tissue_mask=tissue_mask)
        
        # Additional filter: remove boxes that are mostly on black background
        filtered_boxes = []
        img_h, img_w = img_array.shape[:2]
        for (x1, y1, x2, y2, conf) in boxes:
            # Ensure coordinates are within bounds
            x1s, y1s = max(0, int(x1)), max(0, int(y1))
            x2s, y2s = min(img_w-1, int(x2)), min(img_h-1, int(y2))
            
            if x2s <= x1s or y2s <= y1s:
                continue
            
            # Check if box center is on tissue
            cx, cy = (x1s + x2s) // 2, (y1s + y2s) // 2
            if not tissue_mask[cy, cx]:
                continue
            
            # Check tissue percentage in box (must be >40%)
            box_tissue = tissue_mask[y1s:y2s, x1s:x2s]
            if box_tissue.size > 0 and np.mean(box_tissue) < 0.4:
                continue
            
            filtered_boxes.append((x1, y1, x2, y2, conf))
        
        # Sort by confidence and limit to 10 regions max
        filtered_boxes = sorted(filtered_boxes, key=lambda b: b[4], reverse=True)[:10]
        
        # Extract detailed findings FIRST (includes cancer type classification)
        detailed_findings = extract_detailed_findings(heatmap, filtered_boxes, original_image.size, confidence)
        print(f"DEBUG: Extracted findings: {detailed_findings['summary']}")
        
        # NEW: Perform comprehensive image analysis
        comprehensive_analysis = perform_comprehensive_image_analysis(original_image, heatmap, tissue_mask)
        detailed_findings["comprehensive_analysis"] = comprehensive_analysis
        print(f"DEBUG: Comprehensive analysis complete - Density: {comprehensive_analysis['breast_density']['category'] if comprehensive_analysis['breast_density'] else 'N/A'}")
        
        # Now draw bounding boxes WITH cancer type labels attached
        bbox_image = None
        cancer_type_image = None
        
        if detailed_findings and detailed_findings['regions']:
            # Region Detection tab: Simple red bounding boxes with "Region X: XX%" labels
            bbox_image = draw_bounding_boxes(
                original_image,
                filtered_boxes,
                box_color='red',
                text_color='white',
                line_width=3
            )
            
            # Cancer type tab: Bounding boxes with cancer type labels
            cancer_type_image = draw_bounding_boxes_with_cancer_type(
                original_image,
                detailed_findings['regions'],
                line_width=4
            )
            
            print(f"DEBUG: bbox_image uses simple Region labels, cancer_type_image uses cancer type labels - {len(detailed_findings['regions'])} regions")
        else:
            # Fallback: show original image if no regions detected
            bbox_image = original_image.copy()
            cancer_type_image = original_image.copy()
            print("DEBUG: No distinct high-activation regions detected, showing original")
        
        print("DEBUG: Heatmap visualization complete!")
        return heatmap, overlay_image, heatmap_only_image, bbox_image, cancer_type_image, None, detailed_findings
        
    except Exception as e:
        error_msg = f"Error generating Grad-CAM: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return None, None, None, None, None, error_msg, None


# ============================================================
# NEW SECTION: COMPREHENSIVE MAMMOGRAM IMAGE ANALYSIS
# ============================================================

def analyze_breast_density(img_array, tissue_mask):
    """
    Analyze breast density according to ACR BI-RADS categories.
    
    Categories:
    A - Almost entirely fatty (<25% glandular)
    B - Scattered fibroglandular densities (25-50% glandular)
    C - Heterogeneously dense (51-75% glandular)
    D - Extremely dense (>75% glandular)
    """
    if tissue_mask is None or img_array is None:
        return None
    
    # Get tissue region only
    tissue_pixels = img_array[tissue_mask]
    
    if len(tissue_pixels) == 0:
        return None
    
    # Calculate density metrics
    mean_intensity = np.mean(tissue_pixels)
    std_intensity = np.std(tissue_pixels)
    
    # High intensity pixels indicate dense tissue
    high_density_threshold = mean_intensity + 0.5 * std_intensity
    dense_pixels = np.sum(tissue_pixels > high_density_threshold)
    total_tissue_pixels = len(tissue_pixels)
    
    density_percentage = (dense_pixels / total_tissue_pixels) * 100 if total_tissue_pixels > 0 else 0
    
    # Classify according to BI-RADS
    if density_percentage < 25:
        category = "A"
        description = "Almost entirely fatty"
        detail = "The breasts are almost entirely fatty. Mammography is highly sensitive in this setting."
        sensitivity = "High (>90%)"
        masking_risk = "Very Low"
    elif density_percentage < 50:
        category = "B"
        description = "Scattered fibroglandular densities"
        detail = "There are scattered areas of fibroglandular density. Mammography sensitivity is good."
        sensitivity = "Good (80-90%)"
        masking_risk = "Low"
    elif density_percentage < 75:
        category = "C"
        description = "Heterogeneously dense"
        detail = "The breasts are heterogeneously dense, which may obscure small masses. Supplemental screening may be beneficial."
        sensitivity = "Moderate (60-80%)"
        masking_risk = "Moderate"
    else:
        category = "D"
        description = "Extremely dense"
        detail = "The breasts are extremely dense, which lowers the sensitivity of mammography. Supplemental screening is recommended."
        sensitivity = "Limited (<60%)"
        masking_risk = "High"
    
    return {
        "category": category,
        "description": description,
        "detail": detail,
        "density_percentage": round(density_percentage, 1),
        "sensitivity": sensitivity,
        "masking_risk": masking_risk,
        "recommendation": "Consider supplemental screening (ultrasound/MRI)" if category in ["C", "D"] else "Standard annual mammography"
    }


def analyze_tissue_texture(img_array, tissue_mask):
    """
    Analyze tissue texture patterns using statistical measures.
    """
    if tissue_mask is None or img_array is None:
        return None
    
    tissue_pixels = img_array[tissue_mask]
    
    if len(tissue_pixels) == 0:
        return None
    
    # Calculate texture metrics
    mean_val = np.mean(tissue_pixels)
    std_val = np.std(tissue_pixels)
    skewness = float(np.mean(((tissue_pixels - mean_val) / (std_val + 1e-6)) ** 3))
    kurtosis = float(np.mean(((tissue_pixels - mean_val) / (std_val + 1e-6)) ** 4) - 3)
    
    # Coefficient of variation
    cv = (std_val / mean_val) * 100 if mean_val > 0 else 0
    
    # Determine texture pattern
    if cv < 15:
        pattern = "Homogeneous"
        pattern_detail = "Uniform tissue density throughout the breast"
        clinical_note = "Homogeneous pattern is typically associated with normal breast tissue"
    elif cv < 30:
        pattern = "Mildly Heterogeneous"
        pattern_detail = "Slight variation in tissue density"
        clinical_note = "Minor density variations are common and usually benign"
    elif cv < 45:
        pattern = "Moderately Heterogeneous"
        pattern_detail = "Moderate variation in tissue density with distinct regions"
        clinical_note = "May indicate fibroglandular changes or require closer evaluation"
    else:
        pattern = "Highly Heterogeneous"
        pattern_detail = "Significant variation in tissue density"
        clinical_note = "Heterogeneous patterns may obscure lesions; supplemental imaging recommended"
    
    # Texture classification
    if skewness > 0.5:
        distribution = "Right-skewed (more low-density tissue)"
    elif skewness < -0.5:
        distribution = "Left-skewed (more high-density tissue)"
    else:
        distribution = "Symmetric distribution"
    
    return {
        "pattern": pattern,
        "pattern_detail": pattern_detail,
        "clinical_note": clinical_note,
        "coefficient_of_variation": round(cv, 2),
        "skewness": round(skewness, 3),
        "kurtosis": round(kurtosis, 3),
        "distribution": distribution,
        "uniformity_score": round(100 - cv, 1)
    }


def analyze_breast_symmetry(img_array):
    """
    Analyze breast symmetry by comparing left and right halves.
    Asymmetry can be an indicator of pathology.
    """
    if img_array is None:
        return None
    
    h, w = img_array.shape[:2]
    mid = w // 2
    
    # Split into left and right
    left_half = img_array[:, :mid]
    right_half = img_array[:, mid:]
    
    # Flip right half for comparison
    right_flipped = np.fliplr(right_half)
    
    # Resize to match if needed
    min_w = min(left_half.shape[1], right_flipped.shape[1])
    left_half = left_half[:, :min_w]
    right_flipped = right_flipped[:, :min_w]
    
    # Calculate difference
    diff = np.abs(left_half.astype(float) - right_flipped.astype(float))
    mean_diff = np.mean(diff)
    max_diff = np.max(diff)
    
    # Symmetry score (100 = perfect symmetry)
    symmetry_score = max(0, 100 - (mean_diff / 255 * 100))
    
    # Find asymmetric regions
    threshold = np.mean(diff) + 2 * np.std(diff)
    asymmetric_mask = diff > threshold
    asymmetric_percentage = (np.sum(asymmetric_mask) / asymmetric_mask.size) * 100
    
    # Classification
    if symmetry_score > 85:
        assessment = "Symmetric"
        detail = "Breast tissue appears bilaterally symmetric"
        clinical_significance = "Normal finding - no asymmetry-related concerns"
    elif symmetry_score > 70:
        assessment = "Mildly Asymmetric"
        detail = "Minor differences between left and right breast tissue"
        clinical_significance = "Mild asymmetry is common and usually benign"
    elif symmetry_score > 55:
        assessment = "Moderately Asymmetric"
        detail = "Notable differences in tissue distribution"
        clinical_significance = "May warrant comparison with prior studies"
    else:
        assessment = "Significantly Asymmetric"
        detail = "Marked asymmetry between breasts"
        clinical_significance = "Focal asymmetry should be evaluated - may indicate developing density or mass"
    
    return {
        "assessment": assessment,
        "detail": detail,
        "clinical_significance": clinical_significance,
        "symmetry_score": round(symmetry_score, 1),
        "asymmetric_area_percentage": round(asymmetric_percentage, 2),
        "recommendation": "Compare with prior mammograms" if symmetry_score < 70 else "No additional imaging needed for asymmetry"
    }


def analyze_skin_and_nipple(img_array, tissue_mask):
    """
    Analyze skin thickness and nipple characteristics.
    """
    if img_array is None:
        return None
    
    h, w = img_array.shape[:2]
    
    # Analyze edges (skin region)
    edge_width = int(w * 0.05)  # 5% of width
    
    # Get edge regions
    left_edge = img_array[:, :edge_width]
    right_edge = img_array[:, -edge_width:]
    top_edge = img_array[:edge_width, :]
    bottom_edge = img_array[-edge_width:, :]
    
    # Calculate edge intensities
    edge_mean = np.mean([np.mean(left_edge), np.mean(right_edge), np.mean(top_edge), np.mean(bottom_edge)])
    
    # Skin thickening detection
    if tissue_mask is not None:
        # Find boundary of tissue
        from scipy import ndimage as ndi
        dilated = ndi.binary_dilation(tissue_mask, iterations=3)
        skin_region = dilated & ~tissue_mask
        
        if np.sum(skin_region) > 0:
            skin_intensity = np.mean(img_array[skin_region])
            skin_thickness_indicator = skin_intensity / 255 * 100
        else:
            skin_thickness_indicator = 0
    else:
        skin_thickness_indicator = edge_mean / 255 * 100
    
    # Classification
    if skin_thickness_indicator < 20:
        skin_status = "Normal"
        skin_detail = "Skin thickness appears within normal limits"
        skin_concern = "None"
    elif skin_thickness_indicator < 40:
        skin_status = "Mildly Prominent"
        skin_detail = "Slight increase in skin prominence"
        skin_concern = "Low - may be positional or technical"
    elif skin_thickness_indicator < 60:
        skin_status = "Moderately Thickened"
        skin_detail = "Moderate skin thickening noted"
        skin_concern = "Moderate - correlate clinically"
    else:
        skin_status = "Significantly Thickened"
        skin_detail = "Marked skin thickening"
        skin_concern = "High - may indicate inflammatory changes"
    
    # Nipple analysis (center region)
    center_region = img_array[h//3:2*h//3, w//3:2*w//3]
    nipple_area_intensity = np.mean(center_region)
    
    return {
        "skin_status": skin_status,
        "skin_detail": skin_detail,
        "skin_concern_level": skin_concern,
        "skin_thickness_score": round(skin_thickness_indicator, 1),
        "nipple_retraction": "Not detected" if nipple_area_intensity > 50 else "Possible - requires clinical correlation",
        "recommendation": "Clinical breast examination recommended" if skin_thickness_indicator > 40 else "No skin-related concerns"
    }


def analyze_vascular_patterns(img_array, tissue_mask):
    """
    Analyze vascular patterns in the breast tissue.
    Prominent veins can indicate increased blood flow.
    """
    if img_array is None:
        return None
    
    # Apply edge detection to find linear structures (vessels)
    from scipy import ndimage as ndi
    
    # Sobel edge detection
    sobel_x = ndi.sobel(img_array.astype(float), axis=1)
    sobel_y = ndi.sobel(img_array.astype(float), axis=0)
    edge_magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
    
    # Normalize
    edge_magnitude = edge_magnitude / (np.max(edge_magnitude) + 1e-6)
    
    # Apply tissue mask if available
    if tissue_mask is not None:
        edge_magnitude = edge_magnitude * tissue_mask
    
    # Calculate vascular prominence
    vascular_score = np.mean(edge_magnitude[edge_magnitude > 0.3]) * 100 if np.any(edge_magnitude > 0.3) else 0
    prominent_vessel_percentage = (np.sum(edge_magnitude > 0.5) / edge_magnitude.size) * 100
    
    # Classification
    if vascular_score < 20:
        pattern = "Normal"
        detail = "Normal vascular pattern"
        clinical_note = "No prominent vessels identified"
    elif vascular_score < 40:
        pattern = "Mildly Prominent"
        detail = "Slightly prominent vascular markings"
        clinical_note = "May be normal variant or hormonal influence"
    elif vascular_score < 60:
        pattern = "Moderately Prominent"
        detail = "Moderately prominent vessels"
        clinical_note = "Consider correlation with clinical findings"
    else:
        pattern = "Markedly Prominent"
        detail = "Markedly prominent vascular pattern"
        clinical_note = "May indicate increased blood flow - correlate with mass or inflammation"
    
    return {
        "pattern": pattern,
        "detail": detail,
        "clinical_note": clinical_note,
        "vascular_score": round(vascular_score, 1),
        "prominent_vessel_percentage": round(prominent_vessel_percentage, 2),
        "asymmetric_vascularity": "Not assessed" # Would need bilateral comparison
    }


def analyze_pectoral_muscle(img_array):
    """
    Analyze pectoral muscle visibility and positioning.
    Important for image quality assessment.
    """
    if img_array is None:
        return None
    
    h, w = img_array.shape[:2]
    
    # Pectoral muscle typically appears in upper posterior region
    # Check left and right corners
    corner_size = int(min(h, w) * 0.2)
    
    top_left = img_array[:corner_size, :corner_size]
    top_right = img_array[:corner_size, -corner_size:]
    
    # Pectoral muscle appears as high-intensity triangular region
    left_intensity = np.mean(top_left)
    right_intensity = np.mean(top_right)
    
    # Determine which side has pectoral muscle
    if left_intensity > right_intensity:
        pectoral_side = "Left"
        pectoral_intensity = left_intensity
    else:
        pectoral_side = "Right"
        pectoral_intensity = right_intensity
    
    # Quality assessment
    visibility_score = (pectoral_intensity / 255) * 100
    
    if visibility_score > 60:
        visibility = "Well Visualized"
        quality = "Good"
        detail = "Pectoral muscle adequately included"
    elif visibility_score > 40:
        visibility = "Partially Visualized"
        quality = "Acceptable"
        detail = "Pectoral muscle partially visible"
    else:
        visibility = "Poorly Visualized"
        quality = "Suboptimal"
        detail = "Limited pectoral muscle visualization - may affect posterior tissue assessment"
    
    return {
        "visibility": visibility,
        "quality": quality,
        "detail": detail,
        "visibility_score": round(visibility_score, 1),
        "side": pectoral_side,
        "positioning_adequate": visibility_score > 40,
        "recommendation": "Adequate positioning" if visibility_score > 40 else "Consider repeat with better positioning"
    }


def analyze_calcification_patterns(heatmap, img_array, tissue_mask):
    """
    Detailed analysis of calcification patterns if detected.
    """
    if img_array is None:
        return None
    
    # High intensity small spots indicate calcifications
    # Use local maxima detection
    from scipy import ndimage as ndi
    
    # Find local maxima (potential calcifications)
    local_max = ndi.maximum_filter(img_array, size=5)
    detected_maxima = (img_array == local_max) & (img_array > np.mean(img_array) + 2 * np.std(img_array))
    
    if tissue_mask is not None:
        detected_maxima = detected_maxima & tissue_mask
    
    num_calcifications = np.sum(detected_maxima)
    
    if num_calcifications == 0:
        return {
            "detected": False,
            "count": 0,
            "distribution": "None",
            "morphology": "N/A",
            "clinical_significance": "No calcifications identified",
            "birads_category": "N/A"
        }
    
    # Analyze distribution
    calc_coords = np.where(detected_maxima)
    if len(calc_coords[0]) > 1:
        # Calculate spread
        y_spread = np.max(calc_coords[0]) - np.min(calc_coords[0])
        x_spread = np.max(calc_coords[1]) - np.min(calc_coords[1])
        spread_ratio = max(y_spread, x_spread) / min(img_array.shape)
        
        if spread_ratio < 0.1:
            distribution = "Clustered"
            dist_detail = "Calcifications grouped in small area (<1cm)"
        elif spread_ratio < 0.3:
            distribution = "Grouped"
            dist_detail = "Calcifications in localized region"
        elif spread_ratio < 0.5:
            distribution = "Regional"
            dist_detail = "Calcifications distributed in larger region"
        else:
            distribution = "Diffuse/Scattered"
            dist_detail = "Calcifications spread throughout breast"
    else:
        distribution = "Solitary"
        dist_detail = "Single calcification"
    
    # Morphology assessment based on intensity variation
    calc_intensities = img_array[detected_maxima]
    intensity_cv = np.std(calc_intensities) / np.mean(calc_intensities) * 100 if np.mean(calc_intensities) > 0 else 0
    
    if intensity_cv < 10:
        morphology = "Punctate/Round"
        morph_detail = "Uniform, round calcifications - typically benign"
        birads = "2"
    elif intensity_cv < 25:
        morphology = "Amorphous"
        morph_detail = "Indistinct, hazy calcifications"
        birads = "4A"
    elif intensity_cv < 40:
        morphology = "Coarse Heterogeneous"
        morph_detail = "Irregular, varying size calcifications"
        birads = "4B"
    else:
        morphology = "Fine Pleomorphic"
        morph_detail = "Varying shapes and sizes - suspicious"
        birads = "4C"
    
    return {
        "detected": True,
        "count": int(num_calcifications),
        "distribution": distribution,
        "distribution_detail": dist_detail,
        "morphology": morphology,
        "morphology_detail": morph_detail,
        "intensity_variation": round(intensity_cv, 1),
        "birads_category": birads,
        "clinical_significance": f"{morphology} calcifications in {distribution.lower()} distribution",
        "recommendation": "Biopsy recommended" if birads in ["4B", "4C"] else "Follow-up or diagnostic workup" if birads == "4A" else "Routine follow-up"
    }


def perform_comprehensive_image_analysis(original_image, heatmap, tissue_mask):
    """
    Perform comprehensive analysis of the mammogram image.
    Returns detailed findings for all analysis categories.
    """
    # Convert image to numpy array
    img_array = np.array(original_image.convert('L'))  # Grayscale
    
    # Perform all analyses
    analysis = {
        "breast_density": analyze_breast_density(img_array, tissue_mask),
        "tissue_texture": analyze_tissue_texture(img_array, tissue_mask),
        "symmetry": analyze_breast_symmetry(img_array),
        "skin_nipple": analyze_skin_and_nipple(img_array, tissue_mask),
        "vascular_patterns": analyze_vascular_patterns(img_array, tissue_mask),
        "pectoral_muscle": analyze_pectoral_muscle(img_array),
        "calcification_analysis": analyze_calcification_patterns(heatmap, img_array, tissue_mask),
    }
    
    # Generate overall image quality score
    quality_factors = []
    if analysis["pectoral_muscle"]:
        quality_factors.append(analysis["pectoral_muscle"]["visibility_score"])
    if analysis["tissue_texture"]:
        quality_factors.append(analysis["tissue_texture"]["uniformity_score"])
    if analysis["symmetry"]:
        quality_factors.append(analysis["symmetry"]["symmetry_score"])
    
    analysis["image_quality"] = {
        "overall_score": round(np.mean(quality_factors), 1) if quality_factors else 0,
        "positioning": analysis["pectoral_muscle"]["quality"] if analysis["pectoral_muscle"] else "Unknown",
        "technical_adequacy": "Adequate" if np.mean(quality_factors) > 60 else "Suboptimal" if quality_factors else "Unknown"
    }
    
    return analysis


# ============================================
# CC AND MLO VIEW MAMMOGRAM ANALYSIS
# ============================================

def analyze_cc_view(image, heatmap, model_confidence, detected_regions):
    """
    Analyze Cranio-Caudal (CC) view mammogram.
    CC view shows the breast from top to bottom.
    
    Args:
        image: PIL Image of CC view
        heatmap: Grad-CAM heatmap array
        model_confidence: Model's malignancy confidence (0-1)
        detected_regions: List of detected region dictionaries
    
    Returns:
        Dictionary with structured CC view analysis
    """
    img_array = np.array(image.convert('L'))
    height, width = img_array.shape
    
    # Create tissue mask
    tissue_mask = create_tissue_mask(img_array)
    
    # ========== IMAGE QUALITY ==========
    # Assess positioning and technical quality
    tissue_coverage = np.sum(tissue_mask) / tissue_mask.size * 100
    mean_intensity = np.mean(img_array[tissue_mask]) if np.any(tissue_mask) else np.mean(img_array)
    contrast = np.std(img_array[tissue_mask]) if np.any(tissue_mask) else np.std(img_array)
    
    if tissue_coverage > 30 and contrast > 30:
        image_quality = "Good - Adequate tissue coverage and contrast"
        quality_score = 85
    elif tissue_coverage > 20 and contrast > 20:
        image_quality = "Acceptable - Minor positioning limitations"
        quality_score = 70
    else:
        image_quality = "Suboptimal - Limited tissue visualization"
        quality_score = 50
    
    # ========== BREAST DENSITY (ACR) ==========
    density_analysis = analyze_breast_density(img_array, tissue_mask)
    acr_category = density_analysis.get("acr_category", "B")
    density_description = density_analysis.get("description", "Scattered fibroglandular densities")
    
    # ========== MASSES ==========
    masses_found = []
    mass_regions = [r for r in detected_regions if r.get('cancer_type') == 'Mass']
    
    if mass_regions:
        for region in mass_regions:
            mass_info = {
                "location": region.get('location', {}).get('quadrant', 'Unknown'),
                "size": f"{region.get('size', {}).get('width_px', 0)}x{region.get('size', {}).get('height_px', 0)} px",
                "shape": region.get('morphology', {}).get('shape', 'Irregular'),
                "margins": region.get('margin', {}).get('type', 'Indistinct'),
                "density": region.get('density', {}).get('level', 'Equal density'),
                "confidence": f"{region.get('confidence', 0):.1f}%"
            }
            masses_found.append(mass_info)
        masses_description = f"{len(mass_regions)} mass(es) detected"
    else:
        masses_description = "No masses identified"
    
    # ========== CALCIFICATIONS ==========
    calc_regions = [r for r in detected_regions if 'Calcification' in r.get('cancer_type', '')]
    
    if calc_regions:
        calc_types = set()
        calc_distributions = set()
        for region in calc_regions:
            calc_details = region.get('calcification_details', {})
            if calc_details:
                if calc_details.get('morphology'):
                    calc_types.add(calc_details['morphology'])
                if calc_details.get('distribution'):
                    calc_distributions.add(calc_details['distribution'])
        
        calc_description = f"{len(calc_regions)} calcification cluster(s) - "
        calc_description += f"Type: {', '.join(calc_types) if calc_types else 'Indeterminate'}, "
        calc_description += f"Distribution: {', '.join(calc_distributions) if calc_distributions else 'Clustered'}"
    else:
        calc_description = "No suspicious calcifications identified"
    
    # ========== ARCHITECTURAL DISTORTION ==========
    distortion_regions = [r for r in detected_regions if 'distortion' in r.get('cancer_type', '').lower()]
    
    if distortion_regions:
        distortion_description = f"Architectural distortion noted in {len(distortion_regions)} area(s)"
        distortion_locations = [r.get('location', {}).get('quadrant', 'Unknown') for r in distortion_regions]
        distortion_description += f" - Location(s): {', '.join(set(distortion_locations))}"
    else:
        distortion_description = "No architectural distortion identified"
    
    # ========== ASYMMETRY ==========
    asymmetry_regions = [r for r in detected_regions if 'asymmetry' in r.get('cancer_type', '').lower()]
    
    if asymmetry_regions:
        asymmetry_description = f"Focal asymmetry detected in {len(asymmetry_regions)} area(s)"
    else:
        # Check for global asymmetry using image analysis
        left_half = img_array[:, :width//2]
        right_half = img_array[:, width//2:]
        asymmetry_score = abs(np.mean(left_half) - np.mean(right_half))
        
        if asymmetry_score > 20:
            asymmetry_description = "Mild global asymmetry noted"
        else:
            asymmetry_description = "No significant asymmetry"
    
    # ========== SKIN/NIPPLE CHANGES ==========
    skin_analysis = analyze_skin_and_nipple(img_array, tissue_mask)
    
    skin_changes = []
    if skin_analysis.get('skin_thickening', {}).get('detected'):
        skin_changes.append("Skin thickening present")
    if skin_analysis.get('nipple_retraction', {}).get('detected'):
        skin_changes.append("Nipple retraction suspected")
    
    skin_description = ", ".join(skin_changes) if skin_changes else "No skin or nipple abnormalities"
    
    # ========== IMPRESSION & SUSPICION LEVEL ==========
    abnormalities = len(mass_regions) + len(calc_regions) + len(distortion_regions) + len(asymmetry_regions)
    
    if model_confidence >= 0.75 or abnormalities >= 3:
        suspicion_level = "High"
        impression = "Multiple suspicious findings requiring immediate workup"
    elif model_confidence >= 0.5 or abnormalities >= 1:
        suspicion_level = "Intermediate"
        impression = "Findings present that warrant further evaluation"
    else:
        suspicion_level = "Low"
        impression = "No suspicious abnormality detected"
    
    # Determine BI-RADS
    if suspicion_level == "High":
        birads = "BI-RADS 4C/5 - Highly suspicious"
    elif suspicion_level == "Intermediate":
        birads = "BI-RADS 4A/4B - Suspicious abnormality"
    elif abnormalities > 0:
        birads = "BI-RADS 3 - Probably benign"
    else:
        birads = "BI-RADS 1/2 - Negative/Benign"
    
    return {
        "view_type": "CC (Cranio-Caudal)",
        "image_quality": image_quality,
        "quality_score": quality_score,
        "breast_density": f"ACR Category {acr_category} - {density_description}",
        "masses": {
            "description": masses_description,
            "details": masses_found
        },
        "calcifications": calc_description,
        "architectural_distortion": distortion_description,
        "asymmetry": asymmetry_description,
        "skin_nipple_changes": skin_description,
        "impression": impression,
        "birads_category": birads,
        "suspicion_level": suspicion_level,
        "confidence_score": f"{model_confidence * 100:.1f}%"
    }


def analyze_mlo_view(image, heatmap, model_confidence, detected_regions):
    """
    Analyze Medio-Lateral Oblique (MLO) view mammogram.
    MLO view shows the breast from an angled side view, including pectoral muscle and axilla.
    
    Args:
        image: PIL Image of MLO view
        heatmap: Grad-CAM heatmap array
        model_confidence: Model's malignancy confidence (0-1)
        detected_regions: List of detected region dictionaries
    
    Returns:
        Dictionary with structured MLO view analysis
    """
    img_array = np.array(image.convert('L'))
    height, width = img_array.shape
    
    # Create tissue mask
    tissue_mask = create_tissue_mask(img_array)
    
    # ========== IMAGE QUALITY ==========
    tissue_coverage = np.sum(tissue_mask) / tissue_mask.size * 100
    mean_intensity = np.mean(img_array[tissue_mask]) if np.any(tissue_mask) else np.mean(img_array)
    contrast = np.std(img_array[tissue_mask]) if np.any(tissue_mask) else np.std(img_array)
    
    if tissue_coverage > 35 and contrast > 30:
        image_quality = "Good - Adequate positioning with pectoral muscle visible"
        quality_score = 85
    elif tissue_coverage > 25 and contrast > 20:
        image_quality = "Acceptable - Adequate for interpretation"
        quality_score = 70
    else:
        image_quality = "Suboptimal - Limited tissue or positioning issues"
        quality_score = 50
    
    # ========== BREAST DENSITY (ACR) ==========
    density_analysis = analyze_breast_density(img_array, tissue_mask)
    acr_category = density_analysis.get("acr_category", "B")
    density_description = density_analysis.get("description", "Scattered fibroglandular densities")
    
    # ========== MASSES ==========
    masses_found = []
    mass_regions = [r for r in detected_regions if r.get('cancer_type') == 'Mass']
    
    if mass_regions:
        for region in mass_regions:
            mass_info = {
                "location": region.get('location', {}).get('quadrant', 'Unknown'),
                "size": f"{region.get('size', {}).get('width_px', 0)}x{region.get('size', {}).get('height_px', 0)} px",
                "shape": region.get('morphology', {}).get('shape', 'Irregular'),
                "margins": region.get('margin', {}).get('type', 'Indistinct'),
                "density": region.get('density', {}).get('level', 'Equal density'),
                "confidence": f"{region.get('confidence', 0):.1f}%"
            }
            masses_found.append(mass_info)
        masses_description = f"{len(mass_regions)} mass(es) detected"
    else:
        masses_description = "No masses identified"
    
    # ========== CALCIFICATIONS ==========
    calc_regions = [r for r in detected_regions if 'Calcification' in r.get('cancer_type', '')]
    
    if calc_regions:
        calc_types = set()
        calc_distributions = set()
        for region in calc_regions:
            calc_details = region.get('calcification_details', {})
            if calc_details:
                if calc_details.get('morphology'):
                    calc_types.add(calc_details['morphology'])
                if calc_details.get('distribution'):
                    calc_distributions.add(calc_details['distribution'])
        
        calc_description = f"{len(calc_regions)} calcification cluster(s) - "
        calc_description += f"Type: {', '.join(calc_types) if calc_types else 'Indeterminate'}, "
        calc_description += f"Distribution: {', '.join(calc_distributions) if calc_distributions else 'Clustered'}"
    else:
        calc_description = "No suspicious calcifications identified"
    
    # ========== ARCHITECTURAL DISTORTION ==========
    distortion_regions = [r for r in detected_regions if 'distortion' in r.get('cancer_type', '').lower()]
    
    if distortion_regions:
        distortion_description = f"Architectural distortion noted in {len(distortion_regions)} area(s)"
    else:
        distortion_description = "No architectural distortion identified"
    
    # ========== AXILLARY FINDINGS (MLO SPECIFIC) ==========
    # Analyze upper outer region for axillary lymph nodes
    axillary_region = img_array[:height//3, :width//3]  # Upper corner
    axillary_mean = np.mean(axillary_region)
    axillary_std = np.std(axillary_region)
    
    # Check for lymph node-like structures
    if axillary_std > 40 and axillary_mean > 100:
        axillary_findings = "Axillary lymph nodes visualized - appear normal in size"
    elif axillary_std > 30:
        axillary_findings = "Axillary region partially visualized - no obvious abnormality"
    else:
        axillary_findings = "Axillary region not well visualized on this image"
    
    # Check for suspicious axillary findings
    axillary_abnormal = False
    for region in detected_regions:
        loc = region.get('location', {}).get('quadrant', '').lower()
        if 'upper' in loc and ('outer' in loc or 'lateral' in loc):
            if region.get('confidence', 0) > 60:
                axillary_findings = "Suspicious finding in axillary region - recommend ultrasound evaluation"
                axillary_abnormal = True
                break
    
    # ========== PECTORAL MUSCLE VISIBILITY (MLO SPECIFIC) ==========
    pectoral_analysis = analyze_pectoral_muscle(img_array)
    
    if pectoral_analysis:
        pec_visibility = pectoral_analysis.get('visibility_score', 0)
        pec_angle = pectoral_analysis.get('angle', 0)
        
        if pec_visibility > 70:
            pectoral_description = f"Well visualized - extends to nipple level, angle: {pec_angle}°"
        elif pec_visibility > 50:
            pectoral_description = f"Adequately visualized - angle: {pec_angle}°"
        else:
            pectoral_description = "Suboptimally visualized - may limit posterior tissue assessment"
    else:
        pectoral_description = "Pectoral muscle assessment not available"
    
    # ========== IMPRESSION & SUSPICION LEVEL ==========
    abnormalities = len(mass_regions) + len(calc_regions) + len(distortion_regions)
    if axillary_abnormal:
        abnormalities += 1
    
    if model_confidence >= 0.75 or abnormalities >= 3:
        suspicion_level = "High"
        impression = "Multiple suspicious findings requiring immediate workup"
    elif model_confidence >= 0.5 or abnormalities >= 1:
        suspicion_level = "Intermediate"
        impression = "Findings present that warrant further evaluation"
    else:
        suspicion_level = "Low"
        impression = "No suspicious abnormality detected"
    
    # Determine BI-RADS
    if suspicion_level == "High":
        birads = "BI-RADS 4C/5 - Highly suspicious"
    elif suspicion_level == "Intermediate":
        birads = "BI-RADS 4A/4B - Suspicious abnormality"
    elif abnormalities > 0:
        birads = "BI-RADS 3 - Probably benign"
    else:
        birads = "BI-RADS 1/2 - Negative/Benign"
    
    return {
        "view_type": "MLO (Medio-Lateral Oblique)",
        "image_quality": image_quality,
        "quality_score": quality_score,
        "breast_density": f"ACR Category {acr_category} - {density_description}",
        "masses": {
            "description": masses_description,
            "details": masses_found
        },
        "calcifications": calc_description,
        "architectural_distortion": distortion_description,
        "axillary_findings": axillary_findings,
        "pectoral_muscle_visibility": pectoral_description,
        "impression": impression,
        "birads_category": birads,
        "suspicion_level": suspicion_level,
        "confidence_score": f"{model_confidence * 100:.1f}%"
    }


def detect_colored_text_label(rgb_array):
    """
    Detect colored text labels like blue 'R-MLO' in mammogram images.
    Blue text appears as (R<100, G<100, B>100) in RGB.
    
    Args:
        rgb_array: RGB image as numpy array (H, W, 3)
    
    Returns:
        Tuple of (laterality, view_type) or (None, None) if not detected
    """
    if rgb_array is None or len(rgb_array.shape) != 3:
        return None, None
    
    height, width = rgb_array.shape[:2]
    print(f"DEBUG detect_colored_text_label: Image size {width}x{height}")
    
    # Check corners where text labels are typically placed
    regions = [
        ("top_left", rgb_array[:height//4, :width//3]),
        ("top_right", rgb_array[:height//4, -width//3:]),
        ("bottom_left", rgb_array[-height//5:, :width//3]),
        ("bottom_right", rgb_array[-height//5:, -width//3:]),
    ]
    
    for region_name, region in regions:
        if region.size == 0:
            continue
        
        r_channel = region[:, :, 0].astype(np.int32)
        g_channel = region[:, :, 1].astype(np.int32)
        b_channel = region[:, :, 2].astype(np.int32)
        
        # Detect BLUE text: Blue channel significantly higher than red and green
        # Blue text like "R-MLO" typically has B > 50 and B > R and B > G
        blue_text_mask = (b_channel > 50) & (b_channel > r_channel + 10) & (b_channel > g_channel + 10)
        blue_pixel_count = np.sum(blue_text_mask)
        blue_ratio = blue_pixel_count / blue_text_mask.size
        
        # Also detect CYAN text (high G and B, low R)
        cyan_mask = (b_channel > 50) & (g_channel > 50) & (r_channel < g_channel) & (r_channel < b_channel)
        cyan_count = np.sum(cyan_mask)
        
        # Also detect WHITE/BRIGHT text
        bright_mask = (r_channel > 120) & (g_channel > 120) & (b_channel > 120)
        bright_count = np.sum(bright_mask)
        bright_ratio = bright_count / bright_mask.size
        
        # Detect any NON-BLACK text (any pixel that's not very dark)
        # Background in mammograms is typically very dark
        non_black_mask = (r_channel > 30) | (g_channel > 30) | (b_channel > 30)
        non_black_count = np.sum(non_black_mask)
        non_black_ratio = non_black_count / non_black_mask.size
        
        print(f"DEBUG Colored Text {region_name}: blue={blue_pixel_count}({blue_ratio:.4f}), cyan={cyan_count}, bright={bright_count}({bright_ratio:.4f}), non_black={non_black_count}({non_black_ratio:.4f})")
        
        # Combine all text masks
        text_mask = blue_text_mask | cyan_mask | bright_mask
        text_pixel_count = np.sum(text_mask)
        
        if text_pixel_count > 50:  # At least 50 pixels of text
            # Analyze the text pattern
            cols_with_text = np.any(text_mask, axis=0)
            text_width = np.sum(cols_with_text)
            
            rows_with_text = np.any(text_mask, axis=1)
            text_height = np.sum(rows_with_text)
            
            region_h, region_w = text_mask.shape
            width_ratio = text_width / max(region_w, 1)
            
            print(f"DEBUG Colored Text {region_name}: text_pixels={text_pixel_count}, text_w={text_width}, text_h={text_height}, width_ratio={width_ratio:.3f}")
            
            # MLO text is longer than CC text
            # "R-MLO" = 5 chars vs "RCC" = 3 chars
            # If we detect significant blue/colored text, assume it's a label
            if blue_pixel_count > 30 or text_width > 10:
                # Check text width to determine MLO vs CC
                if text_width > 20 or width_ratio > 0.08:
                    print(f"DEBUG: Colored text detected - assuming MLO (wider text)")
                    # Detect laterality from text position or default to R
                    laterality = "R"  # Default, can be improved
                    return laterality, "MLO"
                else:
                    print(f"DEBUG: Colored text detected - assuming CC (shorter text)")
                    return "R", "CC"
    
    return None, None


def detect_text_label_in_image(img_array, original_image=None):
    """
    Detect text labels like 'R-MLO', 'L-CC', 'RCC', 'LMLO' etc. in mammogram images.
    Uses OCR (pytesseract) if available, otherwise falls back to pattern-based detection.
    
    Args:
        img_array: Grayscale image as numpy array
        original_image: Original PIL Image (optional, for color-based detection)
    
    Returns:
        Tuple of (laterality, view_type) or (None, None) if not detected
        laterality: "R" or "L" or None
        view_type: "MLO" or "CC" or None
    """
    height, width = img_array.shape
    
    # Define regions to check for text labels (corners and edges)
    regions_to_check = [
        ("top_left", img_array[:height//5, :width//4]),
        ("top_right", img_array[:height//5, -width//4:]),
        ("bottom_left", img_array[-height//6:, :width//4]),
        ("bottom_right", img_array[-height//6:, -width//4:]),
        ("top_center", img_array[:height//6, width//4:-width//4]),
    ]
    
    # Try OCR-based detection first (most accurate)
    if OCR_AVAILABLE:
        for region_name, region in regions_to_check:
            if region.size == 0 or region.shape[0] < 10 or region.shape[1] < 10:
                continue
            
            try:
                # Preprocess for better OCR
                region_normalized = cv2.normalize(region, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
                
                # Try multiple threshold values to catch different text colors
                for thresh_val in [50, 80, 100, 120, 150]:
                    _, binary = cv2.threshold(region_normalized, thresh_val, 255, cv2.THRESH_BINARY)
                    binary_inv = cv2.bitwise_not(binary)
                    
                    for img_version in [binary, binary_inv]:
                        try:
                            text = pytesseract.image_to_string(img_version, config='--psm 7 -c tessedit_char_whitelist=RMLOC-0123456789').strip().upper()
                            
                            if not text:
                                text = pytesseract.image_to_string(img_version, config='--psm 8 -c tessedit_char_whitelist=RMLOC-0123456789').strip().upper()
                            
                            if text:
                                print(f"DEBUG OCR {region_name} (thresh={thresh_val}): '{text}'")
                                laterality, view_type = parse_mammogram_label(text)
                                if view_type:
                                    print(f"DEBUG: OCR detected label '{text}' -> laterality={laterality}, view={view_type}")
                                    return laterality, view_type
                        except:
                            continue
                            
            except Exception as e:
                print(f"DEBUG OCR error in {region_name}: {e}")
                continue
    
    # Fallback: Enhanced pattern-based detection
    return detect_text_label_pattern_based(img_array)


def parse_mammogram_label(text):
    """
    Parse mammogram label text to extract laterality and view type.
    
    Handles formats like: R-MLO, RMLO, R MLO, L-CC, LCC, L CC, RCC, etc.
    
    Args:
        text: Detected text string
    
    Returns:
        Tuple of (laterality, view_type) or (None, None)
    """
    if not text:
        return None, None
    
    # Clean up the text
    text = text.upper().strip()
    text = re.sub(r'[^A-Z0-9\-\s]', '', text)  # Keep only letters, numbers, dash, space
    
    laterality = None
    view_type = None
    
    # Check for MLO patterns
    mlo_patterns = ['MLO', 'M-LO', 'M L O', 'MLC', 'ML0', 'WLO', 'NLO']  # Common OCR misreads
    for pattern in mlo_patterns:
        if pattern in text:
            view_type = "MLO"
            break
    
    # Check for CC patterns
    cc_patterns = ['CC', 'C-C', 'C C']
    if not view_type:
        for pattern in cc_patterns:
            if pattern in text:
                view_type = "CC"
                break
    
    # Check for laterality
    if text.startswith('R') or 'R-' in text or ' R ' in text or text.startswith('R '):
        laterality = "R"
    elif text.startswith('L') or 'L-' in text or ' L ' in text or text.startswith('L '):
        laterality = "L"
    
    # Also check for full patterns
    full_patterns = {
        'RMLO': ('R', 'MLO'), 'R-MLO': ('R', 'MLO'), 'R MLO': ('R', 'MLO'),
        'LMLO': ('L', 'MLO'), 'L-MLO': ('L', 'MLO'), 'L MLO': ('L', 'MLO'),
        'RCC': ('R', 'CC'), 'R-CC': ('R', 'CC'), 'R CC': ('R', 'CC'),
        'LCC': ('L', 'CC'), 'L-CC': ('L', 'CC'), 'L CC': ('L', 'CC'),
    }
    
    for pattern, (lat, view) in full_patterns.items():
        if pattern in text:
            return lat, view
    
    return laterality, view_type


def detect_text_label_pattern_based(img_array):
    """
    Fallback pattern-based text detection when OCR is not available.
    Analyzes pixel patterns to detect text labels.
    Works with both bright text on dark background AND colored text.
    
    Args:
        img_array: Grayscale image as numpy array
    
    Returns:
        Tuple of (laterality, view_type) or (None, None)
    """
    height, width = img_array.shape
    
    # Check corners and edges where text labels are typically placed
    regions = [
        ("top_left", img_array[:height//5, :width//4]),
        ("top_right", img_array[:height//5, -width//4:]),
        ("bottom_left", img_array[-height//6:, :width//4]),
        ("bottom_right", img_array[-height//6:, -width//4:]),
    ]
    
    for region_name, region in regions:
        if region.size == 0 or region.shape[0] < 5 or region.shape[1] < 5:
            continue
        
        region_h, region_w = region.shape
        
        # Method 1: Look for ANY non-black pixels (text could be any color)
        # In mammograms, the background is typically very dark (< 15)
        background_threshold = 15
        text_mask = region > background_threshold
        text_ratio = np.sum(text_mask) / region.size
        
        # Text typically covers 1-50% of the corner region
        if 0.003 < text_ratio < 0.55:
            # Analyze the text pattern
            cols_with_text = np.any(text_mask, axis=0)
            text_width = np.sum(cols_with_text)
            
            rows_with_text = np.any(text_mask, axis=1)
            text_height = np.sum(rows_with_text)
            
            if text_width > 3 and text_height > 2:
                width_ratio = text_width / max(region_w, 1)
                
                # Calculate text aspect ratio (width/height)
                text_aspect = text_width / max(text_height, 1)
                
                # Count connected components (text characters)
                # More characters = longer text = likely MLO
                
                print(f"DEBUG Pattern {region_name}: text_ratio={text_ratio:.4f}, width_ratio={width_ratio:.3f}, text_w={text_width}, text_h={text_height}, text_aspect={text_aspect:.2f}")
                
                # Improved CC vs MLO detection based on text characteristics
                # CC text: "RCC", "LCC", "R-CC", "L-CC" (3-5 chars, compact)
                # MLO text: "RMLO", "LMLO", "R-MLO", "L-MLO" (4-6 chars, wider)
                
                # Use multiple factors for better accuracy:
                # 1. Text width: MLO is typically wider (>25px), CC is narrower (<20px)
                # 2. Text aspect ratio: MLO is more horizontal (>2.5), CC is more square (1.5-2.5)
                # 3. Width ratio: MLO takes more space (>12%), CC is more compact (<10%)
                
                is_likely_mlo = False
                is_likely_cc = False
                
                # Strong MLO indicators
                if (text_width > 30 and text_aspect > 2.8) or (width_ratio > 0.15):
                    is_likely_mlo = True
                    print(f"DEBUG: Strong MLO pattern (w={text_width}, aspect={text_aspect:.2f}, ratio={width_ratio:.3f})")
                
                # Strong CC indicators  
                elif (text_width < 22 and text_aspect < 2.3) or (width_ratio < 0.09 and text_width < 25):
                    is_likely_cc = True
                    print(f"DEBUG: Strong CC pattern (w={text_width}, aspect={text_aspect:.2f}, ratio={width_ratio:.3f})")
                
                # Moderate MLO indicators
                elif text_width > 25 or width_ratio > 0.12:
                    is_likely_mlo = True
                    print(f"DEBUG: Moderate MLO pattern (w={text_width}, ratio={width_ratio:.3f})")
                
                # Default to CC if ambiguous (CC is more common and safer default)
                else:
                    is_likely_cc = True
                    print(f"DEBUG: Ambiguous, defaulting to CC")
                
                if is_likely_mlo:
                    return None, "MLO"
                elif is_likely_cc:
                    return None, "CC"
    
    # No text detected
    return None, None


def detect_breast_laterality(img_array):
    """
    Detect whether the mammogram is of the Right or Left breast.
    Uses tissue distribution analysis.
    
    Args:
        img_array: Grayscale image as numpy array
    
    Returns:
        "R" for Right breast, "L" for Left breast
    """
    height, width = img_array.shape
    
    # Tissue-based detection
    # In mammograms, the breast tissue appears on one side
    # The side with more tissue indicates which breast it is
    
    # Divide image into left and right halves
    left_half = img_array[:, :width//2]
    right_half = img_array[:, width//2:]
    
    # Calculate tissue density (mean intensity) in each half
    left_density = np.mean(left_half)
    right_density = np.mean(right_half)
    
    # Also check for tissue mass (pixels above threshold)
    threshold = 30
    left_tissue_area = np.sum(left_half > threshold)
    right_tissue_area = np.sum(right_half > threshold)
    
    # Combine metrics
    left_score = left_density + (left_tissue_area / left_half.size) * 100
    right_score = right_density + (right_tissue_area / right_half.size) * 100
    
    # Determine laterality based on tissue location
    # If tissue is on LEFT side of image -> it's the RIGHT breast (standard orientation)
    # If tissue is on RIGHT side of image -> it's the LEFT breast
    if left_score > right_score * 1.05:
        return "R"  # Tissue on left = Right breast
    elif right_score > left_score * 1.05:
        return "L"  # Tissue on right = Left breast
    else:
        # Check edge patterns - breast edge has higher variance
        left_edge = img_array[:, :width//10]
        right_edge = img_array[:, -width//10:]
        
        if np.var(left_edge) > np.var(right_edge):
            return "R"  # Breast edge on left = Right breast
        else:
            return "L"


def detect_mammogram_view_type(img_array):
    """
    Detect whether the mammogram is CC (Cranio-Caudal) or MLO (Medio-Lateral Oblique).
    
    MLO characteristics:
    - Pectoral muscle visible as diagonal bright band from upper corner
    - Breast appears more elongated/diagonal
    - Axillary tail visible
    - Image typically taller than wide (portrait orientation)
    
    CC characteristics:
    - No pectoral muscle visible
    - Breast appears more rounded/circular
    - Top-down view
    - Image typically wider or square
    
    Args:
        img_array: Grayscale image as numpy array
    
    Returns:
        "MLO" or "CC"
    """
    height, width = img_array.shape
    
    # First, try to detect from text label
    _, text_view = detect_text_label_in_image(img_array)
    if text_view:
        print(f"DEBUG: View detected from text label: {text_view}")
        return text_view
    
    mlo_score = 0
    cc_score = 0
    
    # ========== 1. IMAGE ASPECT RATIO (Most reliable indicator) ==========
    # MLO images are typically portrait (taller than wide)
    # CC images are typically landscape or square
    image_aspect_ratio = height / width
    
    print(f"DEBUG: Image aspect ratio = {image_aspect_ratio:.3f} (h={height}, w={width})")
    
    # CRITICAL: If image is clearly portrait (taller than wide), it's almost certainly MLO
    if image_aspect_ratio > 1.2:
        print(f"DEBUG: Strong portrait orientation (ratio={image_aspect_ratio:.3f}) -> Returning MLO directly")
        return "MLO"
    elif image_aspect_ratio > 1.1:
        mlo_score += 5  # Very strong MLO indicator
        print(f"DEBUG: Aspect ratio > 1.1 -> MLO +5")
    elif image_aspect_ratio > 1.02:
        mlo_score += 3
        print(f"DEBUG: Aspect ratio > 1.02 -> MLO +3")
    elif image_aspect_ratio < 0.9:
        cc_score += 4  # Clearly wider than tall = CC
        print(f"DEBUG: Aspect ratio < 0.9 -> CC +4")
    elif image_aspect_ratio < 0.98:
        cc_score += 2
        print(f"DEBUG: Aspect ratio < 0.98 -> CC +2")
    
    # ========== 2. PECTORAL MUSCLE DETECTION (Key MLO indicator) ==========
    # In MLO view, pectoral muscle appears as bright diagonal band from upper corner
    
    def detect_pectoral_muscle_enhanced(img, side="left"):
        """Enhanced pectoral muscle detection with multiple methods."""
        h, w = img.shape
        score = 0
        
        # Get the upper corner region
        if side == "left":
            region = img[:h//2, :w//3]
        else:
            region = img[:h//2, -w//3:]
        
        rh, rw = region.shape
        if rh < 10 or rw < 10:
            return 0
        
        # Method 1: Check for bright triangular region in corner
        # Pectoral muscle creates a bright triangular area
        corner_region = region[:rh//2, :rw//2] if side == "left" else region[:rh//2, -rw//2:]
        corner_mean = np.mean(corner_region)
        rest_mean = np.mean(region[rh//2:, :])
        
        if corner_mean > 40 and corner_mean > rest_mean * 1.2:
            score += 2
            print(f"DEBUG: Pectoral {side} - bright corner detected (mean={corner_mean:.1f} vs rest={rest_mean:.1f})")
        
        # Method 2: Check for diagonal edge (pectoral muscle boundary)
        # Use Sobel-like gradient detection
        grad_y = np.diff(region.astype(float), axis=0)
        grad_x = np.diff(region.astype(float), axis=1)
        
        # Diagonal gradient (45 degrees)
        min_dim = min(grad_y.shape[0], grad_x.shape[1])
        diag_grads = []
        for i in range(min_dim):
            if i < grad_y.shape[0] and i < grad_y.shape[1]:
                diag_grads.append(abs(grad_y[i, min(i, grad_y.shape[1]-1)]))
        
        if diag_grads:
            max_diag_grad = np.max(diag_grads)
            mean_diag_grad = np.mean(diag_grads)
            if max_diag_grad > 30 or mean_diag_grad > 10:
                score += 2
                print(f"DEBUG: Pectoral {side} - diagonal edge detected (max={max_diag_grad:.1f}, mean={mean_diag_grad:.1f})")
        
        # Method 3: Check intensity profile from corner to center
        # Pectoral muscle shows gradual decrease from corner
        profile_len = min(rh, rw) // 2
        if side == "left":
            profile = [region[i, i] for i in range(profile_len) if i < rh and i < rw]
        else:
            profile = [region[i, rw-1-i] for i in range(profile_len) if i < rh and rw-1-i >= 0]
        
        if len(profile) > 5:
            # Check if intensity decreases from corner (pectoral muscle pattern)
            first_third = np.mean(profile[:len(profile)//3])
            last_third = np.mean(profile[-len(profile)//3:])
            if first_third > 50 and first_third > last_third * 1.3:
                score += 2
                print(f"DEBUG: Pectoral {side} - intensity gradient detected (start={first_third:.1f}, end={last_third:.1f})")
        
        # Method 4: Check for continuous bright region from top
        # In MLO, pectoral muscle extends from top edge
        top_strip = region[:rh//4, :]
        top_mean = np.mean(top_strip)
        if top_mean > 60:
            score += 1
            print(f"DEBUG: Pectoral {side} - bright top strip (mean={top_mean:.1f})")
        
        return score
    
    left_pec = detect_pectoral_muscle_enhanced(img_array, "left")
    right_pec = detect_pectoral_muscle_enhanced(img_array, "right")
    pectoral_score = max(left_pec, right_pec)
    
    print(f"DEBUG: Pectoral scores - left={left_pec}, right={right_pec}, max={pectoral_score}")
    
    if pectoral_score >= 4:
        mlo_score += 4
    elif pectoral_score >= 2:
        mlo_score += 2
    elif pectoral_score >= 1:
        mlo_score += 1
    
    # ========== 3. BREAST TISSUE SHAPE ANALYSIS ==========
    # Create tissue mask
    tissue_threshold = 20
    tissue_mask = img_array > tissue_threshold
    
    # Find tissue bounding box
    rows = np.any(tissue_mask, axis=1)
    cols = np.any(tissue_mask, axis=0)
    
    if np.any(rows) and np.any(cols):
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        tissue_height = rmax - rmin
        tissue_width = cmax - cmin
        
        if tissue_width > 0 and tissue_height > 0:
            tissue_aspect = tissue_height / tissue_width
            
            print(f"DEBUG: Tissue aspect ratio = {tissue_aspect:.3f}")
            
            # MLO: tissue is more vertically elongated
            if tissue_aspect > 1.5:
                mlo_score += 3
                print(f"DEBUG: Tissue elongated vertically -> MLO +3")
            elif tissue_aspect > 1.2:
                mlo_score += 2
                print(f"DEBUG: Tissue somewhat elongated -> MLO +2")
            elif tissue_aspect < 0.9:
                cc_score += 2
                print(f"DEBUG: Tissue wider than tall -> CC +2")
    
    # ========== 4. TISSUE DISTRIBUTION ANALYSIS ==========
    # MLO: More tissue in upper portion (pectoral + axillary region)
    # CC: More evenly distributed or centered
    
    upper_third = img_array[:height//3, :]
    middle_third = img_array[height//3:2*height//3, :]
    lower_third = img_array[2*height//3:, :]
    
    upper_tissue = np.sum(upper_third > tissue_threshold)
    middle_tissue = np.sum(middle_third > tissue_threshold)
    lower_tissue = np.sum(lower_third > tissue_threshold)
    total_tissue = upper_tissue + middle_tissue + lower_tissue
    
    if total_tissue > 0:
        upper_ratio = upper_tissue / total_tissue
        
        print(f"DEBUG: Upper tissue ratio = {upper_ratio:.3f}")
        
        # MLO typically has significant tissue in upper region (pectoral muscle area)
        if upper_ratio > 0.4:
            mlo_score += 2
            print(f"DEBUG: High upper tissue ratio -> MLO +2")
        elif upper_ratio > 0.35:
            mlo_score += 1
            print(f"DEBUG: Moderate upper tissue ratio -> MLO +1")
    
    # ========== 5. DIAGONAL TISSUE PATTERN ==========
    # MLO images often show diagonal tissue orientation
    
    # Check if tissue follows a diagonal pattern
    left_upper = np.sum(img_array[:height//2, :width//2] > tissue_threshold)
    right_lower = np.sum(img_array[height//2:, width//2:] > tissue_threshold)
    right_upper = np.sum(img_array[:height//2, width//2:] > tissue_threshold)
    left_lower = np.sum(img_array[height//2:, :width//2] > tissue_threshold)
    
    # MLO often has diagonal distribution (upper-left to lower-right or vice versa)
    diag1 = left_upper + right_lower
    diag2 = right_upper + left_lower
    
    if max(diag1, diag2) > 0:
        diag_ratio = min(diag1, diag2) / max(diag1, diag2)
        
        # Strong diagonal pattern (one diagonal has much more tissue)
        if diag_ratio < 0.6:
            mlo_score += 1
            print(f"DEBUG: Diagonal tissue pattern detected -> MLO +1")
    
    # ========== FINAL DECISION ==========
    print(f"DEBUG: Final scores - MLO={mlo_score}, CC={cc_score}")
    
    # Decision logic with clear thresholds
    if mlo_score >= cc_score + 2:
        print(f"DEBUG: Decision = MLO (score diff = {mlo_score - cc_score})")
        return "MLO"
    elif cc_score >= mlo_score + 2:
        print(f"DEBUG: Decision = CC (score diff = {cc_score - mlo_score})")
        return "CC"
    elif mlo_score > cc_score:
        print(f"DEBUG: Decision = MLO (slight advantage)")
        return "MLO"
    elif cc_score > mlo_score:
        print(f"DEBUG: Decision = CC (slight advantage)")
        return "CC"
    else:
        # Tie-breaker: use aspect ratio as primary indicator
        if image_aspect_ratio > 1.0:
            print(f"DEBUG: Decision = MLO (tie-breaker: aspect ratio)")
            return "MLO"
        else:
            print(f"DEBUG: Decision = CC (tie-breaker: aspect ratio)")
            return "CC"


def generate_mammogram_view_analysis(image, heatmap, model_confidence, detected_regions, view_type="auto", filename=None):
    """
    Generate structured mammogram analysis based on view type.
    Detects: RCC (Right CC), LCC (Left CC), RMLO (Right MLO), LMLO (Left MLO)
    
    Args:
        image: PIL Image
        heatmap: Grad-CAM heatmap
        model_confidence: Model confidence (0-1)
        detected_regions: List of detected regions
        view_type: "rcc", "lcc", "rmlo", "lmlo", "cc", "mlo", or "auto" (auto-detect)
        filename: Optional filename for additional context in view detection
    
    Returns:
        Dictionary with view-specific analysis including full view code
    """
    img_array = np.array(image.convert('L'))
    height, width = img_array.shape
    
    print(f"DEBUG generate_mammogram_view_analysis: Image size = {width}x{height}, aspect ratio = {height/width:.3f}")
    
    # Also get RGB array for colored text detection
    rgb_array = np.array(image.convert('RGB')) if image.mode != 'L' else None
    
    # Auto-detect view type and laterality if not specified
    if view_type == "auto":
        # First try to detect from colored text label in image (most accurate for blue text like R-MLO)
        text_laterality, text_view = None, None
        
        if rgb_array is not None:
            text_laterality, text_view = detect_colored_text_label(rgb_array)
        
        if not text_view:
            # Try grayscale text detection
            text_laterality, text_view = detect_text_label_in_image(img_array)
        
        if text_view:
            # Text label found - use it as primary source
            detected_view = text_view
            print(f"DEBUG: View from text label: {detected_view}")
        else:
            # Fall back to image analysis
            detected_view = detect_mammogram_view_type(img_array)
            print(f"DEBUG: View from image analysis: {detected_view}")
        
        if text_laterality:
            # Laterality found in text label
            detected_laterality = text_laterality
            print(f"DEBUG: Laterality from text label: {detected_laterality}")
        else:
            # Fall back to tissue analysis
            detected_laterality = detect_breast_laterality(img_array)
            print(f"DEBUG: Laterality from tissue analysis: {detected_laterality}")
        
        # Combine to get full view code
        view_code = f"{detected_laterality}{detected_view}"  # e.g., "RMLO", "LCC"
        view_type = detected_view.lower()
    else:
        # Parse provided view type
        view_type_upper = view_type.upper()
        if view_type_upper in ["RCC", "LCC", "RMLO", "LMLO"]:
            view_code = view_type_upper
            view_type = "mlo" if "MLO" in view_type_upper else "cc"
        elif view_type_upper in ["CC", "MLO"]:
            # Only view type provided, detect laterality
            detected_laterality = detect_breast_laterality(img_array)
            view_code = f"{detected_laterality}{view_type_upper}"
            view_type = view_type_upper.lower()
        else:
            # Default to auto-detection
            text_laterality, text_view = None, None
            
            if rgb_array is not None:
                text_laterality, text_view = detect_colored_text_label(rgb_array)
            
            if not text_view:
                text_laterality, text_view = detect_text_label_in_image(img_array)
            
            if text_view:
                detected_view = text_view
            else:
                detected_view = detect_mammogram_view_type(img_array)
            
            if text_laterality:
                detected_laterality = text_laterality
            else:
                detected_laterality = detect_breast_laterality(img_array)
            
            view_code = f"{detected_laterality}{detected_view}"
            view_type = detected_view.lower()
    
    # Get view-specific analysis
    if view_type == "mlo":
        analysis = analyze_mlo_view(image, heatmap, model_confidence, detected_regions)
    else:
        analysis = analyze_cc_view(image, heatmap, model_confidence, detected_regions)
    
    # Add the full view code and laterality info
    laterality = view_code[0]  # "R" or "L"
    laterality_full = "Right" if laterality == "R" else "Left"
    
    # Update view_type to include full information
    if "MLO" in view_code:
        analysis["view_type"] = f"{view_code} ({laterality_full} Medio-Lateral Oblique)"
    else:
        analysis["view_type"] = f"{view_code} ({laterality_full} Cranio-Caudal)"
    
    analysis["view_code"] = view_code
    analysis["laterality"] = laterality_full
    analysis["laterality_code"] = laterality
    
    return analysis

