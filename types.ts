export interface User {
  id?: number;
  name: string;
  email: string;
  password?: string; // Hashed in a real app
  bio?: string;
  profilePic?: string;
}

export interface Category {
  id: string;
  name:string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  startTime: number; // timestamp
  endTime: number; // timestamp
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  categoryId: string;
  order: number;
  createdAt: number; // timestamp
}

export interface CompletedTask extends Task {
  completedAt: number; // timestamp
}

export type Theme = 'dark' | 'light' | 'gradient' | 'colorful' | 'elegant' | 'minimal' | 'high-contrast';
export type Font = 'sans' | 'serif' | 'mono';
export type FontSize = 'sm' | 'base' | 'lg';
export type Page = 'dashboard' | 'history' | 'stats' | 'settings' | 'about';

export interface Settings {
  theme: Theme;
  font: Font;
  language: 'en' | 'ur';
  fontSize: FontSize;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: string;
}