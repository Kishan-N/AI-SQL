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
      maxWidth: 700,
      margin: '0 auto',
      background: 'linear-gradient(135deg, #2a2a2a 0%, #333333 100%)',
      borderRadius: 16,
      boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      overflow: 'hidden',
      border: '1px solid #404040',
      position: 'relative'
    }}>
      {/* Header gradient accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: 'linear-gradient(90deg, #dc2626, #b91c1c, #dc2626)'
      }} />

      <div style={{
        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
        padding: '32px 40px',
        color: '#fff',
        position: 'relative'
      }}>
        {/* Header pattern overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="7" cy="7" r="1"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          opacity: 0.3
        }} />
        <h2 style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 700,
          color: '#fff',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 1
        }}>
          🗄️ Database Configuration
        </h2>
        <p style={{
          margin: '12px 0 0 0',
          opacity: 0.95,
          fontSize: 16,
          color: '#ffffff',
          position: 'relative',
          zIndex: 1
        }}>
          Configure your secure database connection
        </p>
      </div>

      <div style={{ padding: '40px' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div>
            <label style={{
              display: 'block',
              marginBottom: 12,
              fontWeight: 600,
              color: '#ffffff',
              fontSize: 15,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              🏗️ Database Type
            </label>
            <select
              name="type"
              value={localConfig.type}
              onChange={handleTypeChange}
              style={{
                width: '100%',
                padding: '16px 20px',
                border: '2px solid #404040',
                borderRadius: 10,
                fontSize: 15,
                background: '#1a1a1a',
                color: '#ffffff',
                transition: 'all 0.3s ease',
                outline: 'none',
                boxSizing: 'border-box',
                fontWeight: 500
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#dc2626';
                e.target.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#404040';
                e.target.style.boxShadow = 'none';
              }}
            >
              {DB_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: '2 1 0', minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: 12,
                fontWeight: 600,
                color: '#ffffff',
                fontSize: 15,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                🌐 Host
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
                  padding: '16px 20px',
                  border: '2px solid #404040',
                  borderRadius: 10,
                  fontSize: 15,
                  background: '#1a1a1a',
                  color: '#ffffff',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#dc2626';
                  e.target.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#404040';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: 12,
                fontWeight: 600,
                color: '#ffffff',
                fontSize: 15,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                🔌 Port
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
                  padding: '16px 20px',
                  border: '2px solid #404040',
                  borderRadius: 10,
                  fontSize: 15,
                  background: '#1a1a1a',
                  color: '#ffffff',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#dc2626';
                  e.target.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#404040';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: 12,
              fontWeight: 600,
              color: '#ffffff',
              fontSize: 15,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              🗃️ Database Name
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
                padding: '16px 20px',
                border: '2px solid #404040',
                borderRadius: 10,
                fontSize: 15,
                background: '#1a1a1a',
                color: '#ffffff',
                transition: 'all 0.3s ease',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#dc2626';
                e.target.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#404040';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: 12,
                fontWeight: 600,
                color: '#ffffff',
                fontSize: 15,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                👤 Username
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
                  padding: '16px 20px',
                  border: '2px solid #404040',
                  borderRadius: 10,
                  fontSize: 15,
                  background: '#1a1a1a',
                  color: '#ffffff',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#dc2626';
                  e.target.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#404040';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: 12,
                fontWeight: 600,
                color: '#ffffff',
                fontSize: 15,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                🔐 Password
              </label>
              <input
                type="password"
                name="encryptedKey"
                value={localConfig.encryptedKey}
                onChange={handleChange}
                placeholder="Database password"
                required
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  border: '2px solid #404040',
                  borderRadius: 10,
                  fontSize: 15,
                  background: '#1a1a1a',
                  color: '#ffffff',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#dc2626';
                  e.target.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#404040';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            padding: 20,
            borderRadius: 10,
            border: '1px solid #404040',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Preview accent line */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: 'linear-gradient(90deg, #dc2626, #b91c1c)'
            }} />
            <label style={{
              display: 'block',
              marginBottom: 12,
              fontWeight: 600,
              color: '#dc2626',
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              🔗 Connection URL Preview
            </label>
            <code style={{
              fontSize: 14,
              color: '#ffffff',
              wordBreak: 'break-all',
              background: '#333333',
              padding: '8px 12px',
              borderRadius: 6,
              display: 'block',
              border: '1px solid #404040'
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