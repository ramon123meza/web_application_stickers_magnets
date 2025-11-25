import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Ruler, Package } from 'lucide-react';
import {
  getAvailableSizes,
  QUANTITIES,
  FRIDGE_MAGNET_SIZES,
  PRODUCT_TYPES
} from '../../data/pricingData';

/**
 * Fridge magnet thumbnail images - one for each size
 */
const FRIDGE_MAGNET_IMAGES = {
  '2x3': 'https://layout-tool-randr.s3.amazonaws.com/MGFM-Color.jpg',
  '2.5x3.5': 'https://layout-tool-randr.s3.amazonaws.com/MGFML-Color.jpg',
  '4.75x2': 'https://layout-tool-randr.s3.amazonaws.com/MGFMR-Color.jpg',
  '2.5x2.5': 'https://layout-tool-randr.s3.amazonaws.com/MGFMS-Color.jpg'
};

/**
 * Get human-friendly name for fridge magnet sizes
 */
const FRIDGE_MAGNET_NAMES = {
  '2x3': 'Standard',
  '2.5x3.5': 'Large',
  '4.75x2': 'Rectangle',
  '2.5x2.5': 'Square'
};

/**
 * SizeQuantitySelector - Combined selector component for size and quantity
 *
 * Features:
 * - Size dropdown with visual size reference
 * - Quantity buttons/dropdown
 * - Animated highlight on selection change
 * - Disabled states during loading
 * - Fridge magnet thumbnails and enhanced display
 */
