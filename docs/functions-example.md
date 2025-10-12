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

## Streaming Functions with Server-Sent Events (SSE)

The Functions API now supports streaming responses using Server-Sent Events (SSE). This is useful for:
- Sending large datasets incrementally
- Real-time progress updates during long-running operations
- Streaming database query results
- Processing items one at a time

### How Streaming Works

Streaming functions use the `/api/functions/:name/execute-stream` endpoint instead of `/execute`. Inside the function, you have access to a `stream` object with three methods:

- `stream.write(data)` - Send a data chunk to the client
- `stream.end(data)` - Send final data (optional) and close the stream
- `stream.error(error)` - Send an error message and close the stream

### Example 1: Streaming Database Query Results

Instead of loading all results into memory and sending them at once, you can stream them one document at a time:

```javascript
// Define a function that streams users from the database
const streamUsers = async (limit) => {
  const User = getDynamicModel('users');
  const cursor = User.find().limit(limit).cursor();

  let count = 0;
  for await (const user of cursor) {
    stream.write({ user, index: count++ });
  }

  stream.end({ message: 'All users streamed', total: count });
};

// Convert to string and register
const functionData = {
  name: 'streamUsers',
  description: 'Streams users from the database one at a time.',
  code: streamUsers.toString(),
  parameters: [
    { name: 'limit', type: 'number', description: 'Maximum number of users to stream' }
  ],
};
```

### Example 2: Progress Updates for Long Operations

Send progress updates during a long-running operation:

```javascript
const processLargeDataset = async (datasetName) => {
  const Dataset = getDynamicModel(datasetName);
  const items = await Dataset.find();
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Process the item (expensive operation)
    await someExpensiveOperation(item);

    // Send progress update
    stream.write({
      progress: Math.round(((i + 1) / total) * 100),
      processed: i + 1,
      total: total,
      currentItem: item._id
    });
  }

  stream.end({ message: 'Processing complete', total: total });
};
```

### Example 3: Real-time Data Aggregation

Stream aggregated results as they're computed:

```javascript
const streamAggregatedData = async (collectionName, groupByField) => {
  const Model = getDynamicModel(collectionName);

  // Get unique values for grouping
  const uniqueValues = await Model.distinct(groupByField);

  stream.write({ message: `Found ${uniqueValues.length} unique groups` });

  for (const value of uniqueValues) {
    const count = await Model.countDocuments({ [groupByField]: value });
    const sum = await Model.aggregate([
      { $match: { [groupByField]: value } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    stream.write({
      group: value,
      count: count,
      total: sum[0]?.total || 0
    });
  }

  stream.end({ message: 'Aggregation complete' });
};
```

### Executing Streaming Functions

**Using curl:**

```bash
curl -X POST http://localhost:5000/api/functions/streamUsers/execute-stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "args": [10]
  }'
```

**Using JavaScript/Node.js:**

```javascript
const executeStreamingFunction = async (functionName, args) => {
  const response = await fetch(`http://localhost:5000/api/functions/${functionName}/execute-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_AUTH_TOKEN',
    },
    body: JSON.stringify({ args }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decode the chunk
    const chunk = decoder.decode(value, { stream: true });

    // Parse SSE messages (format: "data: {...}\n\n")
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));

        if (data.type === 'data') {
          console.log('Received data:', data.payload);
        } else if (data.type === 'end') {
          console.log('Stream ended:', data.payload);
        } else if (data.type === 'error') {
          console.error('Stream error:', data.message);
        }
      }
    }
  }
};

