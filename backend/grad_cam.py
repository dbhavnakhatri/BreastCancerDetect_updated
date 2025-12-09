import tensorflow as tf
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import matplotlib

matplotlib.use("Agg")
import matplotlib.cm as cm
import matplotlib.pyplot as plt
from scipy import ndimage

def make_gradcam_heatmap(img_array, model, last_conv_layer_index, pred_index=None):
    last_conv_layer = model.layers[last_conv_layer_index]
    inputs = tf.keras.Input(shape=(224, 224, 3))
    
    x = inputs
    for i, layer in enumerate(model.layers):
        x = layer(x)
        if i == last_conv_layer_index:
            conv_output = x
    
    final_output = x
    
    grad_model = tf.keras.Model(inputs=inputs, outputs=[conv_output, final_output])
    
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
    """Create mask for breast tissue (non-black areas)."""
    if len(img_array.shape) == 3:
        gray = np.mean(img_array, axis=2)
    else:
        gray = img_array.copy()
    
    mask = gray > threshold
    # Clean up mask - less aggressive
    mask = ndimage.binary_fill_holes(mask)
    mask = ndimage.binary_closing(mask, iterations=1)
    return mask

def create_heatmap_overlay(original_image, heatmap, alpha=0.4, colormap='jet'):
    img_array = np.array(original_image)
    
    heatmap_resized = np.array(Image.fromarray((heatmap * 255).astype(np.uint8)).resize(
        (original_image.size[0], original_image.size[1]), Image.BILINEAR
    ))
    heatmap_resized = heatmap_resized.astype(np.float32) / 255.0
    
    tissue_mask = create_tissue_mask(img_array, threshold=15)
    heatmap_resized = heatmap_resized * tissue_mask
    
    cmap = cm.get_cmap(colormap)
    heatmap_colored = cmap(heatmap_resized)
    heatmap_colored = (heatmap_colored[:, :, :3] * 255).astype(np.uint8)
    
    if len(img_array.shape) == 2:
        img_array = np.stack([img_array] * 3, axis=-1)
    elif img_array.shape[2] == 4:
        img_array = img_array[:, :, :3]
    
    overlay = img_array.copy().astype(np.float32)
    tissue_mask_3d = np.stack([tissue_mask] * 3, axis=-1)
    overlay = np.where(tissue_mask_3d, (1 - alpha) * img_array + alpha * heatmap_colored, img_array)
    overlay = np.clip(overlay, 0, 255).astype(np.uint8)
    
    return Image.fromarray(overlay)

def get_last_conv_layer_index(model):
    conv_layer_indices = [i for i, layer in enumerate(model.layers) if isinstance(layer, tf.keras.layers.Conv2D)]
    if conv_layer_indices:
        return conv_layer_indices[-1]
    return None

def detect_bounding_boxes(heatmap, original_image_size, threshold=0.5, min_area=50, tissue_mask=None, max_regions=8):
    """Detect bounding boxes - ONLY on tissue areas, max 8 regions."""
    heatmap_work = heatmap.copy()
    
    # Apply tissue mask to filter black background (if provided)
    if tissue_mask is not None:
        tissue_mask_resized = np.array(Image.fromarray(tissue_mask.astype(np.uint8) * 255).resize(
            (heatmap_work.shape[1], heatmap_work.shape[0]), Image.NEAREST
        )) > 127
        heatmap_work = heatmap_work * tissue_mask_resized
    
    binary_mask = (heatmap_work > threshold).astype(np.uint8)
    labeled_array, num_features = ndimage.label(binary_mask)
    
    boxes = []
    heatmap_h, heatmap_w = heatmap_work.shape
    orig_w, orig_h = original_image_size
    scale_x = orig_w / heatmap_w
    scale_y = orig_h / heatmap_h
    min_box_size = 15  # Minimum box size in pixels
    
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
        
        # Skip tiny boxes
        if (x2 - x1) < min_box_size or (y2 - y1) < min_box_size:
            continue
        
        # Keep within bounds
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(orig_w - 1, x2)
        y2 = min(orig_h - 1, y2)
        
        region_mask = (labeled_array == region_id)
        confidence = float(heatmap_work[region_mask].mean())
        boxes.append((x1, y1, x2, y2, confidence))
    
    # Sort by confidence and limit to max_regions
    boxes = sorted(boxes, key=lambda b: b[4], reverse=True)[:max_regions]
    boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
    
    return boxes

