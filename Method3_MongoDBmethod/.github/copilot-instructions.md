# SurveySync - Copilot Instructions

## Architecture Overview

SurveySync is a real-time feedback collection system using **ESP8266 microcontrollers** + **WebSocket** + **MongoDB**. Data flows:

```
ESP8266 devices → WebSocket (adminOnline/server.js) → MongoDB → Display dashboards
```

### Core Services (each runs independently on different ports)

| Service | Port | Purpose |
|---------|------|---------|
| `adminOnline/` | 3000 (Express) + 443 (WebSocket) | Main admin, ESP8266 WebSocket handler, schedule management |
| `displayHelp/` | 4000 | Real-time help call display per lab |
| `graphs/` | 3010 | Analytics dashboard with filtering |
| `helpArchive/` | 4000 | Historical help records |
| `controlSchedule/` | - | Schedule management UI |

## MongoDB Schema (Database: `ResponseLogging`)

- **`Tables`**: Maps `tableID` → `labNo` (room). Index on `tableID`.
- **`Schedule`**: Lab sessions with `labID` (format: `COURSE-BATCH-LAB`), `labNo`, `startTime`, `endTime`
- **`Responses`**: Feedback votes (`response: true/false`)
- **`Helps`**: Help requests with `helpStarted`/`helpEnded` timestamps
- **`UnresolvedHelps`**: Pending help calls

## Key Patterns

### Environment Configuration
All services use a **shared `.env`** at project root:
```javascript
require('dotenv').config({ path: "../.env" });  // Always relative to parent
```

### IST Timezone Handling (Critical)
All timestamps stored in IST (UTC+5:30). Use the shared pattern:
```javascript
function toIST(date) {
    const istOffset = 5 * 60 + 30;
    return new Date(new Date(date).getTime() + istOffset * 60 * 1000);
}
```

### WebSocket Message Format (ESP8266 → Server)
```
tableID\tvalue  // Tab-separated: "1001\t2"
// value: 0=No, 1=Yes, 2=Help
```

### labID Format
Constructed as: `{courseCode}-{batch}-{labNumber}` (e.g., `CSE101-B1-01`)

## ESP8266 Integration

- Arduino code in `adminOnline/ESP8266_Code.cpp` and `ArduinoCode*.cpp`
- Uses `WiFiManager` for captive portal config (SSID: `ESP8266-Config`, password: `surveysync`)
- WebSocket connects to `wss://esp8266-control.onrender.com` on port 443
- LED blink patterns indicate connection status (see README.md for codes)

## Development Commands

```bash
# Start any service (from its directory)
npm start  # or: node server.js

# Each service runs independently - start the ones you need
cd adminOnline && npm start   # Main WebSocket server
cd displayHelp && npm start   # Help display
cd graphs && npm start        # Dashboard
```

## Production URLs

- Admin: `https://esp8266-control.onrender.com/`
- Help Display: `https://help-responses.onrender.com/`
- Dashboard: `https://dashboard-e9g1.onrender.com/`

## View Engine

Services use **EJS** templates in `views/` folders. Express static files served from `public/`.

## When Adding New Features

1. Follow existing Express + MongoDB patterns in sibling services
2. Connect to MongoDB using `MongoClient` with `ServerApiVersion.v1`
3. Always convert dates to IST before storing
4. Use existing collection indexes for queries on `tableID`, `labNo`, `labID`
5. WebSocket broadcasts go to all connected clients in the `clients` Set
