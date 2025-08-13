export function formatTimestamp(date: Date = new Date()): string {
  // Format timestamp for Singapore Time (GMT+8)
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  const formatter = new Intl.DateTimeFormat('en-SG', options);
  const parts = formatter.formatToParts(date);
  
  // Reconstruct in ISO-like format but with local time
  const dateParts: { [key: string]: string } = {};
  parts.forEach(part => {
    dateParts[part.type] = part.value;
  });
  
  // Get milliseconds separately
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}.${ms}+08:00`;
}