/**
 * @fileoverview Image compression utilities for Sticker & Magnet Lab
 * Handles image validation, compression, and format conversion
 * @module utils/imageCompression
 */

import imageCompression from 'browser-image-compression';

/**
 * Maximum file size in MB for uploads (target just under 10MB)
 * @constant {number}
 */
const MAX_SIZE_MB = 9.99;

/**
 * Maximum width or height for images
 * @constant {number}
 */
const MAX_DIMENSION = 4096;

/**
 * Allowed image MIME types
 * @constant {string[]}
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif'
];

/**
 * Allowed PDF MIME type
 * @constant {string[]}
 */
export const ALLOWED_PDF_TYPES = [
  'application/pdf'
];

/**
 * All allowed file types
 * @constant {string[]}
 */
export const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_PDF_TYPES
];

/**
 * Allowed file extensions
 * @constant {string[]}
 */
export const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf'];

/**
 * Minimum resolution requirements by size (in pixels)
 * Based on 300 DPI for print quality
 * @constant {Object}
 */
export const MIN_RESOLUTIONS = {
  '2x2': { width: 600, height: 600 },
  '3x3': { width: 900, height: 900 },
  '4x4': { width: 1200, height: 1200 },
  '5x5': { width: 1500, height: 1500 },
  '6x6': { width: 1800, height: 1800 },
  '3x4': { width: 900, height: 1200 },
  '4x6': { width: 1200, height: 1800 },
  '5x7': { width: 1500, height: 2100 },
  '2x3': { width: 600, height: 900 },
  '2.5x3.5': { width: 750, height: 1050 },
  '4.75x2': { width: 1425, height: 600 },
  '2.5x2.5': { width: 750, height: 750 }
};

/**
 * Validation result type
 * @typedef {Object} ImageValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {string|null} error - Error message if invalid
 * @property {Object} [details] - Additional details about the image
 */

/**
 * Compress image if it exceeds maximum size
 * @param {File} file - Image file to compress
 * @param {Function} [onProgress] - Progress callback (0-100)
 * @returns {Promise<File>} Compressed file or original if already small enough
 * @example
 * const compressedFile = await compressImage(file, (progress) => {
 *   console.log(`Compression: ${progress}%`);
 * });
 */
export const compressImage = async (file, onProgress = null) => {
  // Check if compression is needed
  const maxSizeBytes = MAX_SIZE_MB * 1024 * 1024;

  if (file.size <= maxSizeBytes) {
    // File is already small enough
    if (onProgress) {
      onProgress(100);
    }
    return file;
  }

  const options = {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_DIMENSION,
    useWebWorker: true,
    onProgress: onProgress,
    fileType: file.type,
    // Preserve image quality as much as possible
    initialQuality: 0.9,
    // Maintain EXIF data
    preserveExif: false
  };

  try {
    let compressedFile = await imageCompression(file, options);

    // If still too large, try more aggressive compression
    if (compressedFile.size > maxSizeBytes) {
      const aggressiveOptions = {
        ...options,
        initialQuality: 0.8,
        maxWidthOrHeight: 3000
      };
      compressedFile = await imageCompression(file, aggressiveOptions);
    }

    // Ensure we return a File, not a Blob
    if (compressedFile instanceof Blob && !(compressedFile instanceof File)) {
      return new File([compressedFile], file.name, {
        type: compressedFile.type,
        lastModified: Date.now()
      });
    }

    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    throw new Error(`Failed to compress image: ${error.message}`);
  }
};

