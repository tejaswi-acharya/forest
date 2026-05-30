param(
  [string]$DeviceSerial = ""
)

$ErrorActionPreference = "Stop"

function Get-AdbLevel {
  param([string]$Serial)

  $adbArgs = @()
  if ($Serial) {
    $adbArgs += @("-s", $Serial)
  }

  $output = & adb @adbArgs shell dumpsys battery 2>$null
  if (-not $output) {
    throw "No adb battery output. Make sure the phone is connected and USB debugging / wireless debugging is enabled."
  }

  $level = [regex]::Match(($output | Out-String), '(?m)^\s*level:\s*(\d+)').Groups[1].Value
  $scale = [regex]::Match(($output | Out-String), '(?m)^\s*scale:\s*(\d+)').Groups[1].Value

  if (-not $level -or -not $scale) {
    throw "Could not parse battery level from adb output."
  }

  return [math]::Round(([double]$level / [double]$scale) * 100, 0)
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw "adb not found. Install Android platform-tools and add adb to PATH."
}

$serial = $DeviceSerial
if (-not $serial) {
  $deviceLine = (& adb devices | Select-String -Pattern '\sdevice$' | Select-Object -First 1)
  if ($deviceLine) {
    $serial = ($deviceLine -split '\s+')[0]
  }
}

if (-not $serial) {
  throw "No connected adb device found. Use adb connect <ip>:5555 first, then rerun this script."
}

$battery = Get-AdbLevel -Serial $serial
Write-Host "$battery"