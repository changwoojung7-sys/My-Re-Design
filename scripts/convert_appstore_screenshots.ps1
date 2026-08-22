[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $PSScriptRoot "..\public"
$srcDir = (Get-ChildItem -Path $publicDir -Directory | Where-Object { $_.Name -like "*아이폰*" -or $_.Name -like "*2.0*" })[0].FullName

$targets = @(
    [PSCustomObject]@{ Name = "6.7inch_1290x2796"; Width = 1290; Height = 2796; Dir = (Join-Path $publicDir "AppStore_Screenshots_6.7inch_1290x2796") },
    [PSCustomObject]@{ Name = "6.5inch_1242x2688"; Width = 1242; Height = 2688; Dir = (Join-Path $publicDir "AppStore_Screenshots_6.5inch_1242x2688") },
    [PSCustomObject]@{ Name = "6.1inch_1179x2556"; Width = 1179; Height = 2556; Dir = (Join-Path $publicDir "AppStore_Screenshots_6.1inch_1179x2556") }
)

$files = Get-ChildItem -LiteralPath $srcDir | Where-Object { $_.Extension -match '\.(png|jpg|jpeg)$' }
Write-Host "총 $($files.Count)개 원본 이미지 발견"

foreach ($target in $targets) {
    $tWidth = $target.Width
    $tHeight = $target.Height
    $outDir = $target.Dir
    $tName = $target.Name

    if (-not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Path $outDir | Out-Null
    }

    Write-Host "==> [$tName] ($tWidth x $tHeight) 24-bit PNG 변환 중..."

    foreach ($file in $files) {
        $imgBytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $ms = New-Object System.IO.MemoryStream($imgBytes, 0, $imgBytes.Length)
        $img = [System.Drawing.Image]::FromStream($ms)
        
        # 24비트 RGB 비트맵 (알파 채널 완전 제거)
        $destBitmap = New-Object System.Drawing.Bitmap($tWidth, $tHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        $destGraphics = [System.Drawing.Graphics]::FromImage($destBitmap)
        
        $destGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $destGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $destGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $destGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        # 앱 기본 배경색으로 채우기
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
        
        $destRect = New-Object System.Drawing.Rectangle($destX, $destY, $destWidth, $destHeight)
        $destGraphics.DrawImage($img, $destRect)
        
        $outName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name) + ".png"
        $outPath = Join-Path $outDir $outName
        
        $outMs = New-Object System.IO.MemoryStream
        $destBitmap.Save($outMs, [System.Drawing.Imaging.ImageFormat]::Png)
        [System.IO.File]::WriteAllBytes($outPath, $outMs.ToArray())
        $outMs.Dispose()
        
        $destGraphics.Dispose()
        $destBitmap.Dispose()
        $img.Dispose()
        $ms.Dispose()
    }
    Write-Host "[$tName] 변환 완료! ($((Get-ChildItem $outDir).Count)개 파일)"
}

Write-Host "완료되었습니다."
