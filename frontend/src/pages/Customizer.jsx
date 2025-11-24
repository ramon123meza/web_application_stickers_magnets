import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  ShoppingCart,
  Upload,
  Info,
  CheckCircle,
  AlertCircle,
  FileImage,
  Lightbulb,
  Download,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';

import {
  ImageCanvas,
  UploadZone,
  CanvasControls,
  ProductTypeTabs,
  SizeQuantitySelector,
  PriceDisplay,
  InstructionsInput
} from '../components/editor';

import { useImageUpload } from '../hooks/useImageUpload';
import { downloadCanvas } from '../utils/canvasExport';
import { useCartStore } from '../contexts/CartContext';
import { api } from '../services/api';
import { getSessionId } from '../utils/session';
import logger, { orderLogger, canvasLogger, uploadLogger } from '../utils/logger';
import {
  PRODUCT_TYPES,
  getAvailableSizes,
  getPrice,
  getPerUnitPrice,
  parseSizeDimensions
} from '../data/pricingData';

/**
 * Customizer - Main customizer page with 3-panel layout
 *
 * This is the CORE feature where users design their stickers/magnets.
 *
 * Layout:
 * - Left Panel (30%): Product options, pricing, add to cart
 * - Center Panel (50%): Canvas editor
 * - Right Panel (20%): Upload, quality info, tips
 */