// Execute the streaming function
executeStreamingFunction('streamUsers', [10]);
```

**Using Browser EventSource (for GET-like streaming):**

Note: EventSource only supports GET requests, so for POST requests with authentication, use the fetch API approach above.

### SSE Message Format

All streaming messages follow this format:

```
data: {"type": "data", "payload": {...}}\n\n
data: {"type": "end", "payload": {...}}\n\n
data: {"type": "error", "message": "error description"}\n\n
```

- `type: "data"` - A data chunk from `stream.write()`
- `type: "end"` - Final message from `stream.end()`, includes optional payload
- `type: "error"` - Error message from `stream.error()` or uncaught exceptions

### Error Handling in Streaming Functions

Always handle errors gracefully in streaming functions:

```javascript
const safeStreamingFunction = async (query) => {
  try {
    const Model = getDynamicModel('items');
    const cursor = Model.find(query).cursor();

    for await (const doc of cursor) {
      stream.write(doc);
    }

    stream.end({ message: 'Success' });
  } catch (error) {
    stream.error(error);
  }
};
```

### When to Use Streaming vs Regular Execution

**Use Streaming (`/execute-stream`) when:**
- Processing large datasets that shouldn't be loaded entirely into memory
- Providing real-time progress updates for long operations
- Client needs to start processing results before all data is available
- Streaming database cursors or large query results

**Use Regular Execution (`/execute`) when:**
- Function returns a small, simple result
- All data must be available before processing
- Client prefers a single JSON response
- Function completes quickly

---

## Advanced Example: OpenAI-Compatible API with Streaming

A powerful use case for streaming functions is integrating with AI APIs that support streaming responses, such as OpenAI's Chat Completions API. This allows you to stream AI-generated content token-by-token to your clients.

### Example: Streaming OpenAI Chat Completions

```javascript
const streamOpenAIChat = async (messages, model = 'gpt-4', apiKey) => {
  try {
    // Make request to OpenAI API with streaming enabled
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

        if (trimmedLine.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmedLine.slice(6));
            const content = data.choices[0]?.delta?.content;

            if (content) {
              // Stream each token to the client
              stream.write({
                content: content,
                role: data.choices[0]?.delta?.role,
                finish_reason: data.choices[0]?.finish_reason
              });
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }

    stream.end({ message: 'Streaming complete' });
  } catch (error) {
    console.error('Error streaming OpenAI response:', error);
    stream.error(error);
  }
};

// Register the function
const functionData = {
  name: 'streamOpenAIChat',
  description: 'Streams OpenAI chat completions token by token.',
  code: streamOpenAIChat.toString(),
  parameters: [
    {
      name: 'messages',
      type: 'array',
      description: 'Array of message objects with role and content'
    },
    {
      name: 'model',
      type: 'string',
      description: 'OpenAI model to use (default: gpt-4)'
    },
    {
      name: 'apiKey',
      type: 'string',
      description: 'OpenAI API key'
    }
  ]
};
```

### Executing the OpenAI Streaming Function

**Request:**

```bash
curl -X POST http://localhost:5000/api/functions/streamOpenAIChat/execute-stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "args": [
      [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Write a short poem about coding."}
      ],
      "gpt-4",
      "YOUR_OPENAI_API_KEY"
    ]
  }'
```

**Client-side Implementation:**

```javascript
const streamAIChat = async (messages, model = 'gpt-4', apiKey) => {
  const response = await fetch('http://localhost:5000/api/functions/streamOpenAIChat/execute-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_AUTH_TOKEN',
    },
    body: JSON.stringify({
      args: [messages, model, apiKey]
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'data' && data.payload.content) {
            // Append token to display
            fullText += data.payload.content;
            console.log('Token:', data.payload.content);
            // Update UI in real-time
            document.getElementById('output').textContent = fullText;
          } else if (data.type === 'end') {
            console.log('Stream complete:', data.payload);
          } else if (data.type === 'error') {
            console.error('Error:', data.message);
          }
        } catch (e) {
          // Ignore parse errors for incomplete chunks
        }
      }
    }
  }

  return fullText;
};

// Usage
streamAIChat(
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain recursion in simple terms.' }
  ],
  'gpt-4',
  'YOUR_OPENAI_API_KEY'
);
```

### Other AI Provider Examples

The same pattern works with other OpenAI-compatible APIs:

**Anthropic Claude:**
```javascript
const streamClaudeChat = async (messages, model = 'claude-3-sonnet-20240229', apiKey) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 4096,
      stream: true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'content_block_delta' && data.delta?.text) {
            stream.write({ content: data.delta.text });
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  }

  stream.end({ message: 'Complete' });
};
```

**Local LLMs (Ollama, LM Studio, etc.):**
```javascript
const streamLocalLLM = async (prompt, model = 'llama2') => {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      prompt: prompt,
      stream: true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.response) {
          stream.write({ content: data.response });
        }
        if (data.done) {
          stream.end({ total_duration: data.total_duration });
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
  }
};
```

### Benefits of Streaming AI Responses

1. **Better User Experience**: Users see responses appear in real-time instead of waiting for complete generation
2. **Lower Latency**: First token appears much faster than waiting for complete response
3. **Reduced Memory**: No need to buffer entire response before sending
4. **Progress Indication**: Users know the system is working, reducing perceived wait time
5. **Early Termination**: Can stop generation early if needed

### Security Considerations

When implementing AI streaming functions:

1. **API Key Management**: Never expose API keys in client code. Store them securely on the server or use environment variables
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Cost Control**: Monitor API usage and implement quotas
4. **Input Validation**: Validate and sanitize user inputs before sending to AI APIs
5. **Error Handling**: Handle API errors gracefully and don't expose internal error details to clients

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