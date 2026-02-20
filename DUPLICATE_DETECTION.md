# Duplicate Image Detection System

## Overview
Your mammogram analysis system now prevents duplicate images from being analyzed. This ensures that the same image isn't processed multiple times, which could skew results or waste computational resources.

## How It Works

### Frontend Detection (Client-Side)
**File:** `frontend/src/utils/imageHash.js`

The frontend uses two hashing methods to detect duplicates:

1. **File Hash (SHA-256)**: Detects exact duplicates
   - Compares the raw file bytes
   - Catches identical files with different names
   - Fastest method

2. **Perceptual Hash**: Detects similar images
   - Resizes image to 8x8 pixels
   - Converts to grayscale
   - Creates a 64-bit hash based on pixel brightness
   - Catches the same image saved with different compression levels
   - Threshold: Images with Hamming distance ≤ 5 are considered duplicates

**When it triggers:**
- When user selects files via file picker
- When user drags and drops files
- Checks against all previously uploaded files in the current session

**User feedback:**
- Error message shows which files were rejected and why
- Message disappears after 5 seconds
- Non-duplicate files are still processed normally

### Backend Detection (Server-Side)
**File:** `backend/duplicate_detector.py`

The backend maintains a session-based duplicate cache:

1. **Exact File Hash Check**: Compares SHA-256 hashes
2. **Perceptual Hash Check**: Compares 64-bit perceptual hashes
3. **Hamming Distance**: Calculates similarity (0-64 bits)

**When it triggers:**
- When `/analyze` endpoint receives an image
- Checks against all images analyzed in the current session
- Returns 400 error with descriptive message if duplicate found

**Error Response Example:**
```json
{
  "detail": "❌ Exact duplicate detected: This image matches 'mammogram_1.jpg'. Please upload a different mammogram."
}
```

### Session Management

**Clear Duplicates Endpoint:** `POST /clear-duplicates`
- Clears the backend's duplicate cache
- Called automatically when user clicks "Clear All Files"
- Useful when starting a new analysis session

## Integration Points

### Frontend (`frontend/src/AppContent.js`)
```javascript
// Import the hashing utilities
import { getFileHash, getPerceptualHash, hammingDistance } from "./utils/imageHash";

// Updated handleFileChange function:
// - Checks each new file against existing files
// - Shows error for duplicates
// - Only adds non-duplicate files to the list

// Updated clearAllFiles function:
// - Clears frontend state
// - Calls backend /clear-duplicates endpoint
```

### Backend (`backend/main.py`)
```python
# Import the duplicate detector
from duplicate_detector import duplicate_detector

# In /analyze endpoint:
# - Checks image before validation
# - Returns 400 error if duplicate found
# - Stores hash for future comparisons

# New /clear-duplicates endpoint:
# - Resets the duplicate cache
# - Called when starting new session
```

## User Experience

### Scenario 1: Exact Duplicate
```
User uploads: image1.jpg (1-030.jpg)
User uploads: image3.jpg (1-030.jpg) ← Same file, different name

Result: ❌ Rejected
Message: "Exact duplicate detected: This image matches 'image1.jpg'. Please upload a different mammogram."
```

### Scenario 2: Similar Images (Different Compression)
```
User uploads: mammogram_original.jpg
User uploads: mammogram_compressed.jpg ← Same image, re-saved with different compression

Result: ❌ Rejected
Message: "Duplicate detected: This image is very similar to 'mammogram_original.jpg' (similarity: 63/64). Please upload a different mammogram."
```

### Scenario 3: Different Images
```
User uploads: left_breast.jpg
User uploads: right_breast.jpg ← Different images

Result: ✅ Accepted
Both images are analyzed normally
```

## Technical Details

### Perceptual Hash Algorithm
1. Resize image to 8×8 pixels (64 pixels total)
2. Convert to grayscale
3. Calculate average brightness
4. For each pixel: 1 if brighter than average, 0 otherwise
5. Convert 64-bit binary to hexadecimal

### Hamming Distance
- Counts the number of differing bits between two hashes
- Range: 0-64 (for 64-bit hashes)
- Threshold: ≤ 5 bits difference = duplicate
- This allows for minor compression artifacts

### Performance
- **File Hash**: ~1-5ms per image (depends on file size)
- **Perceptual Hash**: ~50-200ms per image (image processing)
- **Total per file**: ~100-300ms for full duplicate check

## Configuration

### Sensitivity Adjustment
To change duplicate detection sensitivity, edit `backend/duplicate_detector.py`:

```python
# Current threshold (line ~95)
if distance <= 5:  # Change this number
    # 0-2: Very strict (only nearly identical images)
    # 3-5: Strict (catches most duplicates)
    # 6-10: Loose (may miss some duplicates)
    # 10+: Very loose (may have false positives)
```

## Limitations

1. **Session-based**: Duplicates are only tracked within a single analysis session
   - Clearing browser cache or restarting server resets the cache
   - Solution: Use database storage for persistent duplicate tracking

2. **Perceptual hash limitations**:
   - May not catch heavily edited images
   - May not catch images rotated/flipped
   - Works best for identical or minimally compressed duplicates

3. **Performance**:
   - Checking many files against many existing files can be slow
   - O(n²) complexity for n files
   - Solution: Use database indexing for large-scale deployments

## Future Enhancements

1. **Persistent Storage**: Store hashes in database for cross-session duplicate detection
2. **Advanced Hashing**: Implement SIFT/SURF for rotation/flip detection
3. **Batch Processing**: Optimize for large file uploads
4. **User Notifications**: Show duplicate detection progress for multiple files
5. **Duplicate Management**: Allow users to view and manage detected duplicates

## Testing

### Test Case 1: Exact Duplicate
```bash
# Upload same file twice
curl -X POST http://localhost:8001/analyze \
  -F "file=@mammogram.jpg"
# First: Success
# Second: 400 error - "Exact duplicate detected"
```

### Test Case 2: Perceptual Duplicate
```bash
# Save image with different compression
# Upload both versions
# Result: 400 error - "Duplicate detected"
```

### Test Case 3: Clear Cache
```bash
# Upload image1.jpg
# Call /clear-duplicates
# Upload image1.jpg again
# Result: Success (cache was cleared)
```

## Troubleshooting

### Issue: False Positives (Different images marked as duplicates)
- **Cause**: Perceptual hash threshold too loose
- **Solution**: Reduce threshold in `duplicate_detector.py` (change `<= 5` to `<= 3`)

### Issue: False Negatives (Duplicates not detected)
- **Cause**: Perceptual hash threshold too strict
- **Solution**: Increase threshold (change `<= 5` to `<= 8`)

### Issue: Slow duplicate checking
- **Cause**: Checking many files against many existing files
- **Solution**: Clear cache periodically or implement database indexing

## References

- SHA-256: Cryptographic hash function
- Perceptual Hash: Image similarity detection
- Hamming Distance: Bit-level similarity metric
