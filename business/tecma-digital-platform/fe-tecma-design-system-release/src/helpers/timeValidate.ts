export const validateTimeInput = (time: string): string => {
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
  if (isoDatePattern.test(time)) {
    // Extract the time part from the ISO date
    time = time.split('T')[1].split(':').slice(0, 2).join(':');
  }
  const parts = time.split(':');
  if (parts.length === 2) {
    let [hour, minute] = parts;
    // Validate and format hours (00 to 23)
    let hourNumber = parseInt(hour, 10);
    if (isNaN(hourNumber) || hourNumber < 0) hourNumber = 0;
    if (hourNumber > 23) hourNumber = 23;
    hour = hourNumber < 10 ? `0${hourNumber}` : `${hourNumber}`;

    // Validate and format minutes (00 to 59)
    let minuteNumber = parseInt(minute, 10);
    if (isNaN(minuteNumber) || minuteNumber < 0) minuteNumber = 0;
    if (minuteNumber > 59) minuteNumber = 59;
    minute = minuteNumber < 10 ? `0${minuteNumber}` : `${minuteNumber}`;

    return `${hour}:${minute}`;
  }
  return time;
};