export default function SizeQuantitySelector({
  productType = PRODUCT_TYPES.STICKERS,
  selectedSize,
  onSizeChange,
  selectedQuantity = 12,
  onQuantityChange,
  disabled = false,
  className = ''
}) {
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);

  const availableSizes = getAvailableSizes(productType);
  const isFridgeMagnet = productType === PRODUCT_TYPES.FRIDGE_MAGNETS;

  // Popular quantities to show as buttons
  const popularQuantities = [12, 25, 50, 100, 1000];
  const allQuantities = QUANTITIES;

  // Parse size for display
  const parseSizeLabel = (size) => {
    if (size.includes('x')) {
      const parts = size.split('x');
      return `${parts[0]}" × ${parts[1]}"`;
    }
    return size;
  };

  // Get visual size indicator (relative to 22x22 max)
  const getSizeIndicator = (size) => {
    const parts = size.split('x');
    const maxDim = Math.max(parseFloat(parts[0]), parseFloat(parts[1]));
    const percentage = (maxDim / 22) * 100;
    return Math.max(20, Math.min(percentage, 100));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Fridge Magnet Enhanced Selector */}
      {isFridgeMagnet && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-graphite">
            <Ruler className="w-4 h-4 text-cool-blue" />
            Select Magnet Size
          </label>
          <p className="text-xs text-gray-500 -mt-1">
            Choose from our premium fridge magnet sizes
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FRIDGE_MAGNET_SIZES.map((size) => (
              <motion.button
                key={size}
                onClick={() => onSizeChange?.(size)}
                disabled={disabled}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  relative p-3 rounded-xl border-2 text-left
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${selectedSize === size
                    ? 'border-cool-blue bg-soft-sky shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }
                `}
              >
                {selectedSize === size && (
                  <motion.span
                    layoutId="selectedFridgeSize"
                    className="absolute top-2 right-2"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <div className="w-5 h-5 bg-cool-blue rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </motion.span>
                )}

                {/* Magnet Thumbnail */}
                <div className="w-full aspect-[4/3] mb-2 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={FRIDGE_MAGNET_IMAGES[size]}
                    alt={`${size} fridge magnet`}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>

                {/* Size Info */}
                <div>
                  <div className="font-semibold text-graphite text-sm">
                    {FRIDGE_MAGNET_NAMES[size]}
                  </div>
                  <div className={`text-xs ${selectedSize === size ? 'text-cool-blue' : 'text-gray-500'}`}>
                    {parseSizeLabel(size)}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Currently Selected Info */}
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <img
              src={FRIDGE_MAGNET_IMAGES[selectedSize]}
              alt="Selected magnet"
              className="w-12 h-12 object-contain rounded-lg bg-white border border-gray-200"
            />
            <div>
              <p className="text-xs text-gray-500">Selected Size</p>
              <p className="font-semibold text-graphite">
                {FRIDGE_MAGNET_NAMES[selectedSize]} - {parseSizeLabel(selectedSize)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Size Selector (for non-fridge magnets) */}
      {!isFridgeMagnet && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-graphite">
            <Ruler className="w-4 h-4 text-cool-blue" />
            Select Size
          </label>

          <div className="relative">
            <motion.button
              onClick={() => !disabled && setSizeDropdownOpen(!sizeDropdownOpen)}
              disabled={disabled}
              whileHover={{ scale: 1.01 }}
              className={`
                w-full flex items-center justify-between p-4
                bg-white border-2 rounded-xl
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                ${sizeDropdownOpen
                  ? 'border-cool-blue shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {/* Visual size indicator */}
                <div className="relative w-10 h-10 bg-gray-100 rounded-lg overflow-hidden">
                  <motion.div
                    key={selectedSize}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute bg-cool-blue rounded"
                    style={{
                      width: `${getSizeIndicator(selectedSize)}%`,
                      height: `${getSizeIndicator(selectedSize)}%`,
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                </div>

                <div className="text-left">
                  <div className="font-semibold text-graphite">
                    {parseSizeLabel(selectedSize)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {productType === PRODUCT_TYPES.STICKERS ? 'Vinyl Sticker' : 'Die-Cut Magnet'}
                  </div>
                </div>
              </div>

              <motion.div
                animate={{ rotate: sizeDropdownOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </motion.div>
            </motion.button>

            {/* Dropdown */}
            <AnimatePresence>
              {sizeDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="
                    absolute z-50 w-full mt-2 py-2
                    bg-white border border-gray-200 rounded-xl
                    shadow-large max-h-64 overflow-y-auto
                  "
                >
                  {availableSizes.map((size) => (
                    <motion.button
                      key={size}
                      onClick={() => {
                        onSizeChange?.(size);
                        setSizeDropdownOpen(false);
                      }}
                      whileHover={{ backgroundColor: 'rgba(215, 232, 255, 0.5)' }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3
                        transition-colors duration-150
                        ${selectedSize === size
                          ? 'bg-soft-sky text-cool-blue'
                          : 'text-graphite'
                        }
                      `}
                    >
                      {/* Visual indicator */}
                      <div className="relative w-8 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                        <div
                          className={`
                            absolute rounded
                            ${selectedSize === size ? 'bg-cool-blue' : 'bg-gray-400'}
                          `}
                          style={{
                            width: `${getSizeIndicator(size)}%`,
                            height: `${getSizeIndicator(size)}%`,
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)'
                          }}
                        />
                      </div>

                      <span className="font-medium">{parseSizeLabel(size)}</span>

                      {selectedSize === size && (
                        <Check className="w-5 h-5 text-cool-blue ml-auto" />
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Quantity Selector */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-graphite">
          <Package className="w-4 h-4 text-cool-blue" />
          Quantity
        </label>

        {/* Popular quantities as buttons */}
        <div className="flex flex-wrap gap-2">
          {popularQuantities.map((qty) => (
            <motion.button
              key={qty}
              onClick={() => onQuantityChange?.(qty)}
              disabled={disabled}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                relative px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                ${selectedQuantity === qty
                  ? 'bg-cool-blue text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-cool-blue'
                }
              `}
            >
              {qty.toLocaleString()}
              {selectedQuantity === qty && (
                <motion.span
                  layoutId="selectedQty"
                  className="absolute inset-0 bg-cool-blue rounded-lg -z-10"
                />
              )}
            </motion.button>
          ))}
        </div>

        {/* Full quantity dropdown for all options */}
        <div className="relative">
          <select
            value={selectedQuantity}
            onChange={(e) => onQuantityChange?.(parseInt(e.target.value))}
            disabled={disabled}
            className="
              w-full p-3 pr-10 bg-white border-2 border-gray-200 rounded-lg
              text-graphite font-medium appearance-none cursor-pointer
              transition-all duration-200
              hover:border-gray-300 focus:border-cool-blue focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {allQuantities.map((qty) => (
              <option key={qty} value={qty}>
                {qty.toLocaleString()} pieces
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>

        {/* Quantity info */}
        <p className="text-xs text-gray-500">
          Select quantity for better per-piece pricing
        </p>
      </div>

      {/* Close dropdown when clicking outside */}
      {sizeDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSizeDropdownOpen(false)}
        />
      )}
    </div>
  );
}
