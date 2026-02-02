import React, { useState, useRef } from "react";
import { FiArrowLeft, FiDownload } from "react-icons/fi";
import "../App.css";

function ComparisonView({
  leftResults,
  rightResults,
  leftFile,
  rightFile,
  onBack,
}) {
  const [visualTab, setVisualTab] = useState("overlay");
  const [isZoomedLeft, setIsZoomedLeft] = useState(false);
  const [isZoomedRight, setIsZoomedRight] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const zoomImageRefLeft = useRef(null);
  const zoomImageRefRight = useRef(null);

  const getActiveVisualImage = (results) => {
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

  const handleMouseMove = (e, isLeft) => {
    const isZoomed = isLeft ? isZoomedLeft : isZoomedRight;
    if (!isZoomed) return;
    
    const img = isLeft ? zoomImageRefLeft.current : zoomImageRefRight.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    img.style.transformOrigin = `${x}% ${y}%`;
  };

  const handleImageClick = (e, isLeft) => {
    const img = isLeft ? zoomImageRefLeft.current : zoomImageRefRight.current;
    if (!img) return;

    if (isLeft) {
      if (isZoomedLeft) {
        img.style.transform = "scale(1)";
        img.style.transformOrigin = "center center";
        setIsZoomedLeft(false);
      } else {
        const rect = img.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
        img.style.transform = "scale(2.5)";
        setIsZoomedLeft(true);
      }
    } else {
      if (isZoomedRight) {
        img.style.transform = "scale(1)";
        img.style.transformOrigin = "center center";
        setIsZoomedRight(false);
      } else {
        const rect = img.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
        img.style.transform = "scale(2.5)";
        setIsZoomedRight(true);
      }
    }
  };

  const handleDownloadImage = (side) => {
    const results = side === "left" ? leftResults : rightResults;
    const imageUrl = getActiveVisualImage(results);
    
    if (!imageUrl) {
      setStatusMessage("No image available to download");
      return;
    }

    const link = document.createElement("a");
    link.href = imageUrl;
    
    let filename = `mammogram_${side}_analysis`;
    switch (visualTab) {
      case "heatmap":
        filename = `mammogram_${side}_heatmap.png`;
        break;
      case "bbox":
        filename = `region_detection_${side}.png`;
        break;
      case "original":
        filename = `type_of_cancer_detection_${side}.png`;
        break;
      case "overlay":
      default:
        filename = `mammogram_${side}_overlay.png`;
        break;
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setStatusMessage(`Downloaded: ${filename}`);
    setTimeout(() => setStatusMessage(""), 3000);
  };

  const getRiskClass = (results) => {
    const risk = results.risk?.toLowerCase() || "";
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

  const getResultClass = (results) => {
    const result = results.result?.toLowerCase() || "";
    if (result.includes("malignant") || result.includes("cancerous")) {
      return "result-malignant";
    } else if (result.includes("benign") || result.includes("non-cancerous")) {
      return "result-benign";
    }
    return "";
  };

  return (
    <main className="analysis-container">
      <section className="analysis-card">
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h2>Comparison Analysis: Left vs Right</h2>
          <p style={{ color: "#666", fontSize: "0.95rem" }}>Side-by-side mammogram comparison</p>
        </div>

        {/* Comparison Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" }}>
          {/* Left Side */}
          <div style={{ textAlign: "center" }}>
            <h3 style={{ color: "#1565C0", marginBottom: "10px" }}>Left Mammogram</h3>
            <div className={`result-header`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h2 className={`result-title ${getResultClass(leftResults)}`}>
                {leftResults.result || "Analysis Result"}
              </h2>
              <p className={`risk-pill ${getRiskClass(leftResults)}`}>
                Risk Level:&nbsp;
                <strong>{leftResults.risk || "Not available"}</strong>
              </p>
            </div>
          </div>

          {/* Right Side */}
          <div style={{ textAlign: "center" }}>
            <h3 style={{ color: "#C2185B", marginBottom: "10px" }}>Right Mammogram</h3>
            <div className={`result-header`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h2 className={`result-title ${getResultClass(rightResults)}`}>
                {rightResults.result || "Analysis Result"}
              </h2>
              <p className={`risk-pill ${getRiskClass(rightResults)}`}>
                Risk Level:&nbsp;
                <strong>{rightResults.risk || "Not available"}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Prediction Metrics Comparison */}
        <section className="section">
          <h3 className="section-title">Prediction Metrics Comparison</h3>
          <div style={{ overflowX: 'auto', background: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '5px' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '1rem', marginBottom: '0' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #f3e5f5 0%, #fbcfe8 100%)' }}>
                  <th style={{ padding: '16px 18px', textAlign: 'left', borderBottom: 'none', fontWeight: '700', color: '#333', borderTopLeftRadius: '12px', fontSize: '1rem' }}>Metric</th>
                  <th style={{ padding: '16px 18px', textAlign: 'center', borderBottom: 'none', fontWeight: '700', color: '#1565C0', fontSize: '1rem' }}>Left</th>
                  <th style={{ padding: '16px 18px', textAlign: 'center', borderBottom: 'none', fontWeight: '700', color: '#C2185B', borderTopRightRadius: '12px', fontSize: '1rem' }}>Right</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: 'rgba(243, 229, 245, 0.3)' }}>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.1)', fontWeight: '600', color: '#555' }}>Benign %</td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.1)', fontWeight: '700', color: '#1565C0', textAlign: 'center' }}>
                    {leftResults.benign != null ? `${leftResults.benign.toFixed(2)}%` : "—"}
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.1)', fontWeight: '700', color: '#C2185B', textAlign: 'center' }}>
                    {rightResults.benign != null ? `${rightResults.benign.toFixed(2)}%` : "—"}
                  </td>
                </tr>
                <tr style={{ background: 'white' }}>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.1)', fontWeight: '600', color: '#555' }}>Malignant %</td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.1)', fontWeight: '700', color: '#1565C0', textAlign: 'center' }}>
                    {leftResults.malignant != null ? `${leftResults.malignant.toFixed(2)}%` : "—"}
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.1)', fontWeight: '700', color: '#C2185B', textAlign: 'center' }}>
                    {rightResults.malignant != null ? `${rightResults.malignant.toFixed(2)}%` : "—"}
                  </td>
                </tr>
                <tr style={{ background: 'rgba(243, 229, 245, 0.3)' }}>
                  <td style={{ padding: '14px 16px', borderBottom: 'none', fontWeight: '600', color: '#555', borderBottomLeftRadius: '12px' }}>Confidence %</td>
                  <td style={{ padding: '14px 16px', borderBottom: 'none', fontWeight: '700', color: '#1565C0', textAlign: 'center' }}>
                    {leftResults.confidence != null ? `${leftResults.confidence.toFixed(2)}%` : "—"}
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: 'none', fontWeight: '700', color: '#C2185B', textAlign: 'center', borderBottomRightRadius: '12px' }}>
                    {rightResults.confidence != null ? `${rightResults.confidence.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Visual Analysis Section */}
        <section className="section">
          <h3 className="section-title">Visual Analysis Comparison</h3>
          <p className="section-subtitle">
            Grad-CAM attention maps showing which regions influenced the model's decision.
          </p>

          <div className="visual-tabs">
            <button
              className={`visual-tab ${visualTab === "bbox" ? "active" : ""}`}
              onClick={() => setVisualTab("bbox")}
            >
              Region Detection (BBox)
            </button>
            <button
              className={`visual-tab ${visualTab === "original" ? "active" : ""}`}
              onClick={() => setVisualTab("original")}
            >
              Cancer Detection
            </button>
            <button
              className={`visual-tab ${visualTab === "overlay" ? "active" : ""}`}
              onClick={() => setVisualTab("overlay")}
            >
              Heatmap Overlay
            </button>
            <button
              className={`visual-tab ${visualTab === "heatmap" ? "active" : ""}`}
              onClick={() => setVisualTab("heatmap")}
            >
              Heatmap Only
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
            {/* Left Image */}
            <div className="visual-image-card" style={{ position: "relative" }}>
              <div style={{ textAlign: "center", marginBottom: "10px", fontWeight: "600", color: "#1565C0" }}>
                Left Mammogram
              </div>
              {getActiveVisualImage(leftResults) ? (
                <>
                  <div
                    className="zoom-container"
                    onMouseMove={(e) => handleMouseMove(e, true)}
                    onClick={(e) => handleImageClick(e, true)}
                    style={{ position: "relative" }}
                  >
                    <img
                      ref={zoomImageRefLeft}
                      src={getActiveVisualImage(leftResults)}
                      alt="Left visual analysis"
                      style={{
                        cursor: isZoomedLeft ? "zoom-out" : "zoom-in",
                      }}
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadImage("left");
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      background: 'linear-gradient(135deg, rgba(21, 101, 192, 0.9) 0%, rgba(13, 71, 161, 0.9) 100%)',
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
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'linear-gradient(135deg, rgba(25, 118, 210, 1) 0%, rgba(15, 82, 186, 1) 100%)';
                      e.target.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'linear-gradient(135deg, rgba(21, 101, 192, 0.9) 0%, rgba(13, 71, 161, 0.9) 100%)';
                      e.target.style.transform = 'scale(1)';
                    }}
                    title="Download left image"
                  >
                    <FiDownload size={18} />
                    Download
                  </button>
                </>
              ) : (
                <p className="muted small">Image not available.</p>
              )}
            </div>

            {/* Right Image */}
            <div className="visual-image-card" style={{ position: "relative" }}>
              <div style={{ textAlign: "center", marginBottom: "10px", fontWeight: "600", color: "#C2185B" }}>
                Right Mammogram
              </div>
              {getActiveVisualImage(rightResults) ? (
                <>
                  <div
                    className="zoom-container"
                    onMouseMove={(e) => handleMouseMove(e, false)}
                    onClick={(e) => handleImageClick(e, false)}
                    style={{ position: "relative" }}
                  >
                    <img
                      ref={zoomImageRefRight}
                      src={getActiveVisualImage(rightResults)}
                      alt="Right visual analysis"
                      style={{
                        cursor: isZoomedRight ? "zoom-out" : "zoom-in",
                      }}
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadImage("right");
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      background: 'linear-gradient(135deg, rgba(194, 24, 91, 0.9) 0%, rgba(158, 15, 64, 0.9) 100%)',
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
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'linear-gradient(135deg, rgba(211, 47, 47, 1) 0%, rgba(183, 28, 28, 1) 100%)';
                      e.target.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'linear-gradient(135deg, rgba(194, 24, 91, 0.9) 0%, rgba(158, 15, 64, 0.9) 100%)';
                      e.target.style.transform = 'scale(1)';
                    }}
                    title="Download right image"
                  >
                    <FiDownload size={18} />
                    Download
                  </button>
                </>
              ) : (
                <p className="muted small">Image not available.</p>
              )}
            </div>
          </div>

          {statusMessage && (
            <p className="muted small" style={{ marginTop: "10px", textAlign: "center" }}>
              {statusMessage}
            </p>
          )}
        </section>

        {/* Findings Comparison */}
        <section className="section">
          <h3 className="section-title">Findings Summary</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {/* Left Findings */}
            <div style={{ padding: "16px", background: "linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)", borderRadius: "12px" }}>
              <h4 style={{ color: "#1565C0", marginTop: 0 }}>Left Mammogram</h4>
              <div style={{ fontSize: "0.95rem", color: "#333", lineHeight: "1.6" }}>
                <p><strong>Result:</strong> {leftResults.result || "N/A"}</p>
                <p><strong>Risk Level:</strong> {leftResults.risk || "N/A"}</p>
                <p><strong>Summary:</strong> {leftResults.findings?.summary || "No summary available"}</p>
                <p><strong>Detected Regions:</strong> {leftResults.findings?.num_regions || 0}</p>
              </div>
            </div>

            {/* Right Findings */}
            <div style={{ padding: "16px", background: "linear-gradient(135deg, #FCE4EC 0%, #F8BBD9 100%)", borderRadius: "12px" }}>
              <h4 style={{ color: "#C2185B", marginTop: 0 }}>Right Mammogram</h4>
              <div style={{ fontSize: "0.95rem", color: "#333", lineHeight: "1.6" }}>
                <p><strong>Result:</strong> {rightResults.result || "N/A"}</p>
                <p><strong>Risk Level:</strong> {rightResults.risk || "N/A"}</p>
                <p><strong>Summary:</strong> {rightResults.findings?.summary || "No summary available"}</p>
                <p><strong>Detected Regions:</strong> {rightResults.findings?.num_regions || 0}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation Buttons */}
        <div style={{ display: "flex", gap: "15px", marginTop: "30px", justifyContent: "center" }}>
          <button
            className="btn-primary"
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <FiArrowLeft size={18} />
            Back to Upload
          </button>
        </div>
      </section>
    </main>
  );
}

export default ComparisonView;
