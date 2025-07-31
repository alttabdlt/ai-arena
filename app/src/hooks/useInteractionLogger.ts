import { useEffect } from 'react';

export function useInteractionLogger() {
  useEffect(() => {
    // Log all clicks
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Get meaningful information about the clicked element
      const elementInfo = {
        tagName: target.tagName,
        id: target.id || undefined,
        className: target.className || undefined,
        text: target.textContent?.slice(0, 50) || undefined,
        href: (target as HTMLAnchorElement).href || undefined,
        type: (target as HTMLInputElement).type || undefined,
        name: (target as HTMLInputElement).name || undefined,
      };
      
      // Only log meaningful clicks (buttons, links, inputs)
      if (['BUTTON', 'A', 'INPUT', 'SELECT'].includes(target.tagName) || 
          target.onclick || 
          target.closest('button') || 
          target.closest('a')) {
        console.log('🖱️ Click:', {
          element: elementInfo,
          coordinates: { x: e.clientX, y: e.clientY },
          timestamp: new Date().toISOString()
        });
      }
    };

    // Log form submissions
    const handleSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement;
      console.log('📝 Form submission:', {
        formName: form.name || form.id || 'unnamed',
        action: form.action,
        method: form.method,
        timestamp: new Date().toISOString()
      });
    };

    // Log input changes (debounced)
    let inputTimeout: NodeJS.Timeout;
    const handleInput = (e: Event) => {
      const input = e.target as HTMLInputElement;
      
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        console.log('⌨️ Input changed:', {
          name: input.name || input.id || 'unnamed',
          type: input.type,
          valueLength: input.value?.length || 0,
          timestamp: new Date().toISOString()
        });
      }, 500); // Debounce for 500ms
    };

    // Log select changes
    const handleSelectChange = (e: Event) => {
      const select = e.target as HTMLSelectElement;
      console.log('📋 Selection changed:', {
        name: select.name || select.id || 'unnamed',
        value: select.value,
        selectedText: select.selectedOptions[0]?.text,
        timestamp: new Date().toISOString()
      });
    };

    // Add event listeners
    document.addEventListener('click', handleClick, true);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleSelectChange, true);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('submit', handleSubmit, true);
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleSelectChange, true);
      clearTimeout(inputTimeout);
    };
  }, []);
}