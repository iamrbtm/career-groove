# Plan: Fix "Paste Email" Button and Parsing Error

## Current State
- "Paste Email" button exists on `/applications` page (Tracker Studio)
- Button opens modal, but parsing fails with "could not parse" error
- Need to debug the email parser and ensure it works with real email formats

## Phase 1: Database Backup & Container Cleanup

### 1.1 Backup Database
```bash
# Create backup directory
mkdir -p /mnt/storage/docker/career_groove/backups/$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL database
docker exec career_groove-db-1 pg_dump -U career_groove -d career_groove > /mnt/storage/docker/career_groove/backups/$(date +%Y%m%d_%H%M%S)/career_groove_backup.sql

# Verify backup
wc -l /mnt/storage/docker/career_groove/backups/$(date +%Y%m%d_%H%M%S)/career_groove_backup.sql
```

### 1.2 Remove All Containers (Keep Volumes)
```bash
cd /mnt/storage/docker/career_groove
docker compose down -v --remove-orphans  # -v removes volumes, but we want to keep DB volume
# Actually, better to not use -v to preserve DB data
docker compose down --remove-orphans
```

### 1.3 Verify DB Volume Still Exists
```bash
docker volume ls | grep career_groove
```

## Phase 2: Debug Email Parser

### 2.1 Test Parser with Real Email Format
The parser currently expects format:
```
1) Title — Company
   Location: ...
   Work arrangement: ...
   Posting date: ...
   Salary: ...
   Why it matches: ...
   Notable gaps: ...
   Apply: https://...
```

Need to test with actual "Daily Job Matches" email format and adjust regex if needed.

### 2.2 Add Better Error Handling
- Improve error messages in parse-email API
- Add logging to see what's failing
- Handle edge cases (missing fields, different formats)

## Phase 3: Fix Parser Issues

### 3.1 Common Issues to Check
- Title/Company delimiter: `—` (em dash) vs `-` (hyphen) vs `–` (en dash)
- "Apply:" URL extraction with various formats
- Salary parsing for different formats ($55,000-$71,000 vs $55k-$71k vs "Not listed")
- Multi-line "Why it matches" and "Notable gaps" sections
- Header/footer detection

### 3.2 Add Debug Endpoint
Create a test endpoint to see parsed output without creating applications.

## Phase 4: Rebuild & Deploy

### 4.1 Rebuild Docker Image
```bash
docker compose build --no-cache app
docker compose up -d
```

### 4.2 Test Full Flow
1. Navigate to /applications
2. Click "Paste Email"
3. Paste sample email
4. Click "Parse email"
5. Verify jobs are extracted correctly
6. Click "Create N applications"
7. Verify applications appear in tracker

## Phase 5: Add Integration Tests

### 5.1 Create Test Email Fixtures
Add sample emails to test different formats.

### 5.2 Add Automated Tests
Test parser with various email formats.