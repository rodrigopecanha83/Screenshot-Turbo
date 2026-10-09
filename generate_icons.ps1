Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)
$targetDir = "c:\Projetos\Extensoes-Chrome\ScreenShot-Turbo\icons"

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 2, 132, 199))
    $rect = New-Object System.Drawing.Rectangle 0, 0, $s, $s
    $g.FillEllipse($brush, $rect)

    $penWidth = [Math]::Max(1.0, [float]($s / 12.0))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $penWidth
    $innerSize = [int]($s * 0.45)
    $innerPos = [int](($s - $innerSize) / 2)
    $g.DrawEllipse($pen, $innerPos, $innerPos, $innerSize, $innerSize)

    $outPath = Join-Path $targetDir ("icon" + $s + ".png")
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

Write-Host "Icons generated successfully!"
