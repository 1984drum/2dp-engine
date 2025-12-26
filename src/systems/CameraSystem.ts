/**
 * CameraSystem.ts
 * Manages specialized camera movement including Dead Zones, Smoothing (Lerp),
 * and World Clamping.
 */

export interface CameraState {
    x: number;          // Current camera X (top-left)
    y: number;          // Current camera Y (top-left)
    targetX: number;    // Where the camera wants to be
    targetY: number;    // Where the camera wants to be
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface CameraConfig {
    deadZoneWidth: number;
    deadZoneHeight: number;
    lerpFactor: number;
    verticalOffset: number; // Offset to keep player slightly below center
}

export class CameraSystem {
    private state: CameraState;
    private config: CameraConfig;

    constructor(initialState: CameraState, config: CameraConfig) {
        this.state = initialState;
        this.config = config;
    }

    /**
     * Updates the camera position based on the player's position and current viewport/world bounds.
     */
    update(
        player: Rect,
        viewport: { width: number; height: number },
        world: { width: number; height: number }
    ): CameraState {
        // 1. Calculate the player's center relative to the current camera view
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2 + this.config.verticalOffset;

        // 2. Current viewport center in world space
        const currentCenterX = this.state.x + viewport.width / 2;
        const currentCenterY = this.state.y + viewport.height / 2;

        // 3. Distance from center
        const dx = playerCenterX - currentCenterX;
        const dy = playerCenterY - currentCenterY;

        // 4. Bounding Box (Dead Zone) Logic
        // Calculate how much we need to move the *target* to keep the player in the box
        let moveX = 0;
        let moveY = 0;

        if (Math.abs(dx) > this.config.deadZoneWidth) {
            moveX = dx - Math.sign(dx) * this.config.deadZoneWidth;
        }

        if (Math.abs(dy) > this.config.deadZoneHeight) {
            moveY = dy - Math.sign(dy) * this.config.deadZoneHeight;
        }

        // Update target position
        this.state.targetX += moveX;
        this.state.targetY += moveY;

        // 5. Linear Interpolation (Lerp) for Smoothing
        // We move a percentage of the way to the target every frame
        this.state.x += (this.state.targetX - this.state.x) * this.config.lerpFactor;
        this.state.y += (this.state.targetY - this.state.y) * this.config.lerpFactor;

        // 6. World Clamping - REMOVED for free panning
        // this.state.x = Math.max(0, Math.min(world.width - viewport.width, this.state.x));
        // this.state.y = Math.max(0, Math.min(world.height - viewport.height, this.state.y));

        return this.state;
    }

    /**
     * Instantly pans the camera by a delta (used for editor panning).
     */
    pan(dx: number, dy: number, viewport: { width: number; height: number }, world: { width: number; height: number }): CameraState {
        this.state.x -= dx;
        this.state.y -= dy;

        this.state.targetX = this.state.x;
        this.state.targetY = this.state.y;

        return this.state;
    }

    /**
     * Resets the camera to a specific position (e.g., spawn).
     */
    reset(x: number, y: number, viewport: { width: number; height: number }, world: { width: number; height: number }): CameraState {
        // Center the camera on the target coordinates
        this.state.x = x - viewport.width / 2;
        this.state.y = y - viewport.height / 2;

        this.state.targetX = this.state.x;
        this.state.targetY = this.state.y;

        return this.state;
    }

    getState(): CameraState {
        return this.state;
    }
}
