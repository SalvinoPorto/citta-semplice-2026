'use client';

import { HTMLAttributes, forwardRef, useEffect, useRef } from 'react';
import clsx from 'clsx';

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  centered?: boolean;
  scrollable?: boolean;
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ className, isOpen, onClose, size = 'md', centered, scrollable, children, ...props }, ref) => {
    const backdropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (isOpen) {
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
      } else {
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
      }

      return () => {
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
      };
    }, [isOpen]);

    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    };

    if (!isOpen) return null;

    const sizeClasses = {
      sm: 'modal-sm',
      md: '',
      lg: 'modal-lg',
      xl: 'modal-xl',
    };

    return (
      <>
        <div
          ref={backdropRef}
          className="modal fade show d-block"
          tabIndex={-1}
          onClick={handleBackdropClick}
          {...props}
        >
          <div
            ref={ref}
            className={clsx(
              'modal-dialog',
              sizeClasses[size],
              centered && 'modal-dialog-centered',
              scrollable && 'modal-dialog-scrollable',
              className
            )}
          >
            <div className="modal-content">{children}</div>
          </div>
        </div>
        <div className="modal-backdrop fade show"></div>
      </>
    );
  }
);

Modal.displayName = 'Modal';

export interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className, onClose, children, ...props }, ref) => {
    return (
      <div ref={ref} className={clsx('modal-header', className)} {...props}>
        <h5 className="modal-title">{children}</h5>
        {onClose && (
          <button type="button" className="btn-close" aria-label="Chiudi" onClick={onClose}></button>
        )}
      </div>
    );
  }
);

ModalHeader.displayName = 'ModalHeader';

export interface ModalBodyProps extends HTMLAttributes<HTMLDivElement> {}

export const ModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={clsx('modal-body', className)} {...props}>
        {children}
      </div>
    );
  }
);

ModalBody.displayName = 'ModalBody';

export interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={clsx('modal-footer', className)} {...props}>
        {children}
      </div>
    );
  }
);

ModalFooter.displayName = 'ModalFooter';
