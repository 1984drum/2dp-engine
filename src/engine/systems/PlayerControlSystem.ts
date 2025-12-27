import { System, Entity, Transform, Physics } from '../ecs/types';
import inputBridge from '../core/InputBridge';
import eventBus from '../core/EventBus';
import * as Constants from '../../constants';

/**
 * PlayerControlSystem.ts
 * Translates input actions into movement for entities with PlayerControl components.
 */
export class PlayerControlSystem extends System {
    update(dt: number, entities: Entity[]): void {
        const controllable = entities.filter(e =>
            e.components.has('player_control') &&
            e.components.has('physics')
        );

        const isLeft = inputBridge.isActionActive('MOVE_LEFT');
        const isRight = inputBridge.isActionActive('MOVE_RIGHT');
        const isJumpHeld = inputBridge.isActionActive('JUMP');

        for (const entity of controllable) {
            const physics = entity.components.get('physics') as Physics;
            const isGrounded = physics.isGrounded;

            // --- 1. TIMER UPDATES ---
            if (physics.jumpBufferTimer > 0) physics.jumpBufferTimer -= dt * 60;

            // --- 2. JUMP INPUT HANDLING ---
            // Single press logic
            if (isJumpHeld && !physics.jumpProcessed) {
                physics.jumpBufferTimer = Constants.JUMP_BUFFER_FRAMES;
                physics.jumpProcessed = true;
            } else if (!isJumpHeld) {
                physics.jumpProcessed = false;
                // Variable Jump Height: Cut velocity if released while ascending
                if (physics.isJumping && physics.vy < -2) {
                    physics.vy *= 0.35; // More aggressive cut for better tap/hold distinction
                    physics.isJumping = false;
                }
            }

            // --- 3. EXECUTE JUMP ---
            if (physics.jumpBufferTimer > 0 && (isGrounded || physics.coyoteTimer > 0)) {
                physics.vy = Constants.JUMP_FORCE;
                physics.isGrounded = false;
                physics.coyoteTimer = 0;
                physics.jumpBufferTimer = 0;
                physics.isJumping = true;
                eventBus.emit('ENTITY_JUMPED', entity.id);
            }

            // --- 4. GROUNDING / JUMP RESET ---
            if (physics.vy >= 0 && isGrounded) {
                physics.isJumping = false;
            }

            // --- 5. HORIZONTAL MOVEMENT ---
            const currentAccel = isGrounded ? Constants.ACCELERATION : Constants.AIR_ACCELERATION;
            const currentBrake = isGrounded ? Constants.BRAKE_ACCELERATION : (Constants.AIR_ACCELERATION * 1.5);
            const currentFriction = isGrounded ? Constants.FRICTION : Constants.AIR_FRICTION;

            if (isLeft) {
                // If moving opposite way, use snap/brake accel
                if (physics.vx > 0) physics.vx -= currentBrake * dt * 60;
                else if (physics.vx > -Constants.MAX_MOVE_SPEED) {
                    physics.vx -= currentAccel * dt * 60;
                }
            } else if (isRight) {
                if (physics.vx < 0) physics.vx += currentBrake * dt * 60;
                else if (physics.vx < Constants.MAX_MOVE_SPEED) {
                    physics.vx += currentAccel * dt * 60;
                }
            } else {
                // Momentum / Friction
                physics.vx *= Math.pow(currentFriction, dt * 60);
                if (Math.abs(physics.vx) < 0.1) physics.vx = 0;
            }

            // Safety cap for extremely fast movement (sub-stepping handles the rest)
            if (Math.abs(physics.vx) > Constants.MAX_MOVE_SPEED * 1.5) {
                physics.vx = Math.sign(physics.vx) * Constants.MAX_MOVE_SPEED * 1.5;
            }
        }
    }
}
