# Detailed Example: Using the Database Query Feature

This guide provides a step-by-step example of how to register and execute complex database queries using the new API.

## TypeScript Support

If you are using TypeScript on the client side, you can use the provided `types.ts` file to get type safety and autocompletion. The file includes interfaces for the query data, execution context, and request/response objects.

### Example Usage in TypeScript

```typescript
import { QueryData, ExecuteQueryRequest, ExecuteQueryResponse } from './types';

// Define the query data with type safety
const queryData: QueryData = {
  name: 'getUserOrders',
  description: 'Get all orders for a specific user with product details',
  collectionName: 'orders',
  pipeline: [
    { $match: { userId: '{{userId}}' } },
    { $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'productDetails'
      }
    },
    { $unwind: '$productDetails' },
    { $project: {
        orderId: '$_id',
        userId: 1,
        productName: '$productDetails.name',
        quantity: 1,
        price: 1,
        totalAmount: { $multiply: ['$quantity', '$price'] },
        createdAt: 1
      }
    }
  ],
};

// Define the request to execute the query with type safety
const executeRequest: ExecuteQueryRequest = {
  params: { userId: 'user123' },
  options: { sort: { createdAt: -1 }, limit: 10 }
};

// Function to register a new query
const registerQuery = async (queryData: QueryData): Promise<QueryData> => {
  const response = await fetch('http://localhost:5000/api/queries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_AUTH_TOKEN',
    },
    body: JSON.stringify(queryData),
  });

  return response.json();
};

// Function to execute a query
const executeQuery = async (queryName: string, request: ExecuteQueryRequest): Promise<ExecuteQueryResponse> => {
  const response = await fetch(`http://localhost:5000/api/queries/${queryName}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_AUTH_TOKEN',
    },
    body: JSON.stringify(request),
  });

  return response.json();
};

