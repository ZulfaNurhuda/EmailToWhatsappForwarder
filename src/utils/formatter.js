/**
 * @file Provides utility functions for formatting data, such as stripping HTML and formatting file sizes.
 * @module utils/formatter
 */

/**
 * Strips all HTML tags from a string to extract plain text content.
 * This function is designed to handle various HTML elements, including scripts, styles,
 * and common block-level tags, to produce a clean, readable text version of the HTML input.
 *
 * @param {string} html - The HTML content string to be sanitized. Can be an empty string or null/undefined.
 * @returns {string} The extracted plain text. Returns an empty string if the input is falsy.
 */
function stripHtml(html) {
    // Return an empty string immediately if the input is null, undefined, or empty.
    if (!html) return "";

    // 1. Remove script and style blocks completely, as their content is not useful as plain text.
    // The [\S\s]*? pattern performs a non-greedy match for any character, including newlines.
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gmi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gmi, "");

    // 2. Replace common block-level tags with a newline to preserve paragraph breaks and structure.
    // This helps maintain readability by separating distinct blocks of text.
    text = text.replace(/<\/(h[1-6]|p|div|li|blockquote|pre)>/gi, "\n");
    text = text.replace(/<(br|hr)[\s/]*>/gi, "\n");

    // 3. Remove any remaining HTML tags (like <span>, <b>, <i>, etc.) without replacing them with spaces,
    // as they are typically inline and do not represent structural breaks.
    text = text.replace(/<[^>]+>/g, "");

    // 4. Decode common HTML entities to their corresponding characters.
    // This ensures that special characters are displayed correctly in plain text.
    text = text
        .replace(/&nbsp;/g, " ")       // Non-breaking space
        .replace(/&amp;/g, "&")        // Ampersand
        .replace(/&lt;/g, "<")         // Less-than
        .replace(/&gt;/g, ">")         // Greater-than
        .replace(/&quot;/g, '"')      // Double quote
        .replace(/&#39;/g, "'");      // Single quote

    // 5. Clean up whitespace:
    // - Replace multiple newlines or spaces with a single newline to avoid large empty gaps.
    // - Trim leading/trailing whitespace from the final result.
    text = text.replace(/\n\s*\n/g, "\n").trim();

    return text;
}

/**
 * Converts a file size in bytes into a human-readable string format (e.g., KB, MB, GB).
 * The function automatically selects the most appropriate unit.
 *
 * @param {number} bytes - The file size in bytes. Must be a non-negative number.
 * @returns {string} A formatted string representing the file size (e.g., "1.23 MB").
 */
function formatFileSize(bytes) {
    // Handle the edge case where the size is 0.
    if (bytes === 0) return "0 Bytes";

    // Define the units for file sizes.
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    
    // Prevent errors from Math.log(0) and handle negative numbers.
    if (bytes < 0) return "Invalid size";

    // Calculate the appropriate unit index from the sizes array.
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    // If the size is too large for the defined units, return it in bytes.
    if (i >= sizes.length) return `${bytes} Bytes`;

    // Calculate the formatted size and fix it to 2 decimal places.
    const formattedSize = parseFloat((bytes / Math.pow(1024, i)).toFixed(2));

    // Return the formatted size with its corresponding unit.
    return `${formattedSize} ${sizes[i]}`;
}

// Export the utility functions for use in other modules.
module.exports = {
    stripHtml,
    formatFileSize,
};