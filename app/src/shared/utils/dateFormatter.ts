export function formatTimestamp(date: Date = new Date()): string {
  // Format timestamp for local time (will use browser's timezone)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  
  // Reconstruct in ISO-like format but with local time
  const dateParts: Record<string, string> = {};
  parts.forEach(part => {
    dateParts[part.type] = part.value;
  });
  
  // Get timezone offset
  const offset = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  const offsetSign = offset >= 0 ? '+' : '-';
  const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}.${milliseconds}${offsetString}`;
}
