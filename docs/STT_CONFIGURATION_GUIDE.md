# STT Configuration Guide

## Overview

This guide provides detailed instructions for configuring different Speech-to-Text (STT) services with the Teams Meeting Transcription Plugin. Each service has unique setup requirements, capabilities, and optimization settings.

## Table of Contents

1. [Local STT (Whisper.js)](#local-stt-whisperjs)
2. [OpenAI Whisper API](#openai-whisper-api)
3. [Azure Speech Services](#azure-speech-services)
4. [Google Cloud Speech-to-Text](#google-cloud-speech-to-text)
5. [AWS Transcribe](#aws-transcribe)
6. [Claude Speech (Anthropic)](#claude-speech-anthropic)
7. [Comparison and Recommendations](#comparison-and-recommendations)
8. [Troubleshooting](#troubleshooting)

## Local STT (Whisper.js)

### Overview
Local processing using OpenAI's Whisper model running in the browser. Provides privacy and offline capability but requires more system resources.

### Setup Instructions

1. **Enable Local STT**
   ```
   Settings > STT Configuration > Provider: "Local Whisper"
   ```

2. **Choose Model Size**
   - **Tiny**: Fastest, least accurate (39 MB)
   - **Base**: Good balance (74 MB)
   - **Small**: Better accuracy (244 MB)
   - **Medium**: High accuracy (769 MB)
   - **Large**: Best accuracy (1550 MB)

3. **Download Models**
   ```
   Click "Download Models" button
   Wait for download to complete (may take several minutes)
   Models are cached locally for future use
   ```

4. **Configure Settings**
   ```
   Language: Auto-detect or specific language
   Confidence Threshold: 0.6 (recommended)
   Processing Mode: Real-time or Batch
   ```

### Configuration Options

```json
{
  "provider": "local_whisper",
  "model": "base",
  "language": "auto",
  "confidence": 0.6,
  "realTime": true,
  "bufferSize": 4096,
  "processingInterval": 1000
}
```

### Performance Optimization

**System Requirements:**
- RAM: 8GB+ recommended for medium/large models
- CPU: Modern multi-core processor
- GPU: Optional but improves performance significantly

**Browser Optimization:**
```javascript
// Optimize for performance
{
  "webgl": true,           // Use GPU acceleration
  "threads": 4,            // Number of processing threads
  "memoryLimit": "2GB",    // Memory allocation limit
  "cacheModels": true      // Cache models locally
}
```

### Advantages
- ✅ Complete privacy (no data sent to cloud)
- ✅ Works offline
- ✅ No API costs
- ✅ No rate limits

### Limitations
- ❌ Requires significant system resources
- ❌ Slower than cloud services
- ❌ Limited language support compared to cloud
- ❌ Model download required

## OpenAI Whisper API

### Overview
Cloud-based STT service from OpenAI with excellent accuracy and broad language support.

### Setup Instructions

1. **Get API Key**
   ```
   1. Go to https://platform.openai.com
   2. Sign up or log in
   3. Navigate to API Keys section
   4. Create new secret key
   5. Copy the key (starts with sk-)
   ```

2. **Configure in Plugin**
   ```
   Settings > STT Configuration
   Provider: "OpenAI Whisper"
   API Key: [paste your key]
   Model: "whisper-1"
   ```

3. **Test Connection**
   ```
   Click "Test Connection" button
   Upload sample audio file
   Verify transcription quality
   ```

### Configuration Options

```json
{
  "provider": "openai_whisper",
  "apiKey": "sk-...",
  "model": "whisper-1",
  "language": "auto",
  "responseFormat": "json",
  "temperature": 0,
  "prompt": ""
}
```

### Advanced Settings

**Language Detection:**
```json
{
  "language": "auto",        // Auto-detect language
  "language": "en",          // Force English
  "language": "es",          // Force Spanish
  "language": "fr"           // Force French
}
```

**Response Format:**
```json
{
  "responseFormat": "json",           // Detailed response
  "responseFormat": "text",           // Plain text only
  "responseFormat": "srt",            // Subtitle format
  "responseFormat": "verbose_json"    // Maximum detail
}
```

**Custom Prompts:**
```json
{
  "prompt": "This is a business meeting discussing quarterly results and future planning."
}
```

### Rate Limits and Pricing

**Rate Limits:**
- 50 requests per minute
- File size limit: 25 MB
- Audio length limit: 25 minutes per request

**Pricing (as of 2024):**
- $0.006 per minute of audio
- Approximately $0.36 per hour

**Cost Optimization:**
```javascript
// Optimize API usage
{
  "batchProcessing": true,     // Process in batches
  "compressionLevel": "high",  // Compress audio before sending
  "segmentLength": 30,         // Process 30-second segments
  "cacheResults": true         // Cache results locally
}
```

### Advantages
- ✅ Excellent accuracy
- ✅ 99+ languages supported
- ✅ Fast processing
- ✅ Automatic language detection
- ✅ Handles various audio formats

### Limitations
- ❌ Requires internet connection
- ❌ API costs apply
- ❌ Rate limits
- ❌ Data sent to OpenAI servers

## Azure Speech Services

### Overview
Microsoft's enterprise-grade speech recognition service with strong integration with Microsoft ecosystem.

### Setup Instructions

1. **Create Azure Account**
   ```
   1. Go to https://portal.azure.com
   2. Sign up or log in
   3. Create new resource group
   4. Search for "Speech Services"
   5. Create Speech Services resource
   ```

2. **Get Credentials**
   ```
   Resource Overview:
   - Copy Key 1 or Key 2
   - Note the Region (e.g., "eastus")
   - Copy the Endpoint URL
   ```

3. **Configure in Plugin**
   ```
   Settings > STT Configuration
   Provider: "Azure Speech"
   API Key: [your key]
   Region: [your region]
   Endpoint: [your endpoint]
   ```

### Configuration Options

```json
{
  "provider": "azure_speech",
  "apiKey": "your-api-key",
  "region": "eastus",
  "endpoint": "https://eastus.api.cognitive.microsoft.com/",
  "language": "en-US",
  "model": "latest"
}
```

### Advanced Configuration

**Real-time Configuration:**
```json
{
  "realTimeConfig": {
    "enableDictation": true,
    "enablePunctuation": true,
    "enableWordLevelTimestamps": true,
    "profanityOption": "Masked",
    "addSentiment": false
  }
}
```

**Custom Models:**
```json
{
  "customModel": {
    "deploymentId": "your-deployment-id",
    "modelVersion": "latest",
    "adaptationSets": ["technical-terms", "company-names"]
  }
}
```

**Language Configuration:**
```json
{
  "multiLanguage": {
    "candidateLanguages": ["en-US", "es-ES", "fr-FR"],
    "autoDetect": true
  }
}
```

### Rate Limits and Pricing

**Rate Limits:**
- Standard: 20 concurrent requests
- Premium: 100+ concurrent requests
- File size: Up to 200 MB
- Audio length: Up to 10 hours

**Pricing Tiers:**
- Free: 5 hours per month
- Standard: $1 per hour
- Premium: Custom pricing

### Enterprise Features

**Security:**
```json
{
  "security": {
    "enableCustomerManagedKeys": true,
    "vnetIntegration": true,
    "privateEndpoints": true,
    "auditLogging": true
  }
}
```

**Compliance:**
- SOC 2 Type 2 certified
- HIPAA compliant
- GDPR compliant
- ISO 27001 certified

### Advantages
- ✅ Enterprise-grade security
- ✅ High accuracy for business content
- ✅ Custom model training
- ✅ Strong Microsoft ecosystem integration
- ✅ Compliance certifications

### Limitations
- ❌ More complex setup
- ❌ Higher costs for premium features
- ❌ Requires Azure account

## Google Cloud Speech-to-Text

### Overview
Google's speech recognition service with advanced AI capabilities and broad language support.

### Setup Instructions

1. **Create Google Cloud Project**
   ```
   1. Go to https://console.cloud.google.com
   2. Create new project or select existing
   3. Enable Speech-to-Text API
   4. Create service account
   5. Download JSON key file
   ```

2. **Configure Authentication**
   ```
   Settings > STT Configuration
   Provider: "Google Cloud Speech"
   Service Account Key: [upload JSON file]
   Project ID: [your project ID]
   ```

### Configuration Options

```json
{
  "provider": "google_speech",
  "projectId": "your-project-id",
  "keyFile": "path/to/service-account.json",
  "languageCode": "en-US",
  "model": "latest_long",
  "useEnhanced": true
}
```

### Advanced Features

**Model Selection:**
```json
{
  "model": "latest_long",      // Best for long audio
  "model": "latest_short",     // Best for short audio
  "model": "command_and_search", // Best for voice commands
  "model": "phone_call",       // Best for phone audio
  "model": "video"             // Best for video content
}
```

**Audio Enhancement:**
```json
{
  "audioConfig": {
    "useEnhanced": true,
    "enableAutomaticPunctuation": true,
    "enableWordTimeOffsets": true,
    "enableWordConfidence": true,
    "enableSpeakerDiarization": true,
    "diarizationSpeakerCount": 4
  }
}
```

**Custom Vocabulary:**
```json
{
  "speechContexts": [
    {
      "phrases": ["API", "JavaScript", "React", "Teams"],
      "boost": 20.0
    }
  ]
}
```

### Rate Limits and Pricing

**Rate Limits:**
- Streaming: 1000 concurrent streams
- Batch: No specific limits
- File size: Up to 10 GB
- Audio length: Up to 480 minutes

**Pricing:**
- Standard: $0.024 per minute
- Enhanced: $0.048 per minute
- Data logging discount: 50% off

### Advantages
- ✅ Advanced AI capabilities
- ✅ Speaker diarization
- ✅ Custom vocabulary support
- ✅ Multiple specialized models
- ✅ High scalability

### Limitations
- ❌ Complex authentication setup
- ❌ Requires Google Cloud account
- ❌ Higher pricing for enhanced features

## AWS Transcribe

### Overview
Amazon's speech recognition service with strong integration with AWS ecosystem.

### Setup Instructions

1. **Create AWS Account**
   ```
   1. Go to https://aws.amazon.com
   2. Sign up or log in
   3. Navigate to AWS Transcribe
   4. Create IAM user with Transcribe permissions
   5. Generate access keys
   ```

2. **Configure Credentials**
   ```
   Settings > STT Configuration
   Provider: "AWS Transcribe"
   Access Key ID: [your access key]
   Secret Access Key: [your secret key]
   Region: [your preferred region]
   ```

### Configuration Options

```json
{
  "provider": "aws_transcribe",
  "accessKeyId": "your-access-key",
  "secretAccessKey": "your-secret-key",
  "region": "us-east-1",
  "languageCode": "en-US",
  "mediaFormat": "wav"
}
```

### Advanced Features

**Custom Language Models:**
```json
{
  "customLanguageModel": {
    "modelName": "your-custom-model",
    "baseModelName": "NarrowBand",
    "languageCode": "en-US"
  }
}
```

**Content Redaction:**
```json
{
  "contentRedaction": {
    "redactionType": "PII",
    "redactionOutput": "redacted"
  }
}
```

**Speaker Identification:**
```json
{
  "speakerLabels": {
    "showSpeakerLabels": true,
    "maxSpeakerLabels": 10
  }
}
```

### Rate Limits and Pricing

**Rate Limits:**
- Streaming: 25 concurrent streams per account
- Batch: 100 concurrent jobs
- File size: Up to 2 GB
- Audio length: Up to 4 hours

**Pricing:**
- Standard: $0.024 per minute
- Medical: $0.048 per minute
- Call Analytics: $0.048 per minute

### Advantages
- ✅ Strong AWS ecosystem integration
- ✅ Medical transcription specialization
- ✅ Content redaction features
- ✅ Custom vocabulary and models

### Limitations
- ❌ Requires AWS account and IAM setup
- ❌ Complex permission management
- ❌ Limited real-time capabilities

## Claude Speech (Anthropic)

### Overview
Anthropic's speech recognition service (when available) with focus on safety and accuracy.

### Setup Instructions

1. **Get Anthropic API Key**
   ```
   1. Go to https://console.anthropic.com
   2. Sign up or log in
   3. Navigate to API Keys
   4. Generate new API key
   5. Copy the key (starts with sk-ant-)
   ```

2. **Configure in Plugin**
   ```
   Settings > STT Configuration
   Provider: "Claude Speech"
   API Key: [your key]
   Model: "claude-speech-1"
   ```

### Configuration Options

```json
{
  "provider": "claude_speech",
  "apiKey": "sk-ant-...",
  "model": "claude-speech-1",
  "language": "auto",
  "safetyLevel": "high"
}
```

### Advanced Settings

**Safety Configuration:**
```json
{
  "safetyConfig": {
    "contentFiltering": true,
    "biasReduction": true,
    "privacyProtection": "high"
  }
}
```

**Note:** Claude Speech is a hypothetical service for this example. Anthropic currently focuses on text generation rather than speech recognition.

## Comparison and Recommendations

### Accuracy Comparison

| Provider | Business Meetings | Technical Content | Multiple Languages | Real-time |
|----------|------------------|-------------------|-------------------|-----------|
| OpenAI Whisper | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Azure Speech | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Google Cloud | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| AWS Transcribe | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Local Whisper | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

### Cost Comparison (per hour)

| Provider | Standard | Enhanced | Enterprise |
|----------|----------|----------|------------|
| OpenAI Whisper | $0.36 | $0.36 | $0.36 |
| Azure Speech | $1.00 | $2.00 | Custom |
| Google Cloud | $1.44 | $2.88 | Custom |
| AWS Transcribe | $1.44 | $2.88 | Custom |
| Local Whisper | Free | Free | Free |

### Use Case Recommendations

**For Privacy-Sensitive Meetings:**
- ✅ Local Whisper (complete privacy)
- ✅ Azure Speech (enterprise compliance)

**For Best Accuracy:**
- ✅ OpenAI Whisper (general purpose)
- ✅ Google Cloud Speech (technical content)

**For Real-time Performance:**
- ✅ Azure Speech Services
- ✅ Google Cloud Speech

**For Cost-Effectiveness:**
- ✅ Local Whisper (free but resource-intensive)
- ✅ OpenAI Whisper (good balance)

**For Enterprise Features:**
- ✅ Azure Speech Services
- ✅ Google Cloud Speech
- ✅ AWS Transcribe

### Multi-Provider Strategy

Configure multiple providers for different scenarios:

```json
{
  "primaryProvider": "openai_whisper",
  "fallbackProvider": "local_whisper",
  "enterpriseProvider": "azure_speech",
  "rules": {
    "sensitiveContent": "local_whisper",
    "technicalMeetings": "google_speech",
    "longMeetings": "azure_speech"
  }
}
```

## Troubleshooting

### Common Issues

**API Key Problems:**
```
Error: "Invalid API key"
Solution: 
1. Verify key format is correct
2. Check key hasn't expired
3. Ensure billing is set up
4. Test key with provider's API directly
```

**Rate Limit Exceeded:**
```
Error: "Rate limit exceeded"
Solution:
1. Implement exponential backoff
2. Use batch processing
3. Upgrade to higher tier
4. Distribute load across multiple keys
```

**Poor Transcription Quality:**
```
Problem: Low accuracy transcription
Solution:
1. Improve audio quality
2. Use appropriate model for content type
3. Add custom vocabulary
4. Try different provider
```

**Network Connectivity:**
```
Error: "Network timeout"
Solution:
1. Check internet connection
2. Verify firewall settings
3. Test with different network
4. Use local provider as fallback
```

### Performance Optimization

**Audio Preprocessing:**
```javascript
{
  "audioOptimization": {
    "noiseReduction": true,
    "normalization": true,
    "compression": "opus",
    "sampleRate": 16000,
    "channels": 1
  }
}
```

**Batch Processing:**
```javascript
{
  "batchConfig": {
    "segmentLength": 30,      // 30-second segments
    "overlapDuration": 2,     // 2-second overlap
    "parallelRequests": 3,    // Process 3 segments simultaneously
    "retryAttempts": 3        // Retry failed segments
  }
}
```

**Caching Strategy:**
```javascript
{
  "caching": {
    "enableCache": true,
    "cacheExpiry": 86400,     // 24 hours
    "maxCacheSize": "1GB",
    "cacheLocation": "indexeddb"
  }
}
```

### Monitoring and Analytics

**Usage Tracking:**
```javascript
{
  "monitoring": {
    "trackUsage": true,
    "trackAccuracy": true,
    "trackLatency": true,
    "exportMetrics": true
  }
}
```

**Quality Metrics:**
```javascript
{
  "qualityMetrics": {
    "confidenceThreshold": 0.8,
    "accuracyTarget": 0.95,
    "latencyTarget": 2000,    // 2 seconds
    "alertOnThresholds": true
  }
}
```

For additional help with STT configuration, see the [Troubleshooting Guide](./TROUBLESHOOTING.md) or contact support.