import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RotateCw, Move, Check, X, Grid3x3 } from 'lucide-react';
import { Button } from '@ui/button';
import { cn } from '@/lib/utils';

interface PlacedFurniture {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number; rotation: number };
  size: { width: number; height: number };
  scoreBonus: number;
  defenseBonus: number;
  rarity: string;
}

interface HousePlacementGridProps {
  gridSize?: { width: number; height: number };
  furniture: PlacedFurniture[];
  onFurnitureUpdate: (furniture: PlacedFurniture[]) => void;
  selectedFurniture?: PlacedFurniture | null;
  onSelectFurniture: (furniture: PlacedFurniture | null) => void;
  isEditing?: boolean;
}

const CELL_SIZE = 50; // pixels per grid cell

export function HousePlacementGrid({
  gridSize = { width: 10, height: 10 },
  furniture,
  onFurnitureUpdate,
  selectedFurniture,
  onSelectFurniture,
  isEditing = true,
}: HousePlacementGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate if a position is valid for furniture placement
  const isValidPosition = useCallback((furnitureItem: PlacedFurniture, x: number, y: number) => {
    // Check bounds
    const { width, height } = getFurnitureSize(furnitureItem);
    if (x < 0 || y < 0 || x + width > gridSize.width || y + height > gridSize.height) {
      return false;
    }

    // Check collisions with other furniture
    return !furniture.some(item => {
      if (item.id === furnitureItem.id) return false;
      
      const itemSize = getFurnitureSize(item);
      const furnitureSize = getFurnitureSize(furnitureItem);
      
      return !(
        x + furnitureSize.width <= item.position.x ||
        x >= item.position.x + itemSize.width ||
        y + furnitureSize.height <= item.position.y ||
        y >= item.position.y + itemSize.height
      );
    });
  }, [furniture, gridSize]);

  // Get furniture size accounting for rotation
  const getFurnitureSize = (item: PlacedFurniture) => {
    const isRotated = item.position.rotation % 180 !== 0;
    return {
      width: isRotated ? item.size.height : item.size.width,
      height: isRotated ? item.size.width : item.size.height,
    };
  };

  // Handle mouse down on furniture
  const handleFurnitureMouseDown = (e: React.MouseEvent, item: PlacedFurniture) => {
    if (!isEditing) return;
    
    e.preventDefault();
    onSelectFurniture(item);
    
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const offsetX = e.clientX - rect.left - item.position.x * CELL_SIZE;
    const offsetY = e.clientY - rect.top - item.position.y * CELL_SIZE;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
  };

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !selectedFurniture || !gridRef.current) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left - dragOffset.x) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top - dragOffset.y) / CELL_SIZE);
    
    setPreviewPosition({ x, y });
  }, [isDragging, selectedFurniture, dragOffset]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!isDragging || !selectedFurniture || !previewPosition) {
      setIsDragging(false);
      setPreviewPosition(null);
      return;
    }
    
    if (isValidPosition(selectedFurniture, previewPosition.x, previewPosition.y)) {
      const updatedFurniture = furniture.map(item =>
        item.id === selectedFurniture.id
          ? {
              ...item,
              position: {
                ...item.position,
                x: previewPosition.x,
                y: previewPosition.y,
              },
            }
          : item
      );
      onFurnitureUpdate(updatedFurniture);
    }
    
    setIsDragging(false);
    setPreviewPosition(null);
  }, [isDragging, selectedFurniture, previewPosition, furniture, isValidPosition, onFurnitureUpdate]);

  // Rotate selected furniture
  const handleRotate = () => {
    if (!selectedFurniture || !isEditing) return;
    
    const newRotation = (selectedFurniture.position.rotation + 90) % 360;
    const updatedItem = {
      ...selectedFurniture,
      position: { ...selectedFurniture.position, rotation: newRotation },
    };
    
    if (isValidPosition(updatedItem, selectedFurniture.position.x, selectedFurniture.position.y)) {
      const updatedFurniture = furniture.map(item =>
        item.id === selectedFurniture.id ? updatedItem : item
      );
      onFurnitureUpdate(updatedFurniture);
    }
  };

  // Remove selected furniture
  const handleRemove = () => {
    if (!selectedFurniture || !isEditing) return;
    
    const updatedFurniture = furniture.filter(item => item.id !== selectedFurniture.id);
    onFurnitureUpdate(updatedFurniture);
    onSelectFurniture(null);
  };

  // Add event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const getRarityColor = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'LEGENDARY':
        return 'from-yellow-500/20 to-amber-600/20 border-yellow-500/50';
      case 'EPIC':
        return 'from-purple-500/20 to-purple-700/20 border-purple-500/50';
      case 'RARE':
        return 'from-blue-500/20 to-blue-700/20 border-blue-500/50';
      case 'UNCOMMON':
        return 'from-green-500/20 to-green-700/20 border-green-500/50';
      default:
        return 'from-gray-500/20 to-gray-700/20 border-gray-500/50';
    }
  };

  return (
    <div className="relative">
      {/* Controls */}
      {isEditing && selectedFurniture && (
        <div className="absolute -top-16 left-0 flex gap-2 z-20">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRotate}
            className="gap-1"
          >
            <RotateCw className="h-4 w-4" />
            Rotate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRemove}
            className="gap-1 text-destructive"
          >
            <X className="h-4 w-4" />
            Remove
          </Button>
        </div>
      )}

      {/* Grid container */}
      <div
        ref={gridRef}
        className="relative bg-card border-2 border-border rounded-lg overflow-hidden"
        style={{
          width: gridSize.width * CELL_SIZE,
          height: gridSize.height * CELL_SIZE,
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            onSelectFurniture(null);
          }
        }}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(gridSize.height)].map((_, y) => (
            <div
              key={`h-${y}`}
              className="absolute w-full border-t border-muted-foreground/10"
              style={{ top: y * CELL_SIZE }}
            />
          ))}
          {[...Array(gridSize.width)].map((_, x) => (
            <div
              key={`v-${x}`}
              className="absolute h-full border-l border-muted-foreground/10"
              style={{ left: x * CELL_SIZE }}
            />
          ))}
        </div>

        {/* Grid indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-muted-foreground pointer-events-none">
          <Grid3x3 className="h-3 w-3" />
          {gridSize.width}x{gridSize.height}
        </div>

        {/* Placed furniture */}
        {furniture.map((item) => {
          const size = getFurnitureSize(item);
          const isSelected = selectedFurniture?.id === item.id;
          const isDraggingThis = isSelected && isDragging;
          const position = isDraggingThis && previewPosition
            ? previewPosition
            : item.position;
          const isValidPos = isDraggingThis && previewPosition
            ? isValidPosition(item, previewPosition.x, previewPosition.y)
            : true;

          return (
            <motion.div
              key={item.id}
              className={cn(
                "absolute cursor-move rounded-md border-2 flex items-center justify-center transition-colors",
                `bg-gradient-to-br ${getRarityColor(item.rarity)}`,
                isSelected && "ring-2 ring-primary ring-offset-2",
                isDraggingThis && !isValidPos && "border-destructive bg-destructive/20",
                !isEditing && "cursor-default"
              )}
              style={{
                left: position.x * CELL_SIZE,
                top: position.y * CELL_SIZE,
                width: size.width * CELL_SIZE,
                height: size.height * CELL_SIZE,
                transform: `rotate(${item.position.rotation}deg)`,
                zIndex: isSelected ? 10 : 1,
                opacity: isDraggingThis ? 0.8 : 1,
              }}
              onMouseDown={(e) => handleFurnitureMouseDown(e, item)}
              animate={{
                x: isDraggingThis ? 0 : 0,
                y: isDraggingThis ? 0 : 0,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="text-center p-2 select-none" style={{ transform: `rotate(-${item.position.rotation}deg)` }}>
                <p className="text-xs font-semibold truncate">{item.name}</p>
                <div className="flex gap-2 justify-center mt-1 text-[10px]">
                  {item.scoreBonus > 0 && (
                    <span className="text-green-600">+{item.scoreBonus}S</span>
                  )}
                  {item.defenseBonus > 0 && (
                    <span className="text-blue-600">+{item.defenseBonus}D</span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}