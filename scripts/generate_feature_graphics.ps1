Add-Type -AssemblyName System.Drawing

$publicDir = "C:\calamusAppBuild\MyReDesign_App\public"
$srcDir = (Get-ChildItem -LiteralPath $publicDir -Directory | Where-Object { $_.Name -like "*2.0*" -or $_.Name -like "*capture*" -or $_.Name -like "*iPhone*" })[0].FullName
$iconPath = Join-Path $publicDir "app-icon.png"
$playStoreDir = Join-Path $publicDir "GooglePlayStore_Assets"

$w = 1024
$h = 500

$bmp1 = [System.Drawing.Bitmap]::new($w, $h)
$g1 = [System.Drawing.Graphics]::FromImage($bmp1)
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$rect = [System.Drawing.Rectangle]::new(0, 0, $w, $h)
$brushBg = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, [System.Drawing.Color]::FromArgb(10, 15, 30), [System.Drawing.Color]::FromArgb(35, 15, 65), 35.0)
$g1.FillRectangle($brushBg, $rect)

$brushGlow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(40, 120, 80, 255))
$g1.FillEllipse($brushGlow, 650, -50, 450, 450)
$brushGlow2 = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(35, 0, 210, 255))
$g1.FillEllipse($brushGlow2, 800, 150, 350, 350)

if (Test-Path -LiteralPath $iconPath) {
    $icon = [System.Drawing.Image]::FromFile($iconPath)
    $g1.DrawImage($icon, 80, 110, 280, 280)
    $icon.Dispose()
}

$fontTitle = [System.Drawing.Font]::new("Segoe UI", 44, [System.Drawing.FontStyle]::Bold)
$fontSub = [System.Drawing.Font]::new("Segoe UI", 20, [System.Drawing.FontStyle]::Bold)
$fontDesc = [System.Drawing.Font]::new("Segoe UI", 14, [System.Drawing.FontStyle]::Regular)

$brushTitle = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$brushAccent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(0, 220, 200))
$brushSub = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(180, 195, 220))

$g1.DrawString("MyReDesign", $fontTitle, $brushTitle, 390, 130)
$g1.DrawString("AI Habit & Lifestyle Routine OS", $fontSub, $brushAccent, 395, 215)
$g1.DrawString("Daily 3 Missions  |  1:1 Buddy Challenge  |  PlayMovie", $fontDesc, $brushSub, 395, 275)

$outPath1 = Join-Path $playStoreDir "02_Feature_Graphic_1024x500.png"
$outPathJpg = Join-Path $playStoreDir "02_Feature_Graphic_1024x500.jpg"

$bmp1.Save($outPath1, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp1.Save($outPathJpg, [System.Drawing.Imaging.ImageFormat]::Jpeg)

$g1.Dispose()
$bmp1.Dispose()

$bmp2 = [System.Drawing.Bitmap]::new($w, $h)
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$g2.FillRectangle($brushBg, $rect)

$todayImgPath = (Get-ChildItem -LiteralPath $srcDir | Where-Object { $_.Name -like "*Today*2.0*" -or $_.Name -like "*2.0*" })[0].FullName
if (Test-Path -LiteralPath $todayImgPath) {
    $screenImg = [System.Drawing.Image]::FromFile($todayImgPath)
    $g2.DrawImage($screenImg, 670, 30, 230, 470)
    $screenImg.Dispose()
}

if (Test-Path -LiteralPath $iconPath) {
    $icon2 = [System.Drawing.Image]::FromFile($iconPath)
    $g2.DrawImage($icon2, 70, 140, 160, 160)
    $icon2.Dispose()
}

$g2.DrawString("MyReDesign", $fontTitle, $brushTitle, 255, 140)
$g2.DrawString("AI Lifestyle Routine OS", $fontSub, $brushAccent, 260, 215)
$g2.DrawString("Design Your Daily Life with AI", $fontDesc, $brushSub, 260, 265)

$outPath2 = Join-Path $playStoreDir "02_Feature_Graphic_1024x500_Mockup.png"
$bmp2.Save($outPath2, [System.Drawing.Imaging.ImageFormat]::Png)

$g2.Dispose()
$bmp2.Dispose()

Write-Host "Success! 1024x500 Feature Graphics generated."
