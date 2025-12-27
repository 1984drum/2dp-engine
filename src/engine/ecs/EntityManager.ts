import { Entity, EntityId, Component } from './types';

/**
 * EntityManager.ts
 * Handles creation, storage, and retrieval of entities and their components.
 */
class EntityManager {
    private entities: Map<EntityId, Entity> = new Map();

    createEntity(): Entity {
        const id = crypto.randomUUID();
        const entity: Entity = {
            id,
            components: new Map()
        };
        this.entities.set(id, entity);
        return entity;
    }

    removeEntity(id: EntityId) {
        this.entities.delete(id);
    }

    addComponent(entityId: EntityId, component: Component) {
        const entity = this.entities.get(entityId);
        if (entity) {
            entity.components.set(component.type, component);
        }
    }

    removeComponent(entityId: EntityId, componentType: string) {
        const entity = this.entities.get(entityId);
        if (entity) {
            entity.components.delete(componentType);
        }
    }

    getComponent<T extends Component>(entityId: EntityId, type: string): T | undefined {
        return this.entities.get(entityId)?.components.get(type) as T;
    }

    getEntities(): Entity[] {
        return Array.from(this.entities.values());
    }

    /**
     * Get all entities that have a specific set of component types
     */
    query(componentTypes: string[]): Entity[] {
        return this.getEntities().filter(entity =>
            componentTypes.every(type => entity.components.has(type))
        );
    }

    clear() {
        this.entities.clear();
    }
}

export const entityManager = new EntityManager();
export default entityManager;
