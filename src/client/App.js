// Main React App component with security integration
import React, { useState, useEffect } from 'react';
import PluginInterface from './components/PluginInterface.js';
import SecurityManager from './services/SecurityManager.js';
import ConfigurationManager from './services/ConfigurationManager.js';
import './App.css';

function App() {
  const [isTeamsContext, setIsTeamsContext] = useState(false);
  const [error, setError] = useState(null);
  const [securityManager, setSecurityManager] = useState(null);
  const [configurationManager, setConfigurationManager] = useState(null);
  const [securityInitialized, setSecurityInitialized] = useState(false);

  useEffect(() => {
    // Initialize security and configuration managers
    const initializeServices = async () => {
      try {
        // Create SecurityManager instance
        const secMgr = new SecurityManager();
        
        // Create ConfigurationManager with SecurityManager
        const configMgr = new ConfigurationManager(secMgr);
        
        // Initialize SecurityManager with default user
        // In a real app, this would use actual user credentials
        const userId = 'default-user';
        const password = 'default-password'; // This should be user-provided
        
        const initialized = await secMgr.initialize(userId, password);
        if (initialized) {
          setSecurityManager(secMgr);
          setConfigurationManager(configMgr);
          setSecurityInitialized(true);
        } else {
          console.warn('Security manager initialization failed, continuing without security features');
          setConfigurationManager(new ConfigurationManager());
        }
      } catch (err) {
        console.error('Failed to initialize security services:', err);
        setError('Failed to initialize security services');
      }
    };

    // Check if running in Teams context
    const checkTeamsContext = () => {
      try {
        // Check for Teams SDK or Teams-specific indicators
        const isInTeams = window.location.href.includes('teams.microsoft.com') ||
                         window.parent !== window ||
                         document.referrer.includes('teams.microsoft.com');
        
        setIsTeamsContext(isInTeams);
      } catch (err) {
        console.warn('Could not determine Teams context:', err);
        setError('Unable to determine Teams context');
      }
    };

    checkTeamsContext();
    initializeServices();
  }, []);

  if (error) {
    return (
      <div className="app-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }

  if (!configurationManager) {
    return (
      <div className="app-loading">
        <h2>Loading...</h2>
        <p>Initializing security and configuration services...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <PluginInterface 
        isTeamsContext={isTeamsContext}
        securityManager={securityManager}
        configurationManager={configurationManager}
        securityInitialized={securityInitialized}
      />
    </div>
  );
}

export default App;