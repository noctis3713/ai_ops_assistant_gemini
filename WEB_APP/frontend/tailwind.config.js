/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          // 背景色
          bg: '#f8f9fa',
          'bg-secondary': '#ffffff',
          'bg-card': '#ffffff',
          
          // 主要色彩
          primary: '#0066cc',
          'primary-hover': '#0056b3',
          'primary-light': '#cce7ff',
          
          // 次要色彩
          secondary: '#6c757d',
          'secondary-hover': '#545b62',
          'secondary-light': '#e9ecef',
          
          // 狀態色彩
          success: '#198754',
          'success-light': '#d1e7dd',
          'success-dark': '#146c43',
          
          error: '#dc3545',
          'error-light': '#f8d7da',
          'error-dark': '#b02a37',
          
          warning: '#ffc107',
          'warning-light': '#fff3cd',
          'warning-dark': '#997404',
          
          // 文字色彩
          'text-primary': '#212529',
          'text-secondary': '#6c757d',
          'text-muted': '#868e96',
          'text-light': '#adb5bd',
        },
        
        // 保持與設計系統一致的 blue 和 gray 色彩
        blue: {
          50: '#e7f3ff',
          100: '#cce7ff',
          200: '#99cfff',
          300: '#66b7ff',
          400: '#339fff',
          500: '#0066cc',
          600: '#0066cc',
          700: '#0056b3',
          800: '#004494',
          900: '#003875',
        },
        gray: {
          50: '#f8f9fa',
          100: '#f8f9fa',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#6c757d',
          700: '#495057',
          800: '#343a40',
          900: '#212529',
        },
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Source Han Serif TC', 'Lora', 'serif'],
        serif: ['Source Han Serif TC', 'Lora', 'serif'],
        latin: ['Lora', 'serif'],
        chinese: ['Source Han Serif TC', 'serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
      },
    },
  },
  plugins: [],
}