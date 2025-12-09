import tensorflow as tf
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import matplotlib

matplotlib.use("Agg")  # Ensure headless rendering for serverless environments
import matplotlib.cm as cm
import matplotlib.pyplot as plt
from scipy import ndimage

def make_gradcam_heatmap(img_array, model, last_conv_layer_index, pred_index=None):
    """
    Generate Grad-CAM heatmap for a given image and model.
    """
    last_conv_layer = model.layers[last_conv_layer_index]
    inputs = tf.keras.Input(shape=(224, 224, 3))
    
    x = inputs
    for i, layer in enumerate(model.layers):
        x = layer(x)
        if i == last_conv_layer_index:
            conv_output = x
    
    final_output = x
    
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

def create_tissue_mask(img_array, threshold=20):
    """
    Create a mask identifying tissue (non-background) areas.
    """
    if len(img_array.shape) == 3:
        gray = np.mean(img_array, axis=2)
    else:
        gray = img_array.copy()
    
    # Tissue is where pixel intensity is above threshold (not black background)
    mask = gray > threshold
    
    # Clean up the mask with morphological operations
    mask = ndimage.binary_fill_holes(mask)
    mask = ndimage.binary_opening(mask, iterations=2)
    mask = ndimage.binary_closing(mask, iterations=2)
    
    return mask


