import React, { useState, useEffect } from 'react';
import './index.css';
import ReactMarkdown from 'react-markdown';

function App() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enableChart, setEnableChart] = useState(true);

  useEffect(() => {
    document.title = "AI Database Assistant";
  }, []);

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
      if (
        typeof data === 'object' &&
        (data.error?.includes('exceeded your monthly included credits') ||
         data.summary?.includes('exceeded your monthly included credits') ||
         data.insights?.includes('exceeded your monthly included credits'))
      ) {
        setError('You have exceeded your monthly included credits for Hugging Face Inference API. Please subscribe or use a different token.');
      } else if (data.error) setError(data.error);
      else setResult(data);
    } catch {
      setError('Failed to fetch result.');
    }
    setLoading(false);
  };

  const renderSummary = (summary) => {
    let jsonBlock = null;
    let markdownAfterJson = '';
    if (typeof summary === 'string') {
      const jsonMatch = summary.match(/```json\s*([\s\S]*?)```/i);
      if (jsonMatch) {
        jsonBlock = jsonMatch[1];
        markdownAfterJson = summary.replace(/```json[\s\S]*?```/gi, '').trim();
      } else {
        const curlyMatch = summary.match(/({[\s\S]*?})/);
        if (curlyMatch) {
          jsonBlock = curlyMatch[1];
          markdownAfterJson = summary.replace(curlyMatch[1], '').trim();
        }
      }
    }

    let parsed = null;
    if (jsonBlock) {
      try {
        parsed = JSON.parse(jsonBlock);
      } catch {
        parsed = null;
      }
    } else {
      try {
        parsed = JSON.parse(summary);
      } catch {
        parsed = null;
      }
    }

    return (
      <div>
        {parsed && typeof parsed === 'object' && (
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
        )}
        {markdownAfterJson && (
          <div style={{ background: '#f8f8f8', padding: 12, borderRadius: 4, marginTop: 8 }}>
            <ReactMarkdown>{markdownAfterJson}</ReactMarkdown>
          </div>
        )}
        {!parsed && !markdownAfterJson && typeof summary === 'string' && (
          <div style={{ background: '#f8f8f8', padding: 12, borderRadius: 4 }}>
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        )}
      </div>
    );
  };

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
      </div>
    </div>
  );
}

export default App;
