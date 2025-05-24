# Schemaless MongoDB API

## Description

This project provides a flexible and dynamic RESTful API for interacting with MongoDB collections without predefined schemas. It allows for on-the-fly model creation and supports complex querying, filtering, sorting, and pagination.

## Features

*   **Schemaless Collections**: Work with MongoDB collections without defining schemas beforehand.
*   **Dynamic Model Handling**: Mongoose models are created dynamically based on the collection name provided in the API request.
*   **Powerful Querying**: Supports a structured JSON query language for complex data retrieval.
    *   Filtering by multiple conditions (e.g., equality, inequality, greater/less than, in, not in).
    *   Array searching (`array-contains`, `array-contains-any`).
    *   Field existence checks.
    *   Regex pattern matching.
*   **Sorting**: Sort results by any field in ascending or descending order.
*   **Pagination**: Control the number of results and offset for paginated responses.
*   **CRUD Operations**: Standard Create, Read, Update, and Delete operations for documents.
*   **Batch Operations**: Create multiple documents in a single request.
*   **Timestamping**: Automatically adds `createdAt` and `updatedAt` fields to documents.

## API Endpoints

The base path for all API endpoints is `/data`. Replace `:collectionName` with the name of the MongoDB collection you wish to interact with.

### 1. Get All Documents in a Collection

Retrieves a list of documents from a specified collection. Supports filtering, sorting, and pagination via a JSON query string.

