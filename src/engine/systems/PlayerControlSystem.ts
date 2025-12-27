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
                // Variable Jump Height: Smoother cut for floaty physics
                // Instead of sharp 0.2 cut, use 0.5 to retain some momentum arc
                if (physics.isJumping && physics.vy < -2.0) {
                    physics.vy = Math.max(physics.vy * 0.5, -2.0); // Gentle damping
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
                physics.airMoveTimer = 0; // Reset air boost timer
                eventBus.emit('ENTITY_JUMPED', entity.id);
            }

            // --- 4. GROUNDING / JUMP RESET ---
            if (physics.vy >= 0 && isGrounded) {
                physics.isJumping = false;
                physics.airMoveTimer = 0;
            }

            // --- 5. HORIZONTAL MOVEMENT ---
            const currentAccel = isGrounded ? Constants.ACCELERATION : Constants.AIR_ACCELERATION;
            const currentBrake = isGrounded ? Constants.BRAKE_ACCELERATION : (Constants.AIR_ACCELERATION * 1.5);
            const currentFriction = isGrounded ? Constants.FRICTION : Constants.AIR_FRICTION;

            // Air Momentum Boost Logic
            let maxSpeed = Constants.MAX_MOVE_SPEED;
            let moveAccel = currentAccel;

            if (physics.isJumping && !isGrounded) {
                // If holding direction same as movement, boost
                if ((isLeft && physics.vx < 0) || (isRight && physics.vx > 0)) {
                    physics.airMoveTimer++;
                    if (physics.airMoveTimer > 10) {
                        maxSpeed *= 1.2; // 20% speed boost for committed jumps
                        moveAccel *= 1.5; // Snappier air control
                    }
                } else {
                    physics.airMoveTimer = 0;
                }
            } else {
                physics.airMoveTimer = 0;
            }

            if (isLeft) {
                // If moving opposite way, use snap/brake accel
                if (physics.vx > 0) physics.vx -= currentBrake * dt * 60;
                else if (physics.vx > -maxSpeed) {
                    physics.vx -= moveAccel * dt * 60;
                }
            } else if (isRight) {
                if (physics.vx < 0) physics.vx += currentBrake * dt * 60;
                else if (physics.vx < maxSpeed) {
                    physics.vx += moveAccel * dt * 60;
                }
            } else {
                // Momentum / Friction
                physics.vx *= Math.pow(currentFriction, dt * 60);
                if (Math.abs(physics.vx) < 0.1) physics.vx = 0;
            }

            // --- 6. AUTO-RESPAWN DETECTION ---
            const transform = entity.components.get('transform') as Transform;
            const isOOB = transform.y > Constants.WORLD_HEIGHT + 100;

            if (isOOB) {
                physics.respawnTimer += dt;
                if (physics.respawnTimer >= 1.5) {
                    eventBus.emit('PLAYER_OUT_OF_BOUNDS', entity.id);
                    physics.respawnTimer = 0; // Reset after emitting to avoid spam
                }
            } else if (isGrounded) {
                physics.respawnTimer = 0;
            }

            // ABSOLUTE SPEED CAP
            // Prevent runaway velocity from slopes/boosts
            const ABSOLUTE_MAX = 5.0;
            if (Math.abs(physics.vx) > ABSOLUTE_MAX) {
                physics.vx = Math.sign(physics.vx) * ABSOLUTE_MAX;
            }
        }
    }
}
