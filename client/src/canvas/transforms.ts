import { CanvasElement } from '../store/useCanvasStore';

export interface Point {
  x: number;
  y: number;
}

// 1. TRANSFORMATIONS: WORLD <=> SCREEN
export function screenToWorld(clientX: number, clientY: number, pan: { x: number; y: number }, zoom: number): Point {
  return {
    x: (clientX - pan.x) / zoom,
    y: (clientY - pan.y) / zoom
  };
}

export function worldToScreen(worldX: number, worldY: number, pan: { x: number; y: number }, zoom: number): Point {
  return {
    x: worldX * zoom + pan.x,
    y: worldY * zoom + pan.y
  };
}

// 2. GRID SNAPPING
export const GRID_STEP = 20;

export function snap(val: number, step: number = GRID_STEP): number {
  return Math.round(val / step) * step;
}

// 3. ROTATION MATHEMATICS
export function rotatePoint(x: number, y: number, cx: number, cy: number, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos
  };
}

// 4. ELEMENT CORNERS & BOUNDS (For resizing/selecting)
export function getElementCenter(element: CanvasElement): Point {
  return {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2
  };
}

export function getElementBounds(element: CanvasElement) {
  // Unrotated bounds
  const minX = Math.min(element.x, element.x + element.width);
  const maxX = Math.max(element.x, element.x + element.width);
  const minY = Math.min(element.y, element.y + element.height);
  const maxY = Math.max(element.y, element.y + element.height);

  return { minX, maxX, minY, maxY };
}

// Distance helper
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Distance from point to line segment
export function distanceToSegment(p: Point, v: Point, w: Point): number {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return distance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y)
  });
}

// 5. HIT-TESTING (Checks if cursor is over element)
export function isPointOverElement(point: Point, element: CanvasElement): boolean {
  const center = getElementCenter(element);
  
  // Rotate point back by -angle around center to do standard axis-aligned check
  const localPoint = rotatePoint(point.x, point.y, center.x, center.y, -element.angle);
  
  const { x, y, width, height, type, points } = element;
  
  switch (type) {
    case 'rectangle':
    case 'text':
    case 'image':
    case 'document': {
      const minX = Math.min(x, x + width);
      const maxX = Math.max(x, x + width);
      const minY = Math.min(y, y + height);
      const maxY = Math.max(y, y + height);
      return (
        localPoint.x >= minX &&
        localPoint.x <= maxX &&
        localPoint.y >= minY &&
        localPoint.y <= maxY
      );
    }
      
    case 'ellipse': {
      const rx = Math.abs(width) / 2;
      const ry = Math.abs(height) / 2;
      const cx = x + width / 2;
      const cy = y + height / 2;
      if (rx === 0 || ry === 0) return false;
      const term1 = Math.pow(localPoint.x - cx, 2) / Math.pow(rx, 2);
      const term2 = Math.pow(localPoint.y - cy, 2) / Math.pow(ry, 2);
      return term1 + term2 <= 1;
    }
    
    case 'diamond': {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rx = Math.abs(width) / 2;
      const ry = Math.abs(height) / 2;
      if (rx === 0 || ry === 0) return false;
      // Diamond equation: |x - cx| / rx + |y - cy| / ry <= 1
      const dx = Math.abs(localPoint.x - cx) / rx;
      const dy = Math.abs(localPoint.y - cy) / ry;
      return dx + dy <= 1;
    }
    
    case 'line':
    case 'arrow': {
      if (!points || points.length < 2) return false;
      // Points are relative offsets to element.x, element.y
      // Check distance from localPoint to each line segment
      const threshold = 6;
      for (let i = 0; i < points.length - 1; i++) {
        const pt1 = { x: x + points[i][0], y: y + points[i][1] };
        const pt2 = { x: x + points[i+1][0], y: y + points[i+1][1] };
        if (distanceToSegment(localPoint, pt1, pt2) < threshold) {
          return true;
        }
      }
      return false;
    }
    
    case 'freehand': {
      if (!points || points.length === 0) return false;
      const threshold = 8;
      // For freehand, check if point is close to any point in the path
      for (const pt of points) {
        const worldPt = { x: x + pt[0], y: y + pt[1] };
        if (distance(localPoint, worldPt) < threshold) {
          return true;
        }
      }
      return false;
    }
    
    default:
      return false;
  }
}

// 6. ROTATION CORNER HANDLE DETECTION (Checks if cursor is over rotation handle)
export function getRotationHandlePosition(element: CanvasElement): Point {
  const center = getElementCenter(element);
  // Rotated position of handle (placed 30px above the top boundary)
  const handleUnrotated = {
    x: element.x + element.width / 2,
    y: element.y - 30
  };
  return rotatePoint(handleUnrotated.x, handleUnrotated.y, center.x, center.y, element.angle);
}

export function isOverRotationHandle(point: Point, element: CanvasElement, zoom: number): boolean {
  const handlePos = getRotationHandlePosition(element);
  const clickRadius = 8 / zoom; // Adjust hit sensitivity based on zoom level
  return distance(point, handlePos) <= clickRadius;
}

// 7. MULTI-SELECTION BOX HIT-TEST (Checks if element is inside selection drag box)
export function isElementInsideBox(element: CanvasElement, boxStart: Point, boxEnd: Point): boolean {
  const x1 = Math.min(boxStart.x, boxEnd.x);
  const x2 = Math.max(boxStart.x, boxEnd.x);
  const y1 = Math.min(boxStart.y, boxEnd.y);
  const y2 = Math.max(boxStart.y, boxEnd.y);

  // Checks center coordinate
  const center = getElementCenter(element);
  return (
    center.x >= x1 &&
    center.x <= x2 &&
    center.y >= y1 &&
    center.y <= y2
  );
}
