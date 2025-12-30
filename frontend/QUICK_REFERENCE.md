# Quick Reference - Detected Regions Component

## ⚡ Quick Setup (2 Minutes)

### 1. Copy Files
```bash
# Copy these 4 files to your frontend/src/components/ folder:
- DetectedRegions.jsx
- DetectedRegions.css
- ResultsPage.jsx
- ResultsPage.css
```

### 2. Use in Your App
```javascript
// App.js
import ResultsPage from './components/ResultsPage';

function App() {
  return <ResultsPage />;
}
```

### 3. Start Server & Frontend
```bash
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm start
```

## 📦 Component Props

### DetectedRegions Component

```javascript
<DetectedRegions
  findings={analysisData.findings}        // Required: findings object from API
  onDownloadReport={handleDownloadReport} // Required: function to handle PDF download
  onAnalyzeAnother={handleAnalyzeAnother} // Required: function to reset/upload new image
/>
```

## 📊 Data Structure

### Input: findings object

```javascript
const findings = {
  num_regions: 9,                    // Total regions detected
  overall_activation: 0.45,          // Average activation level
  max_activation: 0.95,              // Peak activation
  high_attention_percentage: 5.68,   // % of high attention areas
  regions: [                         // Array of region objects
    {
      id: 1,                         // Region number
      confidence: 64.1,              // Confidence percentage
      location: {
        quadrant: "upper-outer quadrant",
        description: "upper lateral region"
      },
      size: {
        area_percentage: 0.23        // Region size as % of image
      },
      shape: "roughly circular",     // Shape description
      characteristics: {
        pattern: "homogeneous"       // Pattern type
      },
      severity: "moderate"           // low, moderate, or high
    },
    // ... more regions
  ],
  summary: "Multiple suspicious regions..."
};
```

## 🎨 Quick Customization

### Change Primary Color

```css
/* In DetectedRegions.css */
/* Find and replace #d946a6 with your color */

.section-header h3 {
  color: #YOUR_COLOR; /* Change pink to your brand color */
}

.download-report-btn {
  background: linear-gradient(135deg, #YOUR_COLOR 0%, #LIGHTER_COLOR 100%);
}
```

### Change Severity Colors

```javascript
// In DetectedRegions.jsx
const getSeverityColor = (severity) => {
  if (severity === 'high') return '#dc3545';    // Red
  if (severity === 'moderate') return '#ffc107'; // Yellow
  return '#28a745';                              // Green
};
```

## 🔌 API Integration

### Analyze Image

```javascript
const formData = new FormData();
formData.append('file', imageFile);

const response = await fetch('http://localhost:8000/analyze', {
  method: 'POST',
  body: formData
});

const data = await response.json();
// Use data.findings for DetectedRegions component
```

### Download PDF Report

```javascript
const formData = new FormData();
formData.append('file', imageFile);

// Optional: Add patient information
formData.append('patient_name', 'Jane Doe');
formData.append('patient_age', '45 Years');
formData.append('patient_sex', 'Female');

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
```

## 🎯 Component Features

✅ **Region Cards** - Individual cards for each detected region  
✅ **Details Table** - Comprehensive table view of all regions  
✅ **Severity Badges** - Color-coded severity indicators  
✅ **Action Buttons** - Download PDF & Analyze Another  
✅ **Recommended Actions** - Clinical recommendations  
✅ **Responsive** - Works on mobile, tablet, and desktop  
✅ **Animated** - Smooth hover effects and transitions  

## 📱 Responsive Breakpoints

- **Desktop**: > 768px - 3 columns grid
- **Tablet**: 768px - 2 columns grid
- **Mobile**: < 480px - 1 column grid

## 🐛 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Regions not showing | Check `findings` prop is not null |
| Styling broken | Import both .jsx and .css files |
| PDF download fails | Verify backend is running on port 8000 |
| Images not loading | Check base64 encoding in API response |
| Buttons not working | Ensure callback functions are passed |

## 💡 Usage Examples

### Minimum Setup
```javascript
import DetectedRegions from './components/DetectedRegions';

function MyApp() {
  const [findings, setFindings] = useState(null);

  return findings && (
    <DetectedRegions
      findings={findings}
      onDownloadReport={() => console.log('Download')}
      onAnalyzeAnother={() => setFindings(null)}
    />
  );
}
```

### With Full Integration
```javascript
import { useState } from 'react';
import DetectedRegions from './components/DetectedRegions';

function MyApp() {
  const [findings, setFindings] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const handleUpload = async (file) => {
    setImageFile(file);
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('http://localhost:8000/analyze', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    setFindings(data.findings);
  };

  const handleDownload = async () => {
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
    a.download = 'report.pdf';
    a.click();
  };

  return (
    <div>
      {!findings ? (
        <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      ) : (
        <DetectedRegions
          findings={findings}
          onDownloadReport={handleDownload}
          onAnalyzeAnother={() => setFindings(null)}
        />
      )}
    </div>
  );
}
```

## 📚 File Locations

```
frontend/
├── src/
│   ├── components/
│   │   ├── DetectedRegions.jsx     ← Main component
│   │   ├── DetectedRegions.css     ← Styles
│   │   ├── ResultsPage.jsx          ← Full example
│   │   └── ResultsPage.css          ← Example styles
│   └── App.js                       ← Import here
```

## ✅ Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running (npm start)
- [ ] All 4 component files copied
- [ ] CSS files imported
- [ ] Component integrated in your app
- [ ] API endpoints accessible
- [ ] Test with sample image
- [ ] PDF download working

---

**Need more help?** Check `DETECTED_REGIONS_INTEGRATION.md` for detailed guide!














