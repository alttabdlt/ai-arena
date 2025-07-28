import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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
        <p className="text-muted-foreground">Waiting for game board to initialize...</p>
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mt-4"></div>
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
        <div className="bg-yellow-500 text-white p-2 mb-2 rounded text-sm">
          ⚠️ This game is using the old 6x7 board. Start a new game for the 8x8 board.
        </div>
      )}
      
      {/* Column hover indicators */}
      <div className={`grid gap-1 mb-2 ${actualCols === 7 ? 'grid-cols-7' : 'grid-cols-8'}`}>
        {Array.from({ length: actualCols }, (_, col) => (
          <motion.div
            key={col}
            className={cn(
              "h-8 flex items-center justify-center cursor-pointer",
              !disabled && !isAIThinking && board[0][col] === 0 && "hover:bg-primary/10"
            )}
            whileHover={!disabled && !isAIThinking && board[0][col] === 0 ? { scale: 1.1 } : {}}
            whileTap={!disabled && !isAIThinking && board[0][col] === 0 ? { scale: 0.95 } : {}}
            onMouseEnter={() => setHoveredColumn(col)}
            onMouseLeave={() => setHoveredColumn(null)}
            onClick={() => handleColumnClick(col)}
          >
            <AnimatePresence>
              {!disabled && !isAIThinking && board[0][col] === 0 && hoveredColumn === col && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs text-muted-foreground"
                >
                  ▼
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Game board */}
      <motion.div 
        className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg border-2 border-blue-500"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
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
                    "aspect-square rounded-full border-2 border-primary/30",
                    "flex items-center justify-center cursor-pointer relative overflow-hidden",
                    "min-w-[40px] min-h-[40px] md:min-w-[60px] md:min-h-[60px]", // Explicit minimum dimensions
                    !cell && "bg-gray-100 dark:bg-gray-800", // More visible empty cell color
                    !disabled && !isAIThinking && board[0][colIndex] === 0 && "hover:border-primary/50"
                  )}
                  style={{ 
                    width: '100%',
                    backgroundColor: cell === 0 ? '#f3f4f6' : undefined // Ensure empty cells are visible
                  }}
                  onClick={() => handleColumnClick(colIndex)}
                  onMouseEnter={() => setHoveredColumn(colIndex)}
                  onMouseLeave={() => setHoveredColumn(null)}
                  whileHover={!disabled && !isAIThinking && board[0][colIndex] === 0 ? {
                    borderColor: "rgba(var(--primary), 0.5)"
                  } : {}}
                  transition={{ duration: 0.2 }}
                >
                  <AnimatePresence mode="wait">
                    {/* Preview disc */}
                    {showPreview && (
                      <motion.div
                        key="preview"
                        className="absolute inset-2 rounded-full bg-primary/20"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.15 }}
                      />
                    )}
                    
                    {/* Actual disc */}
                    {cell && (
                      <motion.div
                        key={`disc-${cellKey}`}
                        className={cn(
                          "absolute inset-2 rounded-full",
                          cell === 1 ? "bg-gradient-to-br from-red-400 to-red-600" : "bg-gradient-to-br from-yellow-400 to-yellow-600"
                        )}
                        initial={isDropping ? { y: -400, scale: 0.8 } : { scale: 0 }}
                        animate={isWinning ? {
                          y: 0,
                          scale: [1, 1.1, 1],
                          rotate: [0, 5, -5, 0]
                        } : {
                          y: 0,
                          scale: 1
                        }}
                        transition={isWinning ? {
                          scale: {
                            duration: 0.5,
                            repeat: Infinity,
                            repeatDelay: 1
                          },
                          rotate: {
                            duration: 0.5,
                            repeat: Infinity,
                            repeatDelay: 1
                          },
                          y: {
                            type: "spring",
                            damping: 12,
                            stiffness: 200,
                            bounce: 0.4
                          }
                        } : {
                          type: "spring",
                          damping: 12,
                          stiffness: 200,
                          bounce: 0.4
                        }}
                      >
                        {/* Inner shine effect */}
                        <div className={cn(
                          "absolute inset-1 rounded-full",
                          cell === 1 
                            ? "bg-gradient-to-tl from-transparent to-red-300/50" 
                            : "bg-gradient-to-tl from-transparent to-yellow-300/50"
                        )} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Loading indicator */}
      <AnimatePresence>
        {isAIThinking && (
          <motion.div 
            className="mt-4 text-center"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <motion.div 
                className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              AI is thinking...
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}