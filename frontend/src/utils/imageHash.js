/**
 * Image hashing utilities for duplicate detection
 * Uses both file hash (for exact duplicates) and perceptual hash (for similar images)
 */

/**
 * Generate SHA-256 hash of file content
 * @param {File} file - The file to hash
 * @returns {Promise<string>} - Hex string of the hash
 */
export async function getFileHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate perceptual hash of image (for detecting similar images)
 * Uses a simple approach: resize image to 8x8, convert to grayscale, compute hash
 * @param {File} file - The image file
 * @returns {Promise<string>} - Hex string of the perceptual hash
 */
export async function getPerceptualHash(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas and resize to 8x8
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 8, 8);
        
        // Get pixel data and convert to grayscale
        const imageData = ctx.getImageData(0, 0, 8, 8);
        const data = imageData.data;
        
        let hash = '';
        for (let i = 0; i < data.length; i += 4) {
          // Convert RGB to grayscale
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          // Average gray value is ~127.5, so use that as threshold
          hash += gray > 127.5 ? '1' : '0';
        }
        
        // Convert binary string to hex
        const hexHash = parseInt(hash, 2).toString(16).padStart(16, '0');
        resolve(hexHash);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Calculate Hamming distance between two hex hashes
 * Lower distance = more similar images
 * @param {string} hash1 - First hash (hex string)
 * @param {string} hash2 - Second hash (hex string)
 * @returns {number} - Hamming distance (0-64 for 64-bit hashes)
 */
export function hammingDistance(hash1, hash2) {
  if (hash1.length !== hash2.length) return Infinity;
  
  // Convert hex to binary and count differing bits
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const bit1 = parseInt(hash1[i], 16).toString(2).padStart(4, '0');
    const bit2 = parseInt(hash2[i], 16).toString(2).padStart(4, '0');
    
    for (let j = 0; j < 4; j++) {
      if (bit1[j] !== bit2[j]) distance++;
    }
  }
  return distance;
}

/**
 * Check if two images are duplicates
 * @param {File} file1 - First image file
 * @param {File} file2 - Second image file
 * @returns {Promise<{isDuplicate: boolean, reason: string}>}
 */
export async function areDuplicateImages(file1, file2) {
  try {
    // First check: exact file hash (fastest)
    const hash1 = await getFileHash(file1);
    const hash2 = await getFileHash(file2);
    
    if (hash1 === hash2) {
      return {
        isDuplicate: true,
        reason: 'Exact duplicate (identical file content)'
      };
    }
    
    // Second check: perceptual hash (catches similar images)
    const pHash1 = await getPerceptualHash(file1);
    const pHash2 = await getPerceptualHash(file2);
    
    const distance = hammingDistance(pHash1, pHash2);
    
    // Threshold: distance <= 5 means very similar (same image, possibly compressed differently)
    if (distance <= 5) {
      return {
        isDuplicate: true,
        reason: `Very similar image (perceptual similarity: ${distance}/64)`
      };
    }
    
    return {
      isDuplicate: false,
      reason: 'Different images'
    };
  } catch (error) {
    console.error('Error comparing images:', error);
    return {
      isDuplicate: false,
      reason: 'Could not compare (error)'
    };
  }
}
