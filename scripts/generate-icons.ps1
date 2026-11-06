param(
  [string]$OutputDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'public')
)

Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function New-RoundedPath {
  param([float]$X, [float]$Y, [float]$W, [float]$H, [float]$R)

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $R * 2
  $path.AddArc($X, $Y, $d, $d, 180, 90)
  $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
  $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
  $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-Icon {
  param(
    [int]$Size,
    [string]$Path,
    [ValidateSet('rounded', 'full', 'maskable')]
    [string]$Style = 'rounded'
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $scale = $Size / 512.0
  $offset = 0.0

  if ($Style -eq 'maskable') {
    $scale = $scale * 0.76
    $offset = ($Size - 512.0 * $scale) / 2.0
  }

  $graphics.TranslateTransform([float]$offset, [float]$offset)
  $graphics.ScaleTransform([float]$scale, [float]$scale)

  $rect = New-Object System.Drawing.Rectangle(0, 0, 512, 512)
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 129, 97, 255),
    [System.Drawing.Color]::FromArgb(255, 84, 54, 238),
    45.0
  )

  if ($Style -eq 'rounded') {
    $background = New-RoundedPath 0 0 512 512 112
    $graphics.FillPath($gradient, $background)
    $background.Dispose()
  }
  else {
    $graphics.FillRectangle($gradient, $rect)
  }

  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 32, 16, 92))
  $ghostBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(135, 255, 255, 255))
  $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
  $accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 124, 92, 255))
  $sparkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 255, 246, 196))

  $shadow = New-RoundedPath 112 166 196 78 39
  $graphics.FillPath($shadowBrush, $shadow)
  $shadow.Dispose()

  $ghost = New-RoundedPath 104 154 196 78 39
  $graphics.FillPath($ghostBrush, $ghost)
  $ghost.Dispose()

  $shadow2 = New-RoundedPath 176 256 244 132 41
  $graphics.FillPath($shadowBrush, $shadow2)
  $shadow2.Dispose()

  $card = New-RoundedPath 168 244 244 132 41
  $graphics.FillPath($whiteBrush, $card)
  $card.Dispose()

  $line = New-RoundedPath 204 292 172 21 10.5
  $graphics.FillPath($accentBrush, $line)
  $line.Dispose()

  $dot = New-RoundedPath 204 329 46 21 10.5
  $graphics.FillPath($accentBrush, $dot)
  $dot.Dispose()

  $points = New-Object 'System.Drawing.PointF[]' 8
  for ($i = 0; $i -lt 8; $i++) {
    $angle = ($i * 45 - 90) * [Math]::PI / 180
    $radius = if ($i % 2 -eq 0) { 38 } else { 12 }
    $points[$i] = New-Object System.Drawing.PointF(
      [float](410 + $radius * [Math]::Cos($angle)),
      [float](97 + $radius * [Math]::Sin($angle))
    )
  }
  $graphics.FillPolygon($sparkBrush, $points)

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $sparkBrush.Dispose()
  $accentBrush.Dispose()
  $whiteBrush.Dispose()
  $ghostBrush.Dispose()
  $shadowBrush.Dispose()
  $gradient.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-Icon -Size 512 -Path (Join-Path $OutputDir 'pwa-512x512.png') -Style rounded
New-Icon -Size 192 -Path (Join-Path $OutputDir 'pwa-192x192.png') -Style rounded
New-Icon -Size 512 -Path (Join-Path $OutputDir 'maskable-icon-512x512.png') -Style maskable
New-Icon -Size 180 -Path (Join-Path $OutputDir 'apple-touch-icon.png') -Style full
New-Icon -Size 64 -Path (Join-Path $OutputDir 'favicon-64.png') -Style rounded
New-Icon -Size 32 -Path (Join-Path $OutputDir 'favicon-32.png') -Style rounded

Write-Host "Ikonlar üretildi: $OutputDir"
