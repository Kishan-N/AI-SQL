import React, { useState, useEffect } from 'react';
import './index.css';
import ReactMarkdown from 'react-markdown';

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
  const [showTestApis, setShowTestApis] = useState(false); // default: false

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, enableChart }),
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
      } else if (data.error) setError(data.error);
      else setResult(data);
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
            <div style={{ background: '#f8f8f8', padding: 12, borderRadius: 4, marginBottom: 8 }}>
              <ReactMarkdown>{parsed.Summary}</ReactMarkdown>
            </div>
          )}
          {parsed.Explanation && (
            <div style={{ marginBottom: 8 }}>
              <strong>Explanation:</strong>
              <ReactMarkdown>{parsed.Explanation}</ReactMarkdown>
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
          <div style={{ background: '#f8f8f8', padding: 12, borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {header.map((cell, i) => <th key={i} style={{ border: '1px solid #ddd', padding: 8 }}>{cell}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j} style={{ border: '1px solid #ddd', padding: 8 }}>{cell}</td>)}
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
      <div style={{ background: '#f8f8f8', padding: 12, borderRadius: 4 }}>
        <ReactMarkdown>{summary}</ReactMarkdown>
      </div>
    );
  };

  useEffect(() => {
    document.title = "AI Database Assistant";
  }, []);

  return (
    <div>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        background: '#fff',
        border: '1px solid #000',
        padding: '12px 32px',
        marginBottom: 32,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <img
          src="/logo.png"
          alt="SocGen Logo"
          style={{ height: 40, marginRight: 16 }}
        />
        <div style={{
          width: 1,
          height: 32,
          background: '#ccc',
          margin: '0 20px'
        }} />
        <span style={{ color: '#000', fontWeight: 'bold', fontSize: 20 }}>
          AI Database Assistant
        </span>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
          <span style={{ marginRight: 8, color: '#888' }}>Advanced</span>
          <input
            type="checkbox"
            checked={showTestApis}
            onChange={handleToggleTestApis}
            style={{
              width: 36,
              height: 20,
              appearance: 'none',
              background: showTestApis ? '#d40000' : '#ccc',
              borderRadius: 12,
              position: 'relative',
              outline: 'none',
              transition: 'background 0.2s',
              marginRight: 0,
            }}
          />
          <span style={{
            position: 'absolute',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            left: showTestApis ? 20 : 2,
            top: 1,
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
          }} />
        </label>
      </nav>
      <div className="App">
        <h1>AI Database Chat</h1>
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#fafafa',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          marginBottom: 24
        }}>
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit" disabled={loading || !prompt.trim()}>
            {loading ? 'Thinking...' : 'Ask'}
          </button>
          <label style={{ marginLeft: 8, fontSize: 14, display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={enableChart}
              onChange={e => setEnableChart(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            Enable chart
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
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            padding: 28,
            marginBottom: 32
          }}>
            <h2>Summary</h2>
            {renderSummary(result.summary)}
            {result.query && (
              <div data-type="panel">
                <h2>Query</h2>
                <pre>{result.query}</pre>
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
              <div data-type="panel" style={{ background: '#f0f8ff' }}>
                <h2>Insights</h2>
                <ReactMarkdown>{result.insights}</ReactMarkdown>
              </div>
            )}
            {result.chartImage && enableChart && (
              <div data-type="panel">
                <h2>Chart</h2>
                <div style={{ margin: '16px 0', textAlign: 'center' }}>
                  <img
                    src={`data:image/png;base64,${result.chartImage}`}
                    alt="Generated Chart"
                    style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
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
            border: '1px solid #ccc',
            borderRadius: 8,
            background: '#fafafa',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
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
              <strong>Hugging Face Response:</strong>
              <pre style={{ background: '#f4f4f4', padding: 8 }}>
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
            border: '1px solid #ccc',
            borderRadius: 8,
            background: '#fafafa',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
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
              {imageError && <span style={{ color: 'red' }}>{imageError}</span>}
              {generatedImage && (
                <img
                  src={`data:image/png;base64,${generatedImage}`}
                  alt="Generated"
                  style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
