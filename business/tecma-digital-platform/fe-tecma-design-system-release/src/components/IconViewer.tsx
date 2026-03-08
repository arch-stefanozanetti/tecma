import React from 'react';
import Icon from './Icon/Icon';
import { IconName } from './Icon/IconName';
import iconsManifest from './Icon/icons-manifest.json';

const IconViewer: React.FC = () => {
  const iconNames = iconsManifest.icons as IconName[];

  const copyToClipboard = async (iconName: string) => {
    try {
      await navigator.clipboard.writeText(iconName);
      alert(`Copiato: ${iconName}`);
    } catch (err) {
      console.error('Errore nel copiare:', err);
      // Fallback per browser che non supportano clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = iconName;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`Copiato: ${iconName}`);
    }
  };

  return (
    <div style={{ 
      padding: '20px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        marginBottom: '30px',
        fontSize: '24px',
        color: '#333'
      }}>
        Tutte le icone disponibili ({iconNames.length} icone)
      </h1>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '15px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {iconNames.map((iconName) => (
          <div
            key={iconName}
            onClick={() => copyToClipboard(iconName)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '15px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            <Icon 
              iconName={iconName} 
              size="large" 
              style={{ 
                color: '#363B4C',
                marginBottom: '8px'
              }}
            />
            <span style={{
              fontSize: '12px',
              color: '#666',
              textAlign: 'center',
              wordBreak: 'break-word',
              fontFamily: 'monospace'
            }}>
              {iconName}
            </span>
          </div>
        ))}
      </div>
      
      <div style={{
        marginTop: '40px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#363B4C', marginBottom: '10px' }}>
          Come usare:
        </h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          <strong>Clicca su un'icona</strong> per copiare automaticamente il suo nome negli appunti.<br/>
          Usa il nome dell'icona come valore per <code>firstButtonIcon</code> o <code>lastButtonIcon</code> nelle props dei componenti di paginazione.
        </p>
      </div>
    </div>
  );
};

export default IconViewer; 