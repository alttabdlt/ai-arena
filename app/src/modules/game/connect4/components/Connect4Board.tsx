import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface Connect4BoardProps {
  board: number[][];
  onColumnClick: (column: number) => void;
  isAIThinking: boolean;
  disabled?: boolean;
  winningCells?: Array<[number, number]> | null;
}

export function Connect4Board({
  board,
  onColumnClick,
  isAIThinking,
  disabled = false,
  winningCells
}: Connect4BoardProps) {
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [droppingDiscs, setDroppingDiscs] = useState<Set<string>>(new Set());
  
  // Debug logging
  React.useEffect(() => {
    console.log('Connect4Board props:', {
      board,
      boardLength: board?.length,
      boardFirstRow: board?.[0],
      boardFirstRowLength: board?.[0]?.length,
      isValidBoard: board && Array.isArray(board) && board.length > 0 && Array.isArray(board[0]),
      isAIThinking,
      disabled,
      winningCells
    });
    
    // Log the actual board values
    if (board && Array.isArray(board)) {
      console.log('Connect4Board - Full board state:');
      board.forEach((row, index) => {
        console.log(`Row ${index}:`, row);
      });
    }
  }, [board, isAIThinking, disabled, winningCells]);

  // Safety check for board data
  if (!board || !Array.isArray(board) || board.length === 0) {
    console.error('Connect4Board: Invalid board data', board);
    return (
      <div className="text-center p-8">
        <p className="text-sm text-muted-foreground">Waiting for game board to initialize...</p>
        <Loader2 className="h-6 w-6 animate-spin mx-auto mt-4 text-muted-foreground" />
      </div>
    );
  }

  // Get actual board dimensions
  const actualRows = board.length;
  const actualCols = board[0]?.length || 0;
  
  // Validate board dimensions - accept both old (6x7) and new (8x8) sizes
  const isValidBoard = board.every(row => Array.isArray(row) && row.length === actualCols) && actualCols > 0;
  if (!isValidBoard) {
    console.error('Connect4Board: Invalid board dimensions', {
      rows: board.length,
      rowLengths: board.map(row => row?.length)
    });
    return (
      <div className="text-center p-8">
        <p className="text-destructive">Error: Inconsistent board dimensions</p>
        <p className="text-sm text-muted-foreground mt-2">All rows must have the same number of columns</p>
      </div>
    );
  }
  
  // Show warning if using old board size
  const isOldBoardSize = actualRows === 6 && actualCols === 7;

  const isWinningCell = (row: number, col: number) => {
    return winningCells?.some(([r, c]) => r === row && c === col) || false;
  };

  const handleColumnClick = (column: number) => {
    if (disabled || isAIThinking) return;
    
    // Check if column is full
    if (board[0][column] !== 0) return;
    
    // Add to dropping animation set
    const dropRow = getDropPreviewRow(column);
    if (dropRow >= 0) {
      setDroppingDiscs(prev => new Set(prev).add(`${dropRow}-${column}`));
      setTimeout(() => {
        setDroppingDiscs(prev => {
          const next = new Set(prev);
          next.delete(`${dropRow}-${column}`);
          return next;
        });
      }, 600);
    }
    
    onColumnClick(column);
  };

  const getDropPreviewRow = (column: number): number => {
    // Find the lowest empty row in this column
    for (let row = board.length - 1; row >= 0; row--) {
      if (board[row][column] === 0) {
        return row;
      }
    }
    return -1; // Column is full
  };

  return (
    <div className="inline-block w-full">
      
      {/* Warning for old board size */}
      {isOldBoardSize && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 p-2 mb-2 rounded text-xs">
          ⚠️ This game is using the old 6x7 board. Start a new game for the 8x8 board.
        </div>
      )}
      
      {/* Column hover indicators */}
      <div className={`grid gap-1 mb-1 ${actualCols === 7 ? 'grid-cols-7' : 'grid-cols-8'}`}>
        {Array.from({ length: actualCols }, (_, col) => (
          <div
            key={col}
            className={cn(
              "h-6 flex items-center justify-center cursor-pointer",
              !disabled && !isAIThinking && board[0][col] === 0 && "hover:bg-muted"
            )}
            onMouseEnter={() => setHoveredColumn(col)}
            onMouseLeave={() => setHoveredColumn(null)}
            onClick={() => handleColumnClick(col)}
          >
            {!disabled && !isAIThinking && board[0][col] === 0 && hoveredColumn === col && (
              <span className="text-xs text-muted-foreground">▼</span>
            )}
          </div>
        ))}
      </div>

      {/* Game board */}
      <motion.div 
        className="bg-muted p-3 rounded-lg border"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className={`grid gap-2 ${actualCols === 7 ? 'grid-cols-7' : 'grid-cols-8'}`}>
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const isHovered = hoveredColumn === colIndex;
              const dropPreviewRow = isHovered ? getDropPreviewRow(colIndex) : -1;
              const showPreview = isHovered && dropPreviewRow === rowIndex && !disabled && !isAIThinking;
              const isWinning = isWinningCell(rowIndex, colIndex);
              const cellKey = `${rowIndex}-${colIndex}`;
              const isDropping = droppingDiscs.has(cellKey);

              return (
                <motion.div
                  key={cellKey}
                  className={cn(
                    "aspect-square rounded-full border",
                    "flex items-center justify-center cursor-pointer relative overflow-hidden",
                    "min-w-[35px] min-h-[35px] md:min-w-[50px] md:min-h-[50px]",
                    !cell && "bg-background",
                    !disabled && !isAIThinking && board[0][colIndex] === 0 && "hover:border-muted-foreground"
                  )}
                  onClick={() => handleColumnClick(colIndex)}
                  onMouseEnter={() => setHoveredColumn(colIndex)}
                  onMouseLeave={() => setHoveredColumn(null)}
                >
                  <AnimatePresence mode="wait">
                    {/* Preview disc */}
                    {showPreview && (
                      <motion.div
                        key="preview"
                        className="absolute inset-2 rounded-full bg-muted-foreground/20"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.1 }}
                      />
                    )}
                    
                    {/* Actual disc */}
                    {cell && (
                      <motion.div
                        key={`disc-${cellKey}`}
                        className={cn(
                          "absolute inset-1 rounded-full",
                          cell === 1 ? "bg-red-500" : "bg-yellow-500"
                        )}
                        initial={isDropping ? { y: -300, scale: 0.9 } : { scale: 0 }}
                        animate={isWinning ? {
                          y: 0,
                          scale: [1, 1.05, 1]
                        } : {
                          y: 0,
                          scale: 1
                        }}
                        transition={isDropping ? {
                          type: "spring",
                          damping: 15,
                          stiffness: 250,
                          bounce: 0.3
                        } : {
                          duration: 0.2
                        }}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

    </div>
  );
}