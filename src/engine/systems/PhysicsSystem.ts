import { System, Entity, Transform, Physics, Collider } from '../ecs/types';
import * as Constants from '../../constants';

/**
 * PhysicsSystem.ts
 * Applies gravity and basic kinematics to entities with Transform and Physics components.
 */
export class PhysicsSystem extends System {
    update(dt: number, entities: Entity[]): void {
        const physicsEntities = entities.filter(e =>
            e.components.has('transform') && e.components.has('physics')
        );

        for (const entity of physicsEntities) {
            const physics = entity.components.get('physics') as Physics;

            if (physics.isStatic) continue;

            // Apply gravity with multipliers
            let appliedGravity = Constants.GRAVITY;
            if (physics.vy > 0) appliedGravity *= Constants.FALL_GRAVITY_MULTIPLIER;

            // Update velocity (dt is in seconds)
            physics.vy += appliedGravity * dt * 60; // Scale to per-frame for consistency with constants

            if (physics.vy > Constants.MAX_FALL_SPEED) {
                physics.vy = Constants.MAX_FALL_SPEED;
            }
        }
    }
}
