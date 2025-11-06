export function toLocalTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString(); 
}