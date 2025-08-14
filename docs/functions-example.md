# Detailed Example: Using the Firebase Cloud Function-like Feature

This guide provides a step-by-step example of how to register and execute functions using the new API.

## TypeScript Support

If you are using TypeScript on the client side, you can use the provided `types.ts` file to get type safety and autocompletion. The file includes interfaces for the function data, execution context, and request/response objects.

### Example Usage in TypeScript

```typescript
import { FunctionData, ExecuteFunctionRequest, ExecuteFunctionResponse } from './types';

// Define the function data with type safety
const functionData: FunctionData = {
  name: 'addNumbers',
  description: 'Adds two numbers together.',
  code: '(a: number, b: number) => a + b',
  parameters: [
    { name: 'a', type: 'number', description: 'The first number' },
    { name: 'b', type: 'number', description: 'The second number' },
  ],
};

// Define the request to execute the function with type safety
const executeRequest: ExecuteFunctionRequest = {
  args: [5, 3],
};

// Function to register a new function
const registerFunction = async (functionData: FunctionData): Promise<FunctionData> => {
  const response = await fetch('http://localhost:5000/api/functions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_AUTH_TOKEN',
    },
    body: JSON.stringify(functionData),
  });

  return response.json();
};

// Function to execute a function
const executeFunction = async (functionName: string, request: ExecuteFunctionRequest): Promise<ExecuteFunctionResponse> => {
  const response = await fetch(`http://localhost:5000/api/functions/${functionName}/execute`, {
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
registerFunction(functionData)
  .then((registeredFunction) => {
    console.log('Registered function:', registeredFunction);
    return executeFunction(registeredFunction.name, executeRequest);
  })
  .then((result) => {
    console.log('Function result:', result);
    // Update the function
    const updatedFunctionData: FunctionData = {
      ...functionData,
      description: 'Updated description: Adds two numbers together and returns the result.',
    };
    return registerFunction(updatedFunctionData);
  })
  .then((updatedFunction) => {
    console.log('Updated function:', updatedFunction);
    // Execute the updated function
    return executeFunction(updatedFunction.name, executeRequest);
  })
  .then((result) => {
    console.log('Updated function result:', result);
    // Delete the function
    return fetch(`http://localhost:5000/api/functions/${functionData.name}`, {
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

## Step 1: Define and Register a Function

You can register a function in two ways:

### Updating Existing Functions

If you try to register a function with a name that already exists, the system will automatically update the existing function instead of throwing an error. This is useful when you need to modify the code, description, or parameters of an existing function.

**Request to Update:**
```bash
curl -X POST http://localhost:5000/api/functions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "name": "addNumbers",
    "description": "Adds two numbers together and returns the result.",
    "code": "(a, b) => { return a + b; }",
    "parameters": [
      { "name": "a", "type": "number", "description": "The first number" },
      { "name": "b", "type": "number", "description": "The second number" }
    ]
  }'
```

**Response (Updated Function):**
```json
{
  "_id": "638d1f2b3c9d440001a1b2c3",
  "name": "addNumbers",
  "description": "Adds two numbers together and returns the result.",
  "code": "(a, b) => { return a + b; }",
  "parameters": [
    { "name": "a", "type": "number", "description": "The first number" },
    { "name": "b", "type": "number", "description": "The second number" }
  ],
  "createdAt": "2022-12-05T10:30:03.123Z",
  "updatedAt": "2022-12-05T10:35:15.456Z",
  "__v": 0
}
```

**Note:** The `updatedAt` timestamp will be updated to reflect when the function was last modified.

### Method 1: Define the Function as a String

You can define your function as a string directly in your request body.

**Request:**

```bash
curl -X POST http://localhost:5000/api/functions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "name": "addNumbers",
    "description": "Adds two numbers together.",
    "code": "(a, b) => a + b",
    "parameters": [
      { "name": "a", "type": "number", "description": "The first number" },
      { "name": "b", "type": "number", "description": "The second number" }
    ]
  }'
```

**Why include the `parameters` key?**

The `parameters` key is not strictly required for the function to execute, but it provides several important benefits:

1.  **Documentation:** It serves as inline documentation for your function, making it clear what parameters it expects, their types, and their descriptions. This is especially useful when you have many functions and need to remember what each one does.
2.  **Future-Proofing for Validation:** It allows for future validation of the arguments passed to the function. For example, we could use this schema to automatically check if the correct number of arguments were provided and if they are of the correct type before executing the function.
3.  **Discoverability:** It makes your functions more discoverable and self-describing. A developer could browse the list of functions and their parameters to understand what's available in the system without having to read the code.

While the function code itself defines what parameters it expects, the `parameters` key provides a structured way to document and potentially validate those parameters.

### Method 2: Define a Real JavaScript Function and Convert it to a String

This is a more practical approach, as you can write your function in your preferred code editor and then convert it to a string for registration.

**Example in JavaScript:**

```javascript
// 1. Define your function as you normally would.
const addNumbers = (a, b) => {
  return a + b;
};

// 2. Convert the function to a string.
const functionCode = addNumbers.toString();

console.log('Function Code:', functionCode);
// Output: Function Code: (a, b) => { return a + b; }

// 3. Prepare the payload for the API call.
const functionData = {
  name: 'addNumbers',
  description: 'A function that adds two numbers together.',
  code: functionCode,
  parameters: [
    { name: 'a', type: 'number', description: 'The first number' },
    { name: 'b', 'type': 'number', description: 'The second number' },
  ],
};

// 4. Register the function using fetch or any HTTP client.
const registerFunction = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/functions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_AUTH_TOKEN',
      },
      body: JSON.stringify(functionData),
    });

    const result = await response.json();
    console.log('Registered function:', result);
  } catch (error) {
    console.error('Error registering function:', error);
  }
};

registerFunction();

// Example of updating and deleting a function
const updateAndDeleteFunction = async () => {
  try {
    // First register a function
    const initialResult = await registerFunction(functionData);
    console.log('Initial function:', initialResult);
    
    // Execute the function
    const executeResult = await executeFunction(initialResult.name, executeRequest);
    console.log('Function result:', executeResult);
    
    // Update the function
    const updatedFunctionData = {
      ...functionData,
      description: 'Updated description: A function that adds two numbers together with better documentation.',
    };
    const updatedResult = await registerFunction(updatedFunctionData);
    console.log('Updated function:', updatedResult);
    
    // Execute the updated function
    const updatedExecuteResult = await executeFunction(updatedResult.name, executeRequest);
    console.log('Updated function result:', updatedExecuteResult);
    
    // Delete the function
    const deleteResponse = await fetch(`http://localhost:5000/api/functions/${functionData.name}`, {
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

updateAndDeleteFunction();
```

**Response (for both methods):**

```json
{
  "_id": "638d1f2b3c9d440001a1b2c3",
  "name": "addNumbers",
  "description": "Adds two numbers together.",
  "code": "(a, b) => { return a + b; }",
  "parameters": [
    { "name": "a", "type": "number", "description": "The first number" },
    { "name": "b", "type": "number", "description": "The second number" }
  ],
  "createdAt": "2022-12-05T10:30:03.123Z",
  "updatedAt": "2022-12-05T10:30:03.123Z",
  "__v": 0
}
```

---

## Step 2: Delete a Function

You can delete a function by sending a DELETE request to the `/api/functions/:name` endpoint.

**Request:**
```bash
curl -X DELETE http://localhost:5000/api/functions/addNumbers \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response:**
```json
{
  "msg": "Function deleted successfully.",
  "deletedFunction": {
    "_id": "638d1f2b3c9d440001a1b2c3",
    "name": "addNumbers",
    "description": "Adds two numbers together and returns the result.",
    "code": "(a, b) => { return a + b; }",
    "parameters": [
      { "name": "a", "type": "number", "description": "The first number" },
      { "name": "b", "type": "number", "description": "The second number" }
    ],
    "createdAt": "2022-12-05T10:30:03.123Z",
    "updatedAt": "2022-12-05T10:35:15.456Z",
    "__v": 0
  }
}
```

**Error Response (if function not found):**
```json
{
  "msg": "Function not found."
}
```

---

## Step 3: Execute the Function

Once the function is registered, you can execute it by sending a `POST` request to the `/api/functions/:name/execute` endpoint.

**Request:**

```bash
curl -X POST http://localhost:5000/api/functions/addNumbers/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "args": [5, 3]
  }'
```

**Response:**

```json
{
  "result": 8
}
```

---

## Example: Function that Interacts with the Database

You can also register functions that interact with your database. The function will have access to the `db` object, which is the MongoDB connection.

**Example Function:**

```javascript
const getUserById = async (userId) => {
  const User = db.model('users');
  const user = await User.findOne({ id: userId });
  return user;
};

const functionCode = getUserById.toString();

const functionData = {
  name: 'getUserById',
  description: 'Retrieves a user by their ID.',
  code: functionCode,
  parameters: [
    { name: 'userId', type: 'string', description: 'The ID of the user to retrieve' },
  ],
};
```

When you execute this function, it will query the `users` collection in your MongoDB database and return the user with the specified ID.

---

## Example: Function that Uses the Context

When a function is executed, it has access to a context object that includes the following variables:

*   `args`: An array of arguments passed to the function.
*   `db`: The MongoDB database connection.
*   `console`: The console object for logging.

**Example Function:**

```javascript
const processUserData = (userId, action) => {
  console.log(`Processing user ${userId} with action: ${action}`);

  if (action === 'get') {
    const User = db.model('users');
    return User.findOne({ id: userId });
  } else if (action === 'delete') {
    const User = db.model('users');
    return User.deleteOne({ id: userId });
  } else {
    throw new Error(`Unknown action: ${action}`);
  }
};

const functionCode = processUserData.toString();

const functionData = {
  name: 'processUserData',
  description: 'Processes user data based on the provided action.',
  code: functionCode,
  parameters: [
    { name: 'userId', type: 'string', description: 'The ID of the user to process' },
    { name: 'action', type: 'string', description: 'The action to perform (get or delete)' },
  ],
};
```

**To execute this function:**

```bash
curl -X POST http://localhost:5000/api/functions/processUserData/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "args": ["user123", "get"]
  }'
```

This will call the `processUserData` function with `userId` set to `"user123"` and `action` set to `"get"`. The function will then use the `db` object to query the database and return the user data.

---

## Real-World Example: Placing an Order

Let's create a more complex, real-world example: a function to place an order. This function will perform several actions in a single, atomic operation:

1.  Create a new order in the `orders` collection.
2.  Update the stock of the purchased products in the `products` collection.
3.  Send a notification (we'll mock this for now).

### Step 1: Define the Order and Product Schemas

First, let's assume you have the following schemas for your `orders` and `products` collections:

**`orders` collection:**
```json
{
  "userId": "string",
  "items": [
    {
      "productId": "string",
      "quantity": "number",
      "price": "number"
    }
  ],
  "totalAmount": "number",
  "status": "string",
  "createdAt": "Date"
}
```

**`products` collection:**
```json
{
  "name": "string",
  "description": "string",
  "price": "number",
  "stock": "number",
  "createdAt": "Date"
}
```

### Step 2: Create the `placeOrder` Function

Now, let's define the `placeOrder` function. This function will take the user ID and an array of items to purchase.

```javascript
const placeOrder = async (userId, items) => {
  // Start a session for transactions
  const session = await db.startSession();
  session.startTransaction();

  try {
    // 1. Calculate the total amount
    let totalAmount = 0;
    for (const item of items) {
      const product = await db.model('products').findOne({ _id: item.productId }).session(session);
      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`Not enough stock for product ${product.name}`);
      }
      totalAmount += product.price * item.quantity;
    }

    // 2. Create the order
    const orderData = {
      userId,
      items,
      totalAmount,
      status: 'pending',
    };
    const Order = db.model('orders');
    const newOrder = new Order(orderData);
    await newOrder.save({ session });

    // 3. Update product stock
    const Product = db.model('products');
    for (const item of items) {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { stock: -item.quantity } },
        { session }
      );
    }

    // 4. Mock sending a notification
    console.log(`Notification: Order ${newOrder._id} placed for user ${userId}`);

    // Commit the transaction
    await session.commitTransaction();
    console.log('Order placed successfully!');
    return newOrder;

  } catch (error) {
    // If any error occurs, abort the transaction
    await session.abortTransaction();
    console.error('Error placing order:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Convert the function to a string
const functionCode = placeOrder.toString();

// Prepare the payload for the API call
const functionData = {
  name: 'placeOrder',
  description: 'Places a new order, updates product stock, and sends a notification.',
  code: functionCode,
  parameters: [
    { name: 'userId', type: 'string', description: 'The ID of the user placing the order' },
    { name: 'items', type: 'array', description: 'An array of items to purchase' },
  ],
};
```

### Step 3: Register the Function

Register the `placeOrder` function by sending a `POST` request to the `/api/functions` endpoint with the `functionData` payload.

### Step 4: Execute the Function

Now, you can execute the `placeOrder` function from your client application.

**Example Request:**

```bash
curl -X POST http://localhost:5000/api/functions/placeOrder/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "args": [
      "user123",
      [
        { "productId": "product1", "quantity": 2 },
        { "productId": "product2", "quantity": 1 }
      ]
    ]
  }'
```

This will trigger the `placeOrder` function, which will create a new order, update the stock for the specified products, and log a mock notification. The entire operation is wrapped in a MongoDB transaction to ensure data consistency.