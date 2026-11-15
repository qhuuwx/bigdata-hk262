/**
 * CSV Parsing Utilities
 * Provides RFC 4180 compliant parsing for CSV lines with quotes, escapes, and commas.
 */

/**
 * Splits a single CSV row into cell values respecting quotes.
 * @param {string} line - Single line of CSV text
 * @returns {string[]} Array of parsed string values
 */
function parseCSVLine(line) {
  if (typeof line !== 'string') return [];
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

module.exports = {
  parseCSVLine
};
