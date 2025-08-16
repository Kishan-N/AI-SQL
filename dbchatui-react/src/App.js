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



  return (
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
          <div style={{ background: '#f8f8f8', padding: 12, borderRadius: 4 }}>
            <ReactMarkdown>{result.summary}</ReactMarkdown>
          </div>
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
    </div>
  );
}

export default App;
