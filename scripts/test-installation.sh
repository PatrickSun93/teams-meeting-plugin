#!/bin/bash

# Teams App Installation Testing Script
# Tests the app package for common issues before deployment

set -e  # Exit on any error

echo "🧪 Teams Meeting Transcription App - Installation Testing"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Helper functions
pass_test() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

fail_test() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

warn_test() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

info_test() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Test 1: Check if package exists
echo -e "\n${BLUE}1️⃣ Testing Package Existence${NC}"
if [ -f "teams-transcription-app.zip" ]; then
    pass_test "App package found: teams-transcription-app.zip"
else
    fail_test "App package not found. Run 'npm run package:teams' first"
    exit 1
fi

# Test 2: Validate package structure
echo -e "\n${BLUE}2️⃣ Testing Package Structure${NC}"
if unzip -t teams-transcription-app.zip > /dev/null 2>&1; then
    pass_test "Package is a valid ZIP file"
else
    fail_test "Package is corrupted or invalid"
    exit 1
fi

# Check required files
REQUIRED_FILES=("manifest.json")
PACKAGE_CONTENTS=$(unzip -l teams-transcription-app.zip | awk 'NR>3 {print $4}' | grep -v '^$')

for file in "${REQUIRED_FILES[@]}"; do
    if echo "$PACKAGE_CONTENTS" | grep -q "^$file$"; then
        pass_test "Required file found: $file"
    else
        fail_test "Missing required file: $file"
    fi
done

# Check for icons (PNG or SVG)
if echo "$PACKAGE_CONTENTS" | grep -q "icon-color\.\(png\|svg\)"; then
    if echo "$PACKAGE_CONTENTS" | grep -q "icon-color\.png"; then
        pass_test "Color icon found: icon-color.png"
    else
        warn_test "Using SVG fallback for color icon (PNG recommended for production)"
    fi
else
    fail_test "Missing color icon (icon-color.png or icon-color.svg)"
fi

if echo "$PACKAGE_CONTENTS" | grep -q "icon-outline\.\(png\|svg\)"; then
    if echo "$PACKAGE_CONTENTS" | grep -q "icon-outline\.png"; then
        pass_test "Outline icon found: icon-outline.png"
    else
        warn_test "Using SVG fallback for outline icon (PNG recommended for production)"
    fi
else
    fail_test "Missing outline icon (icon-outline.png or icon-outline.svg)"
fi

# Test 3: Validate manifest.json
echo -e "\n${BLUE}3️⃣ Testing Manifest Validation${NC}"

# Extract and validate JSON
MANIFEST_CONTENT=$(unzip -p teams-transcription-app.zip manifest.json)

if echo "$MANIFEST_CONTENT" | jq . > /dev/null 2>&1; then
    pass_test "Manifest is valid JSON"
else
    fail_test "Manifest contains invalid JSON"
    exit 1
fi

# Check required manifest fields
REQUIRED_FIELDS=("id" "version" "name" "description" "developer" "icons")
for field in "${REQUIRED_FIELDS[@]}"; do
    if echo "$MANIFEST_CONTENT" | jq -e ".$field" > /dev/null 2>&1; then
        pass_test "Manifest field present: $field"
    else
        fail_test "Missing required manifest field: $field"
    fi
done

