# redeploy.ps1
# Modular packaging of multiple Lambda functions with separate dependencies

param (
    [string]$EnvFilePath = ".env.dev",  # Default to .env.dev in root folder
    [int[]]$Skip = @()
)

# Set working directory to the script's root directory
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot
Write-Host "Current working directory: $(Get-Location)"

# Configuration
$STACK_NAME = "AAIChatBotFEv1"
$S3_BUCKET = $env:DEPLOYMENT_BUCKET

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

Write-Output "#### Deleting Stack..."
aws cloudformation delete-stack --stack-name $STACK_NAME

Write-Output "#### Awaiting Stack Delete..."
aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME

Write-Output "#### Creating deployment package..."

$env:DEPLOYMENT_TIMESTAMP = (Get-Date -UFormat %s)

Write-Output "Deployment Timestamp set to: $env:DEPLOYMENT_TIMESTAMP"

# CloudFormation Deploy
Write-Host "Deploying CloudFormation stack..."
aws cloudformation deploy `
  --template-file template.yaml `
  --region $env:AWS_REGION `
  --stack-name $STACK_NAME `
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    "AppNamePrefix=$STACK_NAME" `
    "DeploymentTimestamp=$env:DEPLOYMENT_TIMESTAMP" `
    "ExistingS3BucketName=$env:EXISTING_BUCKET"


Write-Output "Cleaning up..."

# Remove-Item -Recurse -Force "./packages"

Write-Host "Deployment complete!"