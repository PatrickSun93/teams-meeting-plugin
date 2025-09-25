/**
 * ConsentDialog - Modal dialog for collecting user consent
 */

import React, { useState, useEffect } from 'react';
import './ConsentDialog.css';

const ConsentDialog = ({ isOpen, consentRequest, onResponse, onClose }) => {
  const [selectedConditions, setSelectedConditions] = useState({});
  const [hasReadDetails, setHasReadDetails] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isOpen && consentRequest) {
      // Reset state when dialog opens
      setSelectedConditions({});
      setHasReadDetails(false);
      setShowDetails(false);
    }
  }, [isOpen, consentRequest]);

  useEffect(() => {
    // Listen for consent dialog events
    const handleConsentDialog = (event) => {
      const { consentRequest, onResponse } = event.detail;
      // This would be handled by the parent component
    };

    document.addEventListener('show-consent-dialog', handleConsentDialog);
    return () => document.removeEventListener('show-consent-dialog', handleConsentDialog);
  }, []);

  if (!isOpen || !consentRequest) {
    return null;
  }

  const { requirement, context } = consentRequest;

  const handleGrant = () => {
    onResponse({
      granted: true,
      grantedAt: Date.now(),
      conditions: selectedConditions,
      context: context
    });
    onClose();
  };

  const handleDeny = () => {
    onResponse({
      granted: false,
      deniedAt: Date.now(),
      reason: 'User declined consent',
      context: context
    });
    onClose();
  };

  const isRequired = requirement.level === 'required';
  const canProceedWithoutConsent = !isRequired;

  return (
    <div className="consent-dialog-overlay">
      <div className="consent-dialog">
        <div className="consent-header">
          <h2>Consent Required</h2>
          <div className={`consent-level ${requirement.level}`}>
            {requirement.level.toUpperCase()}
          </div>
        </div>

        <div className="consent-content">
          <div className="consent-title">
            <h3>{requirement.title}</h3>
          </div>

          <div className="consent-description">
            <p>{requirement.description}</p>
          </div>

          <div className="consent-summary">
            <div className="summary-section">
              <h4>Data to be processed:</h4>
              <ul>
                {requirement.dataProcessed.map((data, index) => (
                  <li key={index}>{data}</li>
                ))}
              </ul>
            </div>

            <div className="summary-section">
              <h4>Third parties involved:</h4>
              <ul>
                {requirement.thirdParties.map((party, index) => (
                  <li key={index}>{party}</li>
                ))}
              </ul>
            </div>

            <div className="summary-section">
              <h4>Data retention:</h4>
              <p>{requirement.retention}</p>
            </div>

            <div className="summary-section">
              <h4>Potential risks:</h4>
              <p className="risk-warning">{requirement.risks}</p>
            </div>
          </div>

          {!showDetails && (
            <button 
              className="show-details-btn"
              onClick={() => {
                setShowDetails(true);
                setHasReadDetails(true);
              }}
            >
              Show Full Details
            </button>
          )}

          {showDetails && (
            <div className="consent-details">
              <div className="details-section">
                <h4>Your Rights</h4>
                <ul>
                  <li>You can revoke this consent at any time through the Security Settings</li>
                  <li>Revoking consent will disable the associated features</li>
                  <li>Your data will be processed only as described above</li>
                  <li>You have the right to request deletion of your data</li>
                </ul>
              </div>

              <div className="details-section">
                <h4>How We Protect Your Data</h4>
                <ul>
                  <li>All data is encrypted during transmission and storage</li>
                  <li>We use industry-standard security measures</li>
                  <li>Access to your data is strictly limited and logged</li>
                  <li>We do not sell or share your data for marketing purposes</li>
                </ul>
              </div>

              <div className="details-section">
                <h4>Legal Basis</h4>
                <p>
                  This consent is requested under Article 6(1)(a) of the GDPR (General Data Protection Regulation) 
                  and similar privacy laws. Your consent is freely given, specific, informed, and can be withdrawn at any time.
                </p>
              </div>

              {requirement.level === 'optional' && (
                <div className="optional-conditions">
                  <h4>Additional Options</h4>
                  <label className="condition-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedConditions.limitedProcessing || false}
                      onChange={(e) => setSelectedConditions({
                        ...selectedConditions,
                        limitedProcessing: e.target.checked
                      })}
                    />
                    <span>Limit data processing to essential functions only</span>
                  </label>
                  <label className="condition-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedConditions.deleteAfterSession || false}
                      onChange={(e) => setSelectedConditions({
                        ...selectedConditions,
                        deleteAfterSession: e.target.checked
                      })}
                    />
                    <span>Automatically delete data after this session</span>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="consent-confirmation">
            <label className="confirmation-checkbox">
              <input
                type="checkbox"
                checked={hasReadDetails}
                onChange={(e) => setHasReadDetails(e.target.checked)}
              />
              <span>I have read and understand the information above</span>
            </label>
          </div>
        </div>

        <div className="consent-actions">
          <div className="action-buttons">
            <button 
              className="deny-btn"
              onClick={handleDeny}
            >
              {isRequired ? 'Cancel Operation' : 'Deny'}
            </button>
            
            <button 
              className="grant-btn"
              onClick={handleGrant}
              disabled={!hasReadDetails}
            >
              Grant Consent
            </button>
          </div>

          {isRequired && (
            <div className="required-notice">
              <p>
                <strong>Note:</strong> This consent is required for the requested operation. 
                Denying consent will cancel the operation.
              </p>
            </div>
          )}

          {canProceedWithoutConsent && (
            <div className="optional-notice">
              <p>
                This consent is optional. You can continue without granting consent, 
                but some features may be limited.
              </p>
            </div>
          )}
        </div>

        <button className="close-btn" onClick={onClose} aria-label="Close dialog">
          ×
        </button>
      </div>
    </div>
  );
};

export default ConsentDialog;