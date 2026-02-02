# 🔧 Fix "Failed to Fetch" Error

## Problem

The error shows:
```
Failed to load resource: net::ERR_CONNECTION_RESET :8001/analyze
Analysis error: TypeError: Failed to fetch
```

This means:
1. There's an old backend process running on port 8001
2. It's not responding properly (crashed or using old code)
3. You need to restart it with the new validation code

## Solution

### Option 1: Kill Old Process and Restart (RECOMMENDED)

**Step 1: Kill the old backend**
```bash
# Double-click this file:
KILL_OLD_BACKEND.bat
```

**Step 2: Start the new backend**
```bash
# Double-click this file:
START_BACKEND_SIMPLE.bat
```

### Option 2: Manual Process Kill

**Step 1: Find the process**
```bash
netstat -ano | findstr :8001
```

You'll see something like:
```
TCP    127.0.0.1:8001    ...    LISTENING    6756
```

**Step 2: Kill it**
```bash
taskkill /F /PID 6756
```
(Replace 6756 with your actual PID)

**Step 3: Start backend**
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Option 3: Use Different Port

If you can't kill the old process, use a different port:

**Step 1: Start backend on port 8002**
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8002
```

**Step 2: Update frontend to use port 8002**
(You'll need to change the API URL in your frontend code)

## Verification

After restarting, you should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
INFO:     Application startup complete.
```

Then test by uploading an image. You should see:
- ✅ Mammograms are accepted and analyzed
- ❌ Photos of people are rejected with error message

## Common Issues

### Issue 1: "Address already in use"
**Solution:** Kill the old process first (see Option 1 or 2 above)

### Issue 2: "Module not found"
**Solution:** Make sure you're in the backend directory:
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Issue 3: Backend starts but crashes immediately
**Solution:** Check the console for error messages. Usually it's a missing dependency:
```bash
cd backend
pip install -r requirements.txt
```

## Quick Fix (One Command)

Run this in PowerShell:
```powershell
# Kill old process and start new one
Get-Process | Where-Object {$_.ProcessName -eq "python"} | Stop-Process -Force
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

---

## Summary

1. ✅ Kill old backend process (PID 6756)
2. ✅ Start new backend with validation code
3. ✅ Test with mammogram - should work
4. ✅ Test with photo of person - should be rejected

**The validation code is ready - you just need to restart the backend properly!**