def draw_bounding_boxes(image, boxes, box_color='red', text_color='white', line_width=3):
    """Draw boxes with labels that stay INSIDE image and don't overlap."""
    img_copy = image.copy()
    draw = ImageDraw.Draw(img_copy)
    img_width, img_height = image.size
    
    # Try multiple font paths
    font = None
    for font_path in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                      "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"]:
        try:
            font = ImageFont.truetype(font_path, 12)
            break
        except:
            continue
    if font is None:
        font = ImageFont.load_default()
    
    used_areas = []
    drawn_count = 0
    
    for i, (x1, y1, x2, y2, confidence) in enumerate(boxes):
        # Strict bounds check
        x1 = max(5, min(x1, img_width - 5))
        y1 = max(5, min(y1, img_height - 5))
        x2 = max(5, min(x2, img_width - 5))
        y2 = max(5, min(y2, img_height - 5))
        
        if x2 <= x1 + 10 or y2 <= y1 + 10:
            continue
        
        # Draw the bounding box
        draw.rectangle([x1, y1, x2, y2], outline=box_color, width=line_width)
        drawn_count += 1
        
        label = f"Region {drawn_count}: {confidence * 100:.1f}%"
        bbox = draw.textbbox((0, 0), label, font=font)
        lw = bbox[2] - bbox[0]
        lh = bbox[3] - bbox[1]
        
        # Calculate label position - MUST stay inside image
        # Try positions in order: above box, below box, inside box top, inside box bottom
        positions = [
            (x1, y1 - lh - 6),  # Above
            (x1, y2 + 4),       # Below
            (x1 + 4, y1 + 4),   # Inside top
            (x1 + 4, y2 - lh - 4),  # Inside bottom
        ]
        
        best_pos = None
        for px, py in positions:
            # Clamp to image bounds
            px = max(4, min(px, img_width - lw - 4))
            py = max(4, min(py, img_height - lh - 4))
            
            # Check if position is valid (inside image)
            if px < 4 or py < 4 or px + lw > img_width - 4 or py + lh > img_height - 4:
                continue
            
            # Check for overlap with existing labels
            label_rect = (px - 2, py - 2, px + lw + 2, py + lh + 2)
            has_overlap = False
            for used in used_areas:
                if not (label_rect[2] < used[0] or label_rect[0] > used[2] or
                        label_rect[3] < used[1] or label_rect[1] > used[3]):
                    has_overlap = True
                    break
            
            if not has_overlap:
                best_pos = (px, py)
                break
        
        # If no good position found, try shifting down incrementally
        if best_pos is None:
            px, py = x1, y1 - lh - 6
            px = max(4, min(px, img_width - lw - 4))
            for shift in range(0, img_height, lh + 8):
                test_y = (y1 + shift) % (img_height - lh - 8) + 4
                label_rect = (px - 2, test_y - 2, px + lw + 2, test_y + lh + 2)
                has_overlap = False
                for used in used_areas:
                    if not (label_rect[2] < used[0] or label_rect[0] > used[2] or
                            label_rect[3] < used[1] or label_rect[1] > used[3]):
                        has_overlap = True
                        break
                if not has_overlap:
                    best_pos = (px, test_y)
                    break
        
        if best_pos is None:
            best_pos = (max(4, min(x1, img_width - lw - 4)), max(4, min(y1, img_height - lh - 4)))
        
        lx, ly = best_pos
        
        # Final bounds check
        lx = max(4, min(lx, img_width - lw - 4))
        ly = max(4, min(ly, img_height - lh - 4))
        
        # Record this label area
        used_areas.append((lx - 2, ly - 2, lx + lw + 2, ly + lh + 2))
        
        # Draw label background and text
        draw.rectangle([lx - 2, ly - 2, lx + lw + 2, ly + lh + 2], fill=box_color)
        draw.text((lx, ly), label, fill=text_color, font=font)
    
    return img_copy

def get_region_location(x1, y1, x2, y2, img_width, img_height):
    center_x = (x1 + x2) / 2
    center_y = (y1 + y2) / 2
    
    h_pos = "lateral" if center_x < img_width * 0.33 else ("medial" if center_x > img_width * 0.67 else "central")
    v_pos = "upper" if center_y < img_height * 0.33 else ("lower" if center_y > img_height * 0.67 else "mid")
    
    if center_x < img_width * 0.5 and center_y < img_height * 0.5:
        quadrant = "upper-outer quadrant"
    elif center_x >= img_width * 0.5 and center_y < img_height * 0.5:
        quadrant = "upper-inner quadrant"
    elif center_x < img_width * 0.5:
        quadrant = "lower-outer quadrant"
    else:
        quadrant = "lower-inner quadrant"
    
    return {"position": f"{v_pos}-{h_pos}", "quadrant": quadrant, "description": f"{v_pos} {h_pos} region ({quadrant})"}

