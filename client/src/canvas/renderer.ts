import rough from 'roughjs';
import { getStroke } from 'perfect-freehand';
import { CanvasElement, DashStyle } from '../store/useCanvasStore';
import { getRotationHandlePosition, getElementCenter, GRID_STEP } from './transforms';

// 1. CONFIGURE ROUGH.JS OPTIONS
function getRoughConfig(element: CanvasElement) {
  const isFilled = element.fillColor && element.fillColor !== 'transparent';
  return {
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    fill: isFilled ? element.fillColor : undefined,
    fillStyle: isFilled ? 'solid' : undefined,
    roughness: element.roughness,
    strokeLineDash: element.dashStyle === 'dashed' ? [8, 8] : element.dashStyle === 'dotted' ? [2, 6] : undefined,
    seed: element.seed
  };
}

// 2. GET PERFECT FREEHAND BRUSH STROKE
function getFreehandPath(points: [number, number][], strokeWidth: number): string {
  const stroke = getStroke(points, {
    size: strokeWidth * 4,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5
  });

  if (stroke.length === 0) return '';

  const d = stroke.reduce(
    (acc, [x, y], i) => {
      if (i === 0) return `M ${x} ${y}`;
      return `${acc} L ${x} ${y}`;
    },
    ''
  );

  return `${d} Z`;
}

// 3. RENDER SPECIFIC ELEMENT
export function drawElement(ctx: CanvasRenderingContext2D, rc: any, element: CanvasElement) {
  ctx.save();
  ctx.globalAlpha = element.opacity;

  const center = getElementCenter(element);
  
  // Apply rotation transform
  if (element.angle !== 0) {
    ctx.translate(center.x, center.y);
    ctx.rotate(element.angle);
    ctx.translate(-center.x, -center.y);
  }

  const { x, y, width, height, type, strokeColor, fillColor, strokeWidth, points, text, imageUrl } = element;
  const config = getRoughConfig(element);

  switch (type) {
    case 'rectangle':
      rc.draw(rc.generator.rectangle(x, y, width, height, config));
      break;

    case 'ellipse':
      const rx = width / 2;
      const ry = height / 2;
      rc.draw(rc.generator.ellipse(x + rx, y + ry, width, height, config));
      break;

    case 'diamond': {
      const cx = x + width / 2;
      const cy = y + height / 2;
      // Diamond polygon path
      const vertices: [number, number][] = [
        [cx, y],
        [x + width, cy],
        [cx, y + height],
        [x, cy]
      ];
      rc.draw(rc.generator.polygon(vertices, config));
      break;
    }

    case 'line':
      if (points && points.length >= 2) {
        // Line segments
        const segments: [number, number][] = points.map(pt => [x + pt[0], y + pt[1]]);
        rc.draw(rc.generator.linearPath(segments, config));
      }
      break;

    case 'arrow':
      if (points && points.length >= 2) {
        const segments: [number, number][] = points.map(pt => [x + pt[0], y + pt[1]]);
        rc.draw(rc.generator.linearPath(segments, config));

        // Draw arrowhead at final point
        const start = segments[segments.length - 2];
        const end = segments[segments.length - 1];
        
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const angle = Math.atan2(dy, dx);
        
        const headLength = 15 + strokeWidth * 2;
        const arrowAngle = Math.PI / 6; // 30 degrees
        
        const x3 = end[0] - headLength * Math.cos(angle - arrowAngle);
        const y3 = end[1] - headLength * Math.sin(angle - arrowAngle);
        const x4 = end[0] - headLength * Math.cos(angle + arrowAngle);
        const y4 = end[1] - headLength * Math.sin(angle + arrowAngle);

        const arrowheadConfig = { ...config, fill: strokeColor, fillStyle: 'solid' };
        rc.draw(rc.generator.polygon([[end[0], end[1]], [x3, y3], [x4, y4]], arrowheadConfig));
      }
      break;

    case 'freehand':
      if (points && points.length > 0) {
        ctx.fillStyle = strokeColor;
        const pathData = getFreehandPath(points.map(pt => [x + pt[0], y + pt[1]]), strokeWidth);
        const path = new Path2D(pathData);
        ctx.fill(path);
      }
      break;

    case 'text':
      if (text) {
        const fontFam = element.fontFamily || "'Outfit', 'Inter', sans-serif";
        const fontW = element.fontWeight || 'normal';
        const fontS = element.fontStyle || 'normal';
        
        ctx.font = `${fontS} ${fontW} 20px ${fontFam}`;
        ctx.textBaseline = 'top';
        
        // Multi-line rendering split by newline
        const lines = text.split('\n');
        const lineHeight = 26;

        // Draw highlight background pills behind each line of text if fillColor is active
        if (fillColor && fillColor !== 'transparent') {
          ctx.fillStyle = fillColor;
          for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i];
            if (lineText.trim() !== '') {
              const textWidth = ctx.measureText(lineText).width;
              const px = 6; // padding x
              const py = 3; // padding y
              
              ctx.beginPath();
              // Standard roundRect drawing API
              ctx.roundRect(x - px, y + i * lineHeight - py, textWidth + px * 2, 20 + py * 2, 6);
              ctx.fill();
            }
          }
        }
        
        ctx.fillStyle = strokeColor;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], x, y + i * lineHeight);
        }
      }
      break;

    case 'image':
      if (imageUrl) {
        const img = new Image();
        img.src = imageUrl;
        if (img.complete) {
          ctx.drawImage(img, x, y, width, height);
        } else {
          img.onload = () => {
            // Force redraw when image finishes loading
            ctx.drawImage(img, x, y, width, height);
          };
          
          // Draw a placeholder frame while image is loading
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(x, y, width, height);
          ctx.fillStyle = '#111827';
          ctx.fillRect(x, y, width, height);
        }
      }
      break;
  }

  ctx.restore();
}

