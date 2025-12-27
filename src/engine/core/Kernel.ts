/**
 * Kernel.ts
 * Manages the high-precision requestAnimationFrame loop and deltaTime.
 */

export type TickCallback = (dt: number) => void;

class Kernel {
    private lastTime: number = 0;
    private running: boolean = false;
    private subscribers: Set<TickCallback> = new Set();
    private frameId: number | null = null;

    /**
     * Start the main game loop
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    /**
     * Stop the main game loop
     */
    stop() {
        this.running = false;
        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    /**
     * Subscribe to tick updates
     */
    subscribe(callback: TickCallback) {
        this.subscribers.add(callback);
    }

    /**
     * Unsubscribe from tick updates
     */
    unsubscribe(callback: TickCallback) {
        this.subscribers.delete(callback);
    }

    private loop = (currentTime: number) => {
        if (!this.running) return;

        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Cap deltaTime to avoid huge jumps (e.g., when switching tabs)
        const dt = Math.min(deltaTime, 0.1);

        this.subscribers.forEach(callback => callback(dt));

        this.frameId = requestAnimationFrame(this.loop);
    };
}

export const kernel = new Kernel();
export default kernel;
