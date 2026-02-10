import React, { useState, useRef } from "react";
import { FiDownload } from "react-icons/fi";
import html2pdf from "html2pdf.js";

function FullComparisonView({
  results,
  secondResults,
  allResults = [], // Array of all results
  files = [], // Array of all files
  visualTab,
  setVisualTab,
  isZoomed,
  setIsZoomed,
  handleMouseMove,
  handleImageClick,
  zoomImageRef,
  getActiveVisualImage,
  getActiveVisualImageSecond,
  getRiskClass,
  getResultClass,
  handleDownloadImage,
  handleDownloadReport,
  handleDownloadSecondReport,
  isGeneratingReport,
  file,
  secondFile
}) {
  const [analysisTab, setAnalysisTab] = useState(0); // Use index for multiple images
  const [detailsTab, setDetailsTab] = useState("clinical");
  const [selectedRegion, setSelectedRegion] = useState(null); // Track selected region for highlighting
  const reportRef = useRef(null); // Reference to the report content for PDF generation

  // Helper function to convert text to title case (handles hyphens, slashes, and special characters)
  const toTitleCase = (str) => {
    if (!str) return str;
    return str
      .split(/(\s+|-|\/)/g) // Split on spaces, hyphens, and slashes but keep delimiters
      .map(word => {
        if (word.match(/^(\s+|-|\/)$/)) return word; // Keep delimiters as-is
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');
  };

  // Function to download the frontend report as PDF
  const handleDownloadFrontendReport = () => {
    const element = reportRef.current;
    if (!element) {
      console.error("Report element not found");
      return;
    }

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `mammogram_analysis_${currentResults?.fileName || 'report'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    };

    html2pdf().set(opt).from(element).save();
  };


  // Determine which results array to use
  const resultsArray = allResults.length > 0 ? allResults : [results, secondResults].filter(Boolean);
  const filesArray = files.length > 0 ? files : [file, secondFile].filter(Boolean);

  // Get the current data based on selected tab
  const currentResults = resultsArray[analysisTab] || results;

  // Get current image based on visual tab and analysis tab
  const getCurrentImage = () => {
    const res = resultsArray[analysisTab];
    if (!res) return null;
    switch (visualTab) {
      case "heatmap": return res.heatmap;
      case "bbox": return res.bbox;
      case "original": return res.cancer_type || res.original;
      case "overlay":
      default: return res.overlay;
    }
  };

  const currentImage = getCurrentImage();

  // Helper function to get risk class for current results
  const getCurrentRiskClass = () => {
    const risk = currentResults?.risk?.toLowerCase() || "";
    if (risk.includes("very high risk") || (risk.includes("high risk") && !risk.includes("moderate"))) {
      return "risk-high";
    } else if (risk.includes("moderate")) {
      return "risk-moderate";
    } else if (risk.includes("very low risk") || risk.includes("low risk")) {
      return "risk-low";
    }
    return "";
  };
  const toProperCase = (text) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/(^|\s|-)\w/g, (char) => char.toUpperCase());
  };



  // Helper function to get result class for current results
  const getCurrentResultClass = () => {
    const result = currentResults?.result?.toLowerCase() || "";
    if (result.includes("malignant") || result.includes("cancerous")) {
      return "result-malignant";
    } else if (result.includes("benign") || result.includes("non-cancerous")) {
      return "result-benign";
    }
    return "";
  };

  // Zoom to specific region when clicked from list - scrolls and highlights the region
  const zoomToRegion = (region) => {
    const img = zoomImageRef.current;
    if (!img) return;

    // If clicking the same region that's already selected, deselect it
    if (selectedRegion === region.id) {
      setSelectedRegion(null);
      return;
    }

    // Set the selected region to highlight it
    setSelectedRegion(region.id);

    // Get bbox coordinates
    let x1, y1, x2, y2;
    if (Array.isArray(region.bbox)) {
      [x1, y1, x2, y2] = region.bbox;
    } else {
      x1 = region.bbox.x1;
      y1 = region.bbox.y1;
      x2 = region.bbox.x2;
      y2 = region.bbox.y2;
    }

    // Calculate the center of the region
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    // Get image dimensions
    const imgNaturalWidth = img.naturalWidth;
    const imgNaturalHeight = img.naturalHeight;
    const displayedWidth = img.clientWidth;
    const displayedHeight = img.clientHeight;

    // Calculate scale
    const scaleX = displayedWidth / imgNaturalWidth;
    const scaleY = displayedHeight / imgNaturalHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calculate actual displayed image dimensions
    const actualDisplayWidth = imgNaturalWidth * scale;
    const actualDisplayHeight = imgNaturalHeight * scale;

    // Calculate offset (letterboxing)
    const offsetX = (displayedWidth - actualDisplayWidth) / 2;
    const offsetY = (displayedHeight - actualDisplayHeight) / 2;

    // Convert center coordinates to displayed pixels
    const displayCenterX = centerX * scale + offsetX;
    const displayCenterY = centerY * scale + offsetY;

    // Get the image container's position
    const imgRect = img.getBoundingClientRect();
    const containerRect = img.parentElement.getBoundingClientRect();

    // Calculate scroll position to center the region
    const scrollX = imgRect.left + displayCenterX - containerRect.left - containerRect.width / 2;
    const scrollY = imgRect.top + displayCenterY - containerRect.top - containerRect.height / 2;

    // Smooth scroll to the region
    img.parentElement.scrollTo({
      left: img.parentElement.scrollLeft + scrollX,
      top: img.parentElement.scrollTop + scrollY,
      behavior: 'smooth'
    });

    // Optional: Add a pulsing animation to the highlighted region
    setTimeout(() => {
      const overlay = document.querySelector('[data-region-overlay]');
      if (overlay) {
        overlay.style.animation = 'pulse 1s ease-in-out 2';
      }
    }, 500);
  };

  // Scroll to mammogram image when clicking comprehensive analysis boxes
  const scrollToMammogram = (analysisType) => {
    // Switch to heatmap overlay tab to show the full analysis
    setVisualTab('overlay');

    // Scroll to the image section
    const imageSection = document.querySelector('[data-mammogram-image]');
    if (imageSection) {
      imageSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add a brief highlight effect to the image
      imageSection.style.boxShadow = '0 0 30px rgba(233, 30, 99, 0.6)';
      setTimeout(() => {
        imageSection.style.boxShadow = '';
      }, 2000);
    }
  };

  // Helper function to render green overlay for selected region
  const renderGreenOverlay = () => {
    if (!selectedRegion || !currentResults.findings?.regions || (visualTab !== 'bbox' && visualTab !== 'original')) {
      return null;
    }

    const region = currentResults.findings.regions.find(r => r.id === selectedRegion);
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

    return (
      <div
        data-region-overlay
        style={{
          position: 'absolute',
          left: `${displayX1}px`,
          top: `${displayY1}px`,
          width: `${displayBoxWidth}px`,
          height: `${displayBoxHeight}px`,
          border: '6px solid #00FF00',
          boxShadow: '0 0 15px rgba(0, 255, 0, 0.9), inset 0 0 15px rgba(0, 255, 0, 0.3)',
          pointerEvents: 'none',
          zIndex: 5,
          boxSizing: 'border-box',
          transition: 'all 0.3s ease'
        }}
      />
    );
  };

  return (
    <>
      {/* Analysis Tab Buttons - Simple, matching website theme */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "10px", justifyContent: "center", flexWrap: "wrap" }}>
        {resultsArray.map((res, index) => (
          <button
            key={index}
            onClick={() => setAnalysisTab(index)}
            style={{
              padding: "10px 20px",
              fontSize: "0.95rem",
              fontWeight: analysisTab === index ? "600" : "500",
              color: analysisTab === index ? "white" : "#666",
              background: res?.analyzing
                ? "#9C27B0"
                : res?.error
                  ? "#f44336"
                  : analysisTab === index
                    ? "#C2185B"
                    : "#f5f5f5",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: analysisTab === index
                ? "0 4px 12px rgba(194, 24, 91, 0.25)"
                : "none",
              opacity: res?.analyzing ? 0.9 : 1,
            }}
            onMouseEnter={(e) => {
              if (analysisTab !== index && !res?.analyzing) {
                e.currentTarget.style.background = "#e0e0e0";
              }
            }}
            onMouseLeave={(e) => {
              if (analysisTab !== index && !res?.analyzing && !res?.error) {
                e.currentTarget.style.background = "#f5f5f5";
              }
            }}
          >
            {res?.analyzing ? (
              <>
                <span className="loader" style={{
                  width: "14px",
                  height: "14px",
                  borderWidth: "2px",
                  display: "inline-block",
                  marginRight: "8px",
                  verticalAlign: "middle"
                }} />
                Analyzing
              </>
            ) : res?.error ? (
              <>
                Image {index + 1} - Error
              </>
            ) : (
              <>
                Image {index + 1} Analysis
              </>
            )}
            {(res?.fileName || filesArray[index]?.name) && (
              <span style={{
                display: "block",
                fontSize: "0.75rem",
                opacity: analysisTab === index ? 0.95 : 0.7,
                marginTop: "4px",
                fontWeight: "400",
              }}>
                {(res?.fileName || filesArray[index]?.name || '').substring(0, 20)}{(res?.fileName || filesArray[index]?.name || '').length > 20 ? '...' : ''}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="result-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        {currentResults?.analyzing ? (
          <>
            <h2 className="result-title" style={{ color: '#FFA726' }}>
              <span className="loader" style={{
                width: "24px",
                height: "24px",
                borderWidth: "3px",
                display: "inline-block",
                marginRight: "12px",
                verticalAlign: "middle"
              }} />
              Analyzing Image...
            </h2>
            <div style={{
              background: '#FFF8E1',
              border: '2px solid #FFA726',
              borderRadius: '10px',
              padding: '20px',
              marginTop: '15px',
              maxWidth: '600px'
            }}>
              <p style={{ color: '#F57C00', fontSize: '1.1rem', fontWeight: '600', marginBottom: '10px' }}>
                {currentResults.fileName}
              </p>
              <p style={{ color: '#666', fontSize: '0.95rem' }}>
                Please wait while we analyze this image...
              </p>
            </div>
          </>
        ) : currentResults?.error ? (
          <>
            <h2 className="result-title" style={{ color: '#ff4444' }}>
              ❌ Validation Failed
            </h2>
            <div style={{
              background: '#fff3f3',
              border: '2px solid #ff4444',
              borderRadius: '10px',
              padding: '20px',
              marginTop: '15px',
              maxWidth: '600px'
            }}>
              <p style={{ color: '#cc0000', fontSize: '1.1rem', fontWeight: '600', marginBottom: '10px' }}>
                {currentResults.fileName}
              </p>
              <p style={{ color: '#666', fontSize: '0.95rem' }}>
                {currentResults.errorMessage}
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Header - Exact same as AppContent.js */}
            <div className="result-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h2 className={`result-title ${getCurrentResultClass()}`}>
                {currentResults?.result || "Analysis Result"}
              </h2>
              <p className={`risk-pill ${getCurrentRiskClass()}`}>
                Risk Level:&nbsp;
                <strong>
                  {currentResults?.risk || "Not available"}
                </strong>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Only show analysis sections if no error and not analyzing */}
      {!currentResults?.error && !currentResults?.analyzing && (
        <>
          {/* Wrap report content with ref for PDF generation */}
          <div ref={reportRef}>
            {/* Prediction Metrics Section */}
            <section className="section">
              <h3 className="section-title">Prediction Metrics</h3>
              <div className="metric-grid">
                <div className="metric">
                  <span className="metric-label">Benign</span>
                  <h3>{currentResults?.benign != null ? `${currentResults.benign.toFixed(2)}%` : "—"}</h3>
                </div>
                <div className="metric">
                  <span className="metric-label">Malignant</span>
                  <h3>{currentResults?.malignant != null ? `${currentResults.malignant.toFixed(2)}%` : "—"}</h3>
                </div>
                <div className="metric">
                  <span className="metric-label">Model Confidence</span>
                  <h3>{currentResults?.confidence != null ? `${currentResults.confidence.toFixed(2)}%` : "—"}</h3>
                </div>
              </div>
            </section>

            {/* AI Summary Section */}
            <section className="section">
              <h3 className="section-title">AI Summary</h3>
              <div className="summary-box malignant">
                <p>{currentResults?.findings?.summary || "Analysis summary not available."}</p>
              </div>
            </section>

            {/* Visual Analysis Section */}
            <section className="section">
              <h3 className="section-title">Visual Analysis</h3>
              <p className="section-subtitle">
                Grad-CAM attention maps showing which regions influenced the model's decision.
              </p>

              <div className="visual-tabs">
                <button className={`visual-tab ${visualTab === "bbox" ? "active" : ""}`} onClick={() => setVisualTab("bbox")}>
                  Region Detection (BBox)
                </button>
                <button className={`visual-tab ${visualTab === "original" ? "active" : ""}`} onClick={() => setVisualTab("original")}>
                  Cancer Detection
                </button>
                <button className={`visual-tab ${visualTab === "overlay" ? "active" : ""}`} onClick={() => setVisualTab("overlay")}>
                  Heatmap Overlay
                </button>
                <button className={`visual-tab ${visualTab === "heatmap" ? "active" : ""}`} onClick={() => setVisualTab("heatmap")}>
                  Heatmap Only
                </button>
              </div>

              <div className="visual-panel">
                <div style={{ display: 'flex', gap: '20px' }}>
                  {/* Main Image Container */}
                  <div className="visual-image-card" data-mammogram-image style={{ position: 'relative', flex: (visualTab === 'bbox' || visualTab === 'original') && currentResults?.findings?.regions?.length > 0 ? '1 1 65%' : '1 1 100%' }}>
                    {currentImage ? (
                      <>
                        <div className="zoom-container" onMouseMove={handleMouseMove} onClick={handleImageClick} style={{ position: 'relative' }}>
                          {/* View Label Overlay */}
                          {currentResults?.view_analysis && currentResults.view_analysis.view_code && (
                            <div style={{
                              position: 'absolute', top: '12px', left: '12px',
                              background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.75) 100%)',
                              color: 'white', padding: '12px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '1.2rem',
                              zIndex: 10, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(10px)',
                              border: '2px solid rgba(255, 255, 255, 0.2)', display: 'flex', flexDirection: 'column', gap: '4px'
                            }}>
                              <div style={{ fontSize: '1.5rem', letterSpacing: '1px', color: '#00D9FF', textShadow: '0 0 10px rgba(0, 217, 255, 0.5)' }}>
                                {currentResults.view_analysis.view_code} View
                              </div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '500', color: 'rgba(255, 255, 255, 0.85)', letterSpacing: '0.5px' }}>
                                {currentResults.view_analysis.view_code.includes('MLO') ? 'Mediolateral Oblique: Angled side view' : 'Craniocaudal: Top-to-bottom view'}
                              </div>
                            </div>
                          )}
                          <img ref={zoomImageRef} src={currentImage} alt="Visual analysis" style={{ cursor: isZoomed ? 'zoom-out' : 'zoom-in' }} />
                          {/* Green overlay for selected region */}
                          {renderGreenOverlay()}
                        </div>
                        {/* Download Button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); if (handleDownloadImage) handleDownloadImage(); }}
                          style={{
                            position: 'absolute', bottom: '12px', right: '12px',
                            background: 'linear-gradient(135deg, rgba(174, 112, 175, 0.9) 0%, rgba(156, 39, 176, 0.9) 100%)',
                            border: '2px solid rgba(255, 255, 255, 0.3)', color: 'white', padding: '10px 14px', borderRadius: '8px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '600',
                            zIndex: 11, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(186, 104, 200, 1) 0%, rgba(171, 71, 188, 1) 100%)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(174, 112, 175, 0.9) 0%, rgba(156, 39, 176, 0.9) 100%)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          title="Download image"
                        >
                          <FiDownload size={18} /> Download
                        </button>
                      </>
                    ) : (
                      <p className="muted small">Image not available.</p>
                    )}
                  </div>

                  {/* Region List Sidebar - Only show for bbox and cancer_type tabs */}
                  {(visualTab === 'bbox' || visualTab === 'original') && currentResults?.findings?.regions && currentResults.findings.regions.length > 0 && (
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
                        📍 Detected Regions ({currentResults.findings.regions.length})
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {currentResults.findings.regions.map((region, idx) => (
                          <div
                            key={idx}
                            onClick={() => zoomToRegion(region)}
                            style={{
                              padding: '12px',
                              background: selectedRegion === region.id ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' : 'white',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              border: selectedRegion === region.id ? '2px solid #00FF00' : '1px solid #e0e0e0',
                              transition: 'all 0.2s ease',
                              boxShadow: selectedRegion === region.id ? '0 4px 12px rgba(0, 255, 0, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)'
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
                              🔍 Click to view on image
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Detailed Analysis Information */}
                <div className="results-info-card">
                  {/* Row 3: Image Quality - Full Width */}
                  {currentResults.findings.comprehensive_analysis.image_quality && (
                    <div style={{ padding: '14px', background: 'linear-gradient(135deg, #ECEFF1 0%, #CFD8DC 100%)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(69, 90, 100, 0.15)', marginBottom: '14px' }}>
                      <div style={{ fontWeight: '700', color: '#455A64', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1.1rem' }}>📷</span> Image Quality Assessment
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '0.85rem' }}>
                        <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', textAlign: 'center' }}>
                          <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Overall Quality</div>
                          <strong style={{ color: '#455A64', fontSize: '1.1rem' }}>{currentResults.findings.comprehensive_analysis.image_quality.overall_score}%</strong>
                        </div>
                        <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', textAlign: 'center' }}>
                          <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Positioning</div>
                          <strong style={{ color: '#455A64', fontSize: '1rem' }}>{toTitleCase(currentResults.findings.comprehensive_analysis.image_quality.positioning)}</strong>
                        </div>
                        <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', textAlign: 'center' }}>
                          <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Technical Adequacy</div>
                          <strong style={{ color: '#455A64', fontSize: '1rem' }}>{toTitleCase(currentResults.findings.comprehensive_analysis.image_quality.technical_adequacy)}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                  <h4>Understanding Your Results</h4>

                  {/* Comprehensive Image Analysis Section */}
                  {currentResults?.findings?.comprehensive_analysis && (
                    <div style={{ marginBottom: '24px' }}>
                      <p className="regions-header" style={{ marginBottom: '16px', fontSize: '1.1rem' }}>
                        📊 Comprehensive Image Analysis
                      </p>

                      {/* Row 0: Calcification Analysis - FIRST if detected */}
                      {currentResults?.findings?.comprehensive_analysis?.calcification_analysis?.detected && (
                        <div
                          onClick={() => scrollToMammogram('calcification')}
                          style={{
                            padding: '14px',
                            background: 'linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)',
                            borderRadius: '12px',
                            border: '2px solid #EF5350',
                            boxShadow: '0 2px 12px rgba(239, 83, 80, 0.25)',
                            marginBottom: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 83, 80, 0.35)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 12px rgba(239, 83, 80, 0.25)';
                          }}
                        >
                          <div style={{ fontWeight: '700', color: '#C62828', marginBottom: '12px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                            <span><span style={{ fontSize: '1.2rem' }}>⚠️</span> Calcification Analysis - Attention Required</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>🔍 Click to view</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '0.85rem' }}>
                            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Count</div>
                              <strong style={{ color: '#C62828', fontSize: '1.1rem' }}>{currentResults.findings.comprehensive_analysis.calcification_analysis.count}</strong>
                            </div>
                            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Distribution</div>
                              <strong style={{ color: '#C62828', fontSize: '0.95rem' }}>{currentResults.findings.comprehensive_analysis.calcification_analysis.distribution}</strong>
                            </div>
                            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>Morphology</div>
                              <strong style={{ color: '#C62828', fontSize: '0.95rem' }}>{currentResults.findings.comprehensive_analysis.calcification_analysis.morphology}</strong>
                            </div>
                            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>BI-RADS</div>
                              <strong style={{ color: '#C62828', fontSize: '1.1rem' }}>{currentResults.findings.comprehensive_analysis.calcification_analysis.birads_category}</strong>
                            </div>
                          </div>
                          <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#C62828', fontWeight: '600', padding: '10px 12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px', borderLeft: '4px solid #C62828' }}>
                            📋 {currentResults.findings.comprehensive_analysis.calcification_analysis.recommendation}
                          </div>
                        </div>
                      )}

                      {/* Row 1: Primary Analysis - Breast Density & Tissue Texture */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '14px' }}>
                        {/* Breast Density */}
                        {currentResults.findings.comprehensive_analysis.breast_density && (
                          <div
                            onClick={() => scrollToMammogram('breast_density')}
                            style={{
                              padding: '14px',
                              background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
                              borderRadius: '12px',
                              boxShadow: '0 2px 8px rgba(21, 101, 192, 0.15)',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-4px)';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(21, 101, 192, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(21, 101, 192, 0.15)';
                            }}
                          >
                            <div style={{ fontWeight: '700', color: '#1565C0', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '1.1rem' }}>🔬</span> Breast Density (ACR BI-RADS)
                              </span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>🔍 Click to view</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Category:</span> <strong style={{ color: '#1565C0' }}>Type {currentResults.findings.comprehensive_analysis.breast_density.category}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Density:</span> <strong style={{ color: '#1565C0' }}>{currentResults.findings.comprehensive_analysis.breast_density.density_percentage}%</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Sensitivity:</span> <strong>{toTitleCase(currentResults.findings.comprehensive_analysis.breast_density.sensitivity)}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Masking Risk:</span> <strong>{toTitleCase(currentResults.findings.comprehensive_analysis.breast_density.masking_risk)}</strong></div>
                            </div>
                            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#1565C0', fontStyle: 'italic', padding: '6px 8px', background: 'rgba(255,255,255,0.4)', borderRadius: '6px' }}>{currentResults.findings.comprehensive_analysis.breast_density.description}</div>
                          </div>
                        )}

                        {/* Tissue Texture */}
                        {currentResults.findings.comprehensive_analysis.tissue_texture && (
                          <div
                            onClick={() => scrollToMammogram('tissue_texture')}
                            style={{
                              padding: '14px',
                              background: 'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)',
                              borderRadius: '12px',
                              boxShadow: '0 2px 8px rgba(123, 31, 162, 0.15)',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-4px)';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(123, 31, 162, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(123, 31, 162, 0.15)';
                            }}
                          >
                            <div style={{ fontWeight: '700', color: '#7B1FA2', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '1.1rem' }}>🧬</span> Tissue Texture Analysis
                              </span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>🔍 Click to view</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Pattern:</span> <strong style={{ color: '#7B1FA2' }}>{toTitleCase(currentResults.findings.comprehensive_analysis.tissue_texture.pattern)}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Uniformity:</span> <strong style={{ color: '#7B1FA2' }}>{currentResults.findings.comprehensive_analysis.tissue_texture.uniformity_score}%</strong></div>
                            </div>
                            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#7B1FA2', fontStyle: 'italic', padding: '6px 8px', background: 'rgba(255,255,255,0.4)', borderRadius: '6px' }}>{currentResults.findings.comprehensive_analysis.tissue_texture.clinical_note}</div>
                          </div>
                        )}
                      </div>

                      {/* Row 2: Secondary Analysis - Symmetry, Skin & Nipple, Vascular */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
                        {/* Symmetry Analysis */}
                        {currentResults.findings.comprehensive_analysis.symmetry && (
                          <div
                            onClick={() => scrollToMammogram('symmetry')}
                            style={{
                              padding: '14px',
                              background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
                              borderRadius: '12px',
                              boxShadow: '0 2px 8px rgba(46, 125, 50, 0.15)',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-4px)';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(46, 125, 50, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(46, 125, 50, 0.15)';
                            }}
                          >
                            <div style={{ fontWeight: '700', color: '#2E7D32', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '1.1rem' }}>⚖️</span> Symmetry
                              </span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>🔍 Click to view</span>
                            </div>
                            <div style={{ display: 'grid', gap: '6px', fontSize: '0.85rem' }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Assessment:</span> <strong style={{ color: '#2E7D32' }}>{toTitleCase(currentResults.findings.comprehensive_analysis.symmetry.assessment)}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Score:</span> <strong style={{ color: '#2E7D32' }}>{currentResults.findings.comprehensive_analysis.symmetry.symmetry_score}%</strong></div>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#2E7D32', fontStyle: 'italic' }}>{currentResults.findings.comprehensive_analysis.symmetry.clinical_significance}</div>
                          </div>
                        )}

                        {/* Skin & Nipple */}
                        {currentResults.findings.comprehensive_analysis.skin_nipple && (
                          <div
                            onClick={() => scrollToMammogram('skin_nipple')}
                            style={{
                              padding: '14px',
                              background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
                              borderRadius: '12px',
                              boxShadow: '0 2px 8px rgba(230, 81, 0, 0.15)',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-4px)';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(230, 81, 0, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(230, 81, 0, 0.15)';
                            }}
                          >
                            <div style={{ fontWeight: '700', color: '#E65100', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '1.1rem' }}>👁️</span> Skin & Nipple
                              </span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>🔍 Click to view</span>
                            </div>
                            <div style={{ display: 'grid', gap: '6px', fontSize: '0.85rem' }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Skin:</span> <strong style={{ color: '#E65100' }}>{toTitleCase(currentResults.findings.comprehensive_analysis.skin_nipple.skin_status)}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Concern:</span> <strong style={{ color: '#E65100' }}>{toTitleCase(currentResults.findings.comprehensive_analysis.skin_nipple.skin_concern_level)}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Nipple:</span> <strong>{toTitleCase(currentResults.findings.comprehensive_analysis.skin_nipple.nipple_retraction)}</strong></div>
                            </div>
                          </div>
                        )}

                        {/* Vascular Patterns */}
                        {currentResults.findings.comprehensive_analysis.vascular_patterns && (
                          <div
                            onClick={() => scrollToMammogram('vascular_patterns')}
                            style={{
                              padding: '14px',
                              background: 'linear-gradient(135deg, #FCE4EC 0%, #F8BBD9 100%)',
                              borderRadius: '12px',
                              boxShadow: '0 2px 8px rgba(194, 24, 91, 0.15)',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-4px)';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(194, 24, 91, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(194, 24, 91, 0.15)';
                            }}
                          >
                            <div style={{ fontWeight: '700', color: '#C2185B', marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '1.1rem' }}>🩸</span> Vascular Pattern
                              </span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>🔍 Click to view</span>
                            </div>
                            <div style={{ display: 'grid', gap: '6px', fontSize: '0.85rem' }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Pattern:</span> <strong style={{ color: '#C2185B' }}>{toTitleCase(currentResults.findings.comprehensive_analysis.vascular_patterns.pattern)}</strong></div>
                              <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}><span style={{ color: '#666' }}>Score:</span> <strong style={{ color: '#C2185B' }}>{currentResults.findings.comprehensive_analysis.vascular_patterns.vascular_score}%</strong></div>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#C2185B', fontStyle: 'italic' }}>{currentResults.findings.comprehensive_analysis.vascular_patterns.clinical_note}</div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* Detected Regions */}
                  {currentResults?.findings?.regions && currentResults.findings.regions.length > 0 && (
                    <>
                      <p className="regions-header">
                        Detected Regions ({currentResults.findings.num_regions})
                      </p>
                      <div className="regions-grid">
                        {currentResults.findings.regions.map((region, idx) => (
                          <div key={idx} className="region-card" style={{ marginBottom: '16px' }}>
                            <div className="region-card-header">
                              Region {region.id}: {toProperCase(region.cancer_type) || 'Abnormality'}
                              {region.birads_region && (
                                <span style={{ marginLeft: '10px', padding: '2px 8px', background: '#E91E63', color: 'white', borderRadius: '4px', fontSize: '0.75rem' }}>
                                  BI-RADS {region.birads_region}
                                </span>
                              )}
                            </div>
                            <div className="region-card-grid" style={{ flex: '1' }}>
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
                              <div><span>Morphology:</span> <strong>{toTitleCase(region.morphology?.shape) || '—'}</strong></div>
                              <div><span>Margin:</span> <strong>{toTitleCase(region.margin?.type) || '—'}</strong></div>
                              <div><span>Margin Risk:</span> <strong style={{ color: region.margin?.risk_level === 'High' ? '#DC2626' : region.margin?.risk_level === 'Moderate' ? '#F59E0B' : '#059669' }}>{toTitleCase(region.margin?.risk_level) || '—'}</strong></div>
                              <div><span>Density:</span> <strong>{toProperCase(region.density?.level) || '—'}</strong></div>
                              <div><span>Vascularity:</span> <strong>{toTitleCase(region.vascularity?.assessment) || '—'}</strong></div>
                              <div><span>Tissue:</span> <strong>{toTitleCase(region.tissue_composition?.type) || '—'}</strong></div>
                              {region.calcification_details && (
                                <>
                                  <div><span>Calc. Type:</span> <strong>{toTitleCase(region.calcification_details.morphology) || '—'}</strong></div>
                                  <div><span>Calc. Dist:</span> <strong>{toTitleCase(region.calcification_details.distribution) || '—'}</strong></div>
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

                            {/* Bottom section - pushed to bottom with marginTop: auto */}
                            <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                              {region.clinical_significance && (
                                <div style={{ padding: '8px 12px', background: 'rgba(233, 30, 99, 0.08)', borderRadius: '8px', borderLeft: '3px solid #E91E63', marginBottom: '8px' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#8B5A8D', marginBottom: '4px' }}>Clinical Significance:</div>
                                  <div style={{ fontSize: '0.85rem', color: '#333' }}>{region.clinical_significance}</div>
                                </div>
                              )}

                              {region.recommended_action && (
                                <div style={{ padding: '8px 12px', background: 'rgba(156, 43, 109, 0.08)', borderRadius: '8px', borderLeft: '3px solid #9C2B6D' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#8B5A8D', marginBottom: '4px' }}>Recommended Action:</div>
                                  <div style={{ fontSize: '0.85rem', color: '#333', fontWeight: '600' }}>{region.recommended_action}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}


                  {/* Mammogram View Analysis Section */}
                  {currentResults?.view_analysis && (
                    <section className="section">
                      <p className="regions-header" style={{ textAlign: 'center' }}>
                        Mammogram View Analysis
                      </p>

                      <div style={{
                        padding: '16px',
                        background: currentResults.view_analysis.view_code?.includes('MLO')
                          ? 'linear-gradient(135deg, #EDE7F6 0%, #D1C4E9 100%)'
                          : 'linear-gradient(135deg, #E0F2F1 0%, #B2DFDB 100%)',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
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
                            background: currentResults.view_analysis.view_code?.includes('MLO')
                              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                              : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                            color: 'white',
                            fontWeight: '800',
                            fontSize: '1.3rem',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            minWidth: '70px',
                            textAlign: 'center'
                          }}>
                            {currentResults.view_analysis.view_code || 'N/A'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: '700',
                              fontSize: '1.2rem',
                              color: currentResults.view_analysis.view_code?.includes('MLO') ? '#5E35B1' : '#00796B'
                            }}>
                              {currentResults.view_analysis.view_code} View
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '2px' }}>
                              {currentResults.view_analysis.view_code?.includes('MLO')
                                ? 'Medio-Lateral Oblique: Angled side view showing pectoral muscle and axilla'
                                : 'Cranio-Caudal: Top-to-bottom view for medial/lateral tissue assessment'}
                            </div>
                          </div>
                        </div>

                        {/* View Analysis Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                          {/* Laterality */}
                          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Breast Side</div>
                            <div style={{ fontWeight: '700', color: currentResults.view_analysis.laterality === 'Right' ? '#1565C0' : '#C2185B', fontSize: '1rem' }}>
                              {currentResults.view_analysis.view_code || 'N/A'}
                            </div>
                          </div>

                          {/* Image Quality */}
                          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Image Quality</div>
                            <div style={{ fontWeight: '600', color: '#333' }}>{currentResults.view_analysis.image_quality || 'N/A'}</div>
                          </div>

                          {/* Quality Score */}
                          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Quality Score</div>
                            <div style={{ fontWeight: '700', fontSize: '1.2rem', color: currentResults.view_analysis.quality_score >= 70 ? '#2E7D32' : currentResults.view_analysis.quality_score ? '#F57C00' : '#999' }}>
                              {currentResults.view_analysis.quality_score ? `${currentResults.view_analysis.quality_score}%` : 'N/A'}
                            </div>
                          </div>

                          {/* MLO-specific: Axillary Findings */}
                          {currentResults.view_analysis.view_code?.includes('MLO') && currentResults.view_analysis.axillary_findings && (
                            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Axillary Findings</div>
                              <div style={{ fontWeight: '600', color: '#333', fontSize: '0.85rem' }}>
                                {currentResults.view_analysis.axillary_findings}
                              </div>
                            </div>
                          )}

                          {/* MLO-specific: Pectoral Muscle
                          {currentResults.view_analysis.view_code?.includes('MLO') && currentResults.view_analysis.pectoral_muscle_visibility && (
                            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Pectoral Muscle</div>
                              <div style={{ fontWeight: '600', color: '#333', fontSize: '0.85rem' }}>
                                {currentResults.view_analysis.pectoral_muscle_visibility}
                              </div>
                            </div>
                          )} */}

                          {/* CC-specific: Asymmetry */}
                          {currentResults.view_analysis.view_code?.includes('CC') && currentResults.view_analysis.asymmetry && (
                            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Asymmetry</div>
                              <div style={{ fontWeight: '600', color: '#333', fontSize: '0.85rem' }}>
                                {currentResults.view_analysis.asymmetry}
                              </div>
                            </div>
                          )}

                          {/* CC-specific: Skin/Nipple Changes */}
                          {currentResults.view_analysis.view_code?.includes('CC') && currentResults.view_analysis.skin_nipple_changes && (
                            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Skin & Nipple</div>
                              <div style={{ fontWeight: '600', color: '#333', fontSize: '0.85rem' }}>
                                {currentResults.view_analysis.skin_nipple_changes}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Impression */}
                        <div style={{
                          marginTop: '14px',
                          padding: '12px 14px',
                          background: currentResults.view_analysis.suspicion_level === 'High'
                            ? 'rgba(198, 40, 40, 0.1)'
                            : currentResults.view_analysis.suspicion_level === 'Intermediate'
                              ? 'rgba(245, 124, 0, 0.1)'
                              : 'rgba(46, 125, 50, 0.1)',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${currentResults.view_analysis.suspicion_level === 'High'
                            ? '#C62828'
                            : currentResults.view_analysis.suspicion_level === 'Intermediate'
                              ? '#F57C00'
                              : '#2E7D32'
                            }`
                        }}>
                          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px', textAlign: 'center' }}>Impression</div>
                          <div style={{
                            fontWeight: '600',
                            color: currentResults.view_analysis.suspicion_level === 'High'
                              ? '#C62828'
                              : currentResults.view_analysis.suspicion_level === 'Intermediate'
                                ? '#F57C00'
                                : '#2E7D32'
                                , textAlign: 'center'
                          }}>
                            {currentResults.view_analysis.impression || 'Analysis complete'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '6px', textAlign: 'center' }}>
                            Suspicion Level: <strong>{currentResults.view_analysis.suspicion_level || 'N/A'}</strong> |
                            Confidence: <strong>{currentResults.view_analysis.confidence_score || 'N/A'}</strong>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Report Details Section with Tabs */}
                  <section className="section">
                    <h3 className="section-title">Report Details</h3>
                    <div className="details-tabs">
                      <button
                        className={`details-tab ${detailsTab === "clinical" ? "active" : ""}`}
                        onClick={() => setDetailsTab("clinical")}
                      >
                        Clinical Context
                      </button>
                      <button
                        className={`details-tab ${detailsTab === "nextSteps" ? "active" : ""}`}
                        onClick={() => setDetailsTab("nextSteps")}
                      >
                        Next Steps
                      </button>
                      <button
                        className={`details-tab ${detailsTab === "risk" ? "active" : ""}`}
                        onClick={() => setDetailsTab("risk")}
                      >
                        Risk Guide
                      </button>
                      <button
                        className={`details-tab ${detailsTab === "heatmapInfo" ? "active" : ""}`}
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
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: '#9C2B6D', fontSize: '1rem' }}>{currentResults?.findings?.num_regions || 0}</td>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', color: '#666' }}>Number of suspicious areas identified</td>
                                </tr>
                                <tr style={{ background: 'white' }}>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '600', color: '#555' }}>High-Attention Areas</td>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: '#9C2B6D', fontSize: '1rem' }}>{currentResults?.findings?.high_attention_percentage?.toFixed(2) || '0.00'}%</td>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', color: '#666' }}>Percentage of image with high AI activation</td>
                                </tr>
                                <tr style={{ background: 'rgba(252, 231, 243, 0.3)' }}>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '600', color: '#555' }}>Max Activation</td>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: '#9C2B6D', fontSize: '1rem' }}>{currentResults?.findings?.max_activation ? (currentResults.findings.max_activation * 100).toFixed(2) : '0.00'}%</td>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', color: '#666' }}>Peak intensity level detected</td>
                                </tr>
                                <tr style={{ background: 'white' }}>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '600', color: '#555' }}>Overall Activity</td>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: '#9C2B6D', fontSize: '1rem' }}>{currentResults?.findings?.overall_activation ? (currentResults.findings.overall_activation * 100).toFixed(2) : '0.00'}%</td>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', color: '#666' }}>Average activation across the image</td>
                                </tr>
                                <tr style={{ background: 'rgba(252, 231, 243, 0.3)' }}>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '600', color: '#555' }}>Malignant Probability</td>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: currentResults?.malignant > 50 ? '#DC2626' : '#059669', fontSize: '1rem' }}>{currentResults?.malignant?.toFixed(2) || '0.00'}%</td>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(156, 43, 109, 0.1)', color: '#666' }}>Probability of cancerous tissue</td>
                                </tr>
                                <tr style={{ background: 'white' }}>
                                  <td style={{ padding: '14px 16px', borderBottom: 'none', fontWeight: '600', color: '#555', borderBottomLeftRadius: '12px' }}>Benign Probability</td>
                                  <td style={{ padding: '14px 16px', borderBottom: 'none', fontWeight: '700', color: currentResults?.benign > 50 ? '#059669' : '#DC2626', fontSize: '1rem' }}>{currentResults?.benign?.toFixed(2) || '0.00'}%</td>
                                  <td style={{ padding: '14px 16px', borderBottom: 'none', color: '#666', borderBottomRightRadius: '12px' }}>Probability of healthy tissue</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Detected Regions Table */}
                          {currentResults?.findings?.regions && currentResults.findings.regions.length > 0 && (
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
                                    {currentResults.findings.regions.map((region, idx) => (
                                      <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(252, 231, 243, 0.3)' : 'white' }}>
                                        <td style={{ padding: '14px 16px', borderBottom: idx === currentResults.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: '#9C2B6D', fontSize: '1.1rem' }}>#{region.id}</td>
                                        <td style={{ padding: '12px 14px', borderBottom: idx === currentResults.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)', color: '#9C2B6D', fontWeight: '700', fontSize: '1rem' }}>{region.cancer_type || 'Unknown'}</td>
                                        <td style={{ padding: '12px 14px', borderBottom: idx === currentResults.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)', color: '#555' }}>{region.location?.quadrant || 'N/A'}</td>
                                        <td style={{ padding: '14px 16px', borderBottom: idx === currentResults.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)', fontWeight: '700', color: region.confidence > 70 ? '#DC2626' : region.confidence > 50 ? '#F59E0B' : '#059669', fontSize: '1.1rem' }}>{region.confidence?.toFixed(1)}%</td>
                                        <td style={{ padding: '12px 14px', borderBottom: idx === currentResults.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)' }}>
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
                                        <td style={{ padding: '12px 14px', borderBottom: idx === currentResults.findings.regions.length - 1 ? 'none' : '1px solid rgba(156, 43, 109, 0.1)', color: '#555', fontWeight: '600' }}>{region.size?.area_percentage?.toFixed(2)}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}

                          {/* No Regions Detected */}
                          {(!currentResults?.findings?.regions || currentResults.findings.regions.length === 0) && (
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

                          {currentResults?.result?.toLowerCase().includes("malignant") ? (
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
                                  ✓ Continue Regular Screening Schedule
                                </p>
                              </div>

                              <h4 className="details-heading" style={{ marginTop: '20px' }}>Recommended Screening Schedule</h4>
                              <ul className="details-list">
                                <li><strong>Ages 40-44:</strong> Optional annual mammogram based on personal preference</li>
                                <li><strong>Ages 45-54:</strong> Annual mammogram recommended</li>
                                <li><strong>Ages 55+:</strong> Mammogram every 1-2 years, or continue annually</li>
                                <li><strong>High-Risk Individuals:</strong> May need earlier and more frequent screening</li>
                              </ul>

                              <h4 className="details-heading" style={{ marginTop: '20px' }}>Self-Care Practices</h4>
                              <ul className="details-list">
                                <li><strong>Monthly Self-Exams:</strong> Perform breast self-examinations regularly</li>
                                <li><strong>Know Your Normal:</strong> Be aware of how your breasts normally look and feel</li>
                                <li><strong>Report Changes:</strong> Contact your doctor if you notice any changes</li>
                                <li><strong>Healthy Lifestyle:</strong> Maintain a healthy weight, limit alcohol, stay active</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                </div> {/* Close ref wrapper */}

              </div>
            </section>
          </div>



{/* Dynamic Recommendations based on result and findings */}
                {(() => {
                  const recommendations = [];
                  const urgencyLevel = currentResults?.result?.toLowerCase().includes("malignant") ? "high" : "low";

                  // Collect recommendations from regions
                  if (currentResults?.findings?.regions && currentResults.findings.regions.length > 0) {
                    currentResults.findings.regions.forEach(region => {
                      if (region.recommended_action && !recommendations.includes(region.recommended_action)) {
                        recommendations.push(region.recommended_action);
                      }
                    });
                  }

                  // Add recommendations from calcification analysis
                  if (currentResults?.findings?.comprehensive_analysis?.calcification_analysis?.detected) {
                    const calcRec = currentResults.findings.comprehensive_analysis.calcification_analysis.recommendation;
                    if (calcRec && !recommendations.includes(calcRec)) {
                      recommendations.push(calcRec);
                    }
                  }

                  // Add recommendations from breast density
                  if (currentResults?.findings?.comprehensive_analysis?.breast_density?.masking_risk === "High") {
                    const densityRec = "Consider supplemental screening (ultrasound or MRI) due to high breast density";
                    if (!recommendations.includes(densityRec)) {
                      recommendations.push(densityRec);
                    }
                  }

                  // Add recommendations from skin/nipple findings
                  if (currentResults?.findings?.comprehensive_analysis?.skin_nipple?.skin_concern_level === "High" ||
                    currentResults?.findings?.comprehensive_analysis?.skin_nipple?.nipple_retraction === "Present") {
                    const skinRec = "Clinical examination for skin changes and nipple abnormalities";
                    if (!recommendations.includes(skinRec)) {
                      recommendations.push(skinRec);
                    }
                  }

                  // Default recommendations if none found
                  if (recommendations.length === 0) {
                    if (urgencyLevel === "high") {
                      recommendations.push("Immediate consultation with oncologist or breast specialist");
                      recommendations.push("Diagnostic mammography and ultrasound");
                      recommendations.push("Consider biopsy for tissue confirmation");
                    } else {
                      recommendations.push("Continue routine screening schedule");
                      recommendations.push("Monthly self-breast examinations");
                      recommendations.push("Report any new changes to your healthcare provider");
                    }
                  }

                  return (
                    <div className={`urgent-box ${urgencyLevel === "high" ? "malignant" : ""}`}
                      style={urgencyLevel === "low" ? {
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        border: '1px solid #bbf7d0'
                      } : {}}>
                      <h5 style={urgencyLevel === "low" ? { color: '#059669' } : {}}>
                        ⚕️ Recommended Action
                      </h5>
                      <p style={urgencyLevel === "low" ? { color: '#047857' } : {}}>
                        {urgencyLevel === "high"
                          ? "Based on these findings, the following actions are strongly recommended:"
                          : "Based on the analysis, continue with preventive care:"}
                      </p>
                      <ul className="checklist" style={urgencyLevel === "low" ? { listStyle: 'none' } : {}}>
                        {recommendations.map((rec, idx) => (
                          <li key={idx} style={urgencyLevel === "low" ? { color: '#059669' } : {}}>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}


          {/* Download Buttons - Both buttons at the end */}
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "30px", flexWrap: "wrap" }}>
            {/* Download PDF Report Button */}
            <button
              className="btn-primary"
              onClick={analysisTab === 0 ? handleDownloadReport : handleDownloadSecondReport}
              disabled={isGeneratingReport}
              style={{
                padding: "14px 32px",
                fontSize: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                minWidth: "240px",
                background: 'linear-gradient(135deg, #EC407A 0%, #E91E63 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: isGeneratingReport ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(233, 30, 99, 0.3)',
                transition: 'all 0.3s ease',
                opacity: isGeneratingReport ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isGeneratingReport) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(233, 30, 99, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isGeneratingReport) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(233, 30, 99, 0.3)';
                }
              }}
            >
              <FiDownload size={18} />
              {isGeneratingReport
                ? "Preparing Report…"
                : "Download PDF Report"
              }
            </button>

            {/* Download Visual Report Button */}
            <button
              className="btn-primary"
              onClick={handleDownloadFrontendReport}
              style={{
                background: 'linear-gradient(135deg, #9C27B0 0%, #BA68C8 100%)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FiDownload size={18} />
              Download Visual Report
            </button>
          </div>

        </>
      )}
    </>
  );
}

export default FullComparisonView;
