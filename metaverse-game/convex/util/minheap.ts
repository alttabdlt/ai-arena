// Simple MinHeap implementation for pathfinding
export function MinHeap<T>(compareFn: (a: T, b: T) => boolean) {
  const heap: T[] = [];

  function bubbleUp(index: number) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (compareFn(heap[parentIndex], heap[index])) {
        [heap[parentIndex], heap[index]] = [heap[index], heap[parentIndex]];
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  function bubbleDown(index: number) {
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < heap.length && compareFn(heap[smallest], heap[left])) {
        smallest = left;
      }
      if (right < heap.length && compareFn(heap[smallest], heap[right])) {
        smallest = right;
      }

      if (smallest !== index) {
        [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
        index = smallest;
      } else {
        break;
      }
    }
  }

  return {
    push(item: T) {
      heap.push(item);
      bubbleUp(heap.length - 1);
    },

    pop(): T | undefined {
      if (heap.length === 0) return undefined;
      if (heap.length === 1) return heap.pop();

      const min = heap[0];
      heap[0] = heap.pop()!;
      bubbleDown(0);
      return min;
    },

    size(): number {
      return heap.length;
    },
  };
}