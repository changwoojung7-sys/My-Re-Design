Add-Type -AssemblyName System.Drawing

$publicDir = "C:\calamusAppBuild\MyReDesign_App\public"
$srcDir = (Get-ChildItem -LiteralPath $publicDir -Directory | Where-Object { $_.Name -like "*2.0*" -or $_.Name -like "*capture*" -or $_.Name -like "*iPhone*" })[0].FullName

$outAllDir = "C:\calamusAppBuild\MyReDesign_App\public\AppStore_Screenshots_1125x2436_ALL"
$outTop10Dir = "C:\calamusAppBuild\MyReDesign_App\public\AppStore_Screenshots_1125x2436_TOP10"

if (-not (Test-Path -LiteralPath $outAllDir)) { New-Item -ItemType Directory -Path $outAllDir | Out-Null }
if (-not (Test-Path -LiteralPath $outTop10Dir)) { New-Item -ItemType Directory -Path $outTop10Dir | Out-Null }

$tWidth = 1125
$tHeight = 2436

$files = Get-ChildItem -LiteralPath $srcDir | Where-Object { $_.Extension -match '\.(png|jpg|jpeg)$' }
Write-Host "Files count: $($files.Count)"

$count = 0
foreach ($file in $files) {
    $imgBytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $ms = [System.IO.MemoryStream]::new($imgBytes)
    $img = [System.Drawing.Image]::FromStream($ms)
    
    # 24-bit RGB (No alpha channel)
    $destBitmap = [System.Drawing.Bitmap]::new($tWidth, $tHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $destGraphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    
    $destGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $destGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $destGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $destGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $destGraphics.Clear([System.Drawing.Color]::FromArgb(11, 17, 32))
    
    $srcRatio = $img.Width / $img.Height
    $targetRatio = $tWidth / $tHeight
    
    $destWidth = $tWidth
    $destHeight = $tHeight
    $destX = 0
    $destY = 0
    
    if ($srcRatio -gt $targetRatio) {
        $destHeight = [int]($tWidth / $srcRatio)
        $destY = [int](($tHeight - $destHeight) / 2)
    } else {
        $destWidth = [int]($tHeight * $srcRatio)
        $destX = [int](($tWidth - $destWidth) / 2)
    }
    
    $destRect = [System.Drawing.Rectangle]::new($destX, $destY, $destWidth, $destHeight)
    $destGraphics.DrawImage($img, $destRect)
    
    $outName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name) + ".png"
    
    $allPath = Join-Path $outAllDir $outName
    if (Test-Path -LiteralPath $allPath) { Remove-Item -LiteralPath $allPath -Force }
    $destBitmap.Save($allPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    if ($count -lt 10) {
        $count = $count + 1
        $seqName = "{0:D2}_{1}" -f $count, $outName
        $top10Path = Join-Path $outTop10Dir $seqName
        if (Test-Path -LiteralPath $top10Path) { Remove-Item -LiteralPath $top10Path -Force }
        $destBitmap.Save($top10Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    
    $destGraphics.Dispose()
    $destBitmap.Dispose()
    $img.Dispose()
    $ms.Dispose()
}

Write-Host "Success! 1125x2436 conversion finished."
