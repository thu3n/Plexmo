# History Export API (Rewrap Edition)

Allows exporting full playback history with detailed metadata for "Rewrap" analysis.

## Authentication (NEW)

**API Key Required**
You must include your API Key in the request. Generate one in **Settings -> General -> API Access**.

### Methods
1.  **Header**: `x-api-key: YOUR_KEY`
2.  **Query Parameter**: `?apiKey=YOUR_KEY`
3.  **Bearer Token**: `Authorization: Bearer YOUR_KEY`

## Endpoint

`GET /api/history/export`

## Query Parameters

- `apiKey` (string): Your API Key (if not using header).
- `userId` (string): Filter by user ID.
- `serverId` (string): Filter by server ID.
- `year` (number): Filter by year (e.g., `2024`).

## Enhanced Response Format

```json
[
  {
    "id": "uuid...",
    "title": "Episode Title",
    "grandparentTitle": "Show Name",
    "mediaType": "episode",
    "isTranscoded": false,
    "startTime": 1704067200000,
    // ...
  }
]
```
