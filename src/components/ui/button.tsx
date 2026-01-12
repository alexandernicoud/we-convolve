import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  onClick,
  type = "button",
  disabled = false,
}: ButtonProps) {
  const baseClasses = "font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const variantClasses = {
    primary: "bg-gradient-to-r from-[#7C5CFF] to-[#2E6BFF] text-white hover:from-[#8B6CFF] hover:to-[#3D7BFF] hover:shadow-lg hover:shadow-[#7C5CFF]/25 focus:ring-[#7C5CFF]/50",
    secondary: "bg-transparent border border-white/18 text-[#F5F7FF] hover:border-[#7C5CFF]/55 hover:bg-[#7C5CFF]/8 focus:ring-[#7C5CFF]/50",
    danger: "bg-transparent border border-[#FF4FD8]/50 text-[#FF4FD8] hover:bg-[#FF4FD8]/10 hover:border-[#FF4FD8] focus:ring-[#FF4FD8]/50",
  };

  return (
    <button
      type={type}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}