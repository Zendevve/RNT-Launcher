import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './Button';
import { modalVariants, scrimVariants } from '../../lib/springs';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl';
  closeOnBackdrop?: boolean;
  hideClose?: boolean;
  contentClassName?: string;
}

let scrollLockCount = 0;

export function acquireModalScrollLock(): void {
  if (typeof document === 'undefined') return;
  scrollLockCount += 1;
  if (scrollLockCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

export function releaseModalScrollLock(): void {
  if (typeof document === 'undefined') return;
  if (scrollLockCount > 0) scrollLockCount -= 1;
  if (scrollLockCount === 0) {
    document.body.style.overflow = 'unset';
  }
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
  closeOnBackdrop = true,
  hideClose = false,
  contentClassName,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    acquireModalScrollLock();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      releaseModalScrollLock();
    };
  }, [isOpen, handleKeyDown]);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
    '2xl': 'max-w-4xl',
    '4xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
  }[size];

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop Scrim */}
          <motion.div
            variants={scrimVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={closeOnBackdrop ? onClose : undefined}
          />

          {/* Modal Dialog */}
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={clsx(
              'relative w-full bg-[#0f0f12] border border-[#2d2d34] rounded-[12px] overflow-hidden z-10 flex flex-col max-h-[90vh]',
              sizeClasses
            )}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2d34] bg-[#0c0c0f]">
              <div>
                <h2 className="text-sm font-medium text-[#f4f4f5] tracking-tight flex items-center gap-2">
                  {title}
                </h2>
                {description && (
                  <p className="text-xs text-[#a1a1aa] mt-0.5 tracking-tight">{description}</p>
                )}
              </div>
              {!hideClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close modal"
                className="text-[#71717a] hover:text-[#f4f4f5] rounded-md hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </Button>
              )}
            </div>

            {/* Content */}
            <div
              className={clsx(
                'flex-1 text-sm text-[#a1a1aa] leading-relaxed',
                contentClassName ?? 'overflow-y-auto p-6'
              )}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2d2d34] bg-black/20">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