def analyze_region_characteristics(heatmap, x1, y1, x2, y2, scale_x, scale_y):
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
    
    pattern = "homogeneous" if std_intensity < 0.1 else ("slightly heterogeneous" if std_intensity < 0.2 else "heterogeneous")
    severity = "high" if max_intensity > 0.9 else ("moderate" if max_intensity > 0.7 else "low")
    
    return {"mean_intensity": mean_intensity, "max_intensity": max_intensity, "pattern": pattern, "severity": severity}

def extract_detailed_findings(heatmap, boxes, original_image_size, confidence):
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
        area_percentage = (width_px * height_px) / (img_width * img_height) * 100
        
        location = get_region_location(x1, y1, x2, y2, img_width, img_height)
        characteristics = analyze_region_characteristics(heatmap, x1, y1, x2, y2, scale_x, scale_y)
        
        aspect_ratio = width_px / height_px if height_px > 0 else 1
        shape = "roughly circular" if 0.8 <= aspect_ratio <= 1.2 else ("horizontally elongated" if aspect_ratio > 1.2 else "vertically elongated")
        
        findings["regions"].append({
            "id": i + 1, "confidence": float(conf * 100), "location": location,
            "size": {"width_px": width_px, "height_px": height_px, "area_percentage": round(area_percentage, 2)},
            "shape": shape, "characteristics": characteristics, "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
        })
    
    if len(boxes) == 0:
        findings["summary"] = "Diffuse abnormal patterns detected." if confidence > 0.5 else "No distinct suspicious regions identified."
    elif len(boxes) == 1:
        r = findings["regions"][0]
        findings["summary"] = f"Single suspicious region in {r['location']['description']} with {r['confidence']:.1f}% confidence."
    else:
        locations = list(set([r['location']['quadrant'] for r in findings['regions']]))
        findings["summary"] = f"Multiple suspicious regions ({len(boxes)}) detected across {', '.join(locations)}."
    
    return findings

def create_gradcam_visualization(original_image, preprocessed_img, model, confidence):
    last_conv_layer_idx = get_last_conv_layer_index(model)
    
    if last_conv_layer_idx is None:
        return None, None, None, None, "No conv layer found", None
    
    try:
        heatmap = make_gradcam_heatmap(preprocessed_img, model, last_conv_layer_idx)
        if heatmap is None:
            return None, None, None, None, "Heatmap generation failed", None
        
        img_array = np.array(original_image)
        tissue_mask = create_tissue_mask(img_array, threshold=15)
        
        overlay_image = create_heatmap_overlay(original_image, heatmap, alpha=0.5)
        
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
        
        # Detect boxes with tissue mask filtering
        boxes = detect_bounding_boxes(heatmap, original_image.size, threshold=0.5, min_area=50, 
                                      tissue_mask=tissue_mask, max_regions=8)
        
        # STRICT filter: remove boxes on black background - box center must be on tissue
        # Also check that box is mostly on tissue (>50%)
        filtered_boxes = []
        img_h, img_w = img_array.shape[:2]
        
        for (x1, y1, x2, y2, conf) in boxes:
            # Get safe coordinates
            x1s = max(0, min(int(x1), img_w-1))
            y1s = max(0, min(int(y1), img_h-1))
            x2s = max(0, min(int(x2), img_w-1))
            y2s = max(0, min(int(y2), img_h-1))
            
            if y2s <= y1s or x2s <= x1s:
                continue
            
            # Check box center - must be on tissue
            cx, cy = (x1s + x2s) // 2, (y1s + y2s) // 2
            if not tissue_mask[cy, cx]:
                continue
            
            # Check tissue percentage in box - must be >50%
            box_mask = tissue_mask[y1s:y2s, x1s:x2s]
            if box_mask.size == 0:
                continue
            tissue_pct = np.sum(box_mask) / box_mask.size
            if tissue_pct < 0.5:
                continue
            
            filtered_boxes.append((x1, y1, x2, y2, conf))
        
        boxes = filtered_boxes
        
        if boxes:
            bbox_image = draw_bounding_boxes(original_image, boxes, box_color='#FF0000', line_width=4)
        else:
            bbox_image = original_image.copy()
        
        detailed_findings = extract_detailed_findings(heatmap, boxes, original_image.size, confidence)
        
        return heatmap, overlay_image, heatmap_only_image, bbox_image, None, detailed_findings
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, None, None, None, f"Error: {str(e)}", None
