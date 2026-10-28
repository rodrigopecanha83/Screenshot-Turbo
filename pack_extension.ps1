$zipPath = "c:\Projetos\Extensoes-Chrome\ScreenShot-Turbo\ScreenShot-Turbo.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$allowedItems = @(
    "_locales",
    "manifest.json",
    "background",
    "capture",
    "content",
    "editor",
    "icons",
    "lib",
    "popup",
    "settings",
    "shared"
)

$fullPaths = $allowedItems | ForEach-Object { Join-Path "c:\Projetos\Extensoes-Chrome\ScreenShot-Turbo" $_ }
Compress-Archive -Path $fullPaths -DestinationPath $zipPath -Force
Write-Host "ZIP atualizado com sucesso! Tamanho:" (Get-Item $zipPath).Length "bytes"
