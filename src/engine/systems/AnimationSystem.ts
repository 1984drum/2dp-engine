import { System, Entity } from '../ecs/types';

/**
 * AnimationSystem.ts
 * Manages frame indices and animation states for entities.
 */
export class AnimationSystem extends System {
    update(dt: number, entities: Entity[]): void {
        const animatable = entities.filter(e => e.components.has('animation'));

        for (const entity of animatable) {
            const anim = entity.components.get('animation') as any;

            anim.timer += dt;
            if (anim.timer >= anim.frameDuration) {
                anim.timer = 0;
                anim.frame = (anim.frame + 1) % anim.frameCount;
            }
        }
    }
}