*   **URL**: `/:collectionName`
*   **Method**: `GET`
*   **Query Parameters**:
    *   `query` (string, optional): A JSON string defining filters, sorting, and pagination. See [Query Language](#query-language) for details.
*   **Success Response**:
    *   **Code**: `200 OK`
    *   **Content**:
        ```json
        {
            "data": [
                // array of documents
            ],
            "metadata": {
                "total": 100, // Total matching documents
                "limit": 10,  // Limit applied
                "offset": 0   // Offset applied
            }
        }
        ```
*   **Error Response**:
    *   **Code**: `400 Bad Request` (if query JSON is invalid)
    *   **Code**: `500 Internal Server Error`
*   **Example**:
    `GET /data/users?query={"conditions":[{"field":"age","operator":">","value":25},{"field":"isActive","operator":"==","value":true}],"orderByField":"age","orderDirection":"asc","limitCount":10,"offsetCount":0}`

### 2. Get a Single Document by ID

Retrieves a single document by its `_id` or a field named `id`.

*   **URL**: `/:collectionName/:id`
*   **Method**: `GET`
*   **Success Response**:
    *   **Code**: `200 OK`
    *   **Content**: `{ /* document object */ }`
*   **Error Response**:
    *   **Code**: `400 Bad Request` (if ID is invalid format)
    *   **Code**: `404 Not Found`
    *   **Code**: `500 Internal Server Error`
*   **Example**:
    `GET /data/products/60c72b2f9b1d8c001c8e4abc`

### 3. Create a New Document

Adds a new document to the specified collection.

*   **URL**: `/:collectionName`
*   **Method**: `POST`
*   **Request Body**: JSON object representing the document to create.
*   **Success Response**:
    *   **Code**: `201 Created`
    *   **Content**: `{ /* newly created document object with _id */ }`
*   **Error Response**:
    *   **Code**: `500 Internal Server Error`
*   **Example**:
    `POST /data/orders`
    Request Body:
    ```json
    {
        "customerName": "John Doe",
        "totalAmount": 199.99,
        "items": ["itemA", "itemB"]
    }
    ```

### 4. Create Multiple New Documents (Batch Write)

Adds multiple new documents to the specified collection in a single request.

*   **URL**: `/:collectionName/batch`
*   **Method**: `POST`
*   **Request Body**: An array of JSON objects, where each object represents a document to create.
*   **Success Response**:
    *   **Code**: `201 Created`
    *   **Content**: `[ /* array of newly created document objects with _ids */ ]`
*   **Error Response**:
    *   **Code**: `400 Bad Request` (if body is not an array or is empty)
    *   **Code**: `500 Internal Server Error` (may include details on partial success/failures)
*   **Example**:
    `POST /data/logs/batch`
    Request Body:
    ```json
    [
        { "level": "info", "message": "User logged in" },
        { "level": "warn", "message": "Low disk space" }
    ]
    ```

### 5. Update a Document by ID

Updates an existing document by its `_id` or a field named `id`.

*   **URL**: `/:collectionName/:id`
*   **Method**: `PUT`
*   **Request Body**: JSON object containing the fields to update.
*   **Success Response**:
    *   **Code**: `200 OK`
    *   **Content**: `{ /* updated document object */ }`
*   **Error Response**:
    *   **Code**: `400 Bad Request` (if ID is invalid format)
    *   **Code**: `404 Not Found`
    *   **Code**: `500 Internal Server Error`
*   **Example**:
    `PUT /data/users/60c72b2f9b1d8c001c8e4abc`
    Request Body:
    ```json
    {
        "isActive": false,
        "profile.status": "inactive"
    }
    ```

### 6. Delete a Document by ID

Deletes a document by its `_id` or a field named `id`.

*   **URL**: `/:collectionName/:id`
*   **Method**: `DELETE`
*   **Success Response**:
    *   **Code**: `204 No Content`
*   **Error Response**:
    *   **Code**: `400 Bad Request` (if ID is invalid format)
    *   **Code**: `404 Not Found`
    *   **Code**: `500 Internal Server Error`
*   **Example**:
    `DELETE /data/sessions/60c72b2f9b1d8c001c8e4abc`

## Query Language

The `query` parameter for the `GET /:collectionName` endpoint accepts a JSON string with the following structure:

```json
{
  "conditions": [
    { "field": "fieldName", "operator": "operatorSymbol", "value": "comparisonValue" }
    // ... more conditions
  ],
  "orderByField": "fieldName",    // Default: "_id"
  "orderDirection": "asc" | "desc", // Default: "desc"
  "limitCount": 10,               // Default: null (no limit)
  "offsetCount": 0                // Default: null (no offset)
}
```

### Conditions

The `conditions` array allows for filtering documents. Each condition object has:
*   `field`: The name of the document field to filter on.
*   `operator`: The comparison operator.
*   `value`: The value to compare against. The system attempts to parse string values to numbers or booleans where appropriate.

**Supported Operators:**

| Operator             | Mongoose Equivalent | Description                                                                 | Example Value                               |
|----------------------|---------------------|-----------------------------------------------------------------------------|---------------------------------------------|
| `==`                 | `$eq`               | Equal to.                                                                   | `"active"`, `25`, `true`                    |
| `!=`                 | `$ne`               | Not equal to.                                                               | `"inactive"`, `30`                          |
| `>`                  | `$gt`               | Greater than.                                                               | `25`                                        |
| `>=`                 | `$gte`              | Greater than or equal to.                                                   | `25`                                        |
| `<`                  | `$lt`               | Less than.                                                                  | `100`                                       |
| `<=`                 | `$lte`              | Less than or equal to.                                                      | `100`                                       |
| `in`                 | `$in`               | Value is in the array.                                                      | `["active", "pending"]`                     |
| `nin`                | `$nin`              | Value is not in the array.                                                  | `["archived", "deleted"]`                   |
| `array-contains`     | `$eq` (on array)    | Array field contains the exact value.                                       | `"nodejs"` (for a field like `tags: ["nodejs", "express"]`) |
| `array-contains-any` | `$in` (on array)    | Array field contains any of the values in the provided array.               | `["react", "vue"]`                          |
| `exists`             | `$exists`           | Field exists (or does not exist).                                           | `true` (field must exist), `false` (field must not exist) |
| `regex`              | `$regex`            | Field matches the regular expression (case-insensitive by default).         | `"^admin"` (starts with "admin")            |

**Value Type Handling:**
*   Numeric strings (e.g., `"25"`) are converted to numbers.
*   `"true"` and `"false"` strings are converted to booleans.

### Sorting

*   `orderByField`: The field to sort the results by. Defaults to `_id`.
*   `orderDirection`: Can be `asc` (ascending) or `desc` (descending). Defaults to `desc`.

### Pagination

*   `limitCount`: The maximum number of documents to return.
*   `offsetCount`: The number of documents to skip from the beginning.

## Setup and Installation

(TODO: Add instructions on how to set up the project, including prerequisites like Node.js, MongoDB, and how to install dependencies.)

Example:
1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Ensure MongoDB is running and accessible.
4.  Configure environment variables (e.g., `MONGODB_URI`).

## Running the Application

(TODO: Add instructions on how to start the server.)

Example:
`npm start`

The API will then be accessible at `http://localhost:PORT` (where `PORT` is the configured port, e.g., 3000).
You can use tools like Postman or `curl` to interact with the API endpoints. 