/**
 * Validate image file
 * @param {File} file - Image file to validate
 * @returns {ImageValidationResult} Validation result
 * @example
 * const result = validateImage(file);
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 */
export const validateImage = (file) => {
  if (!file) {
    return {
      isValid: false,
      error: 'Please select an image file'
    };
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: PNG, JPG, JPEG, WebP, GIF, PDF`
    };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));

  if (!hasValidExtension) {
    return {
      isValid: false,
      error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  // Check file size (warn if over 50MB, even though we can compress)
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > 50) {
    return {
      isValid: false,
      error: 'File is too large. Maximum size is 50MB'
    };
  }

  return {
    isValid: true,
    error: null,
    details: {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeMB: fileSizeMB.toFixed(2)
    }
  };
};

/**
 * Get image dimensions from file
 * @param {File} file - Image file
 * @returns {Promise<{width: number, height: number}>} Image dimensions
 * @example
 * const { width, height } = await getImageDimensions(file);
 */
export const getImageDimensions = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * Check if image meets minimum resolution for a size
 * @param {File} file - Image file
 * @param {string} size - Target size (e.g., '3x3')
 * @returns {Promise<ImageValidationResult>} Resolution check result
 * @example
 * const result = await checkMinResolution(file, '3x3');
 * if (!result.isValid) {
 *   console.warn(result.error);
 * }
 */
export const checkMinResolution = async (file, size) => {
  try {
    const dimensions = await getImageDimensions(file);
    const minRes = MIN_RESOLUTIONS[size];

    if (!minRes) {
      // Unknown size, skip resolution check
      return {
        isValid: true,
        error: null,
        details: dimensions
      };
    }

    // Check if image meets minimum resolution
    // Allow some flexibility - image can be oriented differently
    const meetsWidth = dimensions.width >= minRes.width || dimensions.width >= minRes.height;
    const meetsHeight = dimensions.height >= minRes.height || dimensions.height >= minRes.width;

    if (!meetsWidth || !meetsHeight) {
      return {
        isValid: false,
        error: `Image resolution (${dimensions.width}x${dimensions.height}) is below the recommended minimum (${minRes.width}x${minRes.height}) for size ${size}. This may result in a blurry print.`,
        details: {
          ...dimensions,
          minRequired: minRes,
          isWarning: true // This is a warning, not a hard error
        }
      };
    }

    return {
      isValid: true,
      error: null,
      details: dimensions
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to check image resolution: ${error.message}`
    };
  }
};

/**
 * Convert file to base64 string
 * @param {File} file - File to convert
 * @returns {Promise<string>} Base64 encoded string (without data URI prefix)
 * @example
 * const base64 = await fileToBase64(file);
 * // Returns: "iVBORw0KGgoAAAANSUhEUgAA..."
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      // Remove data URI prefix (e.g., "data:image/png;base64,")
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Convert file to base64 data URI
 * @param {File} file - File to convert
 * @returns {Promise<string>} Base64 data URI string
 * @example
 * const dataUri = await fileToDataUri(file);
 * // Returns: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 */
export const fileToDataUri = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Convert base64 string to File
 * @param {string} base64 - Base64 encoded string (with or without data URI prefix)
 * @param {string} filename - Desired filename
 * @param {string} [mimeType='image/png'] - MIME type
 * @returns {File} Converted file
 * @example
 * const file = base64ToFile(base64String, 'design.png', 'image/png');
 */
export const base64ToFile = (base64, filename, mimeType = 'image/png') => {
  // Handle data URI format
  let base64Data = base64;
  let detectedMimeType = mimeType;

  if (base64.includes(',')) {
    const parts = base64.split(',');
    const header = parts[0];
    base64Data = parts[1];

    // Extract MIME type from data URI
    const mimeMatch = header.match(/data:([^;]+);/);
    if (mimeMatch) {
      detectedMimeType = mimeMatch[1];
    }
  }

  // Decode base64
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: detectedMimeType });

  return new File([blob], filename, {
    type: detectedMimeType,
    lastModified: Date.now()
  });
};

/**
 * Generate thumbnail from image file
 * @param {File} file - Image file
 * @param {number} maxSize - Maximum width or height
 * @returns {Promise<string>} Data URI of thumbnail
 */
export const generateThumbnail = async (file, maxSize = 200) => {
  const dimensions = await getImageDimensions(file);

  // Calculate new dimensions maintaining aspect ratio
  let newWidth, newHeight;
  if (dimensions.width > dimensions.height) {
    newWidth = maxSize;
    newHeight = (dimensions.height / dimensions.width) * maxSize;
  } else {
    newHeight = maxSize;
    newWidth = (dimensions.width / dimensions.height) * maxSize;
  }

  // Create canvas and draw resized image
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext('2d');
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to generate thumbnail'));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Get file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Human-readable file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Check if file needs compression
 * @param {File} file - File to check
 * @returns {boolean} True if file needs compression
 */
export const needsCompression = (file) => {
  return file.size > MAX_SIZE_MB * 1024 * 1024;
};

/**
 * Check if file type is a valid image
 * @param {File} file - File to check
 * @returns {boolean} True if valid image type
 */
export const isValidImageType = (file) => {
  return ALLOWED_IMAGE_TYPES.includes(file.type);
};

/**
 * Check if file type is a valid PDF
 * @param {File} file - File to check
 * @returns {boolean} True if valid PDF type
 */
export const isValidPDFType = (file) => {
  return ALLOWED_PDF_TYPES.includes(file.type);
};

/**
 * Check if file type is allowed
 * @param {File} file - File to check
 * @returns {boolean} True if valid file type
 */
export const isValidFileType = (file) => {
  return ALLOWED_FILE_TYPES.includes(file.type);
};

/**
 * Convert PDF to image using PDF-lib and canvas
 * @param {File} pdfFile - PDF file to convert
 * @param {number} [pageNumber=1] - Page number to convert (1-based)
 * @param {number} [scale=2] - Scale factor for rendering
 * @returns {Promise<File>} Converted image file
 */
export const convertPDFToImage = async (pdfFile, pageNumber = 1, scale = 2) => {
  try {
    // Dynamic import of PDF.js for better tree-shaking
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.js';

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    if (pageNumber > pdf.numPages) {
      throw new Error(`Page ${pageNumber} does not exist. PDF has ${pdf.numPages} pages.`);
    }
    
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Convert canvas to blob
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/png', 0.95);
    });
    
    // Create file from blob
    const fileName = pdfFile.name.replace(/\.pdf$/i, '.png');
    return new File([blob], fileName, { type: 'image/png' });
    
  } catch (error) {
    console.error('PDF to image conversion failed:', error);
    throw new Error(`Failed to convert PDF: ${error.message}`);
  }
};

