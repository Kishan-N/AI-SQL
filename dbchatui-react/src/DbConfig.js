import React, { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';

const DB_TYPES = [
  { value: 'mysql', label: 'MySQL', port: '3306' },
  { value: 'postgresql', label: 'PostgreSQL', port: '5432' },
  { value: 'mssql', label: 'SQL Server', port: '1433' },
  { value: 'oracle', label: 'Oracle', port: '1521' },
];

// AES encryption settings (must match backend)
const AES_KEY = 'seLzpMXW5/ipsMHQ4/SltsfY6fChssPU5fanuMnQ4fI=';
const AES_IV = 'Gis8TV5veoucDR4vOktcbQ==';

function encryptPassword(password) {
  const key = CryptoJS.enc.Base64.parse(AES_KEY);
  const iv = CryptoJS.enc.Base64.parse(AES_IV);
  const encrypted = CryptoJS.AES.encrypt(password, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString();
}

function DbConfig({ dbConfig, setDbConfig }) {
  const [localConfig, setLocalConfig] = useState(dbConfig || {
    type: 'mysql',
    host: '',
    port: '3306',
    database: '',
    username: '',
    encryptedKey: ''
  });

  const [testStatus, setTestStatus] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    setLocalConfig(dbConfig || {
      type: 'mysql', host: '', port: '3306', database: '', username: '', encryptedKey: ''
    });
  }, [dbConfig]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocalConfig(cfg => ({ ...cfg, [name]: value }));
  };

  const handleTypeChange = (e) => {
    const { value } = e.target;
    const selectedDb = DB_TYPES.find(db => db.value === value);
    setLocalConfig(cfg => ({
      ...cfg,
      type: value,
      port: selectedDb?.port || cfg.port
    }));
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);

    try {
      const encryptedSecret = encryptPassword(localConfig.encryptedKey);
      const configToTest = {
        type: localConfig.type,
        host: localConfig.host,
        port: localConfig.port,
        database: localConfig.database,
        username: localConfig.username,
        encryptedKey: encryptedSecret,
        url: `jdbc:${localConfig.type}://${localConfig.host}:${localConfig.port}/${localConfig.database}`
      };

      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToTest),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTestStatus('success');
        } else {
          setTestStatus('error');
        }
      } else {
        setTestStatus('error');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setTestStatus('error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    createSecureConnection();
  };

  const createSecureConnection = async () => {
    try {
      const encryptedSecret = encryptPassword(localConfig.encryptedKey);
      const configToCreate = {
        type: localConfig.type,
        host: localConfig.host,
        port: localConfig.port,
        database: localConfig.database,
        username: localConfig.username,
        encryptedKey: encryptedSecret
      };

      const response = await fetch('/api/create-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToCreate),
      });

      const result = await response.json();

      if (result.success && result.connectionId) {
        const safeConfig = {
          connectionId: result.connectionId,
          type: localConfig.type,
          host: localConfig.host,
          port: localConfig.port,
          database: localConfig.database,
          username: localConfig.username,
          url: `jdbc:${localConfig.type}://${localConfig.host}:${localConfig.port}/${localConfig.database}`
        };

        setDbConfig(safeConfig);
        localStorage.setItem('dbConfig', JSON.stringify(safeConfig));
        setLocalConfig(prev => ({ ...prev, encryptedKey: '' }));
        setTestStatus('saved');
        setTimeout(() => setTestStatus(null), 3000);
      } else {
        setTestStatus('error');
      }
    } catch (error) {
      console.error('Failed to create secure connection:', error);
      setTestStatus('error');
    }
  };

  const isFormValid = localConfig.host && localConfig.port && localConfig.database && localConfig.username;

  return (
    <div style={{
      maxWidth: 600,
      margin: '0 auto',
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      overflow: 'hidden'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #fa0505 0%, #a30000 100%)',
        padding: '24px 32px',
        color: '#fff'
      }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: '#fff' }}>Database Configuration</h2>
        <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: 14, color: '#080808' }}>
          Configure your database connection settings
        </p>
      </div>

      <div style={{ padding: '32px' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#333',
              fontSize: 14
            }}>
              Database Type
            </label>
            <select
              name="type"
              value={localConfig.type}
              onChange={handleTypeChange}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e1e5e9',
                borderRadius: 8,
                fontSize: 14,
                background: '#fff',
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#d40000'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            >
              {DB_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: '2 1 0', minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 600,
                color: '#333',
                fontSize: 14
              }}>
                Host
              </label>
              <input
                type="text"
                name="host"
                value={localConfig.host}
                onChange={handleChange}
                placeholder="localhost or IP address"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 14,
                  transition: 'border-color 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#d40000'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 600,
                color: '#333',
                fontSize: 14
              }}>
                Port
              </label>
              <input
                type="text"
                name="port"
                value={localConfig.port}
                onChange={handleChange}
                placeholder="3306"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 14,
                  transition: 'border-color 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#d40000'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#333',
              fontSize: 14
            }}>
              Database Name
            </label>
            <input
              type="text"
              name="database"
              value={localConfig.database}
              onChange={handleChange}
              placeholder="Enter database name"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e1e5e9',
                borderRadius: 8,
                fontSize: 14,
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#d40000'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 600,
                color: '#333',
                fontSize: 14
              }}>
                Username
              </label>
              <input
                type="text"
                name="username"
                value={localConfig.username}
                onChange={handleChange}
                placeholder="Database username"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 14,
                  transition: 'border-color 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#d40000'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 600,
                color: '#333',
                fontSize: 14
              }}>
                Password
              </label>
              <input
                type="password"
                name="encryptedKey"
                value={localConfig.encryptedKey}
                onChange={handleChange}
                placeholder="Database secret"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 14,
                  transition: 'border-color 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#d40000'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
            </div>
          </div>

          <div style={{
            background: '#f8f9fa',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e9ecef'
          }}>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#666',
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}>
              Connection URL Preview
            </label>
            <code style={{
              fontSize: 13,
              color: '#495057',
              wordBreak: 'break-all'
            }}>
              {localConfig.host && localConfig.port && localConfig.database
                ? `jdbc:${localConfig.type}://${localConfig.host}:${localConfig.port}/${localConfig.database}`
                : 'Fill in the details above to see the connection URL'
              }
            </code>
          </div>

          {testStatus && (
            <div style={{
              padding: 12,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              ...(testStatus === 'success' && {
                background: '#d4edda',
                color: '#155724',
                border: '1px solid #c3e6cb'
              }),
              ...(testStatus === 'error' && {
                background: '#f8d7da',
                color: '#721c24',
                border: '1px solid #f5c6cb'
              }),
              ...(testStatus === 'saved' && {
                background: '#d1ecf1',
                color: '#0c5460',
                border: '1px solid #bee5eb'
              })
            }}>
              {testStatus === 'success' && '✓ Connection test successful!'}
              {testStatus === 'error' && '✗ Connection test failed. Please check your settings.'}
              {testStatus === 'saved' && '✓ Configuration saved successfully!'}
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: 12,
            marginTop: 8,
            paddingTop: 20,
            borderTop: '1px solid #e9ecef'
          }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={!isFormValid || isTesting}
              style={{
                flex: 1,
                padding: '12px 24px',
                background: isTesting ? '#6c757d' : '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: isTesting || !isFormValid ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: !isFormValid ? 0.6 : 1
              }}
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              style={{
                flex: 1,
                padding: '12px 24px',
                background: isFormValid ? '#d40000' : '#6c757d',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: isFormValid ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                opacity: !isFormValid ? 0.6 : 1
              }}
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DbConfig;