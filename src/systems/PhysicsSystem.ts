import { PhysicalEntity, Point } from '../types';
import * as Constants from '../constants';

const {
    GRAVITY, MAX_FALL_SPEED, STEP_HEIGHT, SLOPE_CHECK_DIST,
    ANGLE_RED_THRESHOLD, WORLD_WIDTH, WALL_BOUNCE
} = Constants;

export interface PhysicsDependencies {
    checkPixel: (x: number, y: number, layer: string) => boolean;
    getSurfaceHeight: (x: number, startY: number, layer: string) => number | null;
}

/**
 * Handles horizontal movement and wall collisions for a physical entity.
 */
export const updateHorizontalCollisions = (
    entity: PhysicalEntity,
    stepSize: number,
    steps: number,
    deps: PhysicsDependencies,
    isEnemy: boolean = false
) => {
    let hitWall = false;
    for (let i = 0; i < steps; i++) {
        entity.x += stepSize;

        const checkWall = (sideX: number) => {
            // Player uses more points for more robust collision
            const points = isEnemy
                ? [8, entity.height * 0.5, entity.height - 8]
                : [5, entity.height * 0.25, entity.height * 0.5, entity.height * 0.75, entity.height - 5];

            for (let pt of points) {
                if (deps.checkPixel(sideX, entity.y + pt, 'wall') ||
                    deps.checkPixel(sideX, entity.y + pt, 'breakable')) return true;
                if (isEnemy && deps.checkPixel(sideX, entity.y + pt, 'enemy_wall')) return true;
            }
            return false;
        };

        if (entity.vx < 0 && checkWall(entity.x)) {
            entity.x = Math.ceil(entity.x);
            hitWall = true;
        } else if (entity.vx > 0 && checkWall(entity.x + entity.width)) {
            entity.x = Math.floor(entity.x);
            hitWall = true;
        }

        if (hitWall) {
            if (!isEnemy) entity.vx = -entity.vx * WALL_BOUNCE;
            else entity.vx = 0;
            break;
        }
    }

    if (entity.x < 0) entity.x = 0;
    if (entity.x + entity.width > WORLD_WIDTH) entity.x = WORLD_WIDTH - entity.width;

    return hitWall;
};

/**
 * Handles ceiling collisions for a physical entity.
 */
export const checkCeilingCollision = (entity: PhysicalEntity, deps: PhysicsDependencies) => {
    const isCeiling = (x: number, y: number) =>
        deps.checkPixel(x, y, 'ceiling') || deps.checkPixel(x, y, 'ground') ||
        deps.checkPixel(x, y, 'wall') || deps.checkPixel(x, y, 'breakable');

    const hitCeiling = isCeiling(entity.x + 5, entity.y) ||
        isCeiling(entity.x + entity.width - 5, entity.y) ||
        isCeiling(entity.x + entity.width / 2, entity.y);

    if (hitCeiling) {
        entity.y = Math.ceil(entity.y);
        while (isCeiling(entity.x + entity.width / 2, entity.y)) entity.y++;
        entity.vy = 0;
    }
    return hitCeiling;
};

/**
 * Centralized grounding and slope logic.
 */
export const updateGrounding = (
    entity: PhysicalEntity,
    deps: PhysicsDependencies,
    onMovingPlatform: boolean,
    platformVelocity: { vx: number, vy: number }
) => {
    let groundedThisFrame = false;
    let onPlatformThisFrame = false;
    let slopeAngle = 0;

    if (entity.vy >= 0) {
        const feetY = Math.floor(entity.y + entity.height);
        // If grounded, use STEP_HEIGHT for snapping. If in air, look ahead based on velocity.
        const lookDown = entity.isGrounded ? STEP_HEIGHT : (Math.max(Math.ceil(entity.vy), 4) + 2);

        const checkPoint = (offsetX: number) => {
            for (let y = feetY - STEP_HEIGHT; y < feetY + lookDown; y++) {
                if (deps.checkPixel(entity.x + offsetX, y, 'ground')) return { y, type: 'ground' };
                if (deps.checkPixel(entity.x + offsetX, y, 'platform')) {
                    if (y > feetY - 5) return { y, type: 'platform' };
                }
            }
            return null;
        };

        const offsets = [0, entity.width * 0.33, entity.width * 0.66, entity.width];
        const hits = offsets.map(off => checkPoint(off)).filter(h => h !== null) as { y: number, type: string }[];

        let validHit = null;
        if (hits.length > 0) {
            validHit = hits.sort((a, b) => a.y - b.y)[0];
        }

        if (validHit) {
            const centerX = entity.x + entity.width / 2;
            const run = SLOPE_CHECK_DIST * 2;
            const y1 = deps.getSurfaceHeight(centerX - SLOPE_CHECK_DIST, validHit.y, validHit.type) ?? validHit.y;
            const y2 = deps.getSurfaceHeight(centerX + SLOPE_CHECK_DIST, validHit.y, validHit.type) ?? validHit.y;
            const rise = y2 - y1;
            slopeAngle = Math.atan2(rise, run);

            // Slope steepness check (ANGLE_RED_THRESHOLD)
            if (Math.abs(slopeAngle) > ANGLE_RED_THRESHOLD && validHit.type === 'ground') {
                // Too steep - push back
                entity.x -= entity.vx;
            } else {
                entity.y = validHit.y - entity.height;
                entity.vy = 0;
                groundedThisFrame = true;
                if (validHit.type === 'platform') onPlatformThisFrame = true;
            }
        }
    }

    if (groundedThisFrame) {
        entity.isGrounded = true;
        entity.coyoteTimer = Constants.COYOTE_FRAMES;
        entity.onMovingPlatform = onPlatformThisFrame;
        // Smoothly rotate to match slope
        entity.rotation += (slopeAngle - entity.rotation) * 0.2;
    } else {
        entity.isGrounded = false;
        entity.onMovingPlatform = false;
        if (entity.coyoteTimer > 0) entity.coyoteTimer--;
        // Return to flat in air
        entity.rotation += (0 - entity.rotation) * 0.1;
    }

    return { groundedThisFrame, onPlatformThisFrame, slopeAngle };
};
