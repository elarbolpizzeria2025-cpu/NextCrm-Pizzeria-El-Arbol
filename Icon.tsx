import React from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, className = "" }) => (
  <span className={`material-symbols-outlined ${className}`} style={{ fontSize: size, lineHeight: 1 }}>
    {name}
  </span>
);
