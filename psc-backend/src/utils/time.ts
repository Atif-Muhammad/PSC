// Pakistan Time utility functions
export function parsePakistanDate(dateString: string): Date {
  // Handle yyyy-MM-dd strings (from bookingDetails) by parsing as local date
  // to prevent UTC shift causing off-by-one day issues
  if (!dateString) return new Date();

  const str = String(dateString);
  // If it's an ISO string with time info, take just the date part
  const datePart = str.includes('T') ? str.split('T')[0] : str;

  const parts = datePart.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    if (!isNaN(date.getTime())) return date;
  }

  // Fallback for other formats
  const fallback = new Date(dateString);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

export function getPakistanDate(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }),
  );
}

export function formatPakistanDate(date: Date): string {
  // Format date for Pakistan timezone
  return date.toLocaleDateString('en-PK', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function normalizeDate(dateString: string): Date {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date;
}
