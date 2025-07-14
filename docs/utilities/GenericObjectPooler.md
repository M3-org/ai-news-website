# GenericObjectPooler Utility

## Overview
`GenericObjectPooler<T>` is a generic C# class for efficient object pooling of MonoBehaviour components in Unity. It helps reduce instantiation overhead by reusing objects, making it ideal for bullets, effects, or any frequently spawned GameObjects.

## Core Responsibilities
- Manage a pool of inactive GameObjects of type `T` (where `T : MonoBehaviour`).
- Provide methods to get and return objects to the pool.
- Instantiate new objects if the pool is empty.

## Main Features
- `prefab`: The prefab to instantiate and pool.
- `poolSize`: The initial size of the pool.
- `InitializePool()`: Creates the pool and instantiates objects.
- `GetObject()`: Retrieves an object from the pool or instantiates a new one if empty.
- `ReturnObject(T obj)`: Returns an object to the pool and deactivates it.
- `GetAllObjects()`: Returns all objects currently in the pool.

## How It Works
1. Call `InitializePool()` to create and fill the pool with inactive objects.
2. Use `GetObject()` to retrieve and activate an object for use.
3. When done, call `ReturnObject()` to deactivate and return the object to the pool.
4. The pool will instantiate new objects if it runs out.

## Best Practices
- Use for frequently spawned/despawned objects (bullets, effects, etc.).
- Always return objects to the pool when no longer needed.
- Set `poolSize` based on expected usage.

## Error Handling
- Only pools objects with the required component `T`.
- Instantiates new objects if the pool is empty.

## Integration Points
- Gameplay systems: For efficient object reuse.
- Effects, projectiles, or pooled UI elements.

## Example Usage
```csharp
// Example for pooling bullets
public class Bullet : MonoBehaviour { }
public GenericObjectPooler<Bullet> bulletPool;

void Start() {
    bulletPool.prefab = bulletPrefab;
    bulletPool.poolSize = 50;
    bulletPool.InitializePool();
}

void FireBullet() {
    Bullet bullet = bulletPool.GetObject();
    // Set up bullet...
}

void OnBulletHit(Bullet bullet) {
    bulletPool.ReturnObject(bullet);
}
``` 