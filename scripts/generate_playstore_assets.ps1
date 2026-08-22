Add-Type -AssemblyName System.Drawing

$publicDir = "C:\calamusAppBuild\MyReDesign_App\public"
$srcDir = (Get-ChildItem -LiteralPath $publicDir -Directory | Where-Object { $_.Name -like "*2.0*" -or $_.Name -like "*capture*" -or $_.Name -like "*iPhone*" })[0].FullName
$iconPath = Join-Path $publicDir "app-icon.png"

$playStoreDir = Join-Path $publicDir "GooglePlayStore_Assets"
$screenshotsDir = Join-Path $playStoreDir "Screenshots_Phone_1080x2400"

if (-not (Test-Path -LiteralPath $playStoreDir)) { New-Item -ItemType Directory -Path $playStoreDir | Out-Null }
if (-not (Test-Path -LiteralPath $screenshotsDir)) { New-Item -ItemType Directory -Path $screenshotsDir | Out-Null }

if (Test-Path -LiteralPath $iconPath) {
    $iconImg = [System.Drawing.Image]::FromFile($iconPath)
    $iconBitmap = [System.Drawing.Bitmap]::new(512, 512)
    $iconG = [System.Drawing.Graphics]::FromImage($iconBitmap)
    $iconG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $iconG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $iconG.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $iconG.DrawImage($iconImg, 0, 0, 512, 512)
    $iconBitmap.Save((Join-Path $playStoreDir "01_App_Icon_512x512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $iconG.Dispose()
    $iconBitmap.Dispose()
    $iconImg.Dispose()
}

$featBitmap = [System.Drawing.Bitmap]::new(1024, 500)
$featG = [System.Drawing.Graphics]::FromImage($featBitmap)
$featG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$featG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$rect = [System.Drawing.Rectangle]::new(0, 0, 1024, 500)
$brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, [System.Drawing.Color]::FromArgb(11, 17, 32), [System.Drawing.Color]::FromArgb(26, 16, 60), 45.0)
$featG.FillRectangle($brush, $rect)

if (Test-Path -LiteralPath $iconPath) {
    $iconImg = [System.Drawing.Image]::FromFile($iconPath)
    $featG.DrawImage($iconImg, 80, 120, 260, 260)
    $iconImg.Dispose()
}
$fontTitle = [System.Drawing.Font]::new("Segoe UI", 40, [System.Drawing.FontStyle]::Bold)
$fontSub = [System.Drawing.Font]::new("Segoe UI", 16, [System.Drawing.FontStyle]::Regular)
$textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$subBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(160, 175, 200))

$featG.DrawString("MyReDesign", $fontTitle, $textBrush, 370, 160)
$featG.DrawString("AI-Powered Lifestyle Routine OS", $fontSub, $subBrush, 375, 235)

$featBitmap.Save((Join-Path $playStoreDir "02_Feature_Graphic_1024x500.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$featG.Dispose()
$featBitmap.Dispose()

$files = Get-ChildItem -LiteralPath $srcDir | Where-Object { $_.Extension -match '\.(png|jpg|jpeg)$' }
$count = 0
foreach ($file in $files) {
    if ($count -ge 8) { break }
    $count = $count + 1
    
    $imgBytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $ms = [System.IO.MemoryStream]::new($imgBytes)
    $img = [System.Drawing.Image]::FromStream($ms)
    
    $destBitmap = [System.Drawing.Bitmap]::new(1080, 2400, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $destGraphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    $destGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $destGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $destGraphics.Clear([System.Drawing.Color]::FromArgb(11, 17, 32))
    
    $srcRatio = $img.Width / $img.Height
    $targetRatio = 1080 / 2400
    
    $destWidth = 1080
    $destHeight = 2400
    $destX = 0
    $destY = 0
    
    if ($srcRatio -gt $targetRatio) {
        $destHeight = [int](1080 / $srcRatio)
        $destY = [int]((2400 - $destHeight) / 2)
    } else {
        $destWidth = [int](2400 * $srcRatio)
        $destX = [int]((1080 - $destWidth) / 2)
    }
    
    $destRect = [System.Drawing.Rectangle]::new($destX, $destY, $destWidth, $destHeight)
    $destGraphics.DrawImage($img, $destRect)
    
    $seqName = "{0:D2}_{1}.png" -f $count, [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $outPath = Join-Path $screenshotsDir $seqName
    $destBitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $destGraphics.Dispose()
    $destBitmap.Dispose()
    $img.Dispose()
    $ms.Dispose()
}

Write-Host "Done! Google Play Store assets created."
