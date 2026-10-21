Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 64, 128, 256, 512)
$targetDir = "c:\Projetos\Extensoes-Chrome\ScreenShot-Turbo\icons"
$masterIcon = Join-Path $targetDir "Icon.png"

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

if (Test-Path $masterIcon) {
    # Carrega imagem mestre via MemoryStream para nao travar o arquivo
    $fileBytes = [System.IO.File]::ReadAllBytes($masterIcon)
    $ms = New-Object System.IO.MemoryStream(,$fileBytes)
    $srcImg = [System.Drawing.Image]::FromStream($ms)

    foreach ($s in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap $s, $s
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.DrawImage($srcImg, 0, 0, $s, $s)

        $outPath = Join-Path $targetDir ("Icon" + $s + ".png")
        $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose()
        $bmp.Dispose()
    }

    $srcImg.Dispose()
    $ms.Dispose()
    Write-Host "Icons generated from master Icon.png successfully!"
} else {
    Write-Host "Master Icon.png not found in $targetDir"
}
