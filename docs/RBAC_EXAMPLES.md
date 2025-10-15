# RBAC Ownership System Examples

This document shows how the improved RBAC system handles ownership checks at the route level for both single resources and collections.

## How the New System Works

### 1. Middleware Level
The RBAC middleware sets a flag when ownership is required:

```javascript
// In rbacMiddleware.js
if (permission.includes('own')) {
  req.requiresOwnershipCheck = true;  // Flag for route-level checking
  return true;  // Allow request to proceed
}
```

### 2. Route Level
Each route handles ownership filtering differently based on the operation type.

## Examples by Operation Type

### GET All Resources (List)

**Request:** `GET /api/orders`

**RBAC Config:**
```javascript
orders: {
  roles: {
    user: {
      read: ["own"]  // User can only see their own orders
    }
  }
}
```

**Route Logic:**
```javascript
// In crud.js - GET /:collectionName
if (req.requiresOwnershipCheck) {
  if (collectionName !== 'users') {
    filter.userId = req.user.uid;  // Only fetch user's own documents
  } else {
    filter.id = req.user.uid;      // For users collection
  }
}

// Database query becomes:
// db.orders.find({ userId: "user123" })
```

**Response:** Only orders where `userId` matches the authenticated user's ID.

### GET Single Resource

**Request:** `GET /api/orders/order456`

**RBAC Config:** Same as above

**Route Logic:**
```javascript
// In crud.js - GET /:collectionName/:id
let queryFilter = { id: req.params.id };

if (req.requiresOwnershipCheck) {
  queryFilter.userId = req.user.uid;  // Ensure user owns this specific order
}

// Database query becomes:
// db.orders.findOne({ id: "order456", userId: "user123" })
```

**Possible Outcomes:**
- **200 OK:** Returns the order if it exists and belongs to the user
- **404 Not Found:** If order doesn't exist OR doesn't belong to the user

### CREATE Resource

**Request:** `POST /api/orders` with body:
```json
{
  "total": 99.99,
  "status": "pending"
}
```

**RBAC Config:** Same as above

**Route Logic:**
```javascript
// In crud.js - POST /:collectionName
if (req.requiresOwnershipCheck) {
  if (!documentData.userId) {
    documentData.userId = req.user.uid;  // Auto-assign ownership
  }
  else if (documentData.userId !== req.user.uid) {
    return res.status(403).json({
      msg: 'Forbidden: You can only create documents for yourself'
    });
  }
}

// Final document saved:
// {
//   "total": 99.99,
//   "status": "pending",
//   "userId": "user123"  // Automatically added
// }
```

### UPDATE Resource

**Request:** `PUT /api/orders/order456` with body:
```json
{
  "status": "completed",
  "total": 149.99
}
```

**RBAC Config:** Same as above

**Route Logic:**
```javascript
// In crud.js - PUT /:collectionName/:id
let queryFilter = { id: req.params.id };

if (req.requiresOwnershipCheck) {
  queryFilter.userId = req.user.uid;  // Ensure user owns the document
}

// Database operation:
// db.orders.findOneAndUpdate(
//   { id: "order456", userId: "user123" },  // Only if user owns it
//   { status: "completed", total: 149.99 }
// )
```

### DELETE Resource

**Request:** `DELETE /api/orders/order456`

**RBAC Config:** Same as above

**Route Logic:**
```javascript
// In crud.js - DELETE /:collectionName/:id
let queryFilter = { id: req.params.id };

if (req.requiresOwnershipCheck) {
  queryFilter.userId = req.user.uid;  // Ensure user owns the document
}

// Database operation:
// db.orders.findOneAndDelete({ id: "order456", userId: "user123" })
```

### Aggregation Pipeline

**Request:** `POST /api/orders/pipe` with body:
```json
{
  "pipeline": [
    { "$match": { "status": "completed" } },
    { "$group": { "_id": null, "total": { "$sum": "$total" } } }
  ]
}
```

**RBAC Config:** Same as above

**Route Logic:**
```javascript
// In crud.js - POST /:collectionName/pipe
let finalPipeline = [...pipeline];

if (req.requiresOwnershipCheck) {
  const ownershipMatch = {
    $match: { userId: req.user.uid }
  };

  // Prepend ownership filter to pipeline
  finalPipeline.unshift(ownershipMatch);
}

// Final pipeline becomes:
// [
//   { "$match": { "userId": "user123" } },           // Auto-added ownership filter
//   { "$match": { "status": "completed" } },         // Original first stage
//   { "$group": { "_id": null, "total": { "$sum": "$total" } } }
// ]
```

## Admin vs User Access

### Admin with "all" permissions:
```javascript
orders: {
  roles: {
    admin: {
      read: ["all"],  // Can read any order
      delete: ["all"] // Can delete any order
    }
  }
}
```

**Request:** `GET /api/orders`

**Route Logic:**
```javascript
if (req.requiresOwnershipCheck) {
  // This won't execute for admins since req.requiresOwnershipCheck = false
}
// Database query: db.orders.find({})  // No filtering
```

### User with "own" permissions:
```javascript
orders: {
  roles: {
    user: {
      read: ["own"],  // Can only read own orders
      delete: ["own"] // Can only delete own orders
    }
  }
}
```

**Request:** `GET /api/orders`

**Route Logic:**
```javascript
if (req.requiresOwnershipCheck) {
  filter.userId = req.user.uid;  // Applied for users
}
// Database query: db.orders.find({ userId: "user123" })
```

## Mixed Permissions Example

```javascript
products: {
  roles: {
    user: {
      read: ["all"],   // Can read all products
      write: ["own"],  // Can only edit own products
      create: true,
      delete: ["own"]
    }
  }
}
```

### GET All Products (Read "all")
**Request:** `GET /api/products`
- `req.requiresOwnershipCheck = false` (for read operation)
- Database query: `db.products.find({})`  // No filtering
- Returns all products

### Update Product (Write "own")
**Request:** `PUT /api/products/product123`
- `req.requiresOwnershipCheck = true` (for write operation)
- Database query: `db.products.findOneAndUpdate({ id: "product123", userId: "user123" })`
- Only allows updates to own products

## Batch Operations

### Batch Delete
**Request:** `DELETE /api/orders/batch` with body:
```json
{
  "ids": ["order1", "order2", "order3"]
}
```

**Route Logic:**
```javascript
if (req.requiresOwnershipCheck) {
  deleteFilter.id = { $in: ids };
  deleteFilter.userId = req.user.uid;  // Only delete user's own orders
}

// Database query:
// db.orders.deleteMany({
//   id: { $in: ["order1", "order2", "order3"] },
//   userId: "user123"
// })
```

## Benefits of This Approach

1. **Performance**: Ownership filtering happens in a single database query
2. **Security**: No separate ownership check needed - it's built into the query
3. **Flexibility**: Different logic for different operation types
4. **Consistency**: Same pattern across all CRUD operations
5. **Maintainability**: Clear separation between middleware and route logic

## Error Handling

### Common ownership-related errors:

```json
// Trying to create document for someone else
{
  "msg": "Forbidden: You can only create documents for yourself"
}

// Trying to access someone else's document (results in 404)
{
  "msg": "Document not found or you are not authorized to access it"
}

// Trying to update/delete someone else's document (results in 404)
{
  "msg": "Document not found or you are not authorized to update/delete it"
}
```

The system gracefully handles unauthorized access by returning 404 (not found) instead of 403 (forbidden) for security reasons - it doesn't reveal that the resource exists.