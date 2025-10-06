/**
 * Entity Manager utility for normalized data structure management
 * Addresses Requirements: 4.1, 4.2, 4.3
 */

import { BaseEntity, NormalizedState } from '../types';

export class EntityManager<T extends BaseEntity> {
  private entities: Record<string, T> = {};
  private ids: string[] = [];

  constructor(initialState?: NormalizedState<T>) {
    if (initialState) {
      this.entities = { ...initialState.byId };
      this.ids = [...initialState.allIds];
    }
  }

  /**
   * Add a new entity to the normalized state
   */
  add(entity: T): void {
    this.entities[entity.id] = entity;
    if (!this.ids.includes(entity.id)) {
      this.ids.push(entity.id);
    }
  }

  /**
   * Add multiple entities at once
   */
  addMany(entities: T[]): void {
    entities.forEach(entity => this.add(entity));
  }

  /**
   * Update an existing entity
   */
  update(id: string, updates: Partial<T>): void {
    if (this.entities[id]) {
      this.entities[id] = { 
        ...this.entities[id], 
        ...updates, 
        updatedAt: new Date() 
      };
    }
  }

  /**
   * Remove an entity by ID
   */
  remove(id: string): void {
    delete this.entities[id];
    this.ids = this.ids.filter(entityId => entityId !== id);
  }

  /**
   * Remove multiple entities by IDs
   */
  removeMany(ids: string[]): void {
    ids.forEach(id => this.remove(id));
  }

  /**
   * Get entity by ID
   */
  getById(id: string): T | undefined {
    return this.entities[id];
  }

  /**
   * Get all entities as an array
   */
  getAll(): T[] {
    return this.ids.map(id => this.entities[id]).filter(Boolean);
  }

  /**
   * Query entities with a predicate function
   */
  query(predicate: (entity: T) => boolean): T[] {
    return this.getAll().filter(predicate);
  }

  /**
   * Find first entity matching predicate
   */
  find(predicate: (entity: T) => boolean): T | undefined {
    return this.getAll().find(predicate);
  }

  /**
   * Check if entity exists
   */
  has(id: string): boolean {
    return id in this.entities;
  }

  /**
   * Get count of entities
   */
  count(): number {
    return this.ids.length;
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities = {};
    this.ids = [];
  }

  /**
   * Get normalized state representation
   */
  getState(): Pick<NormalizedState<T>, 'byId' | 'allIds'> {
    return {
      byId: { ...this.entities },
      allIds: [...this.ids]
    };
  }

  /**
   * Sort entities by a key
   */
  sortBy<K extends keyof T>(key: K, direction: 'asc' | 'desc' = 'asc'): T[] {
    const entities = this.getAll();
    return entities.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Group entities by a key
   */
  groupBy<K extends keyof T>(key: K): Record<string, T[]> {
    const groups: Record<string, T[]> = {};
    
    this.getAll().forEach(entity => {
      const groupKey = String(entity[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(entity);
    });
    
    return groups;
  }

  /**
   * Paginate entities
   */
  paginate(page: number, pageSize: number): {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    const total = this.count();
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    const data = this.ids
      .slice(startIndex, endIndex)
      .map(id => this.entities[id])
      .filter(Boolean);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages
    };
  }
}

/**
 * Create initial normalized state
 */
export function createNormalizedState<T extends BaseEntity>(
  entities: T[] = []
): NormalizedState<T> {
  const manager = new EntityManager<T>();
  manager.addMany(entities);
  
  return {
    ...manager.getState(),
    loading: false,
    error: null,
    lastUpdated: null
  };
}

/**
 * Helper to update normalized state immutably
 */
export function updateNormalizedState<T extends BaseEntity>(
  state: NormalizedState<T>,
  updater: (manager: EntityManager<T>) => void
): NormalizedState<T> {
  const manager = new EntityManager<T>(state);
  updater(manager);
  
  return {
    ...manager.getState(),
    loading: state.loading,
    error: state.error,
    lastUpdated: new Date()
  };
}