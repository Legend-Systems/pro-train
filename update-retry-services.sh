#!/bin/bash

# Script to update all services to use the universal RetryService
# This script will:
# 1. Add the RetryService import
# 2. Add RetryService to constructor
# 3. Remove the old retryOperation method
# 4. Replace all retryOperation calls with retryService.executeDatabase

echo "Updating services to use universal RetryService..."

# List of service files to update
services=(
    "src/org/org.service.ts"
    "src/questions/questions.service.ts"
    "src/course-materials/course-materials.service.ts"
    "src/test_attempts/test_attempts.service.ts"
    "src/questions_options/questions_options.service.ts"
    "src/branch/branch.service.ts"
    "src/test/test.service.ts"
    "src/media-manager/media-manager.service.ts"
)

for service in "${services[@]}"; do
    echo "Updating $service..."
    
    # Check if file exists
    if [ ! -f "$service" ]; then
        echo "Warning: $service not found, skipping..."
        continue
    fi
    
    # 1. Add RetryService import (only if not already present)
    if ! grep -q "import { RetryService }" "$service"; then
        # Find the last import line and add the RetryService import after it
        sed -i '' '/^import.*from.*common.*events/a\
import { RetryService } from '\''../common/services/retry.service'\'';
' "$service"
    fi
    
    # 2. Add RetryService to constructor (only if not already present)
    if ! grep -q "private readonly retryService: RetryService" "$service"; then
        # Add retryService parameter to constructor before the closing parenthesis
        sed -i '' 's/) {}/private readonly retryService: RetryService,\
    ) {}/' "$service"
        
        # If that didn't work, try the more common pattern
        sed -i '' 's/,\([[:space:]]*\)) {}/,\1private readonly retryService: RetryService,\1) {}/' "$service"
    fi
    
    # 3. Remove the old retryOperation method
    # This is a bit complex because it spans multiple lines
    # We'll use a more targeted approach
    
    # 4. Replace all retryOperation calls with retryService.executeDatabase
    sed -i '' 's/this\.retryOperation(/this.retryService.executeDatabase(/g' "$service"
    
    echo "✓ Updated $service"
done

echo ""
echo "Update complete! Please review the changes and manually:"
echo "1. Remove the old 'private async retryOperation' methods from each service"
echo "2. Verify that the RetryService import and constructor injection are correct"
echo "3. Test that all services compile without errors"
echo ""
echo "You may need to adjust import paths if the relative path to common/services/retry.service.ts is different." 