'use client';

import { HTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'danger' | 'warning' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', dismissible, onDismiss, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'alert',
          `alert-${variant}`,
          dismissible && 'alert-dismissible fade show',
          className
        )}
        role="alert"
        {...props}
      >
        {children}
        {dismissible && (
          <button
            type="button"
            className="btn-close"
            aria-label="Chiudi"
            onClick={onDismiss}
          ></button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';
