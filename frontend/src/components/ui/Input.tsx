import React, { forwardRef, useState } from 'react'
import { BaseComponentProps } from '../../types/indexs'

interface InputProps extends BaseComponentProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
  placeholder?: string
  value?: string
  defaultValue?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  error?: string
  label?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  rightElement?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'filled' | 'unstyled'
  autoComplete?: string
  autoFocus?: boolean
  maxLength?: number
  minLength?: number
  min?: number | string
  max?: number | string
  step?: number | string
  pattern?: string
  name?: string
  id?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  type = 'text',
  placeholder,
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  label,
  hint,
  leftIcon,
  rightIcon,
  rightElement,
  size = 'md',
  variant = 'default',
  className = '',
  autoComplete,
  autoFocus,
  maxLength,
  minLength,
  min,
  max,
  step,
  pattern,
  name,
  id,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const baseClasses = 'w-full border rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0'
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  }

  const variantClasses = {
    default: `bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${
      error
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600'
        : 'focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400'
    }`,
    filled: `bg-gray-100 dark:bg-gray-700 border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${
      error
        ? 'bg-red-50 dark:bg-red-900/20 focus:bg-white dark:focus:bg-gray-800 focus:border-red-500 focus:ring-red-500'
        : 'focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 focus:ring-blue-500'
    }`,
    unstyled: 'bg-transparent border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0 focus:border-transparent p-0',
  }

  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800'
    : ''

  const inputClasses = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    onBlur?.(e)
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const inputType = type === 'password' && showPassword ? 'text' : type

  const hasLeftPadding = leftIcon
  const hasRightPadding = rightIcon || rightElement || type === 'password'

  const paddingClasses = `${hasLeftPadding ? 'pl-10' : ''} ${hasRightPadding ? 'pr-10' : ''}`

  return (
    <div className="relative">
      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          className={`block text-sm font-medium mb-1 transition-colors ${
            error
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input container */}
      <div className="relative">
        {/* Left icon */}
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
            {leftIcon}
          </div>
        )}

        {/* Input field */}
        <input
          ref={ref}
          type={inputType}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          minLength={minLength}
          min={min}
          max={max}
          step={step}
          pattern={pattern}
          name={name}
          id={id}
          className={`${inputClasses} ${paddingClasses}`}
          {...props}
        />

        {/* Right elements */}
        {(rightIcon || rightElement || type === 'password') && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
            {/* Password toggle */}
            {type === 'password' && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            )}

            {/* Right icon */}
            {rightIcon && (
              <div className="text-gray-400 dark:text-gray-500">
                {rightIcon}
              </div>
            )}

            {/* Right element */}
            {rightElement && rightElement}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-start space-x-1">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </p>
      )}

      {/* Hint text */}
      {hint && !error && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

// Specialized input components
interface TextareaProps extends Omit<InputProps, 'type'> {
  rows?: number
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  placeholder,
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  label,
  hint,
  size = 'md',
  variant = 'default',
  className = '',
  rows = 3,
  resize = 'vertical',
  maxLength,
  minLength,
  name,
  id,
  ...props
}, ref) => {
  const baseClasses = 'w-full border rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0'
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  }

  const variantClasses = {
    default: `bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${
      error
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600'
        : 'focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400'
    }`,
    filled: `bg-gray-100 dark:bg-gray-700 border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${
      error
        ? 'bg-red-50 dark:bg-red-900/20 focus:bg-white dark:focus:bg-gray-800 focus:border-red-500 focus:ring-red-500'
        : 'focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 focus:ring-blue-500'
    }`,
    unstyled: 'bg-transparent border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0 focus:border-transparent p-0',
  }

  const resizeClasses = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize',
  }

  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800'
    : ''

  const textareaClasses = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${resizeClasses[resize]} ${disabledClasses} ${className}`

  return (
    <div>
      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          className={`block text-sm font-medium mb-1 transition-colors ${
            error
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Textarea */}
      <textarea
        ref={ref}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange as any}
        onBlur={onBlur as any}
        onFocus={onFocus as any}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        maxLength={maxLength}
        minLength={minLength}
        name={name}
        id={id}
        rows={rows}
        className={textareaClasses}
        {...props}
      />

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-start space-x-1">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </p>
      )}

      {/* Hint text */}
      {hint && !error && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  )
})

Textarea.displayName = 'Textarea'