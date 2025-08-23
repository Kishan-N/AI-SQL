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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (data.error) setError(data.error);
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
    if (data.error) setImageError(data.error);
    else setGeneratedImage(data.image);
  } catch (err) {
    setImageError('Failed to generate image.');
  }
};

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
    return (
      <div style={{ background: '#f8f8f8', padding: 12, borderRadius: 4 }}>
        <ReactMarkdown>{summary}</ReactMarkdown>
      </div>
    );
  }
  // fallback: render as markdown
  return (
    <div style={{ background: '#f8f8f8', padding: 12, borderRadius: 4 }}>
      <ReactMarkdown>{summary}</ReactMarkdown>
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
                  marginBottom: 32
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
                    Database Chat UI
                  </span>
                </nav>
    <div className="App">
      <h1>Database Chat UI</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Enter your prompt..."
        />
        <button type="submit" disabled={loading || !prompt.trim()}>Ask</button>
      </form>
      {loading && <p>Loading...</p>}
      {error && <p style={{color:'red'}}>{error}</p>}
      {result && (
        <div>
          <h2>Summary</h2>
          {renderSummary(result.summary)}
          {result.query && (
            <>
              <h2>Query</h2>
              <pre>{result.query}</pre>
            </>
          )}
          {result.rowData && result.rowData.length > 0 && (
            <>
              <h2>Results</h2>
              <table border="1">
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
            </>
          )}
          {result.insights && (
            <>
              <h2>Insights</h2>
              <div style={{ background: '#f0f8ff', padding: 12, borderRadius: 4 }}>
                <ReactMarkdown>{result.insights}</ReactMarkdown>
              </div>
            </>
          )}
          {result.chartImage && (
            <>
              <h2>Chart</h2>
              <div style={{ margin: '16px 0' }}>
                <img
                  src={`data:image/png;base64,${result.chartImage}`}
                  alt="Generated Chart"
                  style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: 8 }}
                />
              </div>
            </>
          )}
        </div>
      )}
      <div style={{ marginTop: 32, padding: 16, border: '1px solid #ccc' }}>
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
      <div style={{ marginTop: 32, padding: 16, border: '1px solid #ccc' }}>
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
              style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: 8 }}
            />
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

export default App;
