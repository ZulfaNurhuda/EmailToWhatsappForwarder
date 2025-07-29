const { delay } = require('../helpers');

describe('helpers utilities', () => {
    describe('delay', () => {
        // Set a timeout for this test
        jest.setTimeout(2000);

        test('should resolve after the specified time', async () => {
            const startTime = Date.now();
            const delayTime = 1000; // 1 second

            await delay(delayTime);

            const endTime = Date.now();
            const elapsedTime = endTime - startTime;

            // Check if the elapsed time is approximately the delay time
            expect(elapsedTime).toBeGreaterThanOrEqual(delayTime - 50); // Allow a small margin of error
            expect(elapsedTime).toBeLessThan(delayTime + 250); // Allow for some overhead
        });

        test('should not block the event loop', async () => {
            let nonBlockingCheck = false;

            // Set a timeout that will run during the delay
            setTimeout(() => {
                nonBlockingCheck = true;
            }, 50);

            await delay(100);
            expect(nonBlockingCheck).toBe(true);
        });
    });
});
