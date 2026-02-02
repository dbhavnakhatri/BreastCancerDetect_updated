// This file contains the original App logic
// Renamed from App.js to AppContent.js to avoid confusion

import React, { useMemo, useState, useRef, useEffect } from "react";
import "./App.css";
import { FiUploadCloud, FiLogOut, FiDownload } from "react-icons/fi";
import { useAuth } from "./context/AuthContext";
import { useNavigate } from "react-router-dom";
import FullComparisonView from "./components/FullComparisonView";

const getDefaultApiBase = () => {
  // Auto-detect: Use local backend when running on localhost
  if (typeof window !== "undefined") {
    const localHosts = ["localhost", "127.0.0.1", "0.0.0.0"];
    if (localHosts.includes(window.location.hostname)) {
      console.log("Auto-detected local environment - Using backend: http://localhost:8001");
      return "http://localhost:8001";
    }
  }




  // For production deployment, check environment variable
  const envUrl = process.env.REACT_APP_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    console.log("Using API URL from env:", envUrl);
    return envUrl.replace(/\/$/, "");
  }

  // Fallback for production (Render backend)
  // Backend is deployed on Render
  const productionUrl = "https://breast-cancer-backend-3aei.onrender.com";
  console.log("Using production API URL (Render):", productionUrl);
  return productionUrl;
};