/**
 * Compress PDF file by converting to image and then compressing
 * @param {File} pdfFile - PDF file to compress
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<File>} Compressed file
 */
export const compressPDF = async (pdfFile, onProgress = null) => {
  try {
    if (onProgress) onProgress(10);
    
    // Convert PDF to image first
    const imageFile = await convertPDFToImage(pdfFile);
    if (onProgress) onProgress(50);
    
    // Compress the converted image
    const compressedFile = await compressImage(imageFile, (progress) => {
      if (onProgress) onProgress(50 + (progress * 0.5));
    });
    
    return compressedFile;
  } catch (error) {
    console.error('PDF compression failed:', error);
    throw error;
  }
};

/**
 * Calculate DPI based on image dimensions and print size
 * @param {number} imageWidth - Image width in pixels
 * @param {number} imageHeight - Image height in pixels
 * @param {number} printWidth - Print width in inches
 * @param {number} printHeight - Print height in inches
 * @returns {number} Estimated DPI (uses the lower of width/height DPI)
 */
export const calculateDPI = (imageWidth, imageHeight, printWidth, printHeight) => {
  const dpiWidth = imageWidth / printWidth;
  const dpiHeight = imageHeight / printHeight;
  return Math.min(dpiWidth, dpiHeight);
};

/**
 * Get quality indicator based on DPI
 * Adjusted thresholds: 180+ DPI is considered good since designers can enhance
 * @param {number} dpi - The calculated DPI
 * @param {number} [fileSize=0] - File size in bytes (larger files = better quality data)
 * @returns {{level: string, color: string, message: string}} Quality indicator
 */
export const getQualityIndicator = (dpi, fileSize = 0) => {
  const fileSizeMB = fileSize / (1024 * 1024);

  // If file is large (5MB+) and DPI is decent (180+), designers can work with it
  const hasGoodSourceData = fileSizeMB >= 5;

  if (dpi >= 300) {
    return {
      level: 'excellent',
      color: 'green',
      message: 'Excellent quality - Print will be crisp and clear'
    };
  } else if (dpi >= 200 || (dpi >= 180 && hasGoodSourceData)) {
    return {
      level: 'good',
      color: 'blue',
      message: 'Good quality - Print will look great'
    };
  } else if (dpi >= 150) {
    return {
      level: 'good',
      color: 'blue',
      message: 'Good quality - Our designers will optimize for best results'
    };
  } else if (dpi >= 100) {
    return {
      level: 'acceptable',
      color: 'yellow',
      message: 'Acceptable quality - May need enhancement for large prints'
    };
  } else {
    return {
      level: 'low',
      color: 'red',
      message: 'Low resolution - Consider using a higher resolution image'
    };
  }
};

export default {
  compressImage,
  validateImage,
  getImageDimensions,
  checkMinResolution,
  fileToBase64,
  fileToDataUri,
  base64ToFile,
  generateThumbnail,
  formatFileSize,
  needsCompression,
  isValidImageType,
  isValidPDFType,
  isValidFileType,
  convertPDFToImage,
  compressPDF,
  calculateDPI,
  getQualityIndicator,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_PDF_TYPES,
  ALLOWED_FILE_TYPES,
  ALLOWED_EXTENSIONS,
  MIN_RESOLUTIONS,
  MAX_SIZE_MB,
  MAX_DIMENSION
};
