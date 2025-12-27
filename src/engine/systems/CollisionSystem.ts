import { System, Entity, Transform, Physics, Collider } from '../ecs/types';
import * as Constants from '../../constants';
import eventBus from '../core/EventBus';

/**
 * CollisionSystem.ts
 * Handles world collisions and entity-to-entity interaction.
 * Integrates high-progress logic from previously verified systems.
 */
export class CollisionSystem extends System {
    private checkPixel: (x: number, y: number, layer: string) => boolean;

    constructor(checkPixelFn: (x: number, y: number, layer: string) => boolean) {
        super();
        this.checkPixel = checkPixelFn;
    }

    update(dt: number, entities: Entity[]): void {
        const collidableEntities = entities.filter(e =>
            e.components.has('transform') && e.components.has('physics') && e.components.has('collider')
        );

        for (const entity of collidableEntities) {
            this.resolveWorldCollisions(entity, dt);
        }

        this.resolveEntityCollisions(collidableEntities);
    }

    private resolveWorldCollisions(entity: Entity, dt: number) {
        const transform = entity.components.get('transform') as Transform;
        const physics = entity.components.get('physics') as Physics;
        const collider = entity.components.get('collider') as Collider;
        const isPlayer = entity.components.has('player_control');

        const moveX = physics.vx * dt * 60;
        const moveY = physics.vy * dt * 60;

        // --- 1. HORIZONTAL RESOLUTION (Sub-stepping) ---
        const xSteps = Math.ceil(Math.abs(moveX));
        const xStepSize = xSteps > 0 ? moveX / xSteps : 0;

        for (let i = 0; i < xSteps; i++) {
            transform.x += xStepSize;

            const sideX = physics.vx > 0 ? transform.x + collider.width : transform.x;
            // Check multiple points along height for wall collision
            const checkPoints = [5, collider.height / 2, collider.height - 5];
            let hitWall = false;
            for (const py of checkPoints) {
                if (this.checkPixel(sideX, transform.y + py, 'wall') ||
                    this.checkPixel(sideX, transform.y + py, 'breakable')) {
                    hitWall = true;
                    break;
                }
            }

            if (hitWall) {
                physics.vx = 0;
                transform.x = physics.vx > 0 ? Math.floor(transform.x) : Math.ceil(transform.x);
                break;
            }
        }

        // --- 2. VERTICAL RESOLUTION ---
        transform.y += moveY;

        // Ceiling Check
        if (physics.vy < 0) {
            const headY = transform.y;
            if (this.checkPixel(transform.x + 5, headY, 'wall') ||
                this.checkPixel(transform.x + collider.width - 5, headY, 'wall')) {
                physics.vy = 0;
                transform.y = Math.ceil(transform.y);
            }
        }

        // --- 3. GROUNDING & SLOPE ADHERENCE ---
        let groundedThisFrame = false;
        let currentSlopeAngle = 0;

        if (physics.vy >= 0) {
            const feetY = Math.floor(transform.y + collider.height);
            // Look deeper if already grounded to stick to downward slopes
            const lookDistance = physics.isGrounded ? Constants.STEP_HEIGHT : Math.max(physics.vy, 4);

            let bestY = null;
            let groundType = 'ground';

            const checkXPoints = [2, collider.width / 2, collider.width - 2];
            for (const ox of checkXPoints) {
                const px = transform.x + ox;
                for (let dy = -Constants.STEP_HEIGHT; dy <= lookDistance; dy++) {
                    const ty = feetY + dy;
                    if (this.checkPixel(px, ty, 'ground')) {
                        if (bestY === null || ty < bestY) { bestY = ty; groundType = 'ground'; }
                    }
                    if (this.checkPixel(px, ty, 'platform') && dy >= -2) {
                        if (bestY === null || ty < bestY) { bestY = ty; groundType = 'platform'; }
                    }
                }
            }

            if (bestY !== null) {
                // Determine Slope Angle
                const centerX = transform.x + collider.width / 2;
                const y1 = this.getSurfaceHeight(centerX - 5, bestY, groundType) ?? bestY;
                const y2 = this.getSurfaceHeight(centerX + 5, bestY, groundType) ?? bestY;
                currentSlopeAngle = Math.atan2(y2 - y1, 10);

                // Adhere to slope if not too steep
                if (Math.abs(currentSlopeAngle) < Constants.MAX_GROUND_ANGLE) {
                    transform.y = bestY - collider.height;
                    physics.vy = 0;
                    groundedThisFrame = true;
                }
            }
        }

        if (groundedThisFrame) {
            if (!physics.isGrounded) eventBus.emit('ENTITY_GROUNDED', entity.id);
            physics.isGrounded = true;
            physics.coyoteTimer = Constants.COYOTE_FRAMES; // Reset coyote time
            // Visual rotation for player/enemies
            transform.rotation = transform.rotation + (currentSlopeAngle - transform.rotation) * 0.2;
        } else {
            physics.isGrounded = false;
            if (physics.coyoteTimer > 0) {
                physics.coyoteTimer -= dt * 60;
            }
            transform.rotation = transform.rotation + (0 - transform.rotation) * 0.1;
        }
    }

    private getSurfaceHeight(x: number, startY: number, layer: string): number | null {
        for (let dy = -15; dy <= 15; dy++) {
            if (this.checkPixel(x, startY + dy, layer) && !this.checkPixel(x, startY + dy - 1, layer)) {
                return startY + dy;
            }
        }
        return null;
    }

    private resolveEntityCollisions(entities: Entity[]) {
        // AABB Collision detection
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const a = entities[i];
                const b = entities[j];

                if (this.checkAABB(a, b)) {
                    eventBus.emit('COLLISION_EVENT', { entityA: a.id, entityB: b.id });
                }
            }
        }
    }

    private checkAABB(a: Entity, b: Entity): boolean {
        const tA = a.components.get('transform') as Transform;
        const cA = a.components.get('collider') as Collider;
        const tB = b.components.get('transform') as Transform;
        const cB = b.components.get('collider') as Collider;

        return tA.x < tB.x + cB.width &&
            tA.x + cA.width > tB.x &&
            tA.y < tB.y + cB.height &&
            tA.y + cA.height > tB.y;
    }
}
