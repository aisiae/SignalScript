$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient

$windowClass = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ClassNameProperty, 'LiveCaptionsDesktopWindow')
$textId = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::AutomationIdProperty, 'CaptionsTextBlock')
$root = [Windows.Automation.AutomationElement]::RootElement
$exe = Join-Path $env:windir 'System32\LiveCaptions.exe'
$launched = $false
$textElement = $null
$last = $null

function Emit($found, $text) {
  [Console]::Out.WriteLine((@{ found = $found; text = $text } | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}

while ($true) {
  if (-not $textElement) {
    $window = $root.FindFirst('Children', $windowClass)
    if (-not $window -and -not $launched -and (Test-Path $exe)) { Start-Process $exe; $launched = $true; Start-Sleep -Seconds 3; continue }
    if ($window) { $textElement = $window.FindFirst('Descendants', $textId) }
    if (-not $textElement) { if ($last -ne '#none') { Emit $false ''; $last = '#none' }; Start-Sleep -Milliseconds 1000; continue }
  }
  try { $text = $textElement.Current.Name } catch { $textElement = $null; $launched = $false; continue }
  if ($text -ne $last) { Emit $true $text; $last = $text }
  Start-Sleep -Milliseconds 250
}
