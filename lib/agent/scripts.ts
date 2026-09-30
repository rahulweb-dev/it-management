/**
 * Generates the installer scripts employees run on their own machine.
 * Each installer is self-contained: first run enrolls the device (using
 * the one-time token) and installs a recurring check-in job; every run
 * after that just checks in using the saved device key. No compiled
 * binary, no runtime to install — just the OS's own scripting engine
 * (PowerShell on Windows, bash on Mac).
 *
 * These are written against standard, documented OS commands but were
 * authored without the ability to run them on real Windows/Mac hardware
 * — test on one machine of each OS before rolling out broadly.
 *
 * `token` is only ever interpolated after the installer route has checked
 * it against ENROLLMENT_TOKEN_PATTERN (hex only) — never pass anything
 * unvalidated in here, it lands inside shell source.
 */

// Shared by the Windows installer and the installed check-in job.
const WINDOWS_HARDWARE_FN = `function Get-HardwareInfo {
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
}`

/**
 * The recurring job the scheduled task runs: check-in only, with no
 * enrollment token inside (it's single-use and already spent by then).
 * The installer writes this to disk — the installer itself runs from
 * memory via the .bat launcher, so it has no file of its own to copy
 * ($PSCommandPath is empty), which is what used to break scheduling.
 */
function windowsAgentScript(apiBase: string) {
  return `# AssetFlow Agent - Windows (installed check-in job)
$ErrorActionPreference = "Stop"
$ApiBase = "${apiBase}"
$ConfigPath = "$env:ProgramData\\AssetFlowAgent\\config.json"

${WINDOWS_HARDWARE_FN}

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $($config.deviceApiKey)" }
$body = @{ hardware = (Get-HardwareInfo) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$ApiBase/api/agent/checkin" -Method Post -Body $body -ContentType "application/json" -Headers $headers | Out-Null`
}

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

${WINDOWS_HARDWARE_FN}

# Writes the check-in job to disk and schedules it every 20 minutes. Also
# run on re-install when either is missing: machines enrolled by an older
# installer never got their scheduled task.
function Install-Agent {
    # Single-quoted here-string: written to disk verbatim, nothing expanded.
    $agentScript = @'
${windowsAgentScript(opts.apiBase)}
'@
    Set-Content -Path $ScriptPath -Value $agentScript -Encoding UTF8

    try {
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \`"$ScriptPath\`""
        # Finite 10-year window: [TimeSpan]::MaxValue is rejected by newer
        # Windows builds. No -RunLevel Highest, which needs admin rights most
        # employees don't have — the task runs as the installing user.
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 20) -RepetitionDuration (New-TimeSpan -Days 3650)
        Register-ScheduledTask -TaskName "AssetFlowAgent" -Action $action -Trigger $trigger -Force | Out-Null
        Write-Host "AssetFlow: automatic check-ins scheduled every 20 minutes."
    } catch {
        Write-Host "AssetFlow: couldn't schedule automatic check-ins: $_"
        Write-Host "AssetFlow: ask your IT team to schedule $ScriptPath to run every 20 minutes."
    }
}

$hardware = Get-HardwareInfo

if (Test-Path $ConfigPath) {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    Write-Host "AssetFlow: existing registration found (asset $($config.assetId)) — checking in, not enrolling as new."
    Write-Host "AssetFlow: to force a fresh enrollment instead, delete $ConfigPath first."
    $body = @{ hardware = $hardware } | ConvertTo-Json -Depth 5
    $headers = @{ Authorization = "Bearer $($config.deviceApiKey)" }
    try {
        Invoke-RestMethod -Uri "$ApiBase/api/agent/checkin" -Method Post -Body $body -ContentType "application/json" -Headers $headers | Out-Null
        Write-Host "AssetFlow: check-in OK ($($config.assetId))"
    } catch {
        Write-Host "AssetFlow: check-in failed: $_"
        exit 1
    }
    if (-not (Test-Path $ScriptPath) -or -not (Get-ScheduledTask -TaskName "AssetFlowAgent" -ErrorAction SilentlyContinue)) {
        Install-Agent
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

    Install-Agent

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

# JSON-escape a value: a quote or backslash in e.g. the computer name
# used to produce invalid JSON and break enrollment/check-in.
json_escape() { printf '%s' "$1" | sed -e 's/\\\\/\\\\\\\\/g' -e 's/"/\\\\"/g' | tr -d '\\n\\r'; }

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
# MacBook* models are laptops; iMac, Mac mini, Mac Studio, Mac Pro are not.
case "$MODEL" in MacBook*) DEVICE_TYPE="laptop" ;; *) DEVICE_TYPE="desktop" ;; esac

HARDWARE_JSON=$(cat <<EOF
{
  "hostname": "$(json_escape "$HOSTNAME")",
  "deviceType": "$DEVICE_TYPE",
  "manufacturer": "Apple",
  "model": "$(json_escape "$MODEL")",
  "cpu": "$(json_escape "$CPU")",
  "ramGb": \${RAM_GB:-0},
  "storageGb": \${STORAGE_GB:-0},
  "os": "$(json_escape "$OS_NAME $OS_VERSION")",
  "serialNumber": "$(json_escape "$SERIAL")",
  "ipAddress": "$(json_escape "$IP")",
  "macAddress": "$(json_escape "$MAC")",
  "loggedInUser": "$(json_escape "$LOGGED_IN_USER")"
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