// Example usage
registerQuery(queryData)
  .then((registeredQuery) => {
    console.log('Registered query:', registeredQuery);
    return executeQuery(registeredQuery.name, executeRequest);
  })
  .then((result) => {
    console.log('Query result:', result);
    // Update the query
    const updatedQueryData: QueryData = {
      ...queryData,
      description: 'Updated description: Get all orders for a specific user with product details, sorted by date.',
    };
    return registerQuery(updatedQueryData);
  })
  .then((updatedQuery) => {
    console.log('Updated query:', updatedQuery);
    // Execute the updated query
    return executeQuery(updatedQuery.name, executeRequest);
  })
  .then((result) => {
    console.log('Updated query result:', result);
    // Delete the query
    return fetch(`http://localhost:5000/api/queries/${queryData.name}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer YOUR_AUTH_TOKEN',
      },
    });
  })
  .then((response) => response.json())
  .then((deleteResult) => {
    console.log('Delete result:', deleteResult);
  })
  .catch((error) => {
    console.error('Error:', error);
  });
```

## Prerequisites

1.  **Running Server:** Ensure your Node.js server is running.
2.  **Authentication:** You need a valid authentication token to access the API endpoints. You can obtain this by logging in to your application.

---

## Step 1: Define and Register a Query

You can register a query by sending a POST request to the `/api/queries` endpoint with the query definition.

### Updating Existing Queries

If you try to register a query with a name that already exists, the system will automatically update the existing query instead of throwing an error. This is useful when you need to modify the pipeline, description, or collection of an existing query.

**Request to Update:**
```bash
curl -X POST http://localhost:5000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "name": "getUserOrders",
    "description": "Get all orders for a specific user with product details, sorted by date.",
    "collectionName": "orders",
    "pipeline": [
      { "$match": { "userId": "{{userId}}" } },
      { "$lookup": {
          "from": "products",
          "localField": "items.productId",
          "foreignField": "_id",
          "as": "productDetails"
        }
      },
      { "$unwind": "$productDetails" },
      { "$project": {
          "orderId": "$_id",
          "userId": 1,
          "productName": "$productDetails.name",
          "quantity": 1,
          "price": 1,
          "totalAmount": { "$multiply": ["$quantity", "$price"] },
          "createdAt": 1
        }
      }
    ]
  }'
```

**Response (Updated Query):**
```json
{
  "_id": "638d1f2b3c9d440001a1b2c3",
  "name": "getUserOrders",
  "description": "Get all orders for a specific user with product details, sorted by date.",
  "collectionName": "orders",
  "pipeline": [
    { "$match": { "userId": "{{userId}}" } },
    { "$lookup": {
        "from": "products",
        "localField": "items.productId",
        "foreignField": "_id",
        "as": "productDetails"
      }
    },
    { "$unwind": "$productDetails" },
    { "$project": {
        "orderId": "$_id",
        "userId": 1,
        "productName": "$productDetails.name",
        "quantity": 1,
        "price": 1,
        "totalAmount": { "$multiply": ["$quantity", "$price"] },
        "createdAt": 1
      }
    }
  ],
  "createdAt": "2022-12-05T10:30:03.123Z",
  "updatedAt": "2022-12-05T10:35:15.456Z",
  "__v": 0
}
```

**Note:** The `updatedAt` timestamp will be updated to reflect when the query was last modified.

### Method 1: Define the Query as a JSON Object

You can define your query as a JSON object directly in your request body.

**Request:**

```bash
curl -X POST http://localhost:5000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "name": "getUserOrders",
    "description": "Get all orders for a specific user with product details.",
    "collectionName": "orders",
    "pipeline": [
      { "$match": { "userId": "{{userId}}" } },
      { "$lookup": {
          "from": "products",
          "localField": "items.productId",
          "foreignField": "_id",
          "as": "productDetails"
        }
      },
      { "$unwind": "$productDetails" },
      { "$project": {
          "orderId": "$_id",
          "userId": 1,
          "productName": "$productDetails.name",
          "quantity": 1,
          "price": 1,
          "totalAmount": { "$multiply": ["$quantity", "$price"] },
          "createdAt": 1
        }
      }
    ]
  }'
```

**Why include the `description` key?**

The `description` key is not strictly required for the query to execute, but it provides several important benefits:

1.  **Documentation:** It serves as inline documentation for your query, making it clear what the query does, what collection it operates on, and what parameters it expects. This is especially useful when you have many queries and need to remember what each one does.
2.  **Discoverability:** It makes your queries more discoverable and self-describing. A developer could browse the list of queries and their descriptions to understand what's available in the system without having to read the pipeline.
3.  **Maintenance:** It helps with maintenance by providing context about the query's purpose, which is valuable when debugging or optimizing queries.

### Method 2: Define a Query in JavaScript and Convert it to JSON

This is a more practical approach, as you can write your query in your preferred code editor and then convert it to JSON for registration.

**Example in JavaScript:**

```javascript
// 1. Define your query as you normally would.
const getUserOrdersQuery = {
  name: 'getUserOrders',
  description: 'Get all orders for a specific user with product details.',
  collectionName: 'orders',
  pipeline: [
    { $match: { userId: '{{userId}}' } },
    { $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'productDetails'
      }
    },
    { $unwind: '$productDetails' },
    { $project: {
        orderId: '$_id',
        userId: 1,
        productName: '$productDetails.name',
        quantity: 1,
        price: 1,
        totalAmount: { $multiply: ['$quantity', '$price'] },
        createdAt: 1
      }
    }
  ]
};

// 2. Prepare the payload for the API call.
const queryData = getUserOrdersQuery;

// 3. Register the query using fetch or any HTTP client.
const registerQuery = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/queries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_AUTH_TOKEN',
      },
      body: JSON.stringify(queryData),
    });

    const result = await response.json();
    console.log('Registered query:', result);
  } catch (error) {
    console.error('Error registering query:', error);
  }
};

registerQuery();

// Example of updating and deleting a query
const updateAndDeleteQuery = async () => {
  try {
    // First register a query
    const initialResult = await registerQuery(queryData);
    console.log('Initial query:', initialResult);
    
    // Execute the query
    const executeRequest = {
      params: { userId: 'user123' },
      options: { sort: { createdAt: -1 }, limit: 10 }
    };
    const executeResult = await executeQuery(initialResult.name, executeRequest);
    console.log('Query result:', executeResult);
    
    // Update the query
    const updatedQueryData = {
      ...queryData,
      description: 'Updated description: Get all orders for a specific user with product details, sorted by date.',
    };
    const updatedResult = await registerQuery(updatedQueryData);
    console.log('Updated query:', updatedResult);
    
    // Execute the updated query
    const updatedExecuteResult = await executeQuery(updatedResult.name, executeRequest);
    console.log('Updated query result:', updatedExecuteResult);
    
    // Delete the query
    const deleteResponse = await fetch(`http://localhost:5000/api/queries/${queryData.name}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer YOUR_AUTH_TOKEN',
      },
    });
    const deleteResult = await deleteResponse.json();
    console.log('Delete result:', deleteResult);
    
  } catch (error) {
    console.error('Error in update and delete flow:', error);
  }
};

