# Downloads the Supabase CLI Windows binary into ./tools (no Docker required).
$ErrorActionPreference = 'Stop'
$version = 'v2.67.1'
$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root 'tools'
$exe = Join-Path $tools 'supabase.exe'
New-Item -ItemType Directory -Force -Path $tools | Out-Null

if (Test-Path $exe) {
  & $exe --version
  exit 0
}

$tar = Join-Path $env:TEMP 'supabase_win.tar.gz'
$url = "https://github.com/supabase/cli/releases/download/$version/supabase_windows_amd64.tar.gz"
Write-Host "Downloading Supabase CLI $version..."
curl.exe -L $url -o $tar
tar -xzf $tar -C $env:TEMP
Copy-Item (Join-Path $env:TEMP 'supabase.exe') $exe -Force
Remove-Item $tar -ErrorAction SilentlyContinue
& $exe --version
