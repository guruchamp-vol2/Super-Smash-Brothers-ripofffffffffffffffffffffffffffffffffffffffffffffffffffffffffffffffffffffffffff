# Fetch portraits for characters into assets/portraits and update portraits.json
# Usage:
# 1) Fill assets/portraits.json with either local paths OR http(s) URLs for each character.
#    - If a value is an http(s) URL, this script will download it to assets/portraits/<id>.png
#    - If a value is already a local path (e.g., assets/portraits/sonic.png), it will be preserved.
# 2) Optionally, create assets/portraits-sources.json with a mapping of id->URL. This script will use it as fallback.
# 3) Run this script from the project root or from assets/:
#      PowerShell:  pwsh -File assets/fetch-portraits.ps1
#    or Windows PS: powershell -ExecutionPolicy Bypass -File assets/fetch-portraits.ps1

param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Resolve paths
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$assetsDir = Join-Path $root 'assets'
$portraitsDir = Join-Path $assetsDir 'portraits'
$portraitsJsonPath = Join-Path $assetsDir 'portraits.json'
$sourcesJsonPath = Join-Path $assetsDir 'portraits-sources.json'

# Ensure folders
if (!(Test-Path $portraitsDir)) { New-Item -ItemType Directory -Force -Path $portraitsDir | Out-Null }

# Load portraits.json (id -> path/url)
if (!(Test-Path $portraitsJsonPath)) {
  Write-Error "Missing $portraitsJsonPath. Please create it first."
}
$portraitsMap = Get-Content $portraitsJsonPath -Raw | ConvertFrom-Json

# Load optional sources (id -> url)
$sourcesMap = @{}
if (Test-Path $sourcesJsonPath) {
  $sourcesMap = Get-Content $sourcesJsonPath -Raw | ConvertFrom-Json
}

function IsHttpUrl($s){ return ($s -is [string]) -and ($s -match '^https?://') }

function Download-IfNeeded($id, $srcUrl){
  try{
    $dest = Join-Path $portraitsDir ("{0}.png" -f $id)
    Write-Host "Downloading $id => $dest" -ForegroundColor Cyan
    $resp = Invoke-WebRequest -Uri $srcUrl -UseBasicParsing -OutFile $dest
    return $dest
  } catch {
    Write-Warning "Failed to download $id from $srcUrl: $($_.Exception.Message)"
    return $null
  }
}

# Iterate keys in portraits.json
$updated = $false
$ids = $portraitsMap.PSObject.Properties | ForEach-Object { $_.Name }
foreach($id in $ids){
  $val = $portraitsMap.$id
  if (IsHttpUrl $val) {
    $saved = Download-IfNeeded $id $val
    if ($saved) { $portraitsMap.$id = (Resolve-Path $saved | Split-Path -NoQualifier).Replace("\\","/") ; $updated = $true }
    continue
  }
  # No http(s) in portraits.json value; try sources file
  $srcUrl = $null
  if ($sourcesMap -ne $null -and ($sourcesMap.PSObject.Properties.Name -contains $id)){
    $srcUrl = $sourcesMap.$id
  }
  if (IsHttpUrl $srcUrl) {
    $saved = Download-IfNeeded $id $srcUrl
    if ($saved) { $portraitsMap.$id = (Resolve-Path $saved | Split-Path -NoQualifier).Replace("\\","/") ; $updated = $true }
  } else {
    # keep as-is; either already local path or missing
    continue
  }
}

if ($updated) {
  ($portraitsMap | ConvertTo-Json -Depth 5) | Out-File -FilePath $portraitsJsonPath -Encoding utf8
  Write-Host "Updated $portraitsJsonPath with local file paths." -ForegroundColor Green
} else {
  Write-Host "Nothing to update. Ensure portraits.json contains URLs or add assets/portraits-sources.json with id->URL." -ForegroundColor Yellow
}

Write-Host "Done." -ForegroundColor Green