# Check manifest version format
VERSION=$(echo "$MANIFEST_CONTENT" | jq -r '.version')
if [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    pass_test "Version format is valid: $VERSION"
else
    warn_test "Version format should be semantic (x.y.z): $VERSION"
fi

# Check app ID format
APP_ID=$(echo "$MANIFEST_CONTENT" | jq -r '.id')
if [[ ${#APP_ID} -gt 4 && ${#APP_ID} -lt 64 ]]; then
    pass_test "App ID length is valid: $APP_ID"
else
    warn_test "App ID should be 4-64 characters: $APP_ID"
fi

# Test 4: Check package size
echo -e "\n${BLUE}4️⃣ Testing Package Size${NC}"
PACKAGE_SIZE=$(stat -f%z teams-transcription-app.zip 2>/dev/null || stat -c%s teams-transcription-app.zip 2>/dev/null)
MAX_SIZE=$((4 * 1024 * 1024))  # 4MB limit

if [ "$PACKAGE_SIZE" -lt "$MAX_SIZE" ]; then
    SIZE_MB=$(echo "scale=2; $PACKAGE_SIZE / 1024 / 1024" | bc -l 2>/dev/null || echo "$(($PACKAGE_SIZE / 1024 / 1024))")
    pass_test "Package size OK: ${SIZE_MB}MB (limit: 4MB)"
else
    SIZE_MB=$(echo "scale=2; $PACKAGE_SIZE / 1024 / 1024" | bc -l 2>/dev/null || echo "$(($PACKAGE_SIZE / 1024 / 1024))")
    fail_test "Package too large: ${SIZE_MB}MB (limit: 4MB)"
fi

# Test 5: Validate URLs in manifest
echo -e "\n${BLUE}5️⃣ Testing Manifest URLs${NC}"

# Check developer URLs
WEBSITE_URL=$(echo "$MANIFEST_CONTENT" | jq -r '.developer.websiteUrl // empty')
PRIVACY_URL=$(echo "$MANIFEST_CONTENT" | jq -r '.developer.privacyUrl // empty')
TERMS_URL=$(echo "$MANIFEST_CONTENT" | jq -r '.developer.termsOfUseUrl // empty')

if [[ $WEBSITE_URL =~ ^https?:// ]]; then
    pass_test "Website URL format valid: $WEBSITE_URL"
else
    warn_test "Website URL should start with http:// or https://: $WEBSITE_URL"
fi

if [[ $PRIVACY_URL =~ ^https?:// ]]; then
    pass_test "Privacy URL format valid: $PRIVACY_URL"
else
    warn_test "Privacy URL should start with http:// or https://: $PRIVACY_URL"
fi

if [[ $TERMS_URL =~ ^https?:// ]]; then
    pass_test "Terms URL format valid: $TERMS_URL"
else
    warn_test "Terms URL should start with http:// or https://: $TERMS_URL"
fi

# Test 6: Check valid domains
echo -e "\n${BLUE}6️⃣ Testing Valid Domains${NC}"
VALID_DOMAINS=$(echo "$MANIFEST_CONTENT" | jq -r '.validDomains[]? // empty')

if [ -n "$VALID_DOMAINS" ]; then
    pass_test "Valid domains configured"
    echo "$VALID_DOMAINS" | while read -r domain; do
        if [[ $domain == "localhost:"* ]]; then
            warn_test "Development domain detected: $domain (update for production)"
        else
            info_test "Production domain: $domain"
        fi
    done
else
    warn_test "No valid domains specified"
fi

# Test 7: Check permissions
echo -e "\n${BLUE}7️⃣ Testing Permissions${NC}"
PERMISSIONS=$(echo "$MANIFEST_CONTENT" | jq -r '.permissions[]? // empty')
DEVICE_PERMISSIONS=$(echo "$MANIFEST_CONTENT" | jq -r '.devicePermissions[]? // empty')

if echo "$PERMISSIONS" | grep -q "identity"; then
    pass_test "Identity permission configured"
else
    warn_test "Identity permission not found (may be needed for user info)"
fi

if echo "$PERMISSIONS" | grep -q "messageTeamMembers"; then
    pass_test "Message team members permission configured"
else
    warn_test "Message team members permission not found (needed for chat integration)"
fi

if echo "$DEVICE_PERMISSIONS" | grep -q "media"; then
    pass_test "Media device permission configured"
else
    fail_test "Media device permission required for audio capture"
fi

# Test 8: Development environment check
echo -e "\n${BLUE}8️⃣ Testing Development Environment${NC}"

# Check if Node.js dependencies are installed
if [ -d "node_modules" ]; then
    pass_test "Node.js dependencies installed"
else
    warn_test "Node.js dependencies not found. Run 'npm install'"
fi

# Check if build directory exists
if [ -d "src/client/build" ] || [ -d "build" ] || [ -d "dist" ]; then
    pass_test "Build artifacts found"
else
    warn_test "No build artifacts found. Run 'npm run build'"
fi

# Check package.json scripts
if [ -f "package.json" ]; then
    if grep -q "package:teams" package.json; then
        pass_test "Teams packaging script configured"
    else
        warn_test "Teams packaging script not found in package.json"
    fi
fi

# Test 9: Security checks
echo -e "\n${BLUE}9️⃣ Testing Security Configuration${NC}"

# Check for placeholder values that should be updated
if echo "$MANIFEST_CONTENT" | grep -q "your-app-id-here"; then
    warn_test "Placeholder app ID detected - update webApplicationInfo.id"
fi

if echo "$MANIFEST_CONTENT" | grep -q "yourcompany.com"; then
    warn_test "Placeholder URLs detected - update developer URLs"
fi

if echo "$MANIFEST_CONTENT" | grep -q "Your Company Name"; then
    warn_test "Placeholder developer name detected - update developer.name"
fi

# Check for localhost in production
if echo "$MANIFEST_CONTENT" | jq -r '.validDomains[]? // empty' | grep -q "localhost"; then
    warn_test "Localhost domain found - ensure this is for development only"
fi

# Test 10: Final validation
echo -e "\n${BLUE}🔟 Final Validation${NC}"

# Summary
echo -e "\n${BLUE}📊 Test Summary${NC}"
echo "==============="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"

# Overall result
if [ $TESTS_FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed! Package is ready for deployment.${NC}"
        EXIT_CODE=0
    else
        echo -e "\n${YELLOW}⚠️  Tests passed with warnings. Review warnings before production deployment.${NC}"
        EXIT_CODE=0
    fi
else
    echo -e "\n${RED}❌ Some tests failed. Fix issues before deployment.${NC}"
    EXIT_CODE=1
fi

# Recommendations
echo -e "\n${BLUE}📋 Recommendations${NC}"
echo "==================="

if [ $WARNINGS -gt 0 ] || [ $TESTS_FAILED -gt 0 ]; then
    echo "Before production deployment:"
    echo "1. Fix all failed tests"
    echo "2. Address security warnings (placeholder values)"
    echo "3. Create proper PNG icons (192x192 and 32x32)"
    echo "4. Update URLs to production domains"
    echo "5. Test sideloading in Teams"
fi

echo -e "\nNext steps:"
echo "1. Test sideloading: Upload teams-transcription-app.zip to Teams"
echo "2. Verify app functionality in a test meeting"
echo "3. Review docs/DEPLOYMENT_GUIDE.md for deployment options"
echo "4. Check docs/APP_STORE_SUBMISSION.md for store submission"

exit $EXIT_CODE