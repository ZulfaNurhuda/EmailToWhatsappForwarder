const { formatFileSize, stripHtml, formatImagePlaceholders } = require('../formatter');

describe('formatter utilities', () => {
    // Tests for formatFileSize
    describe('formatFileSize', () => {
        test('should format bytes correctly', () => {
            expect(formatFileSize(0)).toBe('0 Bytes');
            expect(formatFileSize(500)).toBe('500 Bytes');
            expect(formatFileSize(1023)).toBe('1023 Bytes');
        });

        test('should format kilobytes correctly', () => {
            expect(formatFileSize(1024)).toBe('1 KB');
            expect(formatFileSize(1536)).toBe('1.5 KB');
            expect(formatFileSize(1024 * 500)).toBe('500 KB');
        });

        test('should format megabytes correctly', () => {
            expect(formatFileSize(1024 * 1024)).toBe('1 MB');
            expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
        });

        test('should format gigabytes correctly', () => {
            expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
        });
    });

    // Tests for stripHtml
    describe('stripHtml', () => {
        test('should return an empty string if no html is provided', () => {
            expect(stripHtml(null)).toBe('');
            expect(stripHtml(undefined)).toBe('');
        });

        test('should remove basic html tags', () => {
            const html = '<p>Hello <b>World</b></p>';
            expect(stripHtml(html)).toBe('Hello World');
        });

        test('should remove style and script tags completely', () => {
            const html = `<style>p{color:red;}</style><script>alert("hello");</script><span>Some Text</span>`;
            expect(stripHtml(html)).toBe('Some Text');
        });

        test('should handle complex html', () => {
            const html = '<div><h1>Title</h1><p>This is a paragraph with <a href="#">a link</a>.</p></div>';
            expect(stripHtml(html)).toBe('Title\nThis is a paragraph with a link.');
        });

        test('should condense whitespace', () => {
            const html = '<p>Extra   spaces</p>';
            expect(stripHtml(html)).toBe('Extra spaces');
        });
    });

    // Tests for formatImagePlaceholders
    describe('formatImagePlaceholders', () => {
        test('should format image placeholders correctly', () => {
            const textWithImage = 'Hello, World!\n[image: some_image.png]\nAnother line.';
            const expectedFormattedText = 'Hello, World!\n```\n[image: some_image.png] => Lihat di attachment\n```\nAnother line.';
            expect(formatImagePlaceholders(textWithImage)).toBe(expectedFormattedText);
        });

        test('should handle multiple image placeholders', () => {
            const textWithMultipleImages = 'First image: [image: img1.jpg]\nSecond image: [image: img2.jpeg]';
            const expectedFormattedText = 'First image: ```\n[image: img1.jpg] => Lihat di attachment\n```\nSecond image: ```\n[image: img2.jpeg] => Lihat di attachment\n```';
            expect(formatImagePlaceholders(textWithMultipleImages)).toBe(expectedFormattedText);
        });

        test('should not modify text without image placeholders', () => {
            const plainText = 'This is a plain text email with no images.';
            expect(formatImagePlaceholders(plainText)).toBe(plainText);
        });
    });
});