export default function Customizer() {
  // Product configuration state
  const [productType, setProductType] = useState(PRODUCT_TYPES.STICKERS);
  const [selectedSize, setSelectedSize] = useState('5x5');
  const [selectedQuantity, setSelectedQuantity] = useState(50);
  const [instructions, setInstructions] = useState('');

  // Canvas state
  const [shape, setShape] = useState('square');
  const [rotation, setRotation] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const canvasRef = useRef(null);

  // Image upload hook
  const {
    imageDataUrl,
    imageFile,
    isLoading: isUploading,
    uploadProgress,
    error: uploadError,
    qualityInfo,
    hasImage,
    handleFileSelect,
    recalculateQuality,
    clearImage
  } = useImageUpload();

  // UI state
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [showMobileOptions, setShowMobileOptions] = useState(false);

  // Get product dimensions for canvas
  const productDimensions = parseSizeDimensions(selectedSize);

  // Handle product type change
  const handleProductTypeChange = useCallback((type) => {
    setProductType(type);
    // Reset to first available size for new product type
    const sizes = getAvailableSizes(type);
    if (sizes.length > 0 && !sizes.includes(selectedSize)) {
      setSelectedSize(sizes[0]);
    }
  }, [selectedSize]);

  // Handle size change
  const handleSizeChange = useCallback((size) => {
    setSelectedSize(size);
    // Recalculate quality for new print size
    const dims = parseSizeDimensions(size);
    recalculateQuality(dims);
  }, [recalculateQuality]);

  // Handle file upload
  const handleFileUpload = useCallback((file) => {
    handleFileSelect(file, productDimensions);
  }, [handleFileSelect, productDimensions]);

  // Reset canvas controls
  const handleReset = useCallback(() => {
    setRotation(0);
    canvasRef.current?.reset();
  }, []);

  // Fit image to canvas
  const handleFitToCanvas = useCallback(() => {
    canvasRef.current?.fitToCanvas();
  }, []);

  // Download preview
  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas();
    if (canvas) {
      downloadCanvas(canvas, `${productType}-${selectedSize}-preview.png`);
    }
  }, [productType, selectedSize]);

  // Get cart functionality
  const { addToCart } = useCartStore();

  // Add to cart
  const handleAddToCart = useCallback(async () => {
    if (!hasImage) {
      orderLogger.warn('Attempted to add to cart without image');
      return;
    }

    setIsAddingToCart(true);
    orderLogger.info('Starting add to cart process', {
      productType,
      size: selectedSize,
      shape,
      quantity: selectedQuantity,
      hasImage,
      hasInstructions: instructions.length > 0
    });

    try {
      // Ensure canvas is ready
      const canvas = canvasRef.current?.getCanvas();
      if (!canvas) {
        throw new Error('Canvas not available for export');
      }

      const sessionId = getSessionId();

      const ensureBase64 = (dataUrl) =>
        dataUrl?.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      const uploadImageToS3 = async (base64Data, filenamePrefix) => {
        if (!base64Data) {
          throw new Error('Missing image data for upload');
        }

        const uploadResponse = await api.upload.uploadImage({
          image: base64Data,
          filename: `${filenamePrefix}-${Date.now()}.png`,
          sessionId
        });

        if (!uploadResponse?.success) {
          throw new Error(uploadResponse?.error || 'Failed to upload image');
        }

        uploadLogger.info('Image uploaded successfully', {
          filenamePrefix,
          s3Url: uploadResponse.s3Url,
          httpsUrl: uploadResponse.httpsUrl,
          fileSize: uploadResponse.fileSize
        });

        return uploadResponse;
      };

      // Upload original user artwork so staff can access the source file
      const artworkBase64 = ensureBase64(imageDataUrl);
      const artworkFilename = imageFile?.name?.replace(/\s+/g, '-').toLowerCase() || 'artwork.png';
      const originalUpload = await uploadImageToS3(
        artworkBase64,
        `artwork-${productType}-${selectedSize}-${artworkFilename}`
      );

      // Export current canvas preview to preserve adjustments
      uploadLogger.info('Uploading canvas preview to S3');
      const canvasPreviewData = ensureBase64(canvas.toDataURL('image/png', 1.0));
      const previewUpload = await uploadImageToS3(
        canvasPreviewData,
        `preview-${productType}-${selectedSize}`
      );

      // Determine pricing (package price + per unit)
      const packagePrice = getPrice(productType, selectedSize, selectedQuantity);
      if (typeof packagePrice !== 'number') {
        throw new Error('Unable to calculate price for this configuration');
      }
      const unitPrice = getPerUnitPrice(productType, selectedSize, selectedQuantity) || (packagePrice / selectedQuantity);
      const totalPrice = packagePrice;

      // Create cart item
      const cartItem = {
        productType,
        productName: `Custom ${productType === 'fridge_magnet' ? 'Fridge Magnet' : productType.charAt(0).toUpperCase() + productType.slice(1)}`,
        size: selectedSize,
        shape,
        quantity: selectedQuantity,
        unitPrice,
        price: unitPrice,
        totalPrice,
        artworkUrl: originalUpload.s3Url,
        artworkUrlHttps: originalUpload.httpsUrl,
        previewUrl: previewUpload.s3Url,
        previewUrlHttps: previewUpload.httpsUrl,
        imageUrl: previewUpload.httpsUrl,
        imageData: imageDataUrl, // Base64 thumbnail for previewing in cart
        instructions: instructions.trim(),
        addedAt: new Date().toISOString()
      };

      // Add to cart
      addToCart(cartItem);
      orderLogger.info('Item added to cart successfully', cartItem);

      setIsAddingToCart(false);
      setCartSuccess(true);

      // Reset success message after delay
      setTimeout(() => setCartSuccess(false), 3000);

    } catch (error) {
      orderLogger.error('Failed to add item to cart', { error: error.message }, error);
      setIsAddingToCart(false);
      
      // Show error to user (you might want to add error state)
      alert(`Failed to add to cart: ${error.message}`);
    }
  }, [
    hasImage, 
    productType, 
    selectedSize, 
    shape, 
    selectedQuantity, 
    instructions, 
    addToCart, 
    canvasRef
  ]);

  // Get current price
  const currentPrice = getPrice(productType, selectedSize, selectedQuantity);

  return (
    <>
      <Helmet>
        <title>Design Your Custom {productType === PRODUCT_TYPES.STICKERS ? 'Stickers' : 'Magnets'} | Sticker & Magnet Lab</title>
        <meta name="description" content="Create your own custom stickers and magnets with our easy-to-use designer. Upload your image and see your design come to life." />
      </Helmet>

      <div className="bg-gray-50 min-h-[calc(100vh-140px)]">
        {/* Page Title */}
        <div className="bg-white border-b border-gray-200">
          <div className="container-custom py-3 md:py-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-cool-blue hidden sm:block" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-graphite">
                  Custom <span className="gradient-text">Design Studio</span>
                </h1>
                <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                  Upload your design and create custom stickers or magnets
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Responsive Layout */}
        <div className="container-custom py-4 md:py-6">
          <div className="flex flex-col lg:flex-row gap-4 md:gap-6">

            {/* MOBILE: Collapsible Options Header */}
            <div className="lg:hidden">
              <button
                onClick={() => setShowMobileOptions(!showMobileOptions)}
                className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-soft-sky rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-cool-blue" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-graphite text-sm">
                      {productType === PRODUCT_TYPES.STICKERS ? 'Stickers' :
                       productType === PRODUCT_TYPES.FRIDGE_MAGNETS ? 'Fridge Magnets' : 'Die-Cut Magnets'}
                      {' '}&bull;{' '}{selectedSize}"
                    </p>
                    <p className="text-xs text-gray-500">
                      Qty: {selectedQuantity} &bull; ${currentPrice?.toFixed(2)}
                    </p>
                  </div>
                </div>
                {showMobileOptions ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {/* Collapsible Options Panel */}
              <AnimatePresence>
                {showMobileOptions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 space-y-4">
                      {/* Product Type Tabs - Mobile */}
                      <div className="bg-white rounded-xl p-4 shadow-soft">
                        <ProductTypeTabs
                          activeType={productType}
                          onChange={handleProductTypeChange}
                        />
                      </div>

                      {/* Size & Quantity - Mobile */}
                      <div className="bg-white rounded-xl p-4 shadow-soft">
                        <SizeQuantitySelector
                          productType={productType}
                          selectedSize={selectedSize}
                          onSizeChange={handleSizeChange}
                          selectedQuantity={selectedQuantity}
                          onQuantityChange={setSelectedQuantity}
                          disabled={isUploading}
                        />
                      </div>

                      {/* Price Display - Mobile */}
                      <PriceDisplay
                        productType={productType}
                        size={selectedSize}
                        quantity={selectedQuantity}
                      />

                      {/* Instructions - Mobile */}
                      <div className="bg-white rounded-xl p-4 shadow-soft">
                        <InstructionsInput
                          value={instructions}
                          onChange={setInstructions}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* LEFT PANEL - Product Options (Desktop Only) */}
            <motion.aside
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="hidden lg:block w-full lg:w-[30%] lg:min-w-[320px] space-y-6"
            >
              {/* Product Type Tabs */}
              <div className="bg-white rounded-2xl p-6 shadow-soft">
                <ProductTypeTabs
                  activeType={productType}
                  onChange={handleProductTypeChange}
                />
              </div>

              {/* Size & Quantity */}
              <div className="bg-white rounded-2xl p-6 shadow-soft">
                <SizeQuantitySelector
                  productType={productType}
                  selectedSize={selectedSize}
                  onSizeChange={handleSizeChange}
                  selectedQuantity={selectedQuantity}
                  onQuantityChange={setSelectedQuantity}
                  disabled={isUploading}
                />
              </div>

              {/* Price Display */}
              <PriceDisplay
                productType={productType}
                size={selectedSize}
                quantity={selectedQuantity}
              />

              {/* Instructions */}
              <div className="bg-white rounded-2xl p-4 shadow-soft">
                <InstructionsInput
                  value={instructions}
                  onChange={setInstructions}
                />
              </div>

              {/* Add to Cart - Sticky on desktop */}
              <div className="sticky bottom-6">
                <motion.button
                  onClick={handleAddToCart}
                  disabled={!hasImage || isAddingToCart}
                  whileHover={{ scale: hasImage ? 1.02 : 1 }}
                  whileTap={{ scale: hasImage ? 0.98 : 1 }}
                  className={`
                    w-full py-4 px-6 rounded-xl font-bold text-lg
                    flex items-center justify-center gap-3
                    transition-all duration-300 shadow-lg
                    ${hasImage
                      ? 'bg-gradient-to-r from-cool-blue to-deep-indigo text-white hover:shadow-glow'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                    disabled:opacity-50
                  `}
                >
                  <AnimatePresence mode="wait">
                    {isAddingToCart ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Adding...
                      </motion.span>
                    ) : cartSuccess ? (
                      <motion.span
                        key="success"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Added to Cart!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="default"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <ShoppingCart className="w-5 h-5" />
                        Add to Cart - ${currentPrice?.toFixed(2)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                {!hasImage && (
                  <p className="text-center text-sm text-gray-500 mt-2">
                    Upload an image to continue
                  </p>
                )}
              </div>
            </motion.aside>

            {/* CENTER PANEL - Canvas Editor */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-1 lg:w-[50%] space-y-3 md:space-y-4"
            >
              {/* Canvas Area */}
              <div className="bg-white rounded-xl md:rounded-2xl shadow-soft overflow-hidden relative">
                <ImageCanvas
                  ref={canvasRef}
                  productSize={productDimensions}
                  imageDataUrl={hasImage ? imageDataUrl : null}
                  rotation={rotation}
                  showGrid={showGrid}
                  shape={shape}
                  className="min-h-[320px] md:min-h-[420px]"
                />

                {!hasImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/95 p-4 md:p-8">
                    <UploadZone
                      onFileSelect={handleFileUpload}
                      isLoading={isUploading}
                      progress={uploadProgress}
                      error={uploadError}
                      hasImage={false}
                      className="w-full max-w-md"
                    />
                  </div>
                )}
              </div>

              {/* Canvas Controls */}
              <CanvasControls
                shape={shape}
                onShapeChange={setShape}
                rotation={rotation}
                onRotationChange={setRotation}
                showGrid={showGrid}
                onGridToggle={() => setShowGrid(!showGrid)}
                onReset={handleReset}
                onFitToCanvas={handleFitToCanvas}
                onDownload={handleDownload}
                disabled={!hasImage}
              />

              {/* Mobile Add to Cart - Fixed at bottom */}
              <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-40">
                <motion.button
                  onClick={handleAddToCart}
                  disabled={!hasImage || isAddingToCart}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    w-full py-3.5 px-6 rounded-xl font-bold text-base
                    flex items-center justify-center gap-3
                    transition-all duration-300 shadow-md
                    ${hasImage
                      ? 'bg-gradient-to-r from-cool-blue to-deep-indigo text-white'
                      : 'bg-gray-300 text-gray-500'
                    }
                  `}
                >
                  <AnimatePresence mode="wait">
                    {isAddingToCart ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Adding...
                      </motion.span>
                    ) : cartSuccess ? (
                      <motion.span
                        key="success"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Added to Cart!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="default"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <ShoppingCart className="w-5 h-5" />
                        Add to Cart - ${currentPrice?.toFixed(2)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>

              {/* Spacer for mobile fixed button */}
              <div className="lg:hidden h-20" />
            </motion.section>

            {/* RIGHT PANEL - Upload & Tips (Desktop) */}
            <motion.aside
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="hidden lg:block w-full lg:w-[20%] lg:min-w-[260px] space-y-6"
            >
              {/* File Upload Area (when image exists) */}
              {hasImage && (
                <div className="bg-white rounded-2xl p-5 shadow-soft">
                  <div className="flex items-center gap-2 mb-3">
                    <FileImage className="w-5 h-5 text-cool-blue" />
                    <h3 className="font-semibold text-graphite">Your Image</h3>
                  </div>

                  {/* Thumbnail */}
                  <div className="relative mb-4">
                    <img
                      src={imageDataUrl}
                      alt="Uploaded design"
                      className="w-full aspect-square object-contain bg-gray-100 rounded-lg"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      title="Remove image"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Quality Indicator */}
                  {qualityInfo && (
                    <div className={`
                      p-3 rounded-lg text-sm
                      ${qualityInfo.level === 'excellent' ? 'bg-green-100 text-green-700' :
                        qualityInfo.level === 'good' ? 'bg-blue-100 text-blue-700' :
                        qualityInfo.level === 'acceptable' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }
                    `}>
                      <div className="flex items-center gap-2 mb-1">
                        {qualityInfo.level === 'excellent' || qualityInfo.level === 'good' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                        <span className="font-semibold capitalize">{qualityInfo.level} Quality</span>
                      </div>
                      <p className="text-xs">{qualityInfo.message}</p>
                      <p className="text-xs mt-1">Resolution: ~{qualityInfo.dpi} DPI</p>
                      {qualityInfo.wasCompressed && (
                        <p className="text-xs mt-1">
                          Compressed: {qualityInfo.originalSize} → {qualityInfo.processedSize}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Replace Image */}
                  <div className="mt-4">
                    <UploadZone
                      onFileSelect={handleFileUpload}
                      isLoading={isUploading}
                      progress={uploadProgress}
                      error={uploadError}
                      hasImage={false}
                      className="[&>div]:min-h-[100px] [&>div]:p-4"
                    />
                  </div>
                </div>
              )}

              {/* Upload Area (when no image) - Desktop only */}
              {!hasImage && (
                <div className="hidden lg:block bg-white rounded-2xl p-5 shadow-soft">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload className="w-5 h-5 text-cool-blue" />
                    <h3 className="font-semibold text-graphite">Upload Your Design</h3>
                  </div>

                  <UploadZone
                    onFileSelect={handleFileUpload}
                    isLoading={isUploading}
                    progress={uploadProgress}
                    error={uploadError}
                    hasImage={false}
                  />
                </div>
              )}

              {/* Accepted Formats */}
              <div className="bg-white rounded-2xl p-5 shadow-soft">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-cool-blue" />
                  <h3 className="font-semibold text-graphite">Accepted Formats</h3>
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium text-gray-600">
                    .JPG
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium text-gray-600">
                    .PNG
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  High quality images recommended for best print results
                </p>
              </div>

              {/* Tips Section */}
              <div className="bg-gradient-to-br from-soft-sky/50 to-white rounded-2xl p-5 shadow-soft">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-5 h-5 text-cool-blue" />
                  <h3 className="font-semibold text-graphite">Design Tips</h3>
                </div>

                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">
                      Use high resolution images <span className="font-medium text-graphite">(300 DPI)</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">
                      <span className="font-medium text-graphite">PNG</span> works best for transparent backgrounds
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">
                      Upload files up to <span className="font-medium text-graphite">50MB</span> for processing
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">
                      Keep important elements within the <span className="font-medium text-graphite">safe zone</span> (dashed line)
                    </span>
                  </li>
                </ul>
              </div>

              {/* Download Preview Button */}
              {hasImage && (
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border-2 border-gray-200 rounded-xl text-graphite font-medium hover:border-cool-blue hover:text-cool-blue transition-all duration-200"
                >
                  <Download className="w-5 h-5" />
                  Download Preview
                </button>
              )}
            </motion.aside>
          </div>
        </div>
      </div>
    </>
  );
}
