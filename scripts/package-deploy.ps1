$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$staging = Join-Path $root '.deploy-package'
$zip = Join-Path $root 'deploy.zip'

$items = @(
  'server.js',
  'package.json',
  'package-lock.json',
  'index.html',
  'admin.html',
  'admin.js',
  'admin.css',
  'main.js',
  'style.css',
  'museum-ui.json',
  'changelog.html',
  'ecosystem.config.cjs',
  'nginx.conf',
  '.env.example',
  'DEPLOY.md',
  'data'
)

if (Test-Path -LiteralPath $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force
}

New-Item -ItemType Directory -Path $staging | Out-Null

foreach ($item in $items) {
  $source = Join-Path $root $item
  if (Test-Path -LiteralPath $source) {
    Copy-Item -LiteralPath $source -Destination $staging -Recurse -Force
  }
}

if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}

Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zip
Remove-Item -LiteralPath $staging -Recurse -Force

Write-Host "Deploy package created: $zip"
