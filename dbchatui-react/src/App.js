import React, { useState, useEffect } from 'react';
import './index.css';
import ReactMarkdown from 'react-markdown';
import DbConfig from './DbConfig';

function App() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [huggingfaceResult, setHuggingfaceResult] = useState('');
  const [hfPrompt, setHfPrompt] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [imageError, setImageError] = useState('');
  const [enableChart, setEnableChart] = useState(true);
  const [showTestApis, setShowTestApis] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [page, setPage] = useState('chat');
  const [showDbConfigModal, setShowDbConfigModal] = useState(false);
  const [dbConfig, setDbConfig] = useState(() => {
    const saved = localStorage.getItem('dbConfig');
    return saved ? JSON.parse(saved) : null;
  });
  const [hoveredTab, setHoveredTab] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if database connection is configured
    if (!dbConfig || !dbConfig.connectionId) {
      setShowDbConfigModal(true);
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          enableChart,
          connectionId: dbConfig.connectionId
        }),
      });
      const data = await response.json();
      // Check for Hugging Face quota error
      if (
        typeof data === 'object' &&
        (data.error?.includes('exceeded your monthly included credits') ||
         data.summary?.includes('exceeded your monthly included credits') ||
         data.insights?.includes('exceeded your monthly included credits'))
      ) {
        setError('You have exceeded your monthly included credits for Hugging Face Inference API. Please subscribe or use a different token.');
      } else if (data.error) {
        // If error is invalid/expired connection, decryption, or connection error, show modal and clear config
        const errMsg = typeof data.error === 'string' ? data.error.toLowerCase() : '';
        if (
          errMsg.includes('invalid or expired connection id') ||
          errMsg.includes('failed to decrypt database secret') ||
          errMsg.includes('connection failed')
        ) {
          setShowDbConfigModal(true);
          setDbConfig(null);
          localStorage.removeItem('dbConfig');
        } else {
          setError(data.error);
        }
      } else setResult(data);
    } catch (err) {
      setError('Failed to fetch result.');
    }
    setLoading(false);
  };
  useEffect(() => {
    console.log(huggingfaceResult);
  }, [huggingfaceResult]);

  const handleHuggingFace = async () => {
    const response = await fetch('http://localhost:8080/api/huggingface', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: hfPrompt }),
    });
    const data = await response.json();

    // Check for Hugging Face quota error
    if (
      typeof data === 'object' &&
      (data.huggingface?.includes('exceeded your monthly included credits') ||
       data.error?.includes('exceeded your monthly included credits'))
    ) {
      setHuggingfaceResult('You have exceeded your monthly included credits for Hugging Face Inference API. Please subscribe or use a different token.');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(data.huggingface);
    } catch (err) {
      setHuggingfaceResult('Invalid JSON from backend');
      return;
    }

    const content = parsed?.Summary
                 || parsed?.error
                 || 'No content returned';

    setHuggingfaceResult(content);
  };

  const handleGenerateImage = async () => {
    setGeneratedImage('');
    setImageError('');
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt }),
      });
      const data = await response.json();
      // Check for Hugging Face quota error
      if (
        typeof data === 'object' &&
        (data.error?.includes('exceeded your monthly included credits') ||
         data.image?.includes('exceeded your monthly included credits'))
      ) {
        setImageError('You have exceeded your monthly included credits for Hugging Face Inference API. Please subscribe or use a different token.');
      } else if (data.error) setImageError(data.error);
      else setGeneratedImage(data.image);
    } catch (err) {
      setImageError('Failed to generate image.');
    }
  };

  // Copy query to clipboard
  const handleCopyQuery = () => {
    if (result && result.query) {
      navigator.clipboard.writeText(result.query)
        .then(() => {
          setCopiedToClipboard(true);
          setTimeout(() => setCopiedToClipboard(false), 2000); // Reset after 2 seconds
        })
        .catch(err => {
          console.error('Failed to copy query: ', err);
        });
    }
  };

  // Add a toggle for advanced/test APIs
  const handleToggleTestApis = () => setShowTestApis(v => !v);

  const renderSummary = (summary) => {
    let parsed;
    try {
      parsed = JSON.parse(summary);
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === 'object') {
      return (
        <div>
          {parsed.Summary && (
            <div style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
              padding: 16,
              borderRadius: 8,
              marginBottom: 12,
              color: '#ffffff',
              border: '1px solid #404040'
            }}>
              <div className="markdown-content">
                <ReactMarkdown>{parsed.Summary}</ReactMarkdown>
              </div>
            </div>
          )}
          {parsed.Explanation && (
            <div style={{ marginBottom: 12, color: '#ffffff' }}>
              <strong style={{ color: '#dc2626', display: 'block', marginBottom: 8 }}>Explanation:</strong>
              <div className="markdown-content">
                <ReactMarkdown>{parsed.Explanation}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      );
    }
    // If summary is a markdown table (pipe table)
    if (typeof summary === 'string' && summary.trim().startsWith('|') && summary.includes('\n|')) {
      // Parse markdown table to HTML table
      const lines = summary.trim().split(/\r?\n/).filter(l => l.trim().startsWith('|'));
      if (lines.length >= 2) {
        const header = lines[0].split('|').slice(1, -1).map(cell => cell.trim());
        const rows = lines.slice(2).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
        return (
          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #404040'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {header.map((cell, i) => <th key={i} style={{ border: '1px solid #404040', padding: 8, background: '#dc2626', color: '#ffffff' }}>{cell}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j} style={{ border: '1px solid #404040', padding: 8, background: '#333333', color: '#ffffff' }}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }
    // fallback: render as markdown
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        padding: 16,
        borderRadius: 8,
        color: '#ffffff',
        border: '1px solid #404040'
      }}>
        <div className="markdown-content">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      </div>
    );
  };

  useEffect(() => {
    document.title = "DB Chat Assistant";
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            background: '#2d2d2d',
            border: '1px solid #404040',
            borderBottom: '3px solid #dc2626',
            padding: '16px 32px',
            marginBottom: 32,
            boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
            position: 'relative',
            backdropFilter: 'blur(10px)'
          }}>
            <img
              src="/logo.png"
              alt="DB Chat Logo"
              style={{
                height: 45,
                marginRight: 20,
                filter: 'brightness(1.1) contrast(1.1)',
                borderRadius: 6
              }}
            />

            <span style={{
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 22,
              marginRight: 32,
              background: 'linear-gradient(135deg, #ffffff 0%, #dc2626 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              DB Chat Assistant
            </span>
            {/* Enhanced Separator */}
            <div style={{
              width: 2,
              height: 40,
              background: 'linear-gradient(180deg, transparent 0%, #dc2626 50%, transparent 100%)',
              margin: '0 32px 0 0',
              borderRadius: 1
            }} />
            {/* Enhanced Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {['chat', 'dbconfig'].map(tab => (
                <div
                  key={tab}
                  style={{
                    padding: '12px 24px',
                    color: page === tab ? '#ffffff' : '#cccccc',
                    fontWeight: page === tab ? 700 : 500,
                    fontSize: 15,
                    cursor: 'pointer',
                    borderBottom: page === tab ? '3px solid #dc2626' : '3px solid transparent',
                    background: page === tab
                      ? 'linear-gradient(135deg, rgba(220,38,38,0.2) 0%, rgba(185,28,28,0.1) 100%)'
                      : hoveredTab === tab
                      ? 'rgba(220,38,38,0.1)'
                      : 'transparent',
                    borderRadius: '8px 8px 0 0',
                    transition: 'all 0.3s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onClick={() => setPage(tab)}
                  onMouseEnter={() => setHoveredTab(tab)}
                  onMouseLeave={() => setHoveredTab(null)}
                >
                  {/* Tab glow effect */}
                  {page === tab && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(135deg, rgba(220,38,38,0.1) 0%, transparent 100%)',
                      pointerEvents: 'none'
                    }} />
                  )}
                  {tab === 'chat' ? 'Chat' : 'DB Config'}
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
        {/* Enhanced Advanced Toggle */}
        <div style={{ marginLeft: 32 }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: 14,
            color: '#cccccc',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            <span style={{ marginRight: 12 }}>Advanced</span>
            <input
              type="checkbox"
              checked={showTestApis}
              onChange={handleToggleTestApis}
              style={{
                width: 48,
                height: 26,
                appearance: 'none',
                background: showTestApis
                  ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                  : '#404040',
                borderRadius: 13,
                outline: 'none',
                border: 'none',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                margin: 0,
                display: 'block',
                boxShadow: showTestApis
                  ? '0 0 15px rgba(220, 38, 38, 0.4)'
                  : '0 2px 6px rgba(0,0,0,0.3)',
                position: 'relative'
              }}
            />
          </label>
        </div>
      </nav>
      <div className="App">
        {page === 'dbconfig' ? (
          <DbConfig dbConfig={dbConfig} setDbConfig={setDbConfig} />
        ) : (
          <>
            <h1>AI Database Chat</h1>
            <form onSubmit={handleSubmit} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: 'linear-gradient(135deg, #2a2a2a 0%, #333333 100%)',
              padding: 24,
              borderRadius: 12,
              boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
              marginBottom: 32,
              border: '1px solid #404040',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Form top accent */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'linear-gradient(90deg, #dc2626, #b91c1c)'
              }} />
              <input
                type="text"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Ask me anything about your database..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '1.1rem',
                  fontWeight: 400
                }}
              />
              <button type="submit" disabled={loading || !prompt.trim()}>
                {loading ? '🤔 Thinking...' : '🚀 ASK AI'}
              </button>
              <label style={{
                marginLeft: 16,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                color: '#cccccc',
                fontWeight: 500
              }}>
                <input
                  type="checkbox"
                  checked={enableChart}
                  onChange={e => setEnableChart(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Enable Chart Generation
              </label>
            </form>
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0' }}>
                <div className="spinner" />
              </div>
            )}
            {error && (
              <div style={{
                background: '#fff0f0',
                color: '#d40000',
                border: '1px solid #d40000',
                borderRadius: 6,
                padding: 16,
                marginBottom: 24,
                fontWeight: 500
              }}>
                {error}
              </div>
            )}
            {result && (
              <div style={{
                background: 'linear-gradient(135deg, #2a2a2a 0%, #333333 100%)',
                borderRadius: 12,
                boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
                padding: 28,
                marginBottom: 32,
                border: '1px solid #404040',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Result container top accent */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: 'linear-gradient(90deg, #dc2626, #b91c1c)'
                }} />
                <h2 style={{ marginTop: 0, marginBottom: 16 }}>Summary</h2>
                {renderSummary(result.summary)}
                {result.query && (
                  <div data-type="panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h2 style={{ margin: 0 }}>Query</h2>
                      <button
                        onClick={handleCopyQuery}
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.9rem',
                          backgroundColor: copiedToClipboard ? '#059669' : '#404040',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          fontWeight: 500
                        }}
                      >
                        {copiedToClipboard ? 'Copied!' : 'Copy Query'}
                      </button>
                    </div>
                    <pre style={{ marginTop: 0 }}>{result.query}</pre>
                  </div>
                )}
                {result.rowData && result.rowData.length > 0 && (
                  <div data-type="panel">
                    <h2>Results</h2>
                    <div style={{ overflowX: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            {result.rowData[0].map((cell, j) => (
                              <th key={j}>{cell}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.rowData.slice(1).map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => <td key={j}>{cell}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {result.insights && (
                  <div data-type="panel" style={{
                    background: 'linear-gradient(135deg, #0c4a6e 0%, #1e40af 100%)',
                    border: '1px solid #2563eb'
                  }}>
                    <h2 style={{ color: '#ffffff' }}>Insights</h2>
                    <div style={{ color: '#ffffff' }} className="markdown-content">
                      <ReactMarkdown>{result.insights}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {result.chartImage && enableChart && (
                  <div data-type="panel">
                    <h2>Chart</h2>
                    <div style={{ margin: '16px 0', textAlign: 'center' }}>
                      <img
                        src={`data:image/png;base64,${result.chartImage}`}
                        alt="Generated Chart"
                        style={{ maxWidth: '100%', border: '1px solid #404040', borderRadius: 8, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Test Hugging Face API UI, conditionally rendered */}
            {showTestApis && (
              <div style={{
                marginTop: 32,
                padding: 24,
                border: '1px solid #404040',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2a2a2a 0%, #333333 100%)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Test section top accent */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: 'linear-gradient(90deg, #dc2626, #b91c1c)'
                }} />
                <h3>Test Hugging Face API</h3>
                <input
                  type="text"
                  value={hfPrompt}
                  onChange={e => setHfPrompt(e.target.value)}
                  placeholder="Enter prompt for Hugging Face"
                  style={{ width: '60%' }}
                />
                <button onClick={handleHuggingFace} style={{ marginLeft: 8 }}>
                  Send to Hugging Face
                </button>
                <div style={{ marginTop: 16 }}>
                  <strong style={{ color: '#dc2626' }}>Hugging Face Response:</strong>
                  <pre style={{
                    background: '#1a1a1a',
                    padding: 8,
                    color: '#ffffff',
                    border: '1px solid #404040'
                  }}>
                    {huggingfaceResult}
                  </pre>
                </div>
              </div>
            )}
            {/* Test Image Generation API UI, conditionally rendered */}
            {showTestApis && (
              <div style={{
                marginTop: 32,
                padding: 24,
                border: '1px solid #404040',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2a2a2a 0%, #333333 100%)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Test section top accent */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: 'linear-gradient(90deg, #dc2626, #b91c1c)'
                }} />
                <h3>Test Image Generation API</h3>
                <input
                  type="text"
                  value={imagePrompt}
                  onChange={e => setImagePrompt(e.target.value)}
                  placeholder="Enter prompt for image generation"
                  style={{ width: '60%' }}
                />
                <button onClick={handleGenerateImage} style={{ marginLeft: 8 }}>
                  Generate Image
                </button>
                <div style={{ marginTop: 16 }}>
                  {imageError && <span style={{ color: '#dc2626' }}>{imageError}</span>}
                  {generatedImage && (
                    <img
                      src={`data:image/png;base64,${generatedImage}`}
                      alt="Generated"
                      style={{ maxWidth: '100%', border: '1px solid #404040', borderRadius: 8, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
                    />
                  )}
                </div>
              </div>
            )}
            {/* Database Configuration Modal */}
            {showDbConfigModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.8)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(5px)'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #2a2a2a 0%, #333333 100%)',
                  padding: 32,
                  borderRadius: 12,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                  width: '90%',
                  maxWidth: 400,
                  position: 'relative',
                  textAlign: 'center',
                  border: '1px solid #404040',
                  color: '#ffffff'
                }}>
                  {/* Modal top accent */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, #dc2626, #b91c1c)'
                  }} />
                  <h2 style={{ marginTop: 0, color: '#dc2626' }}>Database Connection Required</h2>
                  <p style={{ marginBottom: 24, fontSize: 16, color: '#cccccc' }}>
                    Please configure the database connection settings before proceeding with your query.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                    <button
                      onClick={() => setShowDbConfigModal(false)}
                      style={{
                        padding: '10px 20px',
                        background: '#404040',
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 14,
                        color: '#ffffff'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setShowDbConfigModal(false);
                        setPage('dbconfig');
                      }}
                      style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                        color: '#fff',
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 14,
                        transition: 'background 0.2s'
                      }}
                    >
                      Go to DB Config
                    </button>
                  </div>
                  <div style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    cursor: 'pointer',
                    color: '#cccccc',
                    fontSize: 18
                  }} onClick={() => setShowDbConfigModal(false)}>
                    &times;
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
