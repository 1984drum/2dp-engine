/**
 * InputBridge.ts
 * Maps hardware events (Keyboard/Mouse) to internal game actions.
 */
class InputBridge {
    private actions: Map<string, boolean> = new Map();
    private keyMap: Record<string, string> = {
        'ArrowLeft': 'MOVE_LEFT',
        'KeyA': 'MOVE_LEFT',
        'ArrowRight': 'MOVE_RIGHT',
        'KeyD': 'MOVE_RIGHT',
        'ArrowUp': 'JUMP',
        'KeyW': 'JUMP',
        'Space': 'JUMP',
        'ShiftLeft': 'RUN',
        'ShiftRight': 'RUN'
    };

    init() {
        window.addEventListener('keydown', (e) => {
            if (this.keyMap[e.code]) e.preventDefault();
            this.handleKey(e.code, true);
        });
        window.addEventListener('keyup', (e) => this.handleKey(e.code, false));
    }

    private handleKey(code: string, isDown: boolean) {
        const action = this.keyMap[code];
        if (action) {
            this.actions.set(action, isDown);
        }
    }

    isActionActive(action: string): boolean {
        return this.actions.get(action) || false;
    }
}

export const inputBridge = new InputBridge();
export default inputBridge;
