export type Listener = (...args: any[]) => void;

class EventBus {
    private listeners: Map<string, Listener[]> = new Map();

    /**
     * Subscribe to an event
     */
    on(event: string, callback: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);
    }

    /**
     * Unsubscribe from an event
     */
    off(event: string, callback: Listener) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            this.listeners.set(event, eventListeners.filter(l => l !== callback));
        }
    }

    /**
     * Emit an event
     */
    emit(event: string, ...args: any[]) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => callback(...args));
        }
    }
}

export const eventBus = new EventBus();
export default eventBus;
