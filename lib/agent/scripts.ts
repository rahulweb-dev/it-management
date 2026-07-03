/**
 * Generates the installer scripts employees run on their own machine.
 * Each script is self-contained and does double duty: first run enrolls
 * the device (using the one-time token) and installs itself as a
 * recurring scheduled job; every run after that just checks in using the
 * saved device key. No compiled binary, no runtime to install — just the
 * OS's own scripting engine (PowerShell on Windows, bash on Mac).
 *
 * These are written against standard, documented OS commands but were
 * authored without the ability to run them on real Windows/Mac hardware
 * — test on one machine of each OS before rolling out broadly.
 */

export function windowsInstallerScript(opts: { apiBase: string; token: string }) {
  return `# AssetFlow Agent — Windows
# Collects basic hardware/system info and registers this machine in AssetFlow.
# Re-run safe: first run enrolls, every run after that just checks in.
$ErrorActionPreference = "Stop"
$ApiBase = "${opts.apiBase}"
$Token = "${opts.token}"
$InstallDir = "$env:ProgramData\\AssetFlowAgent"
$ConfigPath = "$InstallDir\\config.json"
$ScriptPath = "$InstallDir\\agent.ps1"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

function Get-HardwareInfo {
    $cs = Get-CimInstance Win32_ComputerSystem
    $bios = Get-CimInstance Win32_BIOS
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $disks = Get-CimInstance Win32_DiskDrive
    $storageGb = [math]::Round((($disks | Measure-Object -Property Size -Sum).Sum) / 1GB, 1)
    $ramGb = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
    $netAdapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
    $ip = $null
    if ($netAdapter) {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $netAdapter.InterfaceIndex -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress
    }

    return @{
        hostname     = $env:COMPUTERNAME
        deviceType   = if ($cs.PCSystemType -eq 2) { "laptop" } else { "desktop" }
        manufacturer = $cs.Manufacturer
        model        = $cs.Model
        cpu          = $cpu.Name
        ramGb        = $ramGb
        storageGb    = $storageGb
        os           = "$($os.Caption) $($os.Version)"
        serialNumber = $bios.SerialNumber
        ipAddress    = $ip
        macAddress   = $netAdapter.MacAddress
        loggedInUser = $env:USERNAME
    }
}

$hardware = Get-HardwareInfo

if (Test-Path $ConfigPath) {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    Write-Host "AssetFlow: existing registration found (asset $($config.assetId)) — checking in, not enrolling as new."
    Write-Host "AssetFlow: to force a fresh enrollment instead, delete $ConfigPath first."
    $body = @{ hardware = $hardware } | ConvertTo-Json -Depth 5
    try {
        Invoke-RestMethod -Uri "$ApiBase/api/agent/checkin" -Method Post -Body $body -ContentType "application/json" \`
            -Headers @{ Authorization = "Bearer $($config.deviceApiKey)" } | Out-Null
        Write-Host "AssetFlow: check-in OK ($($config.assetId))"
    } catch {
        Write-Host "AssetFlow: check-in failed: $_"
        exit 1
    }
} else {
    Write-Host "AssetFlow: no existing registration on this machine — enrolling as a new device."
    try {
        $body = @{ token = $Token; platform = "windows"; hardware = $hardware } | ConvertTo-Json -Depth 5
        $response = Invoke-RestMethod -Uri "$ApiBase/api/agent/enroll" -Method Post -Body $body -ContentType "application/json"
    } catch {
        Write-Host "AssetFlow: enrollment failed: $_"
        exit 1
    }
    @{ deviceApiKey = $response.deviceApiKey; assetId = $response.assetId } | ConvertTo-Json | Set-Content $ConfigPath

    Copy-Item -Path $PSCommandPath -Destination $ScriptPath -Force

    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File \`"$ScriptPath\`""
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 20) -RepetitionDuration ([TimeSpan]::MaxValue)
    Register-ScheduledTask -TaskName "AssetFlowAgent" -Action $action -Trigger $trigger -RunLevel Highest -Force | Out-Null

    Write-Host "AssetFlow: enrolled successfully as $($response.assetId)"
}
`
}

/**
 * Windows doesn't run .ps1 files on double-click — it opens them in a text
 * editor instead (a deliberate security default, to stop people
 * accidentally running scripts). A .bat file doesn't have that problem:
 * double-clicking one runs it immediately. So this is what employees
 * actually download and double-click; it just fetches the real
 * PowerShell script from the server and executes it in memory.
 */
