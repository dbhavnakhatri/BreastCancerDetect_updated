# Detected Regions Frontend Integration Guide

## Overview

This guide shows you how to integrate the detailed detected regions display into your React frontend. The components match the exact design from your reference screenshots.

## Components Created

### 1. `DetectedRegions.jsx` - Main Component
Displays:
- Individual region cards with details
- Comprehensive regions table
- Recommended actions
- Action buttons (Download PDF, Analyze Another)

### 2. `ResultsPage.jsx` - Example Integration
Complete example showing:
- Image upload
- API integration
- Results display
- Full workflow

## Quick Start

### Step 1: Add Components to Your App

```javascript
// In your main app file (e.g., App.js)
import ResultsPage from './components/ResultsPage';

function App() {
  return (
    <div className="App">
      <ResultsPage />
    </div>
  );
}

export default App;
```

### Step 2: Ensure Backend is Running

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### Step 3: Start Frontend

```bash
cd frontend
npm start
```

## Integration Options

### Option A: Use Complete ResultsPage (Recommended for Testing)

The easiest way to test everything:

```javascript
// App.js
import ResultsPage from './components/ResultsPage';

function App() {
  return <ResultsPage />;
}
```

### Option B: Integrate DetectedRegions into Existing App

If you already have an upload/analysis flow:

```javascript
import { useState } from 'react';
import DetectedRegions from './components/DetectedRegions';

function YourExistingComponent() {
  const [analysisData, setAnalysisData] = useState(null);

  // Your existing analysis function
  const handleAnalysis = async (imageFile) => {
    const formData = new FormData();
    formData.append('file', imageFile);

    const response = await fetch('http://localhost:8000/analyze', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    setAnalysisData(data);
  };

  const handleDownloadReport = async () => {
    // Your download PDF logic
    const formData = new FormData();
    formData.append('file', imageFile);
    
    const response = await fetch('http://localhost:8000/report', {
      method: 'POST',
      body: formData
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mammogram_report.pdf';
    a.click();
  };

  const handleAnalyzeAnother = () => {
    setAnalysisData(null);
    // Reset your form
  };

  return (
    <div>
      {/* Your existing upload UI */}
      
      {analysisData && (
        <DetectedRegions
          findings={analysisData.findings}
          onDownloadReport={handleDownloadReport}
          onAnalyzeAnother={handleAnalyzeAnother}
        />
      )}
    </div>
  );
}
```

## API Response Structure

The `/analyze` endpoint returns data in this format:

```javascript
{
  "result": "Malignant (Cancerous)",
  "probability": 85.5,
  "confidence": 0.855,
  "benign_prob": 14.5,
  "malignant_prob": 85.5,
  "risk_level": "High Risk",
  "risk_icon": "🔴",
  "risk_color": "#ff0000",
  "stats": { /* image statistics */ },
  "heatmap_error": null,
  "image_size": { "width": 512, "height": 512 },
  "file_format": "JPEG",
  "findings": {
    "num_regions": 9,
    "overall_activation": 0.45,
    "max_activation": 0.95,
    "high_attention_percentage": 5.68,
    "regions": [
      {
        "id": 1,
        "confidence": 64.1,
        "location": {
          "quadrant": "upper-outer quadrant",
          "description": "upper lateral region (upper-outer quadrant)"
        },
        "size": {
          "width_px": 45,
          "height_px": 42,
          "area_percentage": 0.23
        },
        "shape": "roughly circular",
        "characteristics": {
          "pattern": "homogeneous",
          "density": "high",
          "uniformity": 0.85
        },
        "severity": "moderate",
        "bbox": { "x1": 100, "y1": 50, "x2": 145, "y2": 92 }
      },
      // ... more regions
    ],
    "summary": "Multiple suspicious regions (9) detected across..."
  },
  "images": {
    "original": "base64_encoded_image",
    "overlay": "base64_encoded_image",
    "heatmap_only": "base64_encoded_image",
    "bbox": "base64_encoded_image"
  }
}
```

## Customization

### Change Colors

Edit `DetectedRegions.css`:

