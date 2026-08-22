[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $PSScriptRoot "..\public"
$srcDir = (Get-ChildItem -Path $publicDir -Directory | Where-Object { $_.Name -like "*아이폰*" -or $_.Name -like "*2.0*" })[0].FullName
$outDir = Join-Path $publicDir "AppStore_Screenshots_1290x2796"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$targetWidth = 1290
$targetHeight = 2796

$files = Get-ChildItem -LiteralPath $srcDir | Where-Object { $_.Extension -match '\.(png|jpg|jpeg)$' }

Write-Host "소스 폴더: $srcDir"
Write-Host "대상 폴더: $outDir"
Write-Host "총 $($files.Count)개 이미지 변환 시작 -> 1290x2796"

foreach ($file in $files) {
    try {
        $img = [System.Drawing.Image]::FromFile($file.FullName)
        
        $destBitmap = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $destGraphics = [System.Drawing.Graphics]::FromImage($destBitmap)
        
        $destGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $destGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $destGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $destGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        # 앱 기본 배경색으로 클리어
        $destGraphics.Clear([System.Drawing.Color]::FromArgb(11, 17, 32)) # #0B1120
        
        # 비율 유지하면서 꽉 채우기 (Fit with aspect ratio)
        $srcRatio = $img.Width / $img.Height
        $targetRatio = $targetWidth / $targetHeight
        
        $destWidth = $targetWidth
        $destHeight = $targetHeight
        $destX = 0
        $destY = 0
        
        if ($srcRatio -gt $targetRatio) {
            # 가로가 상대적으로 더 긴 경우
            $destHeight = [int]($targetWidth / $srcRatio)
            $destY = [int](($targetHeight - $destHeight) / 2)
        } else {
            # 세로가 상대적으로 더 긴 경우
            $destWidth = [int]($targetHeight * $srcRatio)
            $destX = [int](($targetWidth - $destWidth) / 2)
        }
        
        $destRect = New-Object System.Drawing.Rectangle($destX, $destY, $destWidth, $destHeight)
        $destGraphics.DrawImage($img, $destRect)
        
        $outName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name) + ".png"
        $outPath = Join-Path $outDir $outName
        
        $destBitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        $destGraphics.Dispose()
        $destBitmap.Dispose()
        $img.Dispose()
        
        Write-Host "변환 완료: $outName (1290x2796)"
    } catch {
        Write-Error "실패: $($file.Name) - $($_.Exception.Message)"
    }
}

Write-Host "모든 이미지 변환이 완료되었습니다."
