Add-Type -AssemblyName System.Drawing

$srcIcon = "C:\calamusAppBuild\MyReDesign_App\public\app-icon.png"
$expoAssets = "C:\calamusAppBuild\MyReDesign_App\MyReDesign-Expo\assets"

$img = [System.Drawing.Image]::FromFile($srcIcon)
Write-Host "원본 아이콘 크기: $($img.Width) x $($img.Height)"

$targetSize = 1024
$bitmap = New-Object System.Drawing.Bitmap($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.DrawImage($img, 0, 0, $targetSize, $targetSize)

# 모든 Expo 아이콘 및 스플래시 에셋 교체
$bitmap.Save((Join-Path $expoAssets "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Save((Join-Path $expoAssets "splash.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Save((Join-Path $expoAssets "splash-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Save((Join-Path $expoAssets "android-icon-foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Save((Join-Path $expoAssets "adaptive-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Save((Join-Path $expoAssets "favicon.png"), [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bitmap.Dispose()
$img.Dispose()

Write-Host "Expo assets 폴더 아이콘 교체 완료!"
