import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { fabric } from 'fabric';
import { motion } from 'framer-motion';

/**
 * ImageCanvas - Main Fabric.js canvas component for image editing
 *
 * ENHANCED VERSION - Robust image persistence across all property changes
 *
 * Features:
 * - Dynamic sizing based on product dimensions
 * - ROBUST image persistence (survives shape/size/qty changes)
 * - Smart auto-fit for uploaded images
 * - Drag/pan within bounds with visible handles
 * - Scale control (0.1x to 5x)
 * - Rotate control (0, 90, 180, 270 degrees)
 * - Safe print area visualization
 * - Touch gesture support
 * - Responsive design for mobile and desktop
 */
const ImageCanvas = forwardRef(({
  productSize = { width: 5, height: 5 },
  imageDataUrl,
  scale = 1,
  rotation = 0,
  showGrid = false,
  shape = 'square',
  onCanvasReady,
  onImageLoaded,
  className = ''
}, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const imageObjRef = useRef(null);

  // Store the current image data URL to detect actual image changes
  const currentImageUrlRef = useRef(null);

  // Store image transform state to preserve position/scale across canvas rebuilds
  const imageTransformRef = useRef({
    scaleX: null,
    scaleY: null,
    left: null,
    top: null,
    angle: 0,
    initialized: false
  });

  const [isReady, setIsReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Memoize product aspect ratio to avoid recalculation
  const aspectRatio = useMemo(() =>
    productSize.width / productSize.height,
    [productSize.width, productSize.height]
  );

  // Calculate canvas size based on container and product aspect ratio
  const calculateCanvasSize = useCallback(() => {
    if (!containerRef.current) return { width: 400, height: 400 };

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 16; // Minimal padding
    const containerHeight = container.clientHeight - 16;

    let width, height;

    if (aspectRatio >= 1) {
      // Wider than tall
      width = Math.min(containerWidth, containerHeight * aspectRatio);
      height = width / aspectRatio;
    } else {
      // Taller than wide
      height = Math.min(containerHeight, containerWidth / aspectRatio);
      width = height * aspectRatio;
    }

    // Ensure reasonable size bounds
    width = Math.max(280, Math.min(width, 700));
    height = Math.max(280, Math.min(height, 700));

    return { width: Math.round(width), height: Math.round(height) };
  }, [aspectRatio]);

  // Initialize canvas ONCE on mount
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    const size = calculateCanvasSize();
    setCanvasSize(size);

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: size.width,
      height: size.height,
      backgroundColor: 'transparent',
      selection: false,
      preserveObjectStacking: true,
      renderOnAddRemove: true,
      allowTouchScrolling: true
    });

    fabricCanvasRef.current = canvas;
    setIsReady(true);

    if (onCanvasReady) {
      onCanvasReady(canvas);
    }

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
      imageObjRef.current = null;
      currentImageUrlRef.current = null;
    };
  }, []); // Empty deps - only run once on mount

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!fabricCanvasRef.current || !containerRef.current) return;

      const newSize = calculateCanvasSize();
      setCanvasSize(newSize);
      fabricCanvasRef.current.setDimensions(newSize);

      // Re-center image if it exists
      if (imageObjRef.current) {
        const img = imageObjRef.current;
        const canvas = fabricCanvasRef.current;

        // Keep image centered
        img.set({
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2
        });
        img.setCoords();
      }

      // Redraw safe area and grid
      drawSafeArea();
      if (showGrid) drawGrid();

      fabricCanvasRef.current.renderAll();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateCanvasSize, showGrid]);

  // Update canvas size when product dimensions change (without recreating canvas)
  useEffect(() => {
    if (!fabricCanvasRef.current || !isReady) return;

    const canvas = fabricCanvasRef.current;
    const newSize = calculateCanvasSize();

    // Only update if size actually changed
    if (newSize.width !== canvasSize.width || newSize.height !== canvasSize.height) {
      setCanvasSize(newSize);
      canvas.setDimensions(newSize);

      // Re-center and scale image proportionally if exists
      if (imageObjRef.current) {
        const img = imageObjRef.current;

        // Keep image centered at new canvas center
        img.set({
          left: newSize.width / 2,
          top: newSize.height / 2
        });
        img.setCoords();
      }

      // Redraw overlays
      drawSafeArea();
      if (showGrid) drawGrid();

      canvas.renderAll();
    }
  }, [productSize.width, productSize.height, isReady]);

  // Center image helper
  const centerImage = useCallback((imgObj) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !imgObj) return;

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    imgObj.set({
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      originX: 'center',
      originY: 'center'
    });

    imgObj.setCoords();
  }, []);

  // Fit image to canvas with proper scaling
  const fitImageToCanvas = useCallback((imgObj, shouldSave = true) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !imgObj) return;

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    // Calculate scale to fill canvas while maintaining aspect ratio
    const imgWidth = imgObj.width;
    const imgHeight = imgObj.height;

    const scaleX = (canvasWidth * 0.92) / imgWidth;
    const scaleY = (canvasHeight * 0.92) / imgHeight;
    const fitScale = Math.min(scaleX, scaleY);

    imgObj.set({
      scaleX: fitScale,
      scaleY: fitScale,
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      originX: 'center',
      originY: 'center'
    });

    imgObj.setCoords();

    // Save transform state
    if (shouldSave) {
      imageTransformRef.current = {
        scaleX: fitScale,
        scaleY: fitScale,
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        angle: imgObj.angle || 0,
        initialized: true
      };
    }
  }, []);

  // Constrain image position to keep it visible
  const constrainImagePosition = useCallback((img) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !img) return;

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    const imgWidth = img.getScaledWidth();
    const imgHeight = img.getScaledHeight();

    // Ensure at least 25% of image stays visible
    const minOverlap = 0.25;
    const minVisibleX = imgWidth * minOverlap;
    const minVisibleY = imgHeight * minOverlap;

    // Calculate bounds for center-positioned objects
    const minLeft = minVisibleX - (imgWidth / 2);
    const maxLeft = canvasWidth - minVisibleX + (imgWidth / 2);
    const minTop = minVisibleY - (imgHeight / 2);
    const maxTop = canvasHeight - minVisibleY + (imgHeight / 2);

    let newLeft = img.left;
    let newTop = img.top;

    if (img.left < minLeft) newLeft = minLeft;
    if (img.left > maxLeft) newLeft = maxLeft;
    if (img.top < minTop) newTop = minTop;
    if (img.top > maxTop) newTop = maxTop;

    if (newLeft !== img.left || newTop !== img.top) {
      img.set({ left: newLeft, top: newTop });
      img.setCoords();
    }
  }, []);

  // Save current image transform state
  const saveImageTransform = useCallback(() => {
    if (imageObjRef.current) {
      const img = imageObjRef.current;
      imageTransformRef.current = {
        scaleX: img.scaleX,
        scaleY: img.scaleY,
        left: img.left,
        top: img.top,
        angle: img.angle || 0,
        initialized: true
      };
    }
  }, []);

  // Load image onto canvas - only when imageDataUrl ACTUALLY changes
  useEffect(() => {
    if (!fabricCanvasRef.current || !isReady) return;

    // Check if this is actually a new image
    const isNewImage = imageDataUrl !== currentImageUrlRef.current;

    if (!imageDataUrl) {
      // Clear image if URL is removed
      if (imageObjRef.current) {
        fabricCanvasRef.current.remove(imageObjRef.current);
        imageObjRef.current = null;
        currentImageUrlRef.current = null;
        imageTransformRef.current.initialized = false;
        setIsImageLoaded(false);
      }
      return;
    }

    // Only load if it's actually a new image
    if (!isNewImage && imageObjRef.current) {
      return; // Image already loaded, no need to reload
    }

    const canvas = fabricCanvasRef.current;

    // Remove existing image
    if (imageObjRef.current) {
      canvas.remove(imageObjRef.current);
      imageObjRef.current = null;
    }

    // Store new URL reference
    currentImageUrlRef.current = imageDataUrl;

    fabric.Image.fromURL(imageDataUrl, (img) => {
      if (!fabricCanvasRef.current) return; // Canvas was disposed

      // Configure image object with proper controls
      img.set({
        selectable: true,
        hasControls: true,
        hasBorders: true,
        hasRotatingPoint: false,
        lockRotation: true,
        originX: 'center',
        originY: 'center',
        // Enhanced corner controls for better visibility
        cornerSize: 14,
        cornerColor: '#3A6EA5',
        cornerStrokeColor: '#ffffff',
        borderColor: '#3A6EA5',
        borderScaleFactor: 2.5,
        transparentCorners: false,
        cornerStyle: 'circle',
        padding: 8,
        // Make sure controls are always visible
        borderOpacityWhenMoving: 0.8
      });

      // Fit image to canvas on initial load
      fitImageToCanvas(img);

      // Add to canvas
      canvas.add(img);
      canvas.setActiveObject(img);
      imageObjRef.current = img;
      setIsImageLoaded(true);

      // Set up event handlers for drag and scale
      img.on('moving', () => {
        constrainImagePosition(img);
        saveImageTransform();
      });

      img.on('scaling', () => {
        // Constrain scale
        const minScale = 0.05;
        const maxScale = 8.0;

        if (img.scaleX < minScale) {
          img.set({ scaleX: minScale, scaleY: minScale });
        }
        if (img.scaleX > maxScale) {
          img.set({ scaleX: maxScale, scaleY: maxScale });
        }

        img.setCoords();
        saveImageTransform();
      });

      img.on('scaled', () => {
        constrainImagePosition(img);
        saveImageTransform();
        canvas.renderAll();
      });

      img.on('modified', () => {
        saveImageTransform();
      });

      // Redraw overlays to ensure proper layering
      drawSafeArea();
      if (showGrid) drawGrid();

      canvas.renderAll();

      if (onImageLoaded) {
        onImageLoaded(img);
      }
    }, { crossOrigin: 'anonymous' });
  }, [imageDataUrl, isReady, fitImageToCanvas, constrainImagePosition, onImageLoaded, showGrid, saveImageTransform]);

  // Apply scale changes from parent
  useEffect(() => {
    if (!imageObjRef.current || !fabricCanvasRef.current || !isReady) return;

    const img = imageObjRef.current;
    const canvas = fabricCanvasRef.current;

    // Calculate base scale to fit canvas
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    const scaleX = (canvasWidth * 0.92) / img.width;
    const scaleY = (canvasHeight * 0.92) / img.height;
    const baseScale = Math.min(scaleX, scaleY);

    // Apply user scale multiplier
    const finalScale = baseScale * scale;

    img.set({
      scaleX: finalScale,
      scaleY: finalScale
    });

    img.setCoords();
    saveImageTransform();
    canvas.renderAll();
  }, [scale, isReady, saveImageTransform]);

  // Apply rotation changes from parent
  useEffect(() => {
    if (!imageObjRef.current || !fabricCanvasRef.current || !isReady) return;

    const img = imageObjRef.current;
    img.set({ angle: rotation });
    img.setCoords();

    imageTransformRef.current.angle = rotation;
    fabricCanvasRef.current.renderAll();
  }, [rotation, isReady]);

  // Draw safe print area border
  const drawSafeArea = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove existing safe area indicators
    const existingIndicators = canvas.getObjects().filter(obj =>
      obj.name === 'safeArea' || obj.name === 'printArea' || obj.name === 'safeAreaText' || obj.name === 'shapeIndicator'
    );
    existingIndicators.forEach(obj => canvas.remove(obj));

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    // Create print area indicator (entire canvas boundary)
    let printArea;
    if (shape === 'round') {
      const radius = Math.min(canvasWidth, canvasHeight) / 2;
      printArea = new fabric.Circle({
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        radius: radius - 3,
        fill: 'transparent',
        stroke: '#d1d5db',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        name: 'printArea',
        originX: 'center',
        originY: 'center'
      });
    } else {
      printArea = new fabric.Rect({
        left: 3,
        top: 3,
        width: canvasWidth - 6,
        height: canvasHeight - 6,
        fill: 'transparent',
        stroke: '#d1d5db',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        name: 'printArea'
      });
    }

    // Create safe area visualization (8% margin from edges)
    const margin = 0.08;
    let safeArea;
    if (shape === 'round') {
      const radius = Math.min(canvasWidth, canvasHeight) / 2;
      const safeRadius = radius * (1 - margin);
      safeArea = new fabric.Circle({
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        radius: safeRadius,
        fill: 'transparent',
        stroke: '#22c55e',
        strokeWidth: 2,
        strokeDashArray: [10, 5],
        selectable: false,
        evented: false,
        name: 'safeArea',
        originX: 'center',
        originY: 'center'
      });
    } else if (shape === 'custom') {
      // For custom die-cut, show a slightly inset rectangle with dashed line
      safeArea = new fabric.Rect({
        left: canvasWidth * margin,
        top: canvasHeight * margin,
        width: canvasWidth * (1 - 2 * margin),
        height: canvasHeight * (1 - 2 * margin),
        fill: 'transparent',
        stroke: '#f59e0b',
        strokeWidth: 2,
        strokeDashArray: [10, 5],
        selectable: false,
        evented: false,
        name: 'safeArea'
      });
    } else {
      safeArea = new fabric.Rect({
        left: canvasWidth * margin,
        top: canvasHeight * margin,
        width: canvasWidth * (1 - 2 * margin),
        height: canvasHeight * (1 - 2 * margin),
        fill: 'transparent',
        stroke: '#22c55e',
        strokeWidth: 2,
        strokeDashArray: [10, 5],
        selectable: false,
        evented: false,
        name: 'safeArea'
      });
    }

    // Add helper text
    const labelText = shape === 'custom'
      ? 'Design Area'
      : 'Safe Zone';
    const labelColor = shape === 'custom' ? '#f59e0b' : '#22c55e';

    const safeAreaText = new fabric.Text(labelText, {
      left: canvasWidth / 2,
      top: shape === 'round' ? canvasHeight * 0.88 : canvasHeight * 0.94,
      fontSize: 11,
      fill: labelColor,
      fontWeight: 'bold',
      textAlign: 'center',
      selectable: false,
      evented: false,
      name: 'safeAreaText',
      originX: 'center',
      originY: 'center',
      backgroundColor: 'rgba(255,255,255,0.9)',
      padding: 4
    });

    // Add elements to canvas
    canvas.add(printArea);
    canvas.add(safeArea);
    canvas.add(safeAreaText);

    // Send indicators to back
    canvas.sendToBack(safeAreaText);
    canvas.sendToBack(safeArea);
    canvas.sendToBack(printArea);

    // Bring image to front if it exists
    if (imageObjRef.current) {
      canvas.bringToFront(imageObjRef.current);
    }

    canvas.renderAll();
  }, [shape]);

  // Update safe area when shape changes
  useEffect(() => {
    if (isReady && fabricCanvasRef.current) {
      drawSafeArea();
    }
  }, [isReady, shape, canvasSize, drawSafeArea]);

  // Draw grid overlay
  const drawGrid = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove existing grid
    const existingGrid = canvas.getObjects().filter(obj => obj.name === 'gridLine');
    existingGrid.forEach(obj => canvas.remove(obj));

    const gridSize = 40;
    const width = canvas.getWidth();
    const height = canvas.getHeight();

    // Vertical lines
    for (let x = gridSize; x < width; x += gridSize) {
      const line = new fabric.Line([x, 0, x, height], {
        stroke: 'rgba(0,0,0,0.08)',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        name: 'gridLine'
      });
      canvas.add(line);
      canvas.sendToBack(line);
    }

    // Horizontal lines
    for (let y = gridSize; y < height; y += gridSize) {
      const line = new fabric.Line([0, y, width, y], {
        stroke: 'rgba(0,0,0,0.08)',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        name: 'gridLine'
      });
      canvas.add(line);
      canvas.sendToBack(line);
    }

    // Bring image to front if it exists
    if (imageObjRef.current) {
      canvas.bringToFront(imageObjRef.current);
    }

    canvas.renderAll();
  }, []);

  // Handle grid toggle
  useEffect(() => {
    if (!fabricCanvasRef.current || !isReady) return;

    const canvas = fabricCanvasRef.current;

    // Remove existing grid
    const existingGrid = canvas.getObjects().filter(obj => obj.name === 'gridLine');
    existingGrid.forEach(obj => canvas.remove(obj));

    if (showGrid) {
      drawGrid();
    }

    canvas.renderAll();
  }, [showGrid, isReady, canvasSize, drawGrid]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getCanvas: () => fabricCanvasRef.current,
    getImage: () => imageObjRef.current,
    reset: () => {
      if (imageObjRef.current && fabricCanvasRef.current) {
        fitImageToCanvas(imageObjRef.current);
        imageObjRef.current.set({ angle: 0 });
        imageObjRef.current.setCoords();
        fabricCanvasRef.current.renderAll();
      }
    },
    fitToCanvas: () => {
      if (imageObjRef.current && fabricCanvasRef.current) {
        fitImageToCanvas(imageObjRef.current);
        fabricCanvasRef.current.renderAll();
      }
    },
    exportAsDataURL: (multiplier = 2) => {
      return fabricCanvasRef.current?.toDataURL({
        format: 'png',
        quality: 1,
        multiplier
      });
    }
  }), [fitImageToCanvas]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative flex items-center justify-center w-full min-h-[380px] md:min-h-[420px] p-2 ${className}`}
    >
      {/* Checkered background to show transparency */}
      <div
        className="absolute inset-2 rounded-xl"
        style={{
          backgroundImage: `
            linear-gradient(45deg, #f3f4f6 25%, transparent 25%),
            linear-gradient(-45deg, #f3f4f6 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #f3f4f6 75%),
            linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)
          `,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
        }}
      />

      {/* Canvas container */}
      <div
        className="relative bg-white rounded-xl shadow-lg overflow-visible"
        style={{
          width: canvasSize.width,
          height: canvasSize.height
        }}
      >
        <canvas ref={canvasRef} id="editor-canvas" />

        {/* Size indicator */}
        <div className="absolute bottom-2 right-2 bg-graphite/80 text-white text-xs px-2.5 py-1 rounded-md font-medium">
          {productSize.width}" × {productSize.height}"
        </div>

        {/* Shape indicator */}
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-graphite text-xs px-2.5 py-1 rounded-md font-medium border border-gray-200 flex items-center gap-1.5">
          {shape === 'round' && (
            <>
              <div className="w-3 h-3 rounded-full border-2 border-cool-blue" />
              <span>Round</span>
            </>
          )}
          {shape === 'square' && (
            <>
              <div className="w-3 h-3 rounded-sm border-2 border-cool-blue" />
              <span>Square</span>
            </>
          )}
          {shape === 'custom' && (
            <>
              <div className="w-3 h-3 border-2 border-amber-500 rounded-sm" style={{ borderRadius: '30% 70% 50% 50%' }} />
              <span>Custom Shape</span>
            </>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-cool-blue border-t-transparent" />
        </div>
      )}

      {/* No image placeholder */}
      {isReady && !isImageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400 p-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium">Upload your design</p>
            <p className="text-xs mt-1">Drag & drop or click to browse</p>
          </div>
        </div>
      )}
    </motion.div>
  );
});

ImageCanvas.displayName = 'ImageCanvas';

export default ImageCanvas;
