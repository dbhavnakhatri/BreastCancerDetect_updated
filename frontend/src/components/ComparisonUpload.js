import React, { useMemo, useState, useEffect } from "react";
import { FiUploadCloud, FiLogOut } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import ComparisonView from "./ComparisonView";
import "../App.css";

const getDefaultApiBase = () => {
  if (typeof window !== "undefined") {
    const localHosts = ["localhost", "127.0.0.1", "0.0.0.0"];
    if (localHosts.includes(window.location.hostname)) {
      console.log("Auto-detected local environment - Using backend: http://localhost:8001");
      return "http://localhost:8001";
    }
  }

  const envUrl = process.env.REACT_APP_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    console.log("Using API URL from env:", envUrl);
    return envUrl.replace(/\/$/, "");
  }

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

function ComparisonUpload() {
  const apiBase = useMemo(() => getDefaultApiBase(), []);
  const apiUrl = (endpoint) => buildEndpoint(apiBase, endpoint);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);
  const [leftResults, setLeftResults] = useState(null);
  const [rightResults, setRightResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadHistory, setUploadHistory] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  // Load upload history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('uploadHistory');
    if (savedHistory) {
      try {
        setUploadHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error loading upload history:', e);
      }
    }
  }, []);

  const saveToHistory = (fileName, fileData) => {
    const newEntry = {
      id: Date.now(),
      name: fileName,
      data: fileData,
      timestamp: new Date().toISOString()
    };
    
    setUploadHistory(prev => {
      const updated = [newEntry, ...prev.filter(h => h.name !== fileName)].slice(0, 5);
      localStorage.setItem('uploadHistory', JSON.stringify(updated));
      return updated;
    });
  };

  const removeFromHistory = (id) => {
    setUploadHistory(prev => {
      const updated = prev.filter(h => h.id !== id);
      localStorage.setItem('uploadHistory', JSON.stringify(updated));
      return updated;
    });
  };

  const uploadFromHistory = (historyItem, side) => {
    fetch(historyItem.data)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], historyItem.name, { type: blob.type || 'image/jpeg' });
        if (side === 'left') {
          setLeftFile(file);
          analyzeFile(file, 'left');
        } else {
          setRightFile(file);
          analyzeFile(file, 'right');
        }
      })
      .catch(err => {
        console.error('Error loading from history:', err);
        setErrorMessage('Failed to load image from history');
      });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e, side) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (side === 'left') {
        setLeftFile(droppedFile);
        analyzeFile(droppedFile, 'left');
      } else {
        setRightFile(droppedFile);
        analyzeFile(droppedFile, 'right');
      }
    }
  };

  const handleFileChange = (e, side) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      const reader = new FileReader();
      reader.onload = () => {
        saveToHistory(selectedFile.name, reader.result);
      };
      reader.readAsDataURL(selectedFile);

      if (side === 'left') {
        setLeftFile(selectedFile);
        analyzeFile(selectedFile, 'left');
      } else {
        setRightFile(selectedFile);
        analyzeFile(selectedFile, 'right');
      }
    }
  };

  const handleBrowseClick = (side) => {
    const inputId = side === 'left' ? "fileInputLeft" : "fileInputRight";
    const input = document.getElementById(inputId);
    if (input) input.click();
  };

  const analyzeFile = async (selectedFile, side) => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);

    setIsAnalyzing(true);
    setStatusMessage(`Uploading ${side} mammogram for analysis…`);
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

      console.log("Analysis Results:", {
        result: resultData.result,
        riskLevel: resultData.risk,
        malignantProb: resultData.malignant,
        benignProb: resultData.benign,
        confidence: resultData.confidence
      });

      if (side === 'left') {
        setLeftResults(resultData);
      } else {
        setRightResults(resultData);
      }

      setStatusMessage(`${side.charAt(0).toUpperCase() + side.slice(1)} mammogram analysis complete.`);
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

  const handleViewComparison = () => {
    if (leftResults && rightResults) {
      setShowComparison(true);
    } else {
      setErrorMessage("Please upload and analyze both left and right mammograms.");
    }
  };

  const handleBackToUpload = () => {
    setShowComparison(false);
    setLeftFile(null);
    setRightFile(null);
    setLeftResults(null);
    setRightResults(null);
    setStatusMessage("");
    setErrorMessage("");
  };

  if (showComparison && leftResults && rightResults) {
    return (
      <ComparisonView
        leftResults={leftResults}
        rightResults={rightResults}
        leftFile={leftFile}
        rightFile={rightFile}
        onBack={handleBackToUpload}
      />
    );
  }

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

      <section className="upload-section">
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h2>Upload Mammograms for Comparison</h2>
          <p style={{ color: "#666", fontSize: "1.1rem" }}>Upload left and right mammograms to compare side-by-side</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", maxWidth: "1200px", margin: "0 auto" }}>
          {/* Left Mammogram Upload */}
          <div className="upload-card">
            <h3>Left Mammogram</h3>
            <p>Max 200MB • Supported formats: DICOM, JPG, PNG</p>
            <div
              className={`dropzone ${dragActive ? "active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'left')}
              onClick={() => handleBrowseClick('left')}
            >
              <FiUploadCloud
                size={50}
                style={{ color: "#AE70AF", marginBottom: "10px" }}
              />
              <p className="drop-main-text">
                {isAnalyzing ? "Analyzing…" : "Drag & drop file here"}
              </p>
              <p className="drop-sub-text">or click to browse files</p>
              <button
                type="button"
                className="btn-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  handleBrowseClick('left');
                }}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? "Processing…" : "Browse File"}
              </button>
              <input
                type="file"
                id="fileInputLeft"
                style={{ display: "none" }}
                onChange={(e) => handleFileChange(e, 'left')}
                accept=".jpg,.jpeg,.png,.dcm"
                disabled={isAnalyzing}
              />
            </div>

            {leftFile && (
              <p className="selected-file">
                Selected File: <strong>{leftFile.name}</strong>
              </p>
            )}

            {leftResults && (
              <p className="selected-file" style={{ color: "#059669" }}>
                ✓ Analysis Complete
              </p>
            )}
          </div>

          {/* Right Mammogram Upload */}
          <div className="upload-card">
            <h3>Right Mammogram</h3>
            <p>Max 200MB • Supported formats: DICOM, JPG, PNG</p>
            <div
              className={`dropzone ${dragActive ? "active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'right')}
              onClick={() => handleBrowseClick('right')}
            >
              <FiUploadCloud
                size={50}
                style={{ color: "#AE70AF", marginBottom: "10px" }}
              />
              <p className="drop-main-text">
                {isAnalyzing ? "Analyzing…" : "Drag & drop file here"}
              </p>
              <p className="drop-sub-text">or click to browse files</p>
              <button
                type="button"
                className="btn-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  handleBrowseClick('right');
                }}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? "Processing…" : "Browse File"}
              </button>
              <input
                type="file"
                id="fileInputRight"
                style={{ display: "none" }}
                onChange={(e) => handleFileChange(e, 'right')}
                accept=".jpg,.jpeg,.png,.dcm"
                disabled={isAnalyzing}
              />
            </div>

            {rightFile && (
              <p className="selected-file">
                Selected File: <strong>{rightFile.name}</strong>
              </p>
            )}

            {rightResults && (
              <p className="selected-file" style={{ color: "#059669" }}>
                ✓ Analysis Complete
              </p>
            )}
          </div>
        </div>

        {/* Upload History */}
        {uploadHistory.length > 0 && !leftFile && !rightFile && (
          <div className="upload-history" style={{ maxWidth: "1200px", margin: "30px auto 0" }}>
            <p className="history-title">Recent Uploads</p>
            <div className="history-list">
              {uploadHistory.map((item) => (
                <div key={item.id} className="history-item">
                  <span className="history-name" title={item.name}>
                    📄 {item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name}
                  </span>
                  <div className="history-actions">
                    <button
                      className="history-btn history-upload-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        uploadFromHistory(item, 'left');
                      }}
                      title="Upload as left mammogram"
                    >
                      Left
                    </button>
                    <button
                      className="history-btn history-upload-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        uploadFromHistory(item, 'right');
                      }}
                      title="Upload as right mammogram"
                    >
                      Right
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
              ))}
            </div>
          </div>
        )}

        {statusMessage && (
          <p className="muted small" style={{ marginTop: "20px", textAlign: "center" }}>
            {statusMessage}
          </p>
        )}
        {errorMessage && (
          <p className="muted small" style={{ color: "#ff8080", marginTop: "20px", textAlign: "center" }}>
            {errorMessage}
          </p>
        )}

        {/* View Comparison Button */}
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <button
            className="btn-primary"
            onClick={handleViewComparison}
            disabled={!leftResults || !rightResults}
            style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 auto" }}
          >
            View Comparison
          </button>
        </div>
      </section>
    </div>
  );
}

export default ComparisonUpload;
