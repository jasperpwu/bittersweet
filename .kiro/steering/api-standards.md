---
inclusion: fileMatch
fileMatchPattern: "{backend/**/*,**/api/**/*,**/services/**/*}"
---

# API Standards - bittersweet

## REST API Conventions

### Base URL Structure
```
Production: https://api.bittersweet.app/v1
Development: http://localhost:8080/v1
```

### HTTP Methods
- **GET**: Retrieve resources (idempotent)
- **POST**: Create new resources
- **PUT**: Update entire resource (idempotent)
- **PATCH**: Partially update resource
- **DELETE**: Remove resource (idempotent)

### Endpoint Naming
- Use plural nouns: `/users`, `/focus-sessions`, `/journal-entries`
- Use kebab-case for multi-word resources
- Nested resources: `/users/{userId}/focus-sessions`
- Actions as verbs: `/focus-sessions/{id}/complete`

## Request/Response Standards

### Standard Headers
```http
Content-Type: application/json
Authorization: Bearer {jwt_token}
X-API-Version: v1
X-Request-ID: {uuid}
```

### Request Body Format
```json
{
  "data": {
    "type": "focus-session",
    "attributes": {
      "duration": 1800,
      "task_name": "Study React Native",
      "category": "learning"
    }
  }
}
```

### Success Response Format
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "type": "focus-session",
    "attributes": {
      "duration": 1800,
      "task_name": "Study React Native",
      "category": "learning",
      "completed": true,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T11:00:00Z"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T11:00:00Z",
    "request_id": "req_123456"
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The provided data is invalid",
    "details": [
      {
        "field": "duration",
        "message": "Duration must be between 300 and 7200 seconds"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T11:00:00Z",
    "request_id": "req_123456"
  }
}
```

## HTTP Status Codes

### Success Codes
- **200 OK**: Successful GET, PUT, PATCH requests
- **201 Created**: Successful POST requests
- **204 No Content**: Successful DELETE requests

### Client Error Codes
- **400 Bad Request**: Invalid request format or parameters
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Valid auth but insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Resource conflict (duplicate creation)
- **422 Unprocessable Entity**: Valid format but invalid data

### Server Error Codes
- **500 Internal Server Error**: Unexpected server error
- **503 Service Unavailable**: Temporary service unavailability

## Authentication & Authorization

### JWT Token Structure
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "iat": 1642234567,
  "exp": 1642320967,
  "scopes": ["focus:read", "focus:write", "journal:read", "journal:write"]
}
```

### OAuth Integration
- Apple Sign-In: Native iOS integration
- Google OAuth: Web flow for cross-platform support
- Token refresh handled automatically by client

## API Endpoints Specification

### Authentication Endpoints
```http
POST /auth/apple       # Apple OAuth callback
POST /auth/google      # Google OAuth callback  
POST /auth/refresh     # Refresh JWT token
DELETE /auth/logout    # Logout user
```

### Focus Session Endpoints
```http
GET    /focus-sessions              # List user's focus sessions
POST   /focus-sessions              # Create new focus session
GET    /focus-sessions/{id}         # Get specific focus session
PUT    /focus-sessions/{id}         # Update focus session
DELETE /focus-sessions/{id}         # Delete focus session
POST   /focus-sessions/{id}/complete # Mark session as complete
```

### Journal Endpoints
```http
GET    /journal-entries             # List journal entries
POST   /journal-entries             # Create manual journal entry
GET    /journal-entries/{id}        # Get specific entry
PUT    /journal-entries/{id}        # Update journal entry
DELETE /journal-entries/{id}        # Delete journal entry
```

### Squad Endpoints
```http
GET    /squads                      # User's squads
POST   /squads                      # Create new squad
GET    /squads/{id}                 # Get squad details
POST   /squads/{id}/members         # Add squad member
DELETE /squads/{id}/members/{userId} # Remove squad member
GET    /squads/{id}/leaderboard     # Squad leaderboard
```

### User & Rules Endpoints
```http
GET    /users/profile               # User profile
PUT    /users/profile               # Update profile
GET    /users/rules                 # App unlock rules
POST   /users/rules                 # Create new rule
PUT    /users/rules/{id}            # Update rule
DELETE /users/rules/{id}            # Delete rule
GET    /users/stats                 # User statistics
```

## Data Validation Rules

### Focus Session Validation
```go
type FocusSessionRequest struct {
    Duration   int    `json:"duration" validate:"required,min=300,max=7200"`
    TaskName   string `json:"task_name" validate:"required,max=100"`
    Category   string `json:"category" validate:"required,oneof=work study exercise creativity other"`
    WhitelistApps []string `json:"whitelist_apps"`
}
```

### Journal Entry Validation
```go
type JournalEntryRequest struct {
    StartTime  time.Time `json:"start_time" validate:"required"`
    EndTime    time.Time `json:"end_time" validate:"required,gtfield=StartTime"`
    TaskName   string    `json:"task_name" validate:"required,max=100"`
    Category   string    `json:"category" validate:"required"`
    Completed  bool      `json:"completed"`
    Notes      string    `json:"notes" validate:"max=500"`
}
```

## Rate Limiting
- **General API**: 1000 requests per hour per user
- **Authentication**: 10 requests per minute per IP
- **Focus Sessions**: 50 sessions per day per user
- **Journal Entries**: 100 entries per day per user

## Pagination
```http
GET /focus-sessions?page=2&limit=20&sort=created_at&order=desc
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "meta": {
    "pagination": {
      "current_page": 2,
      "per_page": 20,
      "total_pages": 5,
      "total_count": 87,
      "has_next": true,
      "has_prev": true
    }
  }
}
```

## Error Handling Patterns

### Go Backend Error Handling
```go
func HandleFocusSession(c *gin.Context) {
    var req FocusSessionRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, ErrorResponse{
            Success: false,
            Error: APIError{
                Code:    "VALIDATION_ERROR",
                Message: "Invalid request format",
                Details: parseValidationErrors(err),
            },
        })
        return
    }
    
    // Business logic...
}
```

### React Native Client Error Handling
```typescript
// services/api.ts
export const createFocusSession = async (data: FocusSessionData): Promise<FocusSession> => {
  try {
    const response = await fetch(`${API_BASE_URL}/focus-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ data: { type: 'focus-session', attributes: data } }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new APIError(result.error.code, result.error.message, result.error.details);
    }
    
    return result.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
```

## Testing Standards
- All endpoints must have unit tests
- Integration tests for complex workflows
- Mock external services (Apple/Google OAuth)
- Test error conditions and edge cases
- Validate request/response schemas