updateAndDeleteQuery();
```

**Response (for both methods):**

```json
{
  "_id": "638d1f2b3c9d440001a1b2c3",
  "name": "getUserOrders",
  "description": "Get all orders for a specific user with product details.",
  "collectionName": "orders",
  "pipeline": [
    { "$match": { "userId": "{{userId}}" } },
    { "$lookup": {
        "from": "products",
        "localField": "items.productId",
        "foreignField": "_id",
        "as": "productDetails"
      }
    },
    { "$unwind": "$productDetails" },
    { "$project": {
        "orderId": "$_id",
        "userId": 1,
        "productName": "$productDetails.name",
        "quantity": 1,
        "price": 1,
        "totalAmount": { "$multiply": ["$quantity", "$price"] },
        "createdAt": 1
      }
    }
  ],
  "createdAt": "2022-12-05T10:30:03.123Z",
  "updatedAt": "2022-12-05T10:30:03.123Z",
  "__v": 0
}
```

---

## Step 2: Delete a Query

You can delete a query by sending a DELETE request to the `/api/queries/:name` endpoint.

**Request:**
```bash
curl -X DELETE http://localhost:5000/api/queries/getUserOrders \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response:**
```json
{
  "msg": "Query deleted successfully.",
  "deletedQuery": {
    "_id": "638d1f2b3c9d440001a1b2c3",
    "name": "getUserOrders",
    "description": "Get all orders for a specific user with product details.",
    "collectionName": "orders",
    "pipeline": [
      { "$match": { "userId": "{{userId}}" } },
      { "$lookup": {
          "from": "products",
          "localField": "items.productId",
          "foreignField": "_id",
          "as": "productDetails"
        }
      },
      { "$unwind": "$productDetails" },
      { "$project": {
          "orderId": "$_id",
          "userId": 1,
          "productName": "$productDetails.name",
          "quantity": 1,
          "price": 1,
          "totalAmount": { "$multiply": ["$quantity", "$price"] },
          "createdAt": 1
        }
      }
    ],
    "createdAt": "2022-12-05T10:30:03.123Z",
    "updatedAt": "2022-12-05T10:35:15.456Z",
    "__v": 0
  }
}
```

**Error Response (if query not found):**
```json
{
  "msg": "Query not found."
}
```

---

## Step 3: Execute the Query

Once the query is registered, you can execute it by sending a `POST` request to the `/api/queries/:name/execute` endpoint.

**Request:**

```bash
curl -X POST http://localhost:5000/api/queries/getUserOrders/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "params": {
      "userId": "user123"
    },
    "options": {
      "sort": { "createdAt": -1 },
      "limit": 10
    }
  }'
```

**Response:**

```json
{
  "result": [
    {
      "orderId": "638d1f2b3c9d440001a1b2c4",
      "userId": "user123",
      "productName": "Laptop",
      "quantity": 1,
      "price": 999.99,
      "totalAmount": 999.99,
      "createdAt": "2022-12-05T10:30:03.123Z"
    },
    {
      "orderId": "638d1f2b3c9d440001a1b2c5",
      "userId": "user123",
      "productName": "Mouse",
      "quantity": 2,
      "price": 29.99,
      "totalAmount": 59.98,
      "createdAt": "2022-12-04T15:20:30.456Z"
    }
  ],
  "metadata": {
    "total": 2,
    "executedPipeline": [
      { "$match": { "userId": "user123" } },
      { "$lookup": {
          "from": "products",
          "localField": "items.productId",
          "foreignField": "_id",
          "as": "productDetails"
        }
      },
      { "$unwind": "$productDetails" },
      { "$project": {
          "orderId": "$_id",
          "userId": 1,
          "productName": "$productDetails.name",
          "quantity": 1,
          "price": 1,
          "totalAmount": { "$multiply": ["$quantity", "$price"] },
          "createdAt": 1
        }
      },
      { "$sort": { "createdAt": -1 } },
      { "$limit": 10 }
    ],
    "queryName": "getUserOrders"
  }
}
```

---

## Example: Query with Parameters

You can create queries that accept parameters using the `{{parameterName}}` syntax. These parameters will be replaced with actual values when the query is executed.

**Example Query:**

