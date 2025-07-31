// 按鈕組件
import React from 'react';
import { cn } from '@/utils/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'small' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseClasses = 'transition-all duration-300 focus:outline-none inline-flex items-center justify-center';
  
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    small: 'btn-small',
    ghost: 'btn-ghost',
  };
  
  const sizeClasses = {
    sm: variant === 'small' ? '' : 'py-2 px-4 text-sm',
    md: variant === 'small' ? '' : 'py-3 px-8 text-base',
    lg: variant === 'small' ? '' : 'py-4 px-10 text-lg',
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        isLoading && 'opacity-70 cursor-not-allowed',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>處理中...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;