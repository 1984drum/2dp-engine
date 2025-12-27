import { System, Entity, Transform, Physics, Collider } from '../ecs/types';
import * as Constants from '../../constants';

/**
 * ScriptingSystem.ts
 * Handles AI behaviors and logic scripts for entities.
 */
export class ScriptingSystem extends System {
    private checkPixel: (x: number, y: number, layer: string) => boolean;

    constructor(checkPixelFn: (x: number, y: number, layer: string) => boolean) {
        super();
        this.checkPixel = checkPixelFn;
    }

    update(dt: number, entities: Entity[]): void {
        const enemies = entities.filter(e => e.components.has('enemy'));

        for (const entity of enemies) {
            const physics = entity.components.get('physics') as Physics;
            const transform = entity.components.get('transform') as Transform;
            const collider = entity.components.get('collider') as Collider;

            // Initialize speed if not set or zero
            if (physics.vx === 0) {
                physics.vx = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.5);
            }

            const direction = Math.sign(physics.vx);
            const speed = Math.abs(physics.vx);

            // 1. Edge Detection
            const feetY = transform.y + collider.height;
            const lookAheadX = transform.x + (direction > 0 ? collider.width + 5 : -5);

            const isGroundAhead = this.checkPixel(lookAheadX, feetY + 5, 'ground') ||
                this.checkPixel(lookAheadX, feetY + 5, 'platform');

            // 2. Wall Detection
            const isWallAhead = this.checkPixel(lookAheadX, transform.y + collider.height / 2, 'wall') ||
                this.checkPixel(lookAheadX, transform.y + collider.height / 2, 'enemy_wall');

            if (!isGroundAhead || isWallAhead) {
                // Turn around
                physics.vx = -direction * speed;
                // Nudge position slightly to avoid getting stuck in a loop
                transform.x += physics.vx * dt * 60;
            }
        }
    }
}
