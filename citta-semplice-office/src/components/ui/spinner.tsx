'use client';

import { HTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark';
  type?: 'border' | 'grow';
}

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', variant = 'primary', type = 'border', ...props }, ref) => {
    const sizeClasses = {
      sm: `spinner-${type}-sm`,
      md: '',
      lg: 'spinner-lg',
    };

    return (
      <div
        ref={ref}
        className={clsx(
          `spinner-${type}`,
          `text-${variant}`,
          sizeClasses[size],
          className
        )}
        role="status"
        {...props}
      >
        <span className="visually-hidden">Caricamento...</span>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

export interface LoadingOverlayProps extends HTMLAttributes<HTMLDivElement> {
  message?: string;
}

export const LoadingOverlay = forwardRef<HTMLDivElement, LoadingOverlayProps>(
  ({ className, message = 'Caricamento in corso...', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx('d-flex flex-column justify-content-center align-items-center py-5', className)}
        {...props}
      >
        <Spinner size="lg" />
        <p className="mt-3 text-muted">{message}</p>
      </div>
    );
  }
);

LoadingOverlay.displayName = 'LoadingOverlay';