```javascript
const getProductsByCategoryQuery = {
  name: 'getProductsByCategory',
  description: 'Get products by category with pagination',
  collectionName: 'products',
  pipeline: [
    { $match: { category: '{{category}}', isActive: true } },
    { $sort: { name: 1 } },
    { $skip: {{skip}} },
    { $limit: {{limit}} }
  ]
};
```

**To execute this query:**

```bash
curl -X POST http://localhost:5000/api/queries/getProductsByCategory/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "params": {
      "category": "electronics",
      "skip": 0,
      "limit": 10
    }
  }'
```

This will execute the query with the `category` parameter set to `"electronics"`, `skip` set to `0`, and `limit` set to `10`.

---

## Example: Query with Aggregation

You can create complex aggregation queries for data analysis and reporting.

**Example Query:**

```javascript
const getSalesReportQuery = {
  name: 'getSalesReport',
  description: 'Generate a sales report by product category',
  collectionName: 'orders',
  pipeline: [
    { $match: { status: 'completed', createdAt: { $gte: '{{startDate}}', $lte: '{{endDate}}' } } },
    { $unwind: '$items' },
    { $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    { $group: {
        _id: '$product.category',
        totalSales: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: { $multiply: ['$items.quantity', '$items.price'] } }
      }
    },
    { $sort: { totalSales: -1 } }
  ]
};
```

**To execute this query:**

```bash
curl -X POST http://localhost:5000/api/queries/getSalesReport/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "params": {
      "startDate": "2023-01-01T00:00:00.000Z",
      "endDate": "2023-12-31T23:59:59.999Z"
    },
    "options": {
      "includeTotal": true
    }
  }'
```

This will generate a sales report for the specified date range, grouped by product category.

---

## Real-World Example: User Analytics Dashboard

Let's create a more complex, real-world example: a query to generate user analytics for a dashboard. This query will perform several aggregations to provide insights into user behavior.

### Step 1: Define the User Analytics Query

Now, let's define the `getUserAnalytics` query. This query will calculate various metrics for a specific user over a time period.

```javascript
const getUserAnalyticsQuery = {
  name: 'getUserAnalytics',
  description: 'Generate user analytics for a dashboard',
  collectionName: 'user_activities',
  pipeline: [
    { $match: { 
        userId: '{{userId}}', 
        activityDate: { $gte: '{{startDate}}', $lte: '{{endDate}}' } 
      }
    },
    { $group: {
        _id: null,
        totalActivities: { $sum: 1 },
        uniqueDays: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$activityDate' } } },
        activitiesByType: {
          $push: {
            type: '$activityType',
            timestamp: '$activityDate'
          }
        }
      }
    },
    { $project: {
        _id: 0,
        totalActivities: 1,
        activeDays: { $size: '$uniqueDays' },
        activitiesByType: 1,
        averageActivitiesPerDay: { $divide: ['$totalActivities', { $size: '$uniqueDays' }] }
      }
    }
  ]
};
```

### Step 2: Register the Query

```bash
curl -X POST http://localhost:5000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "name": "getUserAnalytics",
    "description": "Generate user analytics for a dashboard",
    "collectionName": "user_activities",
    "pipeline": [
      { "$match": { 
          "userId": "{{userId}}", 
          "activityDate": { "$gte": "{{startDate}}", "$lte": "{{endDate}}" } 
        }
      },
      { "$group": {
          "_id": null,
          "totalActivities": { "$sum": 1 },
          "uniqueDays": { "$addToSet": { "$dateToString": { "format": "%Y-%m-%d", "date": "$activityDate" } } },
          "activitiesByType": {
            "$push": {
              "type": "$activityType",
              "timestamp": "$activityDate"
            }
          }
        }
      },
      { "$project": {
          "_id": 0,
          "totalActivities": 1,
          "activeDays": { "$size": "$uniqueDays" },
          "activitiesByType": 1,
          "averageActivitiesPerDay": { "$divide": ["$totalActivities", { "$size": "$uniqueDays" }] }
        }
      }
    ]
  }'
```

### Step 3: Execute the Query

```bash
curl -X POST http://localhost:5000/api/queries/getUserAnalytics/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "params": {
      "userId": "user123",
      "startDate": "2023-01-01T00:00:00.000Z",
      "endDate": "2023-12-31T23:59:59.999Z"
    },
    "options": {
      "includeTotal": true
    }
  }'
```

This will generate user analytics for the specified user and date range, providing insights into their activity patterns.