export function windowsLauncherBat(opts: { apiBase: string; token: string }) {
  const scriptUrl = `${opts.apiBase}/api/agent/installer/windows-script/${opts.token}`
  // Invoke-WebRequest instead of the older Net.WebClient — WebClient can
  // fail silently (return an empty string) in some Windows/PowerShell
  // configurations instead of throwing, which surfaced as a confusing
  // "Cannot bind argument to parameter 'Path'" error. This version checks
  // the response explicitly and prints a real diagnostic if it's empty.
  const psCommand =
    `& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ` +
    `try { $resp = Invoke-WebRequest -Uri '${scriptUrl}' -UseBasicParsing } ` +
    `catch { Write-Host ('AssetFlow: could not reach the server - ' + $_.Exception.Message); exit 1 }; ` +
    `if ([string]::IsNullOrWhiteSpace($resp.Content)) { Write-Host 'AssetFlow: server returned an empty response. Contact your IT team.'; exit 1 }; ` +
    `Invoke-Expression $resp.Content }`

  return `@echo off
echo AssetFlow: setting up this device...
powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"
if %errorlevel% neq 0 (
    echo AssetFlow: something went wrong. Contact your IT team.
    pause
) else (
    echo AssetFlow: done. This window will close in a moment.
    timeout /t 5 >nul
)
`
}

export function macInstallerScript(opts: { apiBase: string; token: string }) {
  return `#!/bin/bash
# AssetFlow Agent — macOS
# Collects basic hardware/system info and registers this machine in AssetFlow.
# Re-run safe: first run enrolls, every run after that just checks in.
set -e
API_BASE="${opts.apiBase}"
TOKEN="${opts.token}"
INSTALL_DIR="$HOME/Library/Application Support/AssetFlowAgent"
CONFIG_PATH="$INSTALL_DIR/config.json"
SCRIPT_PATH="$INSTALL_DIR/agent.sh"
PLIST_PATH="$HOME/Library/LaunchAgents/com.assetflow.agent.plist"

mkdir -p "$INSTALL_DIR"

HOSTNAME=$(scutil --get ComputerName 2>/dev/null || hostname)
MODEL=$(sysctl -n hw.model)
CPU=$(sysctl -n machdep.cpu.brand_string)
RAM_BYTES=$(sysctl -n hw.memsize)
RAM_GB=$(echo "scale=1; $RAM_BYTES / 1073741824" | bc)
OS_NAME=$(sw_vers -productName)
OS_VERSION=$(sw_vers -productVersion)
SERIAL=$(system_profiler SPHardwareDataType | awk -F': ' '/Serial Number/{print $2}' | xargs)
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
MAC=$(ifconfig en0 2>/dev/null | awk '/ether/{print $2}')
LOGGED_IN_USER=$(stat -f "%Su" /dev/console)
STORAGE_GB=$(( $(df -k / | tail -1 | awk '{print $2}') / 1048576 ))

HARDWARE_JSON=$(cat <<EOF
{
  "hostname": "$HOSTNAME",
  "deviceType": "laptop",
  "manufacturer": "Apple",
  "model": "$MODEL",
  "cpu": "$CPU",
  "ramGb": $RAM_GB,
  "storageGb": $STORAGE_GB,
  "os": "$OS_NAME $OS_VERSION",
  "serialNumber": "$SERIAL",
  "ipAddress": "$IP",
  "macAddress": "$MAC",
  "loggedInUser": "$LOGGED_IN_USER"
}
EOF
)

if [ -f "$CONFIG_PATH" ]; then
  EXISTING_ASSET_ID=$(grep -o '"assetId"[^,}]*' "$CONFIG_PATH" | cut -d'"' -f4)
  echo "AssetFlow: existing registration found (asset $EXISTING_ASSET_ID) — checking in, not enrolling as new."
  echo "AssetFlow: to force a fresh enrollment instead, delete $CONFIG_PATH first."
  DEVICE_KEY=$(grep -o '"deviceApiKey"[^,}]*' "$CONFIG_PATH" | cut -d'"' -f4)
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/api/agent/checkin" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer $DEVICE_KEY" \\
    -d "{\\"hardware\\": $HARDWARE_JSON}")
  if [ "$HTTP_CODE" != "200" ]; then
    echo "AssetFlow: check-in failed (HTTP $HTTP_CODE)"
    exit 1
  fi
  echo "AssetFlow: check-in OK ($EXISTING_ASSET_ID)"
else
  echo "AssetFlow: no existing registration on this machine — enrolling as a new device."
  RESPONSE=$(curl -s -w "\\n%{http_code}" -X POST "$API_BASE/api/agent/enroll" \\
    -H "Content-Type: application/json" \\
    -d "{\\"token\\": \\"$TOKEN\\", \\"platform\\": \\"mac\\", \\"hardware\\": $HARDWARE_JSON}")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "AssetFlow: enrollment failed (HTTP $HTTP_CODE): $BODY"
    exit 1
  fi
  echo "$BODY" > "$CONFIG_PATH"
  cp "$0" "$SCRIPT_PATH"
  chmod +x "$SCRIPT_PATH"

  cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.assetflow.agent</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$SCRIPT_PATH</string></array>
  <key>StartInterval</key><integer>1200</integer>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
PLIST
  launchctl load "$PLIST_PATH" 2>/dev/null || true
  echo "AssetFlow: enrolled successfully"
fi
`
}
