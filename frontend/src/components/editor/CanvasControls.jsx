import { motion } from 'framer-motion';
import {
  RotateCcw,
  RotateCw,
  RefreshCw,
  Grid3X3,
  Download,
  Maximize,
  Square,
  Circle,
  Scissors
} from 'lucide-react';

/**
 * CanvasControls - Control toolbar for canvas manipulation
 *
 * Features:
 * - Shape selection (square, round, custom die cut)
 * - Rotate buttons (CCW, CW)
 * - Reset button
 * - Grid toggle
 * - Download preview button
 * - Fit to canvas button
 */
export default function CanvasControls({
  shape = 'square',
  onShapeChange,
  rotation = 0,
  onRotationChange,
  showGrid = false,
  onGridToggle,
  onReset,
  onDownload,
  onFitToCanvas,
  disabled = false,
  className = ''
}) {

  // Handle rotation
  const rotateClockwise = () => {
    const newRotation = (rotation + 90) % 360;
    onRotationChange?.(newRotation);
  };

  const rotateCounterClockwise = () => {
    const newRotation = (rotation - 90 + 360) % 360;
    onRotationChange?.(newRotation);
  };

  const ControlButton = ({
    onClick,
    title,
    icon: Icon,
    active = false,
    variant = 'default',
    disableOverride = null
  }) => {
    const isDisabled = typeof disableOverride === 'boolean' ? disableOverride : disabled;
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        disabled={isDisabled}
        title={title}
        className={`
          p-2.5 rounded-lg transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variant === 'primary'
            ? 'bg-cool-blue text-white hover:bg-deep-indigo shadow-md'
            : active
              ? 'bg-soft-sky text-cool-blue border-2 border-cool-blue'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }
        `}
      >
        <Icon className="w-5 h-5" />
      </motion.button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={`
        flex flex-wrap items-center justify-center gap-4 p-4
        bg-white rounded-xl shadow-soft border border-gray-100
        ${className}
      `}
    >
      {/* Shape Selection */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-1">
          Shape
        </span>

        <div className="flex gap-1">
          <ControlButton
            onClick={() => onShapeChange?.('square')}
            title="Square/Rectangle die cut"
            icon={Square}
            active={shape === 'square'}
            disableOverride={false}
          />
          
          <ControlButton
            onClick={() => onShapeChange?.('round')}
            title="Round die cut"
            icon={Circle}
            active={shape === 'round'}
            disableOverride={false}
          />
          
          <ControlButton
            onClick={() => onShapeChange?.('custom')}
            title="Custom die cut (follows image shape)"
            icon={Scissors}
            active={shape === 'custom'}
            disableOverride={false}
          />
        </div>
        
        {/* Shape Info */}
        {shape === 'custom' && (
          <div className="ml-2 text-xs text-gray-600 max-w-[200px]">
            Upload images with transparent backgrounds for custom shapes
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-gray-200" />

      {/* Rotation Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-1">
          Rotate
        </span>

        <ControlButton
          onClick={rotateCounterClockwise}
          title="Rotate counter-clockwise (90 deg)"
          icon={RotateCcw}
        />

        <ControlButton
          onClick={rotateClockwise}
          title="Rotate clockwise (90 deg)"
          icon={RotateCw}
        />

        <span className="text-sm font-medium text-graphite min-w-[35px] text-center">
          {rotation}°
        </span>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-gray-200" />

      {/* Utility Controls */}
      <div className="flex items-center gap-2">
        <ControlButton
          onClick={onGridToggle}
          title="Toggle grid"
          icon={Grid3X3}
          active={showGrid}
        />

        <ControlButton
          onClick={onFitToCanvas}
          title="Fit to canvas"
          icon={Maximize}
        />

        <ControlButton
          onClick={onReset}
          title="Reset position"
          icon={RefreshCw}
        />
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-gray-200" />

      {/* Download Button */}
      <ControlButton
        onClick={onDownload}
        title="Download preview"
        icon={Download}
        variant="primary"
      />

      {disabled && (
        <p className="text-xs text-gray-500 text-center w-full">
          Upload an image to enable rotate, grid, fit, and download controls.
        </p>
      )}
    </motion.div>
  );
}
