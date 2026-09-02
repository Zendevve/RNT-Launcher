import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils/cn';
import { springSnappy } from '../../lib/springs';

export interface ContextMenuItem {
  id?: string;
  label?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

export interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
  className?: string;
}

export function useContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
    setIsOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openMenu = useCallback((x: number, y: number) => {
    setPosition({ x, y });
    setIsOpen(true);
  }, []);

  return {
    isOpen,
    position,
    handleContextMenu,
    openMenu,
    closeMenu,
  };
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  items,
  onClose,
  className,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Reposition inside viewport boundaries
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      if (x + rect.width > viewportWidth - 10) {
        x = Math.max(10, viewportWidth - rect.width - 10);
      }
      if (y + rect.height > viewportHeight - 10) {
        y = Math.max(10, viewportHeight - rect.height - 10);
      }

      setAdjustedPosition({ x, y });
    };

    updatePosition();
  }, [isOpen, position]);

  // Click outside & Escape key listeners
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, onClose]);

  const content = (
    <AnimatePresence>
      {isOpen && items.length > 0 && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.94, y: 2 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: springSnappy }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
          style={{
            left: `${adjustedPosition.x}px`,
            top: `${adjustedPosition.y}px`,
            transformOrigin: 'top left',
          }}
          className={cn(
            'fixed z-50 min-w-[190px] bg-[#16181b]/95 border-t border-t-white/[0.14] border-x border-b border-black/60 rounded-lg shadow-2xl shadow-black/80 py-1.5 backdrop-blur-xl select-none text-xs',
            className
          )}
        >
          {items.map((item, index) => {
            if (item.divider) {
              return <div key={`divider-${index}`} className="my-1 border-t border-white/[0.07]" />;
            }

            return (
              <button
                key={item.id || `item-${index}`}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick?.();
                  onClose();
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors font-medium tracking-tight',
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed text-zinc-500'
                    : item.danger
                    ? 'text-red-400 hover:bg-red-950/60 hover:text-white'
                    : 'text-zinc-200 hover:bg-white/[0.08] hover:text-white'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  {item.icon && <span className="flex-shrink-0 text-zinc-400">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </div>

                {item.shortcut && (
                  <span className="ml-3 font-mono text-[10px] text-zinc-500 tracking-wider">
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
