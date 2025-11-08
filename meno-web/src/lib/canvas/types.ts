export interface CanvasPoint {
  x: number; // normalized [0,1]
  y: number; // normalized [0,1]
}

export interface SharedStroke {
  id: string;
  color: string;
  size: number; // normalized relative to min dimension
  points: CanvasPoint[];
  author?: string | null;
  createdAt: number;
  updatedAt: number;
}


