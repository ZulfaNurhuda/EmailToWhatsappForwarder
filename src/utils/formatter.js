/**
 * Formatting utility functions
 * @module utils/formatter
 */

/**
 * Strips HTML tags from text
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function stripHtml(html) {
    if (!html) return "";

    // Remove script and style elements
    html = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    html = html.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');

    // Replace block-level tags with a space
    html = html.replace(/<(h[1-6]|p|div|li|blockquote|pre|br)[\s/]*>/gi, ' ');

    // Remove remaining tags
    html = html.replace(/<[^>]+>/g, '');

    // Decode entities and clean up whitespace
    return html
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Formats file size to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    if (i >= sizes.length) return `${bytes} Bytes`;
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = {
    stripHtml,
    formatFileSize,
};