// 4. DRAW SNAP GRID PATTERN
export function drawGridInsideBounds(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  gridType: 'grid' | 'lines' | 'dots' = 'grid'
) {
  ctx.save();
  const isDark = document.documentElement.classList.contains('dark');
  ctx.strokeStyle = isDark ? 'rgba(75, 85, 99, 0.4)' : 'rgba(209, 213, 219, 0.7)'; // subtle lines
  ctx.fillStyle = isDark ? 'rgba(156, 163, 175, 0.5)' : 'rgba(107, 114, 128, 0.5)'; // subtle dots
  ctx.lineWidth = 0.5;

  // Align start coordinates to step size
  const firstCol = Math.floor(startX / GRID_STEP) * GRID_STEP;
  const firstRow = Math.floor(startY / GRID_STEP) * GRID_STEP;

  if (gridType === 'dots') {
    for (let x = firstCol; x <= endX; x += GRID_STEP) {
      for (let y = firstRow; y <= endY; y += GRID_STEP) {
        if (x < startX || x > endX || y < startY || y > endY) continue;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  } else {
    ctx.beginPath();
    
    // Vertical grid lines (only for 'grid')
    if (gridType === 'grid') {
      for (let x = firstCol; x <= endX; x += GRID_STEP) {
        if (x < startX || x > endX) continue;
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
    }

    // Horizontal grid lines (for 'grid' and 'lines')
    for (let y = firstRow; y <= endY; y += GRID_STEP) {
      if (y < startY || y > endY) continue;
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }

    ctx.stroke();
  }
  ctx.restore();
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number },
  zoom: number,
  gridType: 'grid' | 'lines' | 'dots' = 'grid'
) {
  const startX = -pan.x / zoom;
  const startY = -pan.y / zoom;
  const endX = (width - pan.x) / zoom;
  const endY = (height - pan.y) / zoom;
  drawGridInsideBounds(ctx, startX, startY, endX, endY, gridType);
}

// 5. DRAW ACTIVE BORDERS & RESIZING HANGER BOXES
export function drawSelectionBox(ctx: CanvasRenderingContext2D, element: CanvasElement, zoom: number) {
  ctx.save();
  ctx.strokeStyle = '#8b5cf6'; // active purple border
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);

  const { x, y, width, height, angle } = element;
  const center = getElementCenter(element);

  // Apply rotation transform
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.translate(-center.x, -center.y);

  // Bounding rect outline
  ctx.strokeRect(x, y, width, height);

  // Draw 8 handles: corner handles + side handles
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([]); // solid line for handles

  const size = 8 / zoom;
  const halfSize = size / 2;

  const handlePositions = [
    { x, y }, // Top-Left
    { x: x + width / 2, y }, // Top-Middle
    { x: x + width, y }, // Top-Right
    { x, y: y + height / 2 }, // Middle-Left
    { x: x + width, y: y + height / 2 }, // Middle-Right
    { x, y: y + height }, // Bottom-Left
    { x: x + width / 2, y: y + height }, // Bottom-Middle
    { x: x + width, y: y + height } // Bottom-Right
  ];

  for (const pos of handlePositions) {
    ctx.fillRect(pos.x - halfSize, pos.y - halfSize, size, size);
    ctx.strokeRect(pos.x - halfSize, pos.y - halfSize, size, size);
  }

  // Draw rotation handle indicator
  const rotPos = { x: x + width / 2, y: y - 30 };
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(rotPos.x, rotPos.y);
  ctx.stroke();

  ctx.fillStyle = '#8b5cf6';
  ctx.beginPath();
  ctx.arc(rotPos.x, rotPos.y, 5 / zoom, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// 6. DRAW COLLABORATOR PRESENCE CURSORS
export function drawCollaboratorCursor(
  ctx: CanvasRenderingContext2D,
  cursor: { userName: string; userColor: string; x: number; y: number },
  zoom: number
) {
  ctx.save();
  const { x, y, userName, userColor } = cursor;

  // Draw cursor arrow pointer
  ctx.fillStyle = userColor;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 12 / zoom, y + 12 / zoom);
  ctx.lineTo(x + 4 / zoom, y + 15 / zoom);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw tag label card
  ctx.fillStyle = userColor;
  ctx.font = `${Math.max(10, 12 / zoom)}px 'Inter', sans-serif`;
  ctx.textBaseline = 'top';

  const textWidth = ctx.measureText(userName).width;
  const paddingX = 6 / zoom;
  const paddingY = 3 / zoom;
  
  const tagW = textWidth + paddingX * 2;
  const tagH = (12 / zoom) + paddingY * 2;
  const tagX = x + 8 / zoom;
  const tagY = y + 16 / zoom;

  // Background round rect
  ctx.fillRect(tagX, tagY, tagW, tagH);

  // Label text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(userName, tagX + paddingX, tagY + paddingY);

  ctx.restore();
}
