#!/bin/bash
# Azure Windows Runner Setup for Ritemark Native
#
# This script creates an Azure spot VM for Windows CI builds.
# Run this ONCE from your local machine with Azure CLI installed.
#
# Prerequisites:
#   1. Install Azure CLI: brew install azure-cli
#   2. Login: az login
#   3. Have a GitHub personal access token (for runner registration)
#
# Cost: ~$0.30-0.35/hr spot, ~$20/month disk (128GB Premium SSD)
# Monthly build cost (4 builds): ~$1.30 compute + $20 disk = ~$21

set -euo pipefail

RESOURCE_GROUP="ritemark-ci"
VM_NAME="ritemark-runner"
LOCATION="eastus"
VM_SIZE="Standard_D8s_v5"
IMAGE="Win2022Datacenter"
DISK_SIZE=128
ADMIN_USER="ritemarkadmin"

echo "=== Ritemark Azure Windows Runner Setup ==="
echo ""

# --- Step 1: Create resource group ---
echo "1. Creating resource group '$RESOURCE_GROUP' in $LOCATION..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none
echo "   Done."

# --- Step 2: Prompt for admin password ---
echo ""
echo "2. Set a password for the Windows VM admin account."
echo "   Requirements: 12+ chars, uppercase, lowercase, number, special char."
read -sp "   Password: " ADMIN_PASSWORD
echo ""

# --- Step 3: Create spot VM ---
echo ""
echo "3. Creating spot VM '$VM_NAME' ($VM_SIZE, ${DISK_SIZE}GB SSD)..."
echo "   This takes 2-5 minutes..."
az vm create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --location "$LOCATION" \
  --image "$IMAGE" \
  --size "$VM_SIZE" \
  --priority Spot \
  --eviction-policy Deallocate \
  --max-price -1 \
  --os-disk-size-gb "$DISK_SIZE" \
  --storage-sku Premium_LRS \
  --admin-username "$ADMIN_USER" \
  --admin-password "$ADMIN_PASSWORD" \
  --public-ip-sku Standard \
  --nsg-rule RDP \
  --output table
echo "   VM created."

# --- Step 4: Get public IP ---
echo ""
echo "4. Getting VM public IP..."
PUBLIC_IP=$(az vm show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --show-details \
  --query publicIps \
  --output tsv)
echo "   Public IP: $PUBLIC_IP"

# --- Step 5: Create service principal for GitHub Actions ---
echo ""
echo "5. Creating service principal for GitHub Actions..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

az ad app create --display-name "ritemark-ci-gh-actions" --output none
APP_ID=$(az ad app list --display-name "ritemark-ci-gh-actions" --query "[0].appId" -o tsv)
az ad sp create --id "$APP_ID" --output none 2>/dev/null || true

az role assignment create \
  --assignee "$APP_ID" \
  --role Contributor \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --output none

# --- Step 6: Create OIDC federated credential ---
echo ""
echo "6. Setting up OIDC for GitHub Actions..."
REPO="jarmo-productory/ritemark-native"

# For workflow_dispatch on main
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"gh-main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${REPO}:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" --output none

# For tag pushes
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"gh-tags\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${REPO}:ref:refs/tags/*\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" --output none 2>/dev/null || echo "   (tag credential may already exist)"

echo "   Done."

# --- Step 7: Print summary ---
echo ""
echo "========================================"
echo "  SETUP COMPLETE"
echo "========================================"
echo ""
echo "VM Details:"
echo "  Name:     $VM_NAME"
echo "  IP:       $PUBLIC_IP"
echo "  User:     $ADMIN_USER"
echo "  RDP:      mstsc /v:$PUBLIC_IP"
echo ""
echo "Add these GitHub repo secrets (Settings > Secrets > Actions):"
echo "  AZURE_CLIENT_ID:        $APP_ID"
echo "  AZURE_TENANT_ID:        $TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID:  $SUBSCRIPTION_ID"
echo ""
echo "========================================"
echo "  NEXT: RDP into the VM and run the"
echo "  runner setup (see instructions below)"
echo "========================================"
echo ""
echo "On the VM (Admin PowerShell):"
echo ""
echo '  # 1. Install build tools'
echo '  mkdir C:\actions-runner; cd C:\actions-runner'
echo '  Invoke-WebRequest -Uri "https://github.com/actions/runner/releases/download/v2.325.0/actions-runner-win-x64-2.325.0.zip" -OutFile runner.zip'
echo '  Add-Type -AssemblyName System.IO.Compression.FileSystem'
echo '  [System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD\runner.zip", "$PWD")'
echo ''
echo '  # 2. Get registration token from:'
echo "  #    https://github.com/$REPO/settings/actions/runners/new"
echo ''
echo '  # 3. Configure runner as service'
echo '  .\config.cmd --url https://github.com/'"$REPO"' --token YOUR_TOKEN --name ritemark-runner-win --labels windows,x64,azure-spot --work _work --unattended --runasservice'
echo ''
echo '  # 4. Install Node.js 22, Python 3.11, VS Build Tools'
echo '  winget install OpenJS.NodeJS.LTS --version 22.21.1'
echo '  winget install Python.Python.3.11'
echo '  winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet"'
echo ''
echo '  # 5. Lock down RDP to your IP only'
echo "  #    az network nsg rule update --resource-group $RESOURCE_GROUP --nsg-name ${VM_NAME}NSG --name rdp --source-address-prefixes YOUR_IP/32"