const buildEndpoint = (base, endpoint) => {
  const safeBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const safeEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${safeBase}${safeEndpoint}`;
};



const asDataUrl = (value) => (value ? `data:image/png;base64,${value}` : null);

function AppContent() {
  const apiBase = useMemo(() => getDefaultApiBase(), []);
  const apiUrl = (endpoint) => buildEndpoint(apiBase, endpoint);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [results, setResults] = useState({});
  const [file, setFile] = useState(null);
  const [secondFile, setSecondFile] = useState(null);
  const [secondResults, setSecondResults] = useState(null);
  const [files, setFiles] = useState([]); // Array for multiple files
  const [allResults, setAllResults] = useState([]); // Array for all results
  const [dragActive, setDragActive] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [visualTab, setVisualTab] = useState("overlay");
  const [detailsTab, setDetailsTab] = useState("clinical");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [fullscreenRegion, setFullscreenRegion] = useState(null);

  // Zoom functionality
  const zoomImageRef = useRef(null);

  const toProperCase = (text) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/\b\w|-\w/g, (char) => char.toUpperCase());
  };


  // Load upload history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('uploadHistory');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        setUploadHistory(parsed);
      }
    } catch (e) {
      console.error('Error loading upload history:', e);
      // Clear corrupted data
      try {
        localStorage.removeItem('uploadHistory');
      } catch (clearError) {
        console.error('Failed to clear corrupted history:', clearError);
      }
    }
  }, []);

  // Save upload history to localStorage
  const saveToHistory = (fileName, fileData) => {
    const newEntry = {
      id: Date.now(),
      name: fileName,
      data: fileData,
      timestamp: new Date().toISOString()
    };

    setUploadHistory(prev => {
      // Keep only last 5 entries
      const updated = [newEntry, ...prev.filter(h => h.name !== fileName)].slice(0, 5);

      try {
        localStorage.setItem('uploadHistory', JSON.stringify(updated));
      } catch (error) {
        // If storage quota exceeded, clear old data and try again
        if (error.name === 'QuotaExceededError') {
          console.warn('Storage quota exceeded, clearing old history...');
          try {
            // Keep only the newest entry
            const minimal = [newEntry];
            localStorage.setItem('uploadHistory', JSON.stringify(minimal));
            return minimal;
          } catch (e) {
            // If still fails, clear everything and continue without storage
            console.error('Failed to save to localStorage:', e);
            localStorage.removeItem('uploadHistory');
            return [newEntry];
          }
        }
      }

      return updated;
    });
  };

  // Remove from history
  const removeFromHistory = (id) => {
    setUploadHistory(prev => {
      const updated = prev.filter(h => h.id !== id);

      try {
        localStorage.setItem('uploadHistory', JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to update localStorage:', error);
      }

      return updated;
    });
  };

  // Re-upload from history
  const uploadFromHistory = (historyItem) => {
    // Convert base64 back to file and analyze
    fetch(historyItem.data)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], historyItem.name, { type: blob.type || 'image/jpeg' });
        setFile(file);
        // Automatically start analysis
        analyzeFile(file);
      })
      .catch(err => {
        console.error('Error loading from history:', err);
        setErrorMessage('Failed to load image from history');
      });
  };

  // Reset zoom when visual tab changes
  useEffect(() => {
    const img = zoomImageRef.current;
    if (img) {
      img.style.transform = 'scale(1)';
      img.style.transformOrigin = 'center center';
      setIsZoomed(false);
    }
  }, [visualTab]);


  const handleMouseMove = (e) => {
    if (!isZoomed) return;
    const img = zoomImageRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    img.style.transformOrigin = `${x}% ${y}%`;
  };

  const handleImageClick = (e) => {
    const img = zoomImageRef.current;
    if (!img) return;

    if (isZoomed) {
      // Unzoom
      img.style.transform = 'scale(1)';
      img.style.transformOrigin = 'center center';
      setIsZoomed(false);
      setSelectedRegion(null);
    } else {
      // Zoom
      const rect = img.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      img.style.transformOrigin = `${x}% ${y}%`;
      img.style.transform = 'scale(2.5)';
      setIsZoomed(true);
    }
  };

  // Zoom to specific region when clicked from list - now opens fullscreen
  const zoomToRegion = (region) => {
    const img = zoomImageRef.current;
    if (!img) return;

    // If clicking the same region that's already selected, close fullscreen
    if (selectedRegion === region.id && fullscreenRegion) {
      setFullscreenRegion(null);
      setSelectedRegion(null);
      return;
    }

    // Open fullscreen view with the region
    setSelectedRegion(region.id);
    setFullscreenRegion(region);
  };


  // Helper function to render green overlay for selected region
  const renderGreenOverlay = () => {
    if (!selectedRegion || !results.findings?.regions || (visualTab !== 'bbox' && visualTab !== 'original')) {
      return null;
    }

    const region = results.findings.regions.find(r => r.id === selectedRegion);
    if (!region || !region.bbox) return null;

    const img = zoomImageRef.current;
    if (!img) return null;

    let x1, y1, x2, y2;
    if (Array.isArray(region.bbox)) {
      [x1, y1, x2, y2] = region.bbox;
    } else {
      x1 = region.bbox.x1;
      y1 = region.bbox.y1;
      x2 = region.bbox.x2;
      y2 = region.bbox.y2;
    }

    const imgNaturalWidth = img.naturalWidth;
    const imgNaturalHeight = img.naturalHeight;

    if (!imgNaturalWidth || !imgNaturalHeight) return null;

    // Get the actual displayed dimensions of the image
    const displayedWidth = img.clientWidth;
    const displayedHeight = img.clientHeight;

    // Calculate the scale factor between natural and displayed size
    const scaleX = displayedWidth / imgNaturalWidth;
    const scaleY = displayedHeight / imgNaturalHeight;

    // Use the smaller scale to maintain aspect ratio (object-fit: contain behavior)
    const scale = Math.min(scaleX, scaleY);

    // Calculate actual displayed image dimensions
    const actualDisplayWidth = imgNaturalWidth * scale;
    const actualDisplayHeight = imgNaturalHeight * scale;

    // Calculate offset (letterboxing) - image is centered
    const offsetX = (displayedWidth - actualDisplayWidth) / 2;
    const offsetY = (displayedHeight - actualDisplayHeight) / 2;

    // Convert bbox coordinates to displayed pixels
    const displayX1 = x1 * scale + offsetX;
    const displayY1 = y1 * scale + offsetY;
    const displayX2 = x2 * scale + offsetX;
    const displayY2 = y2 * scale + offsetY;

    const displayBoxWidth = displayX2 - displayX1;
    const displayBoxHeight = displayY2 - displayY1;

    console.log('Green overlay positioning:', {
      bbox: { x1, y1, x2, y2 },
      naturalDimensions: { width: imgNaturalWidth, height: imgNaturalHeight },
      displayedDimensions: { width: displayedWidth, height: displayedHeight },
      scale: scale,
      actualDisplay: { width: actualDisplayWidth, height: actualDisplayHeight },
      offset: { x: offsetX, y: offsetY },
      displayBox: { x1: displayX1, y1: displayY1, x2: displayX2, y2: displayY2, width: displayBoxWidth, height: displayBoxHeight }
    });

    return (
      <div
        style={{
          position: 'absolute',
          left: `${displayX1}px`,
          top: `${displayY1}px`,
          width: `${displayBoxWidth}px`,
          height: `${displayBoxHeight}px`,
          border: '6px solid #00FF00',
          boxShadow: '0 0 15px rgba(0, 255, 0, 0.9)',
          pointerEvents: 'none',
          zIndex: 5,
          boxSizing: 'border-box'
        }}
      />
    );
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);

      // Add to files array (support multiple files)
      setFiles(prev => [...prev, ...selectedFiles]);

      // For backward compatibility, set first file
      if (!file) {
        setFile(selectedFiles[0]);
      } else if (!secondFile && selectedFiles.length > 0) {
        setSecondFile(selectedFiles[0]);
      }

      // Save all to history
      selectedFiles.forEach(selectedFile => {
        const reader = new FileReader();
        reader.onload = () => {
          saveToHistory(selectedFile.name, reader.result);
        };
        reader.readAsDataURL(selectedFile);
      });
    }
  };

  const handleSecondFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);

      // Add to files array
      setFiles(prev => [...prev, ...selectedFiles]);

      // For backward compatibility
      if (!secondFile) {
        setSecondFile(selectedFiles[0]);
      }

      // Save to history
      selectedFiles.forEach(selectedFile => {
        const reader = new FileReader();
        reader.onload = () => {
          saveToHistory(selectedFile.name, reader.result);
        };
        reader.readAsDataURL(selectedFile);
      });
    }
  };

  // Remove a specific file from the list
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    // Update backward compatible states
    if (index === 0) {
      setFile(files[1] || null);
      setSecondFile(files[2] || null);
    } else if (index === 1) {
      setSecondFile(files[2] || null);
    }
  };

  // Clear all files
  const clearAllFiles = () => {
    setFiles([]);
    setFile(null);
    setSecondFile(null);
  };

  // Helper function to extract view code from filename
  const extractViewCodeFromFilename = (filename) => {
    const upperName = filename.toUpperCase();

    // Check for specific patterns
    if (upperName.includes('LMLO') || upperName.includes('LEFT_MLO') || upperName.includes('L-MLO')) {
      return 'L-MLO';
    } else if (upperName.includes('RMLO') || upperName.includes('RIGHT_MLO') || upperName.includes('R-MLO')) {
      return 'R-MLO';
    } else if (upperName.includes('LCC') || upperName.includes('LEFT_CC') || upperName.includes('L-CC')) {
      return 'LCC';
    } else if (upperName.includes('RCC') || upperName.includes('RIGHT_CC') || upperName.includes('R-CC')) {
      return 'RCC';
    } else if (upperName.includes('MLO')) {
      return 'MLO';
    } else if (upperName.includes('CC')) {
      return 'CC';
    }

    return null;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);

      // Extract view code from filename immediately for real-time display
      const viewCode = extractViewCodeFromFilename(droppedFile.name);
      if (viewCode) {
        setResults(prev => ({
          ...prev,
          view_analysis: {
            view_code: viewCode,
            laterality: viewCode.includes('L') && !viewCode.includes('R') ? 'Left' : 'Right',
            laterality_code: viewCode.includes('L') && !viewCode.includes('R') ? 'L' : 'R',
            image_quality: 'Analyzing...',
            quality_score: null,
          }
        }));
      }

      analyzeFile(droppedFile);
    }
  };

  const handleBrowseClick = () => {
    const input = document.getElementById("fileInput");
    if (input) input.click();
  };

  const handleBackToUpload = () => {
    setAnalysisDone(false);
    setResults({});
    setSecondResults(null);
    setFile(null);
    setSecondFile(null);
    setFiles([]);
    setAllResults([]);
    setVisualTab("bbox");
    setDetailsTab("clinical");
    setStatusMessage("");
    setErrorMessage("");
  };

  // Analyze a single file and return the result
  const analyzeSingleFile = async (selectedFile, index) => {
    const formData = new FormData();
    formData.append("file", selectedFile);

    const endpoint = "/analyze";
    const currentApiUrl = apiUrl(endpoint);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(currentApiUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.detail || `Server error: ${response.status}`);
    }

    const data = await response.json();
    const images = data.images || {};
    const confidencePercent =
      data.confidence !== undefined && data.confidence <= 1
        ? data.confidence * 100
        : data.confidence ?? null;

    return {
      fileName: selectedFile.name,
      index: index,
      original: asDataUrl(images.original),
      overlay: asDataUrl(images.overlay),
      heatmap: asDataUrl(images.heatmap_only),
      bbox: asDataUrl(images.bbox),
      cancer_type: asDataUrl(images.cancer_type),
      malignant: data.malignant_prob ?? null,
      benign: data.benign_prob ?? null,
      risk: data.risk_level ?? "Unavailable",
      riskIcon: data.risk_icon,
      riskColor: data.risk_color,
      result: data.result ?? "Analysis Result",
      confidence: confidencePercent,
      rawScore: data.confidence ?? null,
      threshold: data.threshold ?? 0.5,
      stats: data.stats || {},
      findings: data.findings || null,
      view_analysis: data.view_analysis || null,
    };
  };

  // Analyze all files
  const analyzeAllFiles = async () => {
    if (files.length === 0) return;

    setIsAnalyzing(true);
    setStatusMessage(`Analyzing ${files.length} image(s)...`);
    setErrorMessage("");

    // Initialize all results with "analyzing" placeholders immediately
    const initialResults = files.map((file, index) => ({
      fileName: file.name,
      index: index,
      analyzing: true,
      original: null,
      overlay: null,
      heatmap: null,
      bbox: null,
      cancer_type: null,
    }));

    setAllResults(initialResults); // Set all placeholders at once
    setAnalysisDone(false); // Don't show results section yet

    const results = [...initialResults]; // Work with a copy
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        setStatusMessage(`Analyzing image ${i + 1} of ${files.length}...`);
        const result = await analyzeSingleFile(files[i], i);

        // Replace placeholder with actual result
        results[i] = result;
        setAllResults([...results]); // Update UI with actual result

        // Show results section after FIRST image completes
        if (i === 0) {
          setAnalysisDone(true); // Now show the results section
          setVisualTab("bbox");
          setDetailsTab("clinical");
        }

        console.log(`✅ Successfully analyzed: ${files[i].name}`);

        // For backward compatibility, set first two successful results
        const successfulResults = results.filter(r => !r.error && !r.analyzing);
        if (successfulResults.length === 1) {
          setResults(successfulResults[0]);
          const successIndex = results.findIndex(r => !r.error && !r.analyzing);
          if (successIndex >= 0) {
            setFile(files[successIndex]);
          }
        }
        if (successfulResults.length === 2) {
          setSecondResults(successfulResults[1]);
          const secondSuccessIndex = results.findIndex((r, idx) => !r.error && !r.analyzing && idx > results.findIndex(r => !r.error && !r.analyzing));
          if (secondSuccessIndex >= 0) {
            setSecondFile(files[secondSuccessIndex]);
          }
        }

      } catch (error) {
        console.error(`❌ Failed to analyze ${files[i].name}:`, error);

        // Replace placeholder with error result
        const errorResult = {
          fileName: files[i].name,
          index: i,
          error: true,
          errorMessage: error.message || "Analysis failed",
          original: null,
          overlay: null,
          heatmap: null,
          bbox: null,
          cancer_type: null,
        };

        results[i] = errorResult;
        setAllResults([...results]); // Update UI with error

        // Show results section after FIRST image completes (even if error)
        if (i === 0) {
          setAnalysisDone(true); // Now show the results section
          setVisualTab("bbox");
          setDetailsTab("clinical");
        }

        errors.push({
          fileName: files[i].name,
          message: error.message || "Analysis failed"
        });
      }
    }

    // Final status message
    const successfulResults = results.filter(r => !r.error && !r.analyzing);
    if (errors.length === 0) {
      setStatusMessage(`✅ All ${results.length} image(s) analyzed successfully.`);
    } else if (successfulResults.length === 0) {
      setStatusMessage("");
      setErrorMessage(`❌ All images failed validation. Please upload valid mammogram images.`);
    } else {
      setStatusMessage(`✅ ${successfulResults.length} of ${results.length} image(s) analyzed successfully.`);
      const errorSummary = errors.map(e => `• ${e.fileName}: ${e.message}`).join('\n');
      console.warn('Some images failed:\n' + errorSummary);
    }

    setIsAnalyzing(false);
  };

  const analyzeFile = async (selectedFile) => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);

    setIsAnalyzing(true);
    setStatusMessage("Uploading image for analysis…");
    setErrorMessage("");

    // Auto-detect endpoint based on backend URL
    // HF deployment supports both /predict (legacy) and /analyze (new)
    // Local backend uses /analyze
    const endpoint = "/analyze";  // Use /analyze for all backends now
    const currentApiUrl = apiUrl(endpoint);
    console.log("Sending request to:", currentApiUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const response = await fetch(currentApiUrl, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error("API Error:", response.status, errorBody);
        throw new Error(errorBody.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();
      const images = data.images || {};
      const confidencePercent =
        data.confidence !== undefined && data.confidence <= 1
          ? data.confidence * 100
          : data.confidence ?? null;

      const resultData = {
        original: asDataUrl(images.original),
        overlay: asDataUrl(images.overlay),
        heatmap: asDataUrl(images.heatmap_only),
        bbox: asDataUrl(images.bbox),
        cancer_type: asDataUrl(images.cancer_type),
        malignant: data.malignant_prob ?? null,
        benign: data.benign_prob ?? null,
        risk: data.risk_level ?? "Unavailable",
        riskIcon: data.risk_icon,
        riskColor: data.risk_color,
        result: data.result ?? "Analysis Result",
        confidence: confidencePercent,
        rawScore: data.confidence ?? null,
        threshold: data.threshold ?? 0.5,
        stats: data.stats || {},
        findings: data.findings || null,  // Detailed findings from backend
        view_analysis: data.view_analysis || null,  // CC/MLO view detection
      };

      // Debug logging
      console.log("Analysis Results:", {
        result: resultData.result,
        riskLevel: resultData.risk,
        malignantProb: resultData.malignant,
        benignProb: resultData.benign,
        confidence: resultData.confidence
      });

      setResults(resultData);

      setAnalysisDone(true);
      setVisualTab("bbox");
      setDetailsTab("clinical");
      setStatusMessage("Analysis complete.");
    } catch (error) {
      console.error("Analysis error:", error);

      let errorMsg = "Backend not reachable.";

      if (error.name === 'AbortError') {
        errorMsg = "Request timed out. The backend server may be starting up (this can take 1-2 minutes on free hosting). Please try again.";
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMsg = `Cannot connect to backend at ${apiBase}. Please check if the backend is running and CORS is enabled.`;
      } else if (error.message) {
        errorMsg = error.message;
      }

      setErrorMessage(errorMsg);
      setStatusMessage("");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeSecondFile = async (selectedFile) => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);

    setIsAnalyzing(true);
    setStatusMessage("Uploading second image for analysis…");
    setErrorMessage("");

    const endpoint = "/analyze";
    const currentApiUrl = apiUrl(endpoint);
    console.log("Sending request to:", currentApiUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(currentApiUrl, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error("API Error:", response.status, errorBody);
        throw new Error(errorBody.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();
      const images = data.images || {};
      const confidencePercent =
        data.confidence !== undefined && data.confidence <= 1
          ? data.confidence * 100
          : data.confidence ?? null;

      const resultData = {
        original: asDataUrl(images.original),
        overlay: asDataUrl(images.overlay),
        heatmap: asDataUrl(images.heatmap_only),
        bbox: asDataUrl(images.bbox),
        cancer_type: asDataUrl(images.cancer_type),
        malignant: data.malignant_prob ?? null,
        benign: data.benign_prob ?? null,
        risk: data.risk_level ?? "Unavailable",
        riskIcon: data.risk_icon,
        riskColor: data.risk_color,
        result: data.result ?? "Analysis Result",
        confidence: confidencePercent,
        rawScore: data.confidence ?? null,
        threshold: data.threshold ?? 0.5,
        stats: data.stats || {},
        findings: data.findings || null,
        view_analysis: data.view_analysis || null,
      };

      console.log("Second Image Analysis Results:", {
        result: resultData.result,
        riskLevel: resultData.risk,
        malignantProb: resultData.malignant,
        benignProb: resultData.benign,
        confidence: resultData.confidence
      });

      setSecondResults(resultData);
      setStatusMessage("Second image analysis complete.");
    } catch (error) {
      console.error("Analysis error:", error);

      let errorMsg = "Backend not reachable.";

      if (error.name === 'AbortError') {
        errorMsg = "Request timed out. Please try again.";
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMsg = `Cannot connect to backend at ${apiBase}. Please check if the backend is running and CORS is enabled.`;
      } else if (error.message) {
        errorMsg = error.message;
      }

      setErrorMessage(errorMsg);
      setStatusMessage("");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadReport = async () => {
    console.log("🔵 Download Report button clicked!");

    if (!file) {
      console.error("❌ No file found!");
      setErrorMessage("Please upload a file before requesting the report.");
      return;
    }

    console.log("✅ File found:", file.name);
    const formData = new FormData();
    formData.append("file", file);

    setIsGeneratingReport(true);
    setErrorMessage("");
    setStatusMessage("Generating report...");

    try {
      console.log("📤 Sending request to:", apiUrl("/report"));
      const response = await fetch(apiUrl("/report"), {
        method: "POST",
        body: formData,
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error("❌ Response error:", errorBody);
        throw new Error(errorBody.detail || "Failed to generate report.");
      }

      console.log("✅ Getting blob...");
      const blob = await response.blob();
      console.log("✅ Blob size:", blob.size, "bytes");

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "mammogram_report.pdf";
      document.body.appendChild(anchor);

      console.log("🖱️ Triggering download...");
      anchor.click();

      setTimeout(() => {
        anchor.remove();
        window.URL.revokeObjectURL(url);
        console.log("✅ Download complete!");
      }, 100);

      setStatusMessage("Report downloaded successfully!");
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (error) {
      console.error("❌ Error in handleDownloadReport:", error);
      setErrorMessage(error.message || "Error while downloading report. Check console for details.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadComparisonReport = async () => {
    console.log("🔵 Download Comparison Report button clicked!");

    if (!file || !secondFile) {
      console.error("❌ Missing files!");
      setErrorMessage("Please upload both files before requesting the comparison report.");
      return;
    }

    console.log("✅ Files found:", file.name, secondFile.name);
    const formData = new FormData();
    formData.append("file1", file);
    formData.append("file2", secondFile);

    setIsGeneratingReport(true);
    setErrorMessage("");
    setStatusMessage("Generating comparison report...");

    try {
      console.log("📤 Sending request to:", apiUrl("/report-comparison"));
      const response = await fetch(apiUrl("/report-comparison"), {
        method: "POST",
        body: formData,
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error("❌ Response error:", errorBody);
        throw new Error(errorBody.detail || "Failed to generate comparison report.");
      }

      console.log("✅ Getting blob...");
      const blob = await response.blob();
      console.log("✅ Blob size:", blob.size, "bytes");

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "mammogram_comparison_report.pdf";
      document.body.appendChild(anchor);

      console.log("🖱️ Triggering download...");
      anchor.click();

      setTimeout(() => {
        anchor.remove();
        window.URL.revokeObjectURL(url);
        console.log("✅ Download complete!");
      }, 100);

      setStatusMessage("Comparison report downloaded successfully!");
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (error) {
      console.error("❌ Error in handleDownloadComparisonReport:", error);
      setErrorMessage(error.message || "Error while downloading comparison report. Check console for details.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadSecondReport = async () => {
    console.log("🔵 Download Second Image Report button clicked!");

    if (!secondFile) {
      console.error("❌ No second file found!");
      setErrorMessage("Please upload a second file before requesting the report.");
      return;
    }

    console.log("✅ Second file found:", secondFile.name);
    const formData = new FormData();
    formData.append("file", secondFile);

    setIsGeneratingReport(true);
    setErrorMessage("");
    setStatusMessage("Generating second image report...");

    try {
      console.log("📤 Sending request to:", apiUrl("/report"));
      const response = await fetch(apiUrl("/report"), {
        method: "POST",
        body: formData,
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error("❌ Response error:", errorBody);
        throw new Error(errorBody.detail || "Failed to generate report.");
      }

      console.log("✅ Getting blob...");
      const blob = await response.blob();
      console.log("✅ Blob size:", blob.size, "bytes");

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "mammogram_report_image2.pdf";
      document.body.appendChild(anchor);

      console.log("🖱️ Triggering download...");
      anchor.click();

      setTimeout(() => {
        anchor.remove();
        window.URL.revokeObjectURL(url);
        console.log("✅ Download complete!");
      }, 100);

      setStatusMessage("Second image report downloaded successfully!");
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (error) {
      console.error("❌ Error in handleDownloadSecondReport:", error);
      setErrorMessage(error.message || "Error while downloading report. Check console for details.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadImage = () => {
    const imageUrl = getActiveVisualImage();
    if (!imageUrl) {
      setErrorMessage("No image available to download");
      return;
    }

    const link = document.createElement("a");
    link.href = imageUrl;

    // Determine filename based on active tab
    let filename = "mammogram_analysis";
    switch (visualTab) {
      case "heatmap":
        filename = "mammogram_heatmap.png";
        break;
      case "bbox":
        filename = "region_detection.png";
        break;
      case "original":
        filename = "type_of_cancer_detection.png";
        break;
      case "overlay":
      default:
        filename = "mammogram_overlay.png";
        break;
    }

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setStatusMessage(`Downloaded: ${filename}`);
    setTimeout(() => setStatusMessage(""), 3000);
  };

  const getActiveVisualImage = () => {
    switch (visualTab) {
      case "heatmap":
        return results.heatmap;
      case "bbox":
        return results.bbox;
      case "original":
        return results.cancer_type || results.original;
      case "overlay":
      default:
        return results.overlay;
    }
  };

  const getActiveVisualImageSecond = () => {
    if (!secondResults) return null;
    switch (visualTab) {
      case "heatmap":
        return secondResults.heatmap;
      case "bbox":
        return secondResults.bbox;
      case "original":
        return secondResults.cancer_type || secondResults.original;
      case "overlay":
      default:
        return secondResults.overlay;
    }
  };

  const getRiskClass = () => {
    const risk = results.risk?.toLowerCase() || "";
    // Check in order from most specific to least specific
    if (risk.includes("very high risk")) {
      return "risk-high";
    } else if (risk.includes("high risk") && !risk.includes("moderate")) {
      return "risk-high";
    } else if (risk.includes("moderate")) {
      return "risk-moderate";
    } else if (risk.includes("very low risk")) {
      return "risk-low";
    } else if (risk.includes("low risk")) {
      return "risk-low";
    }
    return "";
  };

  const getResultClass = () => {
    const result = results.result?.toLowerCase() || "";
    if (result.includes("malignant") || result.includes("cancerous")) {
      return "result-malignant";
    } else if (result.includes("benign") || result.includes("non-cancerous")) {
      return "result-benign";
    }
    return "";
  };

  return (
    <div className="App">
      <video autoPlay muted loop id="bg-video">
        <source src="/backgroundpink.mp4" type="video/mp4" />
      </video>
      <div className="bg-overlay" />

      <header className="header">
        <div className="logo">
          <img src="/Group 28.png" alt="logo" />
          <span>Breast Cancer Detection System</span>
        </div>
        <div className="header-right">
          <span className="welcome-text">Welcome, {user?.name || 'User'}</span>
          <button className="logout-btn" onClick={handleLogout}>
            <FiLogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      {!analysisDone && !showComparison ? (
        <section className="upload-section">
          <div className="upload-card">
            <h3>Upload mammogram (DICOM)</h3>
            <p>Max 200MB • Supported formats: DICOM, JPG, PNG • Upload 1 or more images</p>
            <div
              className={`dropzone`}
              onClick={() => {
                const input = document.getElementById("fileInput");
                if (input) input.click();
              }}
            >
              <FiUploadCloud
                size={50}
                style={{ color: "#AE70AF", marginBottom: "10px" }}
              />
              <p className="drop-main-text">
                {files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''} Selected` : "Select Files"}
              </p>
              <p className="drop-sub-text">or click to browse files</p>
              <button
                type="button"
                className="btn-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  const input = document.getElementById("fileInput");
                  if (input) input.click();
                }}
              >
                {files.length > 0 ? "Add More Files" : "Browse Files"}
              </button>
              <input
                type="file"
                id="fileInput"
                style={{ display: "none" }}
                onChange={handleFileChange}
                accept=".jpg,.jpeg,.png,.dcm"
                multiple
              />
            </div>

            {/* Display all selected files */}
            {files.length > 0 && (
              <div style={{ marginTop: "15px" }}>
                {files.map((f, index) => (
                  <div key={index} className="selected-file" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", padding: "8px 12px", background: "rgba(174, 112, 175, 0.1)", borderRadius: "8px" }}>
                    <span>File {index + 1}: <strong>{f.name}</strong></span>
                    <button
                      onClick={() => removeFile(index)}
                      style={{ background: "none", border: "none", color: "#C2185B", cursor: "pointer", fontSize: "1.2rem", padding: "0 8px" }}
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {files.length > 1 && (
                  <button
                    onClick={clearAllFiles}
                    style={{ marginTop: "10px", background: "none", border: "1px solid #C2185B", color: "#C2185B", padding: "6px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem" }}
                  >
                    Clear All Files
                  </button>
                )}
              </div>
            )}

            {/* Analyze Button - Show when at least one file is selected */}
            {files.length > 0 && (
              <div style={{ textAlign: "center", display: 'flex', justifyContent: 'center', marginTop: "30px" }}>
                <button
                  className={`btn-primary ${isAnalyzing ? "btn-loading" : ""}`}
                  onClick={() => analyzeAllFiles()}
                  disabled={isAnalyzing}
                  style={{ padding: "12px 40px", fontSize: "1.1rem" }}
                >
                  {isAnalyzing ? (
                    <span className="loader" />
                  ) : files.length === 1 ? (
                    "Analyze Image"
                  ) : (
                    `Analyze ${files.length} Images`
                  )}
                </button>
              </div>
            )}

            {/* Upload History Section - Show always when there's history */}
            {uploadHistory.length > 0 && (
              <div className="upload-history" style={{ marginTop: "20px" }}>
                <p className="history-title">Recent Uploads</p>
                <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "10px" }}>Click "Add" to add multiple files for analysis</p>
                <div className="history-list">
                  {uploadHistory.map((item) => {
                    // Check if this item is already in files array
                    const isAlreadyAdded = files.some(f => f.name === item.name);

                    return (
                      <div key={item.id} className="history-item" style={{ opacity: isAlreadyAdded ? 0.6 : 1 }}>
                        <span className="history-name" title={item.name}>
                          📄 {item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name}
                          {isAlreadyAdded && <span style={{ color: "#4CAF50", marginLeft: "8px", fontSize: "0.8rem" }}>✓ Added</span>}
                        </span>
                        <div className="history-actions">
                          <button
                            className="history-btn history-upload-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isAlreadyAdded) return;

                              fetch(item.data)
                                .then(res => res.blob())
                                .then(blob => {
                                  const newFile = new File([blob], item.name, { type: blob.type || 'image/jpeg' });
                                  // Add to files array instead of replacing
                                  setFiles(prev => [...prev, newFile]);
                                  // For backward compatibility
                                  if (!file) {
                                    setFile(newFile);
                                  } else if (!secondFile) {
                                    setSecondFile(newFile);
                                  }
                                })
                                .catch(err => {
                                  console.error('Error loading from history:', err);
                                  setErrorMessage('Failed to load image from history');
                                });
                            }}
                            title={isAlreadyAdded ? "Already added" : "Add this file"}
                            style={{
                              background: isAlreadyAdded ? "#ccc" : "",
                              cursor: isAlreadyAdded ? "not-allowed" : "pointer"
                            }}
                            disabled={isAlreadyAdded}
                          >
                            {isAlreadyAdded ? "Added" : "Add"}
                          </button>
                          <button
                            className="history-btn history-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromHistory(item.id);
                            }}
                            title="Remove from history"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {statusMessage && (
              <p className="muted small" style={{ marginTop: "10px" }}>
                {statusMessage}
              </p>
            )}
            {errorMessage && (
              <p className="muted small" style={{ color: "#ff8080" }}>
                {errorMessage}
              </p>
            )}
          </div>
        </section>
      ) : (allResults.length > 1 || secondResults) ? (
        /* COMPARISON VIEW - When both images are analyzed, show ONLY the tabbed comparison */
        <main className="analysis-container">
          <section className="analysis-card">
            <FullComparisonView
              results={results}
              secondResults={secondResults}
              allResults={allResults}
              files={files}
              visualTab={visualTab}
              setVisualTab={setVisualTab}
              isZoomed={isZoomed}
              setIsZoomed={setIsZoomed}
              handleMouseMove={handleMouseMove}
              handleImageClick={handleImageClick}
              zoomImageRef={zoomImageRef}
              getActiveVisualImage={getActiveVisualImage}
              getActiveVisualImageSecond={getActiveVisualImageSecond}
              getRiskClass={getRiskClass}
              getResultClass={getResultClass}
              handleDownloadImage={handleDownloadImage}
              handleDownloadReport={handleDownloadReport}
              handleDownloadSecondReport={handleDownloadSecondReport}
              isGeneratingReport={isGeneratingReport}
              file={file}
              secondFile={secondFile}
            />

            <div className="btn-row" style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
              <button
                className="btn-secondary"
                onClick={handleBackToUpload}
                style={{
                  padding: "14px 40px",
                  fontSize: "1rem",
                  minWidth: "280px"
                }}
              >
                Analyze Another Image
              </button>
            </div>
          </section>
        </main>
      ) : (
        /* SINGLE IMAGE VIEW - When only one image is analyzed */
        <main className="analysis-container">
          <section className="analysis-card">
            <div className="result-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h2 className={`result-title ${getResultClass()}`}>
                {results.result || "Analysis Result"}
              </h2>
              <p className={`risk-pill ${getRiskClass()}`}>
                Risk Level:&nbsp;
                <strong>
                  {results.risk || "Not available"}
                </strong>
              </p>
            </div>

            {errorMessage && (
              <div style={{ marginBottom: "15px" }}>
                <p className="muted small" style={{ color: "#ff8080" }}>
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Prediction Metrics Section */}
            <section className="section">
              <h3 className="section-title">Prediction Metrics</h3>
              <div className="metric-grid">
                <div className="metric">
                  <span className="metric-label">Benign</span>
                  <h3>
                    {results.benign != null
                      ? `${results.benign.toFixed(2)}%`
                      : "—"}
                  </h3>
                </div>
                <div className="metric">
                  <span className="metric-label">Malignant</span>
                  <h3>
                    {results.malignant != null
                      ? `${results.malignant.toFixed(2)}%`
                      : "—"}
                  </h3>
                </div>
                <div className="metric">
                  <span className="metric-label">Model Confidence</span>
                  <h3>
                    {results.confidence != null
                      ? `${results.confidence.toFixed(2)}%`
                      : "—"}
                  </h3>
                </div>
              </div>
            </section>

            {/* AI Summary Section */}
            <section className="section">
              <h3 className="section-title">AI Summary</h3>
              <div className="summary-box malignant">
                <p>{results.findings?.summary || "Analysis summary not available."}</p>
              </div>
            </section>

            <section className="section">
              <h3 className="section-title">Visual Analysis</h3>
              <p className="section-subtitle">
                Grad-CAM attention maps showing which regions influenced the
                model&apos;s decision.
              </p>

              <div className="visual-tabs">
                <button
                  className={`visual-tab ${visualTab === "bbox" ? "active" : ""}`}
                  onClick={() => setVisualTab("bbox")}
                >
                  Region Detection (BBox)
                </button>
                <button
                  className={`visual-tab ${visualTab === "original" ? "active" : ""
                    }`}
                  onClick={() => setVisualTab("original")}
                >
                  Cancer Detection
                </button>
                <button
                  className={`visual-tab ${visualTab === "overlay" ? "active" : ""
                    }`}
                  onClick={() => setVisualTab("overlay")}
                >
                  Heatmap Overlay
                </button>
                <button
                  className={`visual-tab ${visualTab === "heatmap" ? "active" : ""
                    }`}
                  onClick={() => setVisualTab("heatmap")}
                >
                  Heatmap Only
                </button>

              </div>

              <div className="visual-panel">
                <div style={{ display: 'flex', gap: '20px' }}>
                  {/* Main Image Container */}
                  <div className="visual-image-card" style={{ position: 'relative', flex: (visualTab === 'bbox' || visualTab === 'original') && results.findings?.regions?.length > 0 ? '1 1 65%' : '1 1 100%' }}>
                    {getActiveVisualImage() ? (
                      <>
                        <div
                          className="zoom-container"
                          onMouseMove={handleMouseMove}
                          onClick={handleImageClick}
                          style={{ position: 'relative' }}
                        >
                          {/* View Label Overlay */}
                          {results.view_analysis && results.view_analysis.view_code && (
                            <div style={{
                              position: 'absolute',
                              top: '12px',
                              left: '12px',
                              background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.75) 100%)',
                              color: 'white',
                              padding: '10px 18px',
                              borderRadius: '8px',
                              fontWeight: '700',
                              fontSize: '1.1rem',
                              zIndex: 10,
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                              backdropFilter: 'blur(10px)',
                              border: '2px solid rgba(255, 255, 255, 0.2)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}>
                              <div style={{
                                fontSize: '1.3rem',
                                letterSpacing: '1px',
                                color: '#00D9FF',
                                textShadow: '0 0 10px rgba(0, 217, 255, 0.5)'
                              }}>
                                {results.view_analysis.view_code} View
                              </div>
                              <div style={{
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                color: 'rgba(255, 255, 255, 0.85)',
                                letterSpacing: '0.5px'
                              }}>
                                {results.view_analysis.view_code.includes('MLO')
                                  ? 'Mediolateral Oblique: Angled side view'
                                  : 'Craniocaudal: Top-to-bottom view'}
                              </div>
                            </div>
                          )}

                          <img
                            ref={zoomImageRef}
                            src={getActiveVisualImage()}
                            alt="Visual analysis"
                            style={{ cursor: isZoomed ? 'zoom-out' : 'zoom-in' }}
                          />

                          {/* Green border overlay - covers the red border for selected region */}
                          {renderGreenOverlay()}

                        </div>



                        {/* Download Icon Button - Outside zoom container to prevent zoom on click */}
                         <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadImage();
                        }}
                        style={{
                          position: 'absolute',
                          bottom: '12px',
                          right: '12px',
                          left: '1/2',
                          background: 'linear-gradient(135deg, rgba(174, 112, 175, 0.9) 0%, rgba(156, 39, 176, 0.9) 100%)',
                          border: '2px solid rgba(255, 255, 255, 0.3)',
                          color: 'white',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          zIndex: 11,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                          backdropFilter: 'blur(10px)',
                          transition: 'all 0.3s ease',
                          marginBottom: '10px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'linear-gradient(135deg, rgba(186, 104, 200, 1) 0%, rgba(171, 71, 188, 1) 100%)';
                          e.target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'linear-gradient(135deg, rgba(174, 112, 175, 0.9) 0%, rgba(156, 39, 176, 0.9) 100%)';
                          e.target.style.transform = 'scale(1)';
                        }}
                        title="Download image"
                      >
                        <FiDownload size={18} />
                        Download
                      </button>                      

                            

                      </>
                    ) : (
                      <p className="muted small">Image not available.</p>
                    )}
                  </div>

                  {/* Region List Sidebar - Only show for bbox and cancer_type tabs */}
                  {(visualTab === 'bbox' || visualTab === 'original') && results.findings?.regions && results.findings.regions.length > 0 && (
                    <div style={{
                      flex: '0 0 35%',
                      background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
                      borderRadius: '12px',
                      padding: '16px',
                      maxHeight: '600px',
                      overflowY: 'auto',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
                    }}>
                      <h4 style={{
                        margin: '0 0 16px 0',
                        fontSize: '1.1rem',
                        color: '#9C2B6D',
                        fontWeight: '700',
                        borderBottom: '2px solid #E91E63',
                        paddingBottom: '8px'
                      }}>
                        📍 Detected Regions ({results.findings.regions.length})
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {results.findings.regions.map((region, idx) => (
                          <div
                            key={idx}
                            onClick={() => zoomToRegion(region)}
                            style={{
                              padding: '12px',
                              background: selectedRegion === region.id
                                ? 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)'
                                : 'white',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              border: selectedRegion === region.id
                                ? '2px solid #E91E63'
                                : '1px solid #e0e0e0',
                              transition: 'all 0.2s ease',
                              boxShadow: selectedRegion === region.id
                                ? '0 4px 12px rgba(233, 30, 99, 0.2)'
                                : '0 1px 3px rgba(0,0,0,0.1)'
                            }}
                            onMouseEnter={(e) => {
                              if (selectedRegion !== region.id) {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #f9f9f9 0%, #f0f0f0 100%)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedRegion !== region.id) {
                                e.currentTarget.style.background = 'white';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                              }
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '8px'
                            }}>
                              <span style={{
                                fontWeight: '700',
                                fontSize: '1rem',
                                color: '#9C2B6D'
                              }}>
                                Region #{region.id}
                              </span>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                background: region.severity === 'high'
                                  ? 'rgba(220, 38, 38, 0.15)'
                                  : region.severity === 'medium'
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : 'rgba(16, 185, 129, 0.15)',
                                color: region.severity === 'high'
                                  ? '#DC2626'
                                  : region.severity === 'medium'
                                    ? '#F59E0B'
                                    : '#059669'
                              }}>
                                {toProperCase(region.severity) || 'low'}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: '6px' }}>
                              <strong style={{ color: '#9C2B6D' }}>{toProperCase(region.cancer_type) || 'Abnormality'}</strong>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.75rem', color: '#666' }}>
                              <div>
                                <span style={{ color: '#999' }}>Location:</span>
                                <br />
                                <strong style={{ color: '#555' }}>{toProperCase(region.location?.quadrant) || 'N/A'}</strong>
                              </div>
                              <div>
                                <span style={{ color: '#999' }}>Confidence:</span>
                                <br />
                                <strong style={{
                                  color: region.confidence > 70 ? '#DC2626' : region.confidence > 50 ? '#F59E0B' : '#059669'
                                }}>
                                  {region.confidence?.toFixed(1)}%
                                </strong>
                              </div>
                            </div>

                            <div style={{
                              marginTop: '8px',
                              padding: '6px 8px',
                              background: 'rgba(156, 43, 109, 0.05)',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              color: '#666',
                              textAlign: 'center'
                            }}>
                              {selectedRegion === region.id ? '🔍 Click again to zoom out' : '🔍 Click to zoom to this region'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
{/* Row 3: Image Quality - Full Width */}
                        <div >

                          {results.findings.comprehensive_analysis.image_quality && (
                            <div style={{ padding: '10px', background: 'linear-gradient(135deg, #ECEFF1 0%, #CFD8DC 100%)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(69, 90, 100, 0.15)', marginBottom: '4px', marginTop: '10px'}}>
                              <div style={{ fontWeight: '700', color: '#455A64', marginBottom: '10px', fontSize: '0.95rem', gap: '6px', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.1rem' }}>📷</span> Image Quality Assessment
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '0.85rem' }}>
                                <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', textAlign: 'center' }}>
                                  <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Overall Quality</div>
                                  <strong style={{ color: '#455A64', fontSize: '1.1rem' }}>{results.findings.comprehensive_analysis.image_quality.overall_score}%</strong>
                                </div>
                                <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', textAlign: 'center' }}>
                                  <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Positioning</div>
                                  <strong style={{ color: '#455A64', fontSize: '1rem' }}>{results.findings.comprehensive_analysis.image_quality.positioning}</strong>
                                </div>
                                <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', textAlign: 'center' }}>
                                  <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Technical Adequacy</div>
                                  <strong style={{ color: '#455A64', fontSize: '1rem' }}>{results.findings.comprehensive_analysis.image_quality.technical_adequacy}</strong>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                {/* Detailed Analysis Information */}
                <div className="results-info-card">
                  <h4>Understanding Your Results</h4>


                  {/* Comprehensive Image Analysis Section - Always shown */}
                  {results.findings?.comprehensive_analysis && (
                    <div style={{ marginBottom: '24px' }}>
                      <p className="regions-header" style={{ marginBottom: '16px', fontSize: '1.1rem' }}>
                        📊 Comprehensive Image Analysis
                      </p>
                      {/* Row 4: Calcification Analysis - Alert Style if detected */}
                      {results.findings.comprehensive_analysis.calcification_analysis?.detected && (
                        <div style={{ padding: '14px', background: 'linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)', borderRadius: '12px', border: '2px solid #EF5350', boxShadow: '0 2px 12px rgba(239, 83, 80, 0.25)', marginBottom: '14px' }}>
                          <div style={{ fontWeight: '700', color: '#C62828', marginBottom: '12px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '1.2rem' }}>⚠️</span> Calcification Analysis - Attention Required
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '0.85rem' }}>
                            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Count</div>
                              <strong style={{ color: '#C62828', fontSize: '1.1rem' }}>{results.findings.comprehensive_analysis.calcification_analysis.count}</strong>
                            </div>
                            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Distribution</div>
                              <strong style={{ color: '#C62828', fontSize: '0.95rem' }}>{results.findings.comprehensive_analysis.calcification_analysis.distribution}</strong>
                            </div>
                            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Morphology</div>
                              <strong style={{ color: '#C62828', fontSize: '0.95rem' }}>{results.findings.comprehensive_analysis.calcification_analysis.morphology}</strong>
                            </div>
                            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>BI-RADS</div>
                              <strong style={{ color: '#C62828', fontSize: '1.1rem' }}>{results.findings.comprehensive_analysis.calcification_analysis.birads_category}</strong>
                            </div>
                          </div>
                          <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#C62828', fontWeight: '600', padding: '10px 12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px', borderLeft: '4px solid #C62828' }}>
                            📋 {results.findings.comprehensive_analysis.calcification_analysis.recommendation}
                          </div>
                        </div>
                      )}
                      {/* Row 1: Primary Analysis - Breast Density & Tissue Texture */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '14px' }}>
                        {/* Breast Density */}
                        {results.findings.comprehensive_analysis.breast_density && (
                          <div style={{ padding: '14px', background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(21, 101, 192, 0.15)' }}>
                            <div style={{ fontWeight: '700', color: '#1565C0', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '1.1rem' }}>🔬</span> Breast Density (ACR BI-RADS)
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Category:</span> <strong style={{ color: '#1565C0' }}>Type {results.findings.comprehensive_analysis.breast_density.category}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Density:</span> <strong style={{ color: '#1565C0' }}>{results.findings.comprehensive_analysis.breast_density.density_percentage}%</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Sensitivity:</span> <strong>{results.findings.comprehensive_analysis.breast_density.sensitivity}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Masking Risk:</span> <strong>{results.findings.comprehensive_analysis.breast_density.masking_risk}</strong></div>
                            </div>
                            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#1565C0', fontStyle: 'italic', padding: '6px 8px', background: 'rgba(255,255,255,0.4)', borderRadius: '6px' }}>{results.findings.comprehensive_analysis.breast_density.description}</div>
                          </div>
                        )}

                        {/* Tissue Texture */}
                        {results.findings.comprehensive_analysis.tissue_texture && (
                          <div style={{ padding: '14px', background: 'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(123, 31, 162, 0.15)' }}>
                            <div style={{ fontWeight: '700', color: '#7B1FA2', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '1.1rem' }}>🧬</span> Tissue Texture Analysis
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Pattern:</span> <strong style={{ color: '#7B1FA2' }}>{results.findings.comprehensive_analysis.tissue_texture.pattern}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Uniformity:</span> <strong style={{ color: '#7B1FA2' }}>{results.findings.comprehensive_analysis.tissue_texture.uniformity_score}%</strong></div>
                            </div>
                            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#7B1FA2', fontStyle: 'italic', padding: '6px 8px', background: 'rgba(255,255,255,0.4)', borderRadius: '6px' }}>{results.findings.comprehensive_analysis.tissue_texture.clinical_note}</div>
                          </div>
                        )}
                      </div>

                      {/* Row 2: Secondary Analysis - Symmetry, Skin & Nipple, Vascular */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
                        {/* Symmetry Analysis */}
                        {results.findings.comprehensive_analysis.symmetry && (
                          <div style={{ padding: '14px', background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(46, 125, 50, 0.15)' }}>
                            <div style={{ fontWeight: '700', color: '#2E7D32', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '1.1rem' }}>⚖️</span> Symmetry
                            </div>
                            <div style={{ display: 'grid', gap: '6px', fontSize: '0.85rem' }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Assessment:</span> <strong style={{ color: '#2E7D32' }}>{results.findings.comprehensive_analysis.symmetry.assessment}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Score:</span> <strong style={{ color: '#2E7D32' }}>{results.findings.comprehensive_analysis.symmetry.symmetry_score}%</strong></div>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#2E7D32', fontStyle: 'italic' }}>{results.findings.comprehensive_analysis.symmetry.clinical_significance}</div>
                          </div>
                        )}

                        {/* Skin & Nipple */}
                        {results.findings.comprehensive_analysis.skin_nipple && (
                          <div style={{ padding: '14px', background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(230, 81, 0, 0.15)' }}>
                            <div style={{ fontWeight: '700', color: '#E65100', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '1.1rem' }}>👁️</span> Skin & Nipple
                            </div>
                            <div style={{ display: 'grid', gap: '6px', fontSize: '0.85rem' }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Skin:</span> <strong style={{ color: '#E65100' }}>{results.findings.comprehensive_analysis.skin_nipple.skin_status}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Concern:</span> <strong style={{ color: '#E65100' }}>{results.findings.comprehensive_analysis.skin_nipple.skin_concern_level}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Nipple:</span> <strong>{results.findings.comprehensive_analysis.skin_nipple.nipple_retraction}</strong></div>
                            </div>
                          </div>
                        )}

                        {/* Vascular Patterns */}
                        {results.findings.comprehensive_analysis.vascular_patterns && (
                          <div style={{ padding: '14px', background: 'linear-gradient(135deg, #FCE4EC 0%, #F8BBD9 100%)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(194, 24, 91, 0.15)' }}>
                            <div style={{ fontWeight: '700', color: '#C2185B', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '1.1rem' }}>🩸</span> Vascular Pattern
                            </div>
                            <div style={{ display: 'grid', gap: '6px', fontSize: '0.85rem' }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Pattern:</span> <strong style={{ color: '#C2185B' }}>{results.findings.comprehensive_analysis.vascular_patterns.pattern}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Score:</span> <strong style={{ color: '#C2185B' }}>{results.findings.comprehensive_analysis.vascular_patterns.vascular_score}%</strong></div>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#C2185B', fontStyle: 'italic' }}>{results.findings.comprehensive_analysis.vascular_patterns.clinical_note}</div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {results.result?.toLowerCase().includes("malignant") ? (
                    <div>
                      {/* Detected Regions */}
                      {results.findings?.regions && results.findings.regions.length > 0 && (
                        <>
                          <p className="regions-header">
                            Detected Regions ({results.findings.num_regions})
                          </p>
                          <div className="regions-grid">
                            {results.findings.regions.map((region, idx) => (
                              <div key={idx} className="region-card" style={{ marginBottom: '16px' }}>
                                <div className="region-card-header">
                                  Region {region.id}: {toProperCase(region.cancer_type) || 'Abnormality'}
                                  {region.birads_region && (
                                    <span style={{ marginLeft: '10px', padding: '2px 8px', background: '#E91E63', color: 'white', borderRadius: '4px', fontSize: '0.75rem' }}>
                                      BI-RADS {region.birads_region}
                                    </span>
                                  )}
                                </div>
                                <div className="region-card-grid">
                                  <div style={{ gridColumn: '1 / -1', paddingBottom: '8px', borderBottom: '1px solid rgba(156, 43, 109, 0.15)' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#8B5A8D' }}>Type:</span>
                                    <strong style={{ fontSize: '0.95rem', color: '#9C2B6D' }}> {toProperCase(region.cancer_type) || 'Unknown'}</strong>
                                  </div>
                                  <div>
                                    <span>Location:</span>{' '}
                                    <strong>
                                      {toProperCase(region.location?.quadrant) || 'Unknown'}
                                    </strong>
                                  </div>


                                  <div><span>Confidence:</span> <strong style={{ color: region.confidence > 70 ? '#DC2626' : '#059669' }}>{region.confidence?.toFixed(1)}%</strong></div>

                                  {/* Morphology Details */}
                                  <div><span>Morphology:</span> <strong>{region.morphology?.shape || '—'}</strong></div>
                                  <div><span>Margin:</span> <strong>{region.margin?.type || '—'}</strong></div>
                                  <div><span>Margin Risk:</span> <strong style={{ color: region.margin?.risk_level === 'High' ? '#DC2626' : region.margin?.risk_level === 'Moderate' ? '#F59E0B' : '#059669' }}>{region.margin?.risk_level || '—'}</strong></div>
                                  <div><span>Density:</span> <strong>{toProperCase(region.density?.level) || '—'}</strong></div>
                                  <div><span>Vascularity:</span> <strong>{region.vascularity?.assessment || '—'}</strong></div>
                                  <div><span>Tissue:</span> <strong>{region.tissue_composition?.type || '—'}</strong></div>

                                  {/* Calcification details if present */}
                                  {region.calcification_details && (
                                    <>
                                      <div><span>Calc. Type:</span> <strong>{region.calcification_details.morphology || '—'}</strong></div>
                                      <div><span>Calc. Dist:</span> <strong>{region.calcification_details.distribution || '—'}</strong></div>
                                    </>
                                  )}

                                  <div>
                                    <span>Severity:</span>{' '}
                                    <span className={`severity-badge ${region.severity || 'low'}`}>
                                      {toProperCase(region.severity || 'low')}
                                    </span>
                                  </div>
                                  <div><span>Area:</span> <strong>{region.size?.area_percentage?.toFixed(2)}%</strong></div>
                                </div>

                                {/* Clinical Significance */}
                                {region.clinical_significance && (
                                  <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(233, 30, 99, 0.08)', borderRadius: '8px', borderLeft: '3px solid #E91E63' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#8B5A8D', marginBottom: '4px' }}>Clinical Significance:</div>
                                    <div style={{ fontSize: '0.85rem', color: '#333' }}>{region.clinical_significance}</div>
                                  </div>
                                )}

                                {/* Recommended Action */}
                                {region.recommended_action && (
                                  <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(156, 43, 109, 0.08)', borderRadius: '8px', borderLeft: '3px solid #9C2B6D' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#8B5A8D', marginBottom: '4px' }}>Recommended Action:</div>
                                    <div style={{ fontSize: '0.85rem', color: '#333', fontWeight: '600' }}>{region.recommended_action}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="urgent-box" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0' }}>
                        <h5 style={{ color: '#059669' }}>✓ Continue Preventive Care</h5>
                        <p>The analysis shows patterns consistent with healthy tissue. Continue regular screenings.</p>
                        <ul className="checklist" style={{ listStyle: 'none' }}>
                          <li style={{ color: '#059669' }}>Monthly self-breast examinations</li>
                          <li style={{ color: '#059669' }}>Age-appropriate mammogram schedules</li>
                          <li style={{ color: '#059669' }}>Report any new changes immediately</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Mammogram View Analysis Section */}
            {results.view_analysis && (
              <section className="section">
                <p className="regions-header" style={{ textAlign: 'center' }}>
                  Mammogram View Analysis
                  {isAnalyzing && (
                    <span style={{
                      marginLeft: '12px',
                      fontSize: '0.75rem',
                      color: '#F57C00',
                      fontWeight: '500',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }}>
                      • Completing analysis...
                    </span>
                  )}
                </p>

                <div style={{
                  padding: '16px',
                  background: results.view_analysis.view_code?.includes('MLO')
                    ? 'linear-gradient(135deg, #EDE7F6 0%, #D1C4E9 100%)'
                    : 'linear-gradient(135deg, #E0F2F1 0%, #B2DFDB 100%)',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  opacity: isAnalyzing ? 0.9 : 1,
                  transition: 'opacity 0.3s ease'
                }}>
                  {/* View Type Header with View Code Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: '8px'
                  }}>
                    {/* View Code Badge */}
                    <div style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: results.view_analysis.view_code?.includes('MLO')
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                      color: 'white',
                      fontWeight: '800',
                      fontSize: '1.3rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      minWidth: '70px',
                      textAlign: 'center'
                    }}>
                      {results.view_analysis.view_code || 'N/A'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: '700',
                        fontSize: '1.2rem',
                        color: results.view_analysis.view_code?.includes('MLO') ? '#5E35B1' : '#00796B'
                      }}>
                        {results.view_analysis.view_code} View
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '2px' }}>
                        {results.view_analysis.view_code?.includes('MLO')
                          ? 'Medio-Lateral Oblique: Angled side view showing pectoral muscle and axilla'
                          : 'Cranio-Caudal: Top-to-bottom view for medial/lateral tissue assessment'}
                      </div>
                    </div>
                  </div>

                  {/* View Analysis Grid - Only unique/view-specific information */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {/* Laterality */}
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Breast Side</div>
                      <div style={{ fontWeight: '700', color: results.view_analysis.laterality === 'Right' ? '#1565C0' : '#C2185B', fontSize: '1rem' }}>
                        {results.view_analysis.view_code || 'N/A'}
                      </div>
                    </div>

                    {/* Image Quality */}
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Image Quality</div>
                      <div style={{ fontWeight: '600', color: '#333' }}>{results.view_analysis.image_quality || 'N/A'}</div>
                    </div>

                    {/* Quality Score */}
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Quality Score</div>
                      <div style={{ fontWeight: '700', fontSize: '1.2rem', color: results.view_analysis.quality_score >= 70 ? '#2E7D32' : results.view_analysis.quality_score ? '#F57C00' : '#999' }}>
                        {results.view_analysis.quality_score ? `${results.view_analysis.quality_score}%` : '...'}
                      </div>
                    </div>

                    {/* MLO-specific: Axillary Findings */}
                    {results.view_analysis.view_code?.includes('MLO') && results.view_analysis.axillary_findings && (
                      <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Axillary Findings</div>
                        <div style={{ fontWeight: '600', color: '#333', fontSize: '0.85rem' }}>
                          {results.view_analysis.axillary_findings}
                        </div>
                      </div>
                    )}

                    {/* MLO-specific: Pectoral Muscle */}
                    {/* {results.view_analysis.view_code?.includes('MLO') && results.view_analysis.pectoral_muscle_visibility && (
                      <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Pectoral Muscle</div>
                        <div style={{ fontWeight: '600', color: '#333', fontSize: '0.85rem' }}>
                          {results.view_analysis.pectoral_muscle_visibility}
                        </div>
                      </div>
                    )} */}

                    {/* CC-specific: Asymmetry */}
                    {results.view_analysis.view_code?.includes('CC') && results.view_analysis.asymmetry && (
                      <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Asymmetry</div>
                        <div style={{ fontWeight: '600', color: '#333', fontSize: '0.85rem' }}>
                          {results.view_analysis.asymmetry}
                        </div>
                      </div>
                    )}

                    {/* CC-specific: Skin/Nipple Changes */}
                    {results.view_analysis.view_code?.includes('CC') && results.view_analysis.skin_nipple_changes && (
                      <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Skin & Nipple</div>
                        <div style={{ fontWeight: '600', color: '#333', fontSize: '0.85rem' }}>
                          {results.view_analysis.skin_nipple_changes}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Impression */}
                  <div style={{
                    marginTop: '14px',
                    padding: '12px 14px',
                    background: results.view_analysis.suspicion_level === 'High'
                      ? 'rgba(198, 40, 40, 0.1)'
                      : results.view_analysis.suspicion_level === 'Intermediate'
                        ? 'rgba(245, 124, 0, 0.1)'
                        : 'rgba(46, 125, 50, 0.1)',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${results.view_analysis.suspicion_level === 'High'
                      ? '#C62828'
                      : results.view_analysis.suspicion_level === 'Intermediate'
                        ? '#F57C00'
                        : '#2E7D32'
                      }`
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Impression</div>
                    <div style={{
                      fontWeight: '600',
                      color: results.view_analysis.suspicion_level === 'High'
                        ? '#C62828'
                        : results.view_analysis.suspicion_level === 'Intermediate'
                          ? '#F57C00'
                          : '#2E7D32'
                    }}>
                      {results.view_analysis.impression || 'Analysis complete'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '6px' }}>
                      Suspicion Level: <strong>{results.view_analysis.suspicion_level || 'N/A'}</strong> |
                      Confidence: <strong>{results.view_analysis.confidence_score || 'N/A'}</strong>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="section">
              <h3 className="section-title">Report Details</h3>
              <div className="details-tabs">
                <button
                  className={`details-tab ${detailsTab === "clinical" ? "active" : ""
                    }`}
                  onClick={() => setDetailsTab("clinical")}
                >
                  Clinical Context
                </button>
                <button
                  className={`details-tab ${detailsTab === "nextSteps" ? "active" : ""
                    }`}
                  onClick={() => setDetailsTab("nextSteps")}
                >
                  Next Steps
                </button>
                <button
                  className={`details-tab ${detailsTab === "risk" ? "active" : ""
                    }`}
                  onClick={() => setDetailsTab("risk")}
                >
                  Risk Guide
                </button>
                <button
                  className={`details-tab ${detailsTab === "heatmapInfo" ? "active" : ""
                    }`}
                  onClick={() => setDetailsTab("heatmapInfo")}
                >
                  Heatmap Tips
                </button>
              </div>

              <div className="details-panel">
                {detailsTab === "risk" && (
                  <div>
                    <h4 className="details-heading">Risk Assessment Guide</h4>
                    <ul className="details-list">
                      <li><strong>Very Low Risk (0–10%):</strong> Minimal concern. Continue routine annual screenings.</li>
                      <li><strong>Low Risk (10–25%):</strong> Low probability of malignancy. Regular monitoring recommended.</li>
                      <li><strong>Moderate Risk (25–50%):</strong> Some concerning features detected. Additional imaging may be needed.</li>
                      <li><strong>High Risk (50–75%):</strong> Significant abnormalities present. Immediate follow-up with specialist recommended.</li>
                      <li><strong>Very High Risk (75–100%):</strong> Strong indicators of malignancy. Urgent consultation with oncologist required.</li>
                    </ul>
                    <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 200, 220, 0.15)', borderRadius: '8px' }}>
                      <p style={{ fontSize: '1.1rem', margin: 0 }}>
                        <strong>Note:</strong> Risk levels are based on AI model confidence. They should be confirmed with
                        clinical examination, additional imaging (mammography, ultrasound, MRI), and if necessary, tissue biopsy.
                      </p>
                    </div>
                  </div>
                )}
                {detailsTab === "heatmapInfo" && (
                  <div>
                    <h4 className="details-heading">Understanding Grad-CAM Heatmaps</h4>
                    <p style={{ marginBottom: '16px', lineHeight: '1.8' }}>
                      Grad-CAM (Gradient-weighted Class Activation Mapping) is an AI visualization technique that shows
                      which parts of the image most influenced the model's decision. Think of it as the AI "highlighting"
                      areas it found most important.
                    </p>

                    <h4 className="details-heading" style={{ marginTop: '20px' }}>Color Meanings</h4>
                    <ul className="details-list">
                      <li><strong style={{ color: '#DC2626' }}>Red/Orange:</strong> Highest attention areas. The model
                        found these regions most significant for its prediction. In malignant cases, these often indicate
                        suspicious tissue patterns.</li>
                      <li><strong style={{ color: '#F59E0B' }}>Yellow:</strong> Moderate attention. Areas of interest
                        but less critical than red zones.</li>
                      <li><strong style={{ color: '#10B981' }}>Green:</strong> Low to moderate attention. Normal or
                        less concerning tissue patterns.</li>
                      <li><strong style={{ color: '#3B82F6' }}>Blue:</strong> Minimal attention. Areas that had little
                        impact on the final prediction.</li>
                    </ul>

                    <h4 className="details-heading" style={{ marginTop: '20px' }}>Viewing Modes Explained</h4>
                    <ul className="details-list">
                      <li><strong>Heatmap Overlay:</strong> Best for understanding suspicious areas in anatomical context.
                        The original image is shown with colored heatmap overlaid.</li>
                      <li><strong>Heatmap Only:</strong> Pure activation visualization without the original image.
                        Useful for seeing the exact intensity distribution.</li>
                      <li><strong>Region Detection (BBox):</strong> Shows detected regions of interest with bounding boxes.
                        Highlights specific areas the model identified.</li>
                      <li><strong>Type of Cancer detection:</strong> Unprocessed scan for reference and comparison.</li>
                    </ul>

                    <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 200, 220, 0.15)', borderRadius: '8px' }}>
                      <p style={{ fontSize: '1.1rem', margin: 0 }}>
                        <strong>Important:</strong> Heatmaps show AI attention, not confirmed disease. Red areas don't
                        automatically mean cancer, and blue areas don't guarantee health. Medical professionals use multiple
                        diagnostic tools for accurate assessment.
                      </p>
                    </div>
                  </div>
                )}
                {detailsTab === "clinical" && (
                  <div>
                    {/* Detection Statistics Table */}
                    <h4 className="details-heading" style={{ marginTop: '30px', marginBottom: '18px', fontSize: '1.4rem', color: '#9C2B6D' }}>Detection Statistics</h4>
                    <div style={{ overflowX: 'auto', background: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(156, 43, 109, 0.08)', padding: '5px' }}>
                      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '1.1rem', marginBottom: '0' }}>
                        <thead>
                          <tr style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)' }}>
                            <th style={{ padding: '16px 18px', textAlign: 'left', borderBottom: 'none', fontWeight: '700', color: '#9C2B6D', borderTopLeftRadius: '12px', fontSize: '1.1rem' }}>Metric</th>
                            <th style={{ padding: '16px 18px', textAlign: 'left', borderBottom: 'none', fontWeight: '700', color: '#9C2B6D', fontSize: '1.1rem' }}>Value</th>
                            <th style={{ padding: '16px 18px', textAlign: 'left', borderBottom: 'none', fontWeight: '700', color: '#9C2B6D', borderTopRightRadius: '12px', fontSize: '1.1rem' }}>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: 'rgba(252, 231, 243, 0.3)' }}>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '600', color: '#555' }}>Regions Detected</td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: '#9C2B6D', fontSize: '1rem' }}>{results.findings?.num_regions || 0}</td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', color: '#666' }}>Number of suspicious areas identified</td>
                          </tr>
                          <tr style={{ background: 'white' }}>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '600', color: '#555' }}>High-Attention Areas</td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: '#9C2B6D', fontSize: '1rem' }}>{results.findings?.high_attention_percentage?.toFixed(2) || '0.00'}%</td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', color: '#666' }}>Percentage of image with high AI activation</td>
                          </tr>
                          <tr style={{ background: 'rgba(252, 231, 243, 0.3)' }}>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '600', color: '#555' }}>Max Activation</td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: '#9C2B6D', fontSize: '1rem' }}>{results.findings?.max_activation ? (results.findings.max_activation * 100).toFixed(2) : '0.00'}%</td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', color: '#666' }}>Peak intensity level detected</td>
                          </tr>
                          <tr style={{ background: 'white' }}>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '600', color: '#555' }}>Overall Activity</td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: '#9C2B6D', fontSize: '1rem' }}>{results.findings?.overall_activation ? (results.findings.overall_activation * 100).toFixed(2) : '0.00'}%</td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', color: '#666' }}>Average activation across the image</td>
                          </tr>
                          <tr style={{ background: 'rgba(252, 231, 243, 0.3)' }}>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '600', color: '#555' }}>Malignant Probability</td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: results.malignant > 50 ? '#DC2626' : '#059669', fontSize: '1rem' }}>{results.malignant?.toFixed(2) || '0.00'}%</td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', color: '#666' }}>Probability of cancerous tissue</td>
                          </tr>
                          <tr style={{ background: 'white' }}>
                            <td style={{ padding: '14px 16px', borderBottom: 'none', fontWeight: '600', color: '#555', borderBottomLeftRadius: '12px' }}>Benign Probability</td>
                            <td style={{ padding: '14px 16px', borderBottom: 'none', fontWeight: '700', color: results.benign > 50 ? '#059669' : '#DC2626', fontSize: '1rem' }}>{results.benign?.toFixed(2) || '0.00'}%</td>
                            <td style={{ padding: '14px 16px', borderBottom: 'none', color: '#666', borderBottomRightRadius: '12px' }}>Probability of healthy tissue</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Detected Regions Table */}
                    {results.findings?.regions && results.findings.regions.length > 0 && (
                      <>
                        <h4 className="details-heading" style={{ marginTop: '30px', marginBottom: '18px', fontSize: '1.4rem', color: '#9C2B6D' }}>Detected Regions Detail</h4>
                        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(156, 43, 109, 0.08)', padding: '5px' }}>
                          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '1.05rem', marginBottom: '0' }}>
                            <thead>
                              <tr style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)' }}>
                                <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: 'none', fontWeight: '700', color: '#9C2B6D', borderTopLeftRadius: '12px', fontSize: '1.05rem' }}>Region</th>
                                <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: 'none', fontWeight: '700', color: '#9C2B6D', fontSize: '1.05rem' }}>Cancer Type</th>
                                <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: 'none', fontWeight: '700', color: '#9C2B6D', fontSize: '1.05rem' }}>Location</th>
                                <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: 'none', fontWeight: '700', color: '#9C2B6D', fontSize: '1.05rem' }}>Confidence</th>
                                <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: 'none', fontWeight: '700', color: '#9C2B6D', fontSize: '1.05rem' }}>Severity</th>
                                <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: 'none', fontWeight: '700', color: '#9C2B6D', borderTopRightRadius: '12px', fontSize: '1.05rem' }}>Area %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.findings.regions.map((region, idx) => (
                                <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(252, 231, 243, 0.3)' : 'white' }}>
                                  <td style={{ padding: '14px 16px', borderBottom: idx === results.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: '#9C2B6D', fontSize: '1.1rem' }}>#{region.id}</td>
                                  <td style={{ padding: '12px 14px', borderBottom: idx === results.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)', color: '#9C2B6D', fontWeight: '700', fontSize: '1rem' }}>{region.cancer_type || 'Unknown'}</td>
                                  <td style={{ padding: '12px 14px', borderBottom: idx === results.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)', color: '#555' }}>{region.location?.quadrant || 'N/A'}</td>
                                  <td style={{ padding: '14px 16px', borderBottom: idx === results.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: region.confidence > 70 ? '#DC2626' : region.confidence > 50 ? '#F59E0B' : '#059669', fontSize: '1.1rem' }}>{region.confidence?.toFixed(1)}%</td>
                                  <td style={{ padding: '12px 14px', borderBottom: idx === results.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)' }}>
                                    <span style={{
                                      padding: '4px 10px',
                                      borderRadius: '14px',
                                      fontSize: '0.95rem',
                                      fontWeight: '600',
                                      background: region.severity === 'high' ? 'rgba(220, 38, 38, 0.12)' : region.severity === 'medium' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                      color: region.severity === 'high' ? '#DC2626' : region.severity === 'medium' ? '#F59E0B' : '#059669',
                                      textTransform: 'lowercase'
                                    }}>
                                      {region.severity || 'low'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', borderBottom: idx === results.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)', color: '#555', fontWeight: '600' }}>{region.size?.area_percentage?.toFixed(2)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {/* No Regions Detected */}
                    {(!results.findings?.regions || results.findings.regions.length === 0) && (
                      <div style={{ padding: '20px', background: 'linear-gradient(135deg, #e5fff5 0%, #f5fffa 100%)', borderRadius: '16px', marginTop: '25px', border: '2px solid #c9ffe5', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <p style={{ margin: 0, fontSize: '1.15rem', color: '#059669', lineHeight: '1.7' }}>
                          ✓ <strong>No distinct suspicious regions detected.</strong> The tissue appears uniform without focal abnormalities.
                        </p>
                      </div>
                    )}

                  </div>
                )}
                {detailsTab === "nextSteps" && (
                  <div>
                    <h4 className="details-heading">What To Do After Your Results</h4>

                    {results.result?.toLowerCase().includes("malignant") ? (
                      <div>
                        <div style={{ padding: '14px', background: 'rgba(220, 38, 38, 0.08)', borderRadius: '10px', marginBottom: '16px', borderLeft: '4px solid #DC2626' }}>
                          <p style={{ margin: 0, fontWeight: '600', color: '#DC2626' }}>
                            ⚠️ High-Priority Action Required
                          </p>
                        </div>

                        <h4 className="details-heading" style={{ marginTop: '20px' }}>Immediate Steps (Within 1-2 Days)</h4>
                        <ul className="details-list">
                          <li><strong>Contact Your Primary Care Doctor:</strong> Schedule an urgent appointment to discuss these findings.</li>
                          <li><strong>Request Specialist Referral:</strong> Ask for a referral to a breast surgeon or oncologist.</li>
                          <li><strong>Gather Medical History:</strong> Compile your family history of breast cancer and previous mammogram results.</li>
                          <li><strong>Don't Panic:</strong> Remember this is a screening tool. Confirmation requires professional diagnosis.</li>
                        </ul>

                        <h4 className="details-heading" style={{ marginTop: '20px' }}>Follow-Up Diagnostic Tests</h4>
                        <ul className="details-list">
                          <li><strong>Diagnostic Mammogram:</strong> More detailed imaging of suspicious areas</li>
                          <li><strong>Ultrasound:</strong> Helps distinguish between solid masses and fluid-filled cysts</li>
                          <li><strong>MRI (if recommended):</strong> Provides detailed breast tissue images</li>
                          <li><strong>Biopsy:</strong> The only way to definitively diagnose cancer (if abnormalities confirmed)</li>
                        </ul>

                        <h4 className="details-heading" style={{ marginTop: '20px' }}>Questions to Ask Your Doctor</h4>
                        <ul className="details-list">
                          <li>What additional tests do you recommend?</li>
                          <li>How soon should I get these tests done?</li>
                          <li>What are the possible next steps based on test results?</li>
                          <li>Should I consult with a specialist?</li>
                          <li>Are there lifestyle changes I should make immediately?</li>
                        </ul>
                      </div>
                    ) : (
                      <div>
                        <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', marginBottom: '16px', borderLeft: '4px solid #10B981' }}>
                          <p style={{ margin: 0, fontWeight: '600', color: '#059669' }}>
                            ✓ Positive Results - Continue Preventive Care
                          </p>
                        </div>

                        <h4 className="details-heading" style={{ marginTop: '20px' }}>Recommended Actions</h4>
                        <ul className="details-list">
                          <li><strong>Continue Regular Screenings:</strong> Follow age-appropriate screening guidelines (annual or biennial mammograms).</li>
                          <li><strong>Monthly Self-Exams:</strong> Perform breast self-examinations to notice any changes early.</li>
                          <li><strong>Share Results with Doctor:</strong> Discuss these findings at your next routine check-up.</li>
                          <li><strong>Stay Vigilant:</strong> Report any new lumps, changes in breast appearance, or symptoms to your doctor.</li>
                        </ul>

                        <h4 className="details-heading" style={{ marginTop: '20px' }}>Preventive Health Measures</h4>
                        <ul className="details-list">
                          <li><strong>Maintain Healthy Weight:</strong> Obesity increases breast cancer risk</li>
                          <li><strong>Regular Exercise:</strong> Aim for 150+ minutes of moderate activity per week</li>
                          <li><strong>Limit Alcohol:</strong> Reduce alcohol consumption (increases cancer risk)</li>
                          <li><strong>Healthy Diet:</strong> Focus on fruits, vegetables, whole grains</li>
                          <li><strong>Know Your Family History:</strong> Inform your doctor if there's a family history of breast cancer</li>
                        </ul>

                        <h4 className="details-heading" style={{ marginTop: '20px' }}>When to Seek Immediate Medical Attention</h4>
                        <ul className="details-list">
                          <li>New lump or thickening in breast or underarm</li>
                          <li>Change in breast size, shape, or contour</li>
                          <li>Dimpling, puckering, or redness of breast skin</li>
                          <li>Nipple discharge, retraction, or changes</li>
                          <li>Persistent breast or nipple pain</li>
                        </ul>
                      </div>
                    )}

                    <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(192, 37, 108, 0.08)', borderRadius: '10px' }}>
                      <p style={{ margin: 0, fontSize: '1.15rem', lineHeight: '1.8' }}>
                        <strong>Remember:</strong> This AI analysis is a supplementary screening tool. All findings should be
                        reviewed and confirmed by qualified healthcare professionals. When in doubt, always consult your doctor.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
            <div className="urgent-box malignant">
                        <h5>⚕️ Recommended Action</h5>
                        <p>Based on these findings, consultation with an oncologist or breast specialist is strongly recommended.</p>
                        <ul className="checklist">
                          <li>Clinical Breast Examination</li>
                          <li>Diagnostic Mammography</li>
                          <li>Breast Ultrasound</li>
                          <li>Core Needle Biopsy (if needed)</li>
                        </ul>
                      </div>

            <div className="btn-row" style={{ flexDirection: "column", gap: "16px" }}>
              <button
                className="btn-primary"
                onClick={handleDownloadReport}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? "Preparing Report…" : "Download PDF Report"}
              </button>
              <button className="btn-secondary" onClick={handleBackToUpload}>
                Analyze Another Image
              </button>
            </div>

          </section>
        </main>
      )}
    </div>
  );
}

export default AppContent;