```css
/* Primary color (pink) */
.section-header h3 {
  color: #d946a6; /* Change this to your brand color */
}

.download-report-btn {
  background: linear-gradient(135deg, #d946a6 0%, #e879c0 100%);
  /* Change to your preferred gradient */
}
```

### Modify Severity Colors

In `DetectedRegions.jsx`:

```javascript
const getSeverityColor = (severity) => {
  const severityLower = severity?.toLowerCase() || 'low';
  if (severityLower === 'high') return '#your-red-color';
  if (severityLower === 'moderate') return '#your-yellow-color';
  return '#your-green-color';
};
```

### Add Patient Information to Report Download

```javascript
const handleDownloadReport = async () => {
  const formData = new FormData();
  formData.append('file', imageFile);
  
  // Add patient information
  formData.append('patient_name', 'Jane Doe');
  formData.append('patient_age', '45 Years');
  formData.append('patient_sex', 'Female');
  formData.append('patient_hn', '12345');
  formData.append('department', 'Radiology');
  formData.append('request_doctor', 'Dr. John Smith');
  formData.append('report_by', 'Dr. Sarah Johnson');

  const response = await fetch('http://localhost:8000/report', {
    method: 'POST',
    body: formData
  });

  const blob = await response.blob();
  // Download logic...
};
```

## Features Included

✅ **Individual Region Cards**
- Region location and quadrant
- Confidence percentage
- Shape description
- Pattern analysis
- Severity indicator (color-coded)
- Area percentage

✅ **Detailed Table View**
- Sortable columns
- Color-coded severity badges
- All region attributes at a glance

✅ **Recommended Actions**
- Context-aware recommendations
- Clinical action items list

✅ **Action Buttons**
- Download professional PDF report
- Analyze another image

✅ **Responsive Design**
- Mobile-friendly
- Tablet optimized
- Desktop enhanced

✅ **Beautiful UI**
- Gradient backgrounds
- Smooth animations
- Hover effects
- Professional styling

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── DetectedRegions.jsx       # Main regions display component
│   │   ├── DetectedRegions.css       # Styling for regions
│   │   ├── ResultsPage.jsx            # Complete example page
│   │   └── ResultsPage.css            # Styling for results page
│   └── App.js                         # Your main app file
```

## Testing

1. **Upload an Image**
   - Click the upload area
   - Select a mammogram image
   - Wait for analysis to complete

2. **View Results**
   - See the analysis summary
   - View all three images (original, overlay, detected regions)
   - Scroll to "Understanding Your Results"

3. **Explore Detected Regions**
   - View individual region cards
   - Check the detailed table
   - Review recommended actions

4. **Download Report**
   - Click "Download PDF Report"
   - Check the generated PDF
   - Verify patient information (if provided)

5. **Analyze Another**
   - Click "Analyze Another Image"
   - Upload a new image
   - Repeat the process

## Troubleshooting

### Issue: No regions showing
**Solution**: Check that `analysisData.findings` is not null and has regions array

### Issue: Images not displaying
**Solution**: Verify base64 encoding in API response

### Issue: PDF download fails
**Solution**: Ensure backend `/report` endpoint is accessible

### Issue: Styling looks different
**Solution**: Make sure all CSS files are imported correctly

## API Endpoints Used

### 1. POST /analyze
**Purpose**: Analyze image and get detected regions
**Request**: multipart/form-data with 'file'
**Response**: JSON with analysis results and findings

### 2. POST /report
**Purpose**: Generate PDF report
**Request**: multipart/form-data with 'file' + optional patient info
**Response**: PDF file (application/pdf)

## Next Steps

1. ✅ Integrate components into your app
2. ✅ Customize colors and styling
3. ✅ Add patient information form
4. ✅ Test with real mammogram images
5. ✅ Deploy to production

## Support

- Check `ResultsPage.jsx` for complete working example
- Review `DetectedRegions.jsx` for component API
- See backend `MAMMOGRAM_REPORT_USAGE.md` for PDF customization

---

**Ready to use!** Copy the components into your project and start displaying beautiful detected regions results!














