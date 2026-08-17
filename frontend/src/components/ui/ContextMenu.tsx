import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

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
    if (isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 8;
      let x = position.x;
      let y = position.y;

      if (x + rect.width > window.innerWidth - padding) {
        x = window.innerWidth - rect.width - padding;
      }
      if (y + rect.height > window.innerHeight - padding) {
        y = window.innerHeight - rect.height - padding;
      }
      if (x < padding) x = padding;
      if (y < padding) y = padding;

      setAdjustedPosition({ x, y });
    } else {
      setAdjustedPosition(position);
    }
  }, [isOpen, position]);

  // Click outside & Escape key listeners
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
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

  if (!isOpen || items.length === 0) return null;

  const content = (
    <div
      ref={menuRef}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      className={cn(
        'fixed z-50 min-w-[180px] bg-doom-surface border border-doom-border rounded shadow-xl py-1.5',
        'animate-in fade-in-50 zoom-in-95 duration-100 select-none text-xs',
        className
      )}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`divider-${index}`} className="my-1 border-t border-doom-border/60" />;
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
              'w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors',
              item.disabled
                ? 'opacity-40 cursor-not-allowed text-doom-muted'
                : item.danger
                ? 'text-red-400 hover:bg-doom-red-dark hover:text-white'
                : 'text-doom-text hover:bg-doom-card hover:text-white'
            )}
          >
            <div className="flex items-center gap-2 truncate">
              {item.icon && <span className="flex-shrink-0 text-doom-muted">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </div>

            {item.shortcut && (
              <span className="ml-3 font-mono text-[10px] text-doom-muted/80 tracking-wide">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
