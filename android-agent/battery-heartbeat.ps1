param(
  [string]$DeviceSerial = "",
  [string]$ServerUrl = "http://localhost:3000/api/camera-data",
  [string]$CameraId = "cam_01",
  [string]$CameraSecret = "forestguard-dev-secret",
  [int]$IntervalSeconds = 8
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw "adb not found. Install Android platform-tools and add adb to PATH."
}

function Get-BatteryPercent {
  param([string]$Serial)

  $adbArgs = @()
  if ($Serial) {
    $adbArgs += @("-s", $Serial)
  }

  $output = & adb @adbArgs shell dumpsys battery 2>$null | Out-String
  if (-not $output) {
    throw "No adb battery output. Enable USB debugging or wireless debugging on the phone."
  }

  $levelMatch = [regex]::Match($output, '(?m)^\s*level:\s*(\d+)')
  $scaleMatch = [regex]::Match($output, '(?m)^\s*scale:\s*(\d+)')
  if (-not $levelMatch.Success -or -not $scaleMatch.Success) {
    throw "Could not parse battery level from adb output."
  }

  $level = [double]$levelMatch.Groups[1].Value
  $scale = [double]$scaleMatch.Groups[1].Value
  return [math]::Round(($level / $scale) * 100, 0)
}

if (-not $DeviceSerial) {
  $deviceLine = (& adb devices | Select-String -Pattern '\sdevice$' | Select-Object -First 1)
  if ($deviceLine) {
    $DeviceSerial = ($deviceLine -split '\s+')[0]
  }
}

if (-not $DeviceSerial) {
  throw "No adb device detected. Use adb connect <phone-ip>:5555 or plug in USB debugging, then rerun."
}

Write-Host "Using device: $DeviceSerial"
Write-Host "Sending battery heartbeats to: $ServerUrl"

while ($true) {
  $battery = Get-BatteryPercent -Serial $DeviceSerial
  $payload = @{ 
    camera_id = $CameraId
    detections = @()
    battery = $battery
    battery_source = "phone"
    timestamp = ([DateTime]::UtcNow.ToString("o"))
    source = "real"
  } | ConvertTo-Json -Depth 5

  $headers = @{ "x-camera-secret" = $CameraSecret; "Content-Type" = "application/json" }

  try {
    Invoke-RestMethod -Method Post -Uri $ServerUrl -Headers $headers -Body $payload | Out-Null
    Write-Host "[$(Get-Date -Format HH:mm:ss)] battery=$battery% posted for $CameraId"
  } catch {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] post failed: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds $IntervalSeconds
}