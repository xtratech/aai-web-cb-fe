# redeploy.ps1
# Modular packaging of multiple Lambda functions with separate dependencies

param (
    [string]$EnvFilePath = ".env.uat",  # Default to .env.uat in root folder
    [int[]]$Skip = @()
)

# Set working directory to the script's root directory
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot
Write-Host "Current working directory: $(Get-Location)"

# Configuration
$STACK_NAME = "AAIChatBotFEv1"
$S3_BUCKET = "pluree-deployment-bucket-lambda-1"  # Replace with your S3 bucket name


# Load environment variables from .env.uat
$envFileFullPath = Join-Path $scriptRoot $EnvFilePath
if (Test-Path $envFileFullPath) {
    Get-Content $envFileFullPath | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
        $parts = $_ -split '=', 2
        $key   = $parts[0].Trim()
        $value = $parts[1].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
} else {
    Write-Error "[ERROR] .env file not found at $envFileFullPath. Exiting."
    exit 1
}

$env:DEPLOYMENT_TIMESTAMP = (Get-Date -UFormat %s)

Write-Output "Deployment Timestamp set to: $env:DEPLOYMENT_TIMESTAMP"

# CloudFormation Deploy
Write-Host "Creating package..."
aws cloudformation package `
  --template-file template.yaml `
  --s3-bucket quookerintrachatbotfe-webapp-bucket `
  --output-template-file packaged-template.yaml

Write-Output "Cleaning up..."

# Remove-Item -Recurse -Force "./packages"

Write-Host "Package complete!"