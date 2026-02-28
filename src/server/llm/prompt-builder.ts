import type { GenerateMockRequest, Mock } from './claude-client.js'

export class PromptBuilder {
  buildMockPrompt(request: GenerateMockRequest): string {
    const { method, path, description, context } = request

    let prompt = `
Generate a realistic mock response for the following API endpoint:

**HTTP Method:** ${method}
**Path:** ${path}
${description ? `**Description:** ${description}` : ''}

Requirements:
1. Generate realistic mock data that matches typical API responses
2. Include all necessary fields for a complete response
3. Use appropriate data types (strings, numbers, booleans, arrays, objects)
4. Provide realistic example values
5. Include proper HTTP status code
6. Add optional fields with null values where appropriate
7. Include metadata fields like id, created_at, updated_at where appropriate

Response format (JSON):
\`\`\`json
{
  "name": "Descriptive name for this endpoint",
  "method": "${method}",
  "path": "${path}",
  "status": 200,
  "response": {
    // Your generated mock data here
  },
  "headers": {
    "Content-Type": "application/json"
  },
  "delay": 0,
  "description": "Brief description",
  "tags": ["tag1", "tag2"]
}
\`\`\`
`.trim()

    // Add context if available
    if (context?.existingMocks && context.existingMocks.length > 0) {
      prompt += `\n\nExisting mocks in the project:\n${JSON.stringify(context.existingMocks.slice(0, 3), null, 2)}`
    }

    return prompt
  }

  buildSystemPrompt(context: any = {}): string {
    let prompt = `
You are an expert API mock generator with deep knowledge of:

- RESTful API design principles
- GraphQL specifications
- HTTP protocols and status codes
- JSON Schema and data modeling
- Various programming languages and frameworks

Your core responsibilities:
1. Generate realistic, well-structured mock data
2. Ensure data consistency across related endpoints
3. Follow industry best practices for API design
4. Handle edge cases and error scenarios appropriately

Guidelines:
- Always return valid JSON
- Use appropriate HTTP status codes (200 for success, 201 for created, 400 for bad request, 404 for not found, 500 for server error)
- Include proper response headers
- Generate realistic example values
- Maintain consistency in naming conventions
- Handle optional fields correctly
- Include error responses when appropriate
- Consider pagination, filtering, and sorting for list endpoints

When generating mock data:
- Use realistic names, emails, phone numbers
- Include appropriate timestamps (ISO 8601 format)
- Generate realistic IDs (UUIDs or integers)
- Include relationship fields (foreign keys)
- Add metadata fields (created_at, updated_at)
- Use appropriate field types matching the data
`.trim()

    if (context?.projectInfo) {
      prompt += `\n\nProject Context:\n${JSON.stringify(context.projectInfo, null, 2)}`
    }

    return prompt
  }

  buildImprovePrompt(mock: Mock, instruction: string): string {
    return `
You have the following existing mock:

\`\`\`json
${JSON.stringify(mock, null, 2)}
\`\`\`

User wants to improve it with the following instruction:
"${instruction}"

Please improve the mock according to the instruction while:
1. Maintaining the existing structure
2. Enhancing data quality and realism
3. Adding any missing fields
4. Improving edge case handling
5. Keeping response format consistent

Return the improved mock in the same JSON format:
\`\`\`json
{
  "name": "...",
  "method": "...",
  "path": "...",
  "status": ...,
  "response": { ... },
  "headers": { ... },
  "delay": ...,
  "description": "...",
  "tags": [...]
}
\`\`\`
`.trim()
  }

  buildOpenAPIPrompt(openApiSpec: any): string {
    return `
Analyze the following OpenAPI/Swagger specification and generate mock data for all endpoints:

\`\`\`json
${JSON.stringify(openApiSpec, null, 2)}
\`\`\`

For each endpoint, generate:
1. A successful response (200, 201, etc.)
2. An error response (400, 404, 500, etc.) if applicable

Requirements:
1. Follow the schema definitions exactly
2. Use realistic example values
3. Handle all required fields
4. Include optional fields with null values where appropriate
5. Generate array responses with multiple items (3-5 items for lists)
6. Maintain consistency across related endpoints

Return the result as an array of mock objects:
\`\`\`json
[
  {
    "name": "Get Users",
    "method": "GET",
    "path": "/api/users",
    "status": 200,
    "response": { "data": [...], "total": 100 },
    "headers": { "Content-Type": "application/json" },
    "delay": 0,
    "description": "Get all users",
    "tags": ["users", "list"]
  }
]
\`\`\`
`.trim()
  }

  buildDocumentationPrompt(mock: Mock): string {
    return `
Generate comprehensive API documentation in Markdown format for the following mock endpoint:

\`\`\`json
${JSON.stringify(mock, null, 2)}
\`\`\`

Please generate documentation that includes:
1. Endpoint overview and description
2. HTTP method and full URL
3. Request parameters (path, query, headers, body)
4. Response structure and status codes
5. Field definitions with types and descriptions
6. Example requests and responses
7. Error codes and handling

Format as clean Markdown.
`.trim()
  }

  buildDocumentationSystemPrompt(): string {
    return `
You are an expert API documentation generator with deep knowledge of:
- RESTful API documentation standards
- Markdown formatting
- Multiple programming languages
- API design best practices

Your task is to generate clear, comprehensive API documentation that is:
- Well-structured with proper headings
- Includes all necessary details for developers
- Has clear examples
- Uses proper Markdown syntax
`.trim()
  }

  buildCodeExamplesPrompt(mock: Mock, languages: string[]): string {
    return `
Generate code examples for calling the following API endpoint in these languages: ${languages.join(', ')}

API Details:
\`\`\`json
${JSON.stringify(mock, null, 2)}
\`\`\`

Requirements:
1. Generate complete, working examples for each language
2. Include proper error handling
3. Add comments explaining the code
4. Use popular, well-maintained libraries
5. Include authentication if required

Return as JSON:
\`\`\`json
{
  "javascript": "// code here",
  "python": "# code here",
  "curl": "curl command here"
}
\`\`\`
`.trim()
  }
}