def create_heatmap_overlay(original_image, heatmap, alpha=0.4, colormap='jet'):
    """
    Create an overlay of the heatmap on the original image.
    Only shows heatmap on tissue areas, not on black background.
    """
    img_array = np.array(original_image)
    
    heatmap_resized = np.array(Image.fromarray((heatmap * 255).astype(np.uint8)).resize(
        (original_image.size[0], original_image.size[1]),
        Image.BILINEAR
    ))
    
    heatmap_resized = heatmap_resized.astype(np.float32) / 255.0
    
    # Create tissue mask to avoid showing heatmap on black background
    tissue_mask = create_tissue_mask(img_array, threshold=20)
    
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
    """
    conv_layer_indices = [i for i, layer in enumerate(model.layers) if isinstance(layer, tf.keras.layers.Conv2D)]
    if conv_layer_indices:
        return conv_layer_indices[-1]
    return None

def detect_bounding_boxes(heatmap, original_image_size, threshold=0.6, min_area=100, tissue_mask=None, max_regions=8):
    """
    Detect bounding boxes around high-activation regions in the heatmap.
    Only detects within tissue areas if tissue_mask is provided.
    """
    # Make a copy to avoid modifying original
    heatmap_work = heatmap.copy()
    
    # If tissue mask provided, resize it to heatmap size and apply
    if tissue_mask is not None:
        tissue_mask_resized = np.array(Image.fromarray(tissue_mask.astype(np.uint8) * 255).resize(
            (heatmap_work.shape[1], heatmap_work.shape[0]),
            Image.NEAREST
        )) > 127
        # Zero out heatmap in background areas
        heatmap_work = heatmap_work * tissue_mask_resized
    
    # Threshold the heatmap to get high-activation regions
    binary_mask = (heatmap_work > threshold).astype(np.uint8)
    
    # Label connected components
    labeled_array, num_features = ndimage.label(binary_mask)
    
    boxes = []
    heatmap_h, heatmap_w = heatmap_work.shape
    orig_w, orig_h = original_image_size
    
    scale_x = orig_w / heatmap_w
    scale_y = orig_h / heatmap_h
    
    # Minimum box size to avoid tiny boxes
    min_box_size = 15
    
    for region_id in range(1, num_features + 1):
        region_coords = np.where(labeled_array == region_id)
        
        if len(region_coords[0]) < min_area / (scale_x * scale_y):
            continue
        
        y_min, y_max = region_coords[0].min(), region_coords[0].max()
        x_min, x_max = region_coords[1].min(), region_coords[1].max()
        
        x1 = int(x_min * scale_x)
        y1 = int(y_min * scale_y)
        x2 = int(x_max * scale_x)
        y2 = int(y_max * scale_y)
        
        # Skip boxes that are too small
        if (x2 - x1) < min_box_size or (y2 - y1) < min_box_size:
            continue
        
        # Ensure boxes are within image bounds
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(orig_w - 1, x2)
        y2 = min(orig_h - 1, y2)
        
        region_mask = (labeled_array == region_id)
        confidence = float(heatmap_work[region_mask].mean())
        
        boxes.append((x1, y1, x2, y2, confidence))
    
    # Sort by confidence (highest first) and limit to max_regions
    boxes = sorted(boxes, key=lambda b: b[4], reverse=True)[:max_regions]
    
    # Re-sort by position for consistent labeling
    boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
    
    return boxes

def draw_bounding_boxes(image, boxes, box_color='red', text_color='white', line_width=3):
    """
    Draw bounding boxes on an image with proper label positioning.
    Labels stay within image bounds and don't overlap.
    """
    img_copy = image.copy()
    draw = ImageDraw.Draw(img_copy)
    img_width, img_height = image.size
    
    # Try to load a font with multiple fallbacks
    font = None
    font_size = 14
    
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    
    for font_path in font_paths:
        try:
            font = ImageFont.truetype(font_path, font_size)
            break
        except:
            continue
    
    if font is None:
        font = ImageFont.load_default()
    
    # Track used label positions to avoid overlap
    used_label_areas = []
    
    for i, (x1, y1, x2, y2, confidence) in enumerate(boxes):
        # Ensure box coordinates are within image bounds
        x1 = max(0, min(x1, img_width - 1))
        y1 = max(0, min(y1, img_height - 1))
        x2 = max(0, min(x2, img_width - 1))
        y2 = max(0, min(y2, img_height - 1))
        
        # Skip invalid boxes
        if x2 <= x1 or y2 <= y1:
            continue
        
        # Draw rectangle
        draw.rectangle([x1, y1, x2, y2], outline=box_color, width=line_width)
        
        # Create label text
        label = f"Region {i + 1}: {confidence * 100:.1f}%"
        
        # Get label dimensions
        label_bbox = draw.textbbox((0, 0), label, font=font)
        label_width = label_bbox[2] - label_bbox[0]
        label_height = label_bbox[3] - label_bbox[1]
        
        # Calculate initial label position (prefer above the box)
        label_x = x1
        label_y = y1 - label_height - 4
        
        # Ensure label stays within image bounds horizontally
        if label_x + label_width > img_width:
            label_x = img_width - label_width - 2
        if label_x < 2:
            label_x = 2
        
        # If not enough space above, try below or inside
        if label_y < 2:
            if y2 + label_height + 4 < img_height:
                label_y = y2 + 4
            else:
                label_y = y1 + 4
        
        # Check for overlap with existing labels and adjust
        label_area = (label_x - 2, label_y - 2, label_x + label_width + 4, label_y + label_height + 4)
        
        max_attempts = 10
        attempt = 0
        while attempt < max_attempts:
            overlap = False
            for used_area in used_label_areas:
                if not (label_area[2] < used_area[0] or label_area[0] > used_area[2] or
                        label_area[3] < used_area[1] or label_area[1] > used_area[3]):
                    overlap = True
                    break
            
            if not overlap:
                break
            
            # Move label down
            label_y += label_height + 6
            if label_y + label_height > img_height - 2:
                label_y = 2
                label_x += label_width + 10
                if label_x + label_width > img_width - 2:
                    label_x = 2
            
            label_area = (label_x - 2, label_y - 2, label_x + label_width + 4, label_y + label_height + 4)
            attempt += 1
        
        # Record this label's area
        used_label_areas.append(label_area)
        
        # Draw label background
        draw.rectangle([label_x - 2, label_y - 2, label_x + label_width + 2, label_y + label_height + 2], 
                      fill=box_color)
        
        # Draw label text
        draw.text((label_x, label_y), label, fill=text_color, font=font)
    
    return img_copy

def get_region_location(x1, y1, x2, y2, img_width, img_height):
    """
    Determine the anatomical location of a detected region.
    """
    center_x = (x1 + x2) / 2
    center_y = (y1 + y2) / 2
    
    if center_x < img_width * 0.33:
        h_pos = "lateral"
    elif center_x > img_width * 0.67:
        h_pos = "medial"
    else:
        h_pos = "central"
    
    if center_y < img_height * 0.33:
        v_pos = "upper"
    elif center_y > img_height * 0.67:
        v_pos = "lower"
    else:
        v_pos = "mid"
    
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
    hx1, hy1 = int(x1 / scale_x), int(y1 / scale_y)
    hx2, hy2 = int(x2 / scale_x), int(y2 / scale_y)
    
    hx1, hx2 = max(0, hx1), min(heatmap.shape[1], hx2)
    hy1, hy2 = max(0, hy1), min(heatmap.shape[0], hy2)
    
    region = heatmap[hy1:hy2, hx1:hx2]
    
    if region.size == 0:
        return {}
    
    mean_intensity = float(np.mean(region))
    max_intensity = float(np.max(region))
    std_intensity = float(np.std(region))
    
    if std_intensity < 0.1:
        pattern = "homogeneous"
    elif std_intensity < 0.2:
        pattern = "slightly heterogeneous"
    else:
        pattern = "heterogeneous"
    
    if max_intensity > 0.9:
        severity = "high"
    elif max_intensity > 0.7:
        severity = "moderate"
    else:
        severity = "low"
    
    return {
        "mean_intensity": mean_intensity,
        "max_intensity": max_intensity,
        "pattern": pattern,
        "severity": severity
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
        width_px = x2 - x1
        height_px = y2 - y1
        area_px = width_px * height_px
        area_percentage = (area_px / (img_width * img_height)) * 100
        
        location = get_region_location(x1, y1, x2, y2, img_width, img_height)
        characteristics = analyze_region_characteristics(heatmap, x1, y1, x2, y2, scale_x, scale_y)
        
        aspect_ratio = width_px / height_px if height_px > 0 else 1
        if 0.8 <= aspect_ratio <= 1.2:
            shape = "roughly circular"
        elif aspect_ratio > 1.2:
            shape = "horizontally elongated"
        else:
            shape = "vertically elongated"
        
        region_info = {
            "id": i + 1,
            "confidence": float(conf * 100),
            "location": location,
            "size": {
                "width_px": width_px,
                "height_px": height_px,
                "area_percentage": round(area_percentage, 2)
            },
            "shape": shape,
            "characteristics": characteristics,
            "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
        }
        findings["regions"].append(region_info)
    
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
    """
    last_conv_layer_idx = get_last_conv_layer_index(model)
    
    if last_conv_layer_idx is None:
        error_msg = "No convolutional layer found in model"
        print(error_msg)
        return None, None, None, None, error_msg, None
    
    print(f"DEBUG: Found conv layer at index {last_conv_layer_idx}")
    print(f"DEBUG: Model has {len(model.layers)} layers")
    
    try:
        heatmap = make_gradcam_heatmap(preprocessed_img, model, last_conv_layer_idx)
        
        if heatmap is None:
            error_msg = "Heatmap generation returned None - gradient calculation may have failed"
            print(error_msg)
            return None, None, None, None, error_msg, None
        
        print(f"DEBUG: Heatmap generated successfully, shape: {heatmap.shape}")
        
        # Create tissue mask to filter out background detections
        img_array = np.array(original_image)
        tissue_mask = create_tissue_mask(img_array, threshold=20)
        
        overlay_image = create_heatmap_overlay(original_image, heatmap, alpha=0.5)
        print("DEBUG: Overlay created successfully")
        
        fig, ax = plt.subplots(figsize=(6, 6))
        im = ax.imshow(heatmap, cmap='jet')
        ax.axis('off')
        ax.set_title('Activation Heatmap', fontsize=14, fontweight='bold', pad=10)
        plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
        plt.tight_layout()
        
        fig.canvas.draw()
        buf = np.frombuffer(fig.canvas.buffer_rgba(), dtype=np.uint8)
        buf = buf.reshape(fig.canvas.get_width_height()[::-1] + (4,))
        heatmap_only_image = Image.fromarray(buf[:, :, :3])
        plt.close(fig)
        
        # Generate bounding boxes - USE TISSUE MASK to filter black areas
        boxes = detect_bounding_boxes(heatmap, original_image.size, threshold=0.6, min_area=100, tissue_mask=tissue_mask, max_regions=8)
        
        # Additional filter: remove boxes that are mostly in black/background areas
        filtered_boxes = []
        for (x1, y1, x2, y2, conf) in boxes:
            # Ensure valid coordinates
            x1_safe = max(0, min(x1, img_array.shape[1]-1))
            y1_safe = max(0, min(y1, img_array.shape[0]-1))
            x2_safe = max(0, min(x2, img_array.shape[1]-1))
            y2_safe = max(0, min(y2, img_array.shape[0]-1))
            
            if y2_safe > y1_safe and x2_safe > x1_safe:
                box_tissue_mask = tissue_mask[y1_safe:y2_safe, x1_safe:x2_safe]
                if box_tissue_mask.size > 0:
                    tissue_percentage = np.sum(box_tissue_mask) / box_tissue_mask.size
                    # Only keep boxes that are at least 60% on tissue
                    if tissue_percentage >= 0.6:
                        filtered_boxes.append((x1, y1, x2, y2, conf))
        
        boxes = filtered_boxes
        
        bbox_image = None
        if boxes:
            bbox_image = draw_bounding_boxes(original_image, boxes, box_color='#FF0000', line_width=4)
            print(f"DEBUG: Detected {len(boxes)} suspicious regions on tissue")
        else:
            bbox_image = original_image.copy()
            print("DEBUG: No distinct high-activation regions detected on tissue, showing original")
        
        # Extract detailed findings
        detailed_findings = extract_detailed_findings(heatmap, boxes, original_image.size, confidence)
        print(f"DEBUG: Extracted findings: {detailed_findings['summary']}")
        
        print("DEBUG: Heatmap visualization complete!")
        return heatmap, overlay_image, heatmap_only_image, bbox_image, None, detailed_findings
        
    except Exception as e:
        error_msg = f"Error generating Grad-CAM: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return None, None, None, None, error_msg, None
