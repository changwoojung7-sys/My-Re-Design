[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $PSScriptRoot "..\public"
$srcDir = (Get-ChildItem -Path $publicDir -Directory | Where-Object { $_.Name -like "*아이폰*" -or $_.Name -like "*2.0*" })[0].FullName

$targets = @(
    @{
        Name = "6.5inch_1242x2688";
        Width = 1242;
        Height = 2688;
        Dir = (Join-Path $publicDir "AppStore_Screenshots_6.5inch_1242x2688")
    },
    @{
        Name = "6.1inch_1179x2556";
        Width = 1179;
        Height = 2556;
        Dir = (Join-Path $publicDir "AppStore_Screenshots_6.1inch_1179x2556")
    }
)

foreach ($target in $targets) {
    if (-not (Test-Path $target.Dir)) {
        New-Item -ItemType Directory -Path $target.Dir | Out-Null
    }
}

$files = Get-ChildItem -LiteralPath $srcDir | Where-Object { $_.Extension -match '\.(png|jpg|jpeg)$' }
Write-Host "총 $($files.Count)개 이미지 변환 시작 (6.5인치: 1242x2688, 6.1인치: 1179x2556)"

foreach ($target in $targets) {
    $tWidth = $target.Width
    $tHeight = $target.Height
    $outDir = $target.Dir
    $tName = $target.Name

    Write-Host "==> [$tName] ($tWidth x $tHeight) 생성 중..."

    foreach ($file in $files) {
        try {
            $img = [System.Drawing.Image]::FromFile($file.FullName)
            
            $destBitmap = New-Object System.Drawing.Bitmap($tWidth, $tHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            $destGraphics = [System.Drawing.Graphics]::FromImage($destBitmap)
            
            $destGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $destGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $destGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $destGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            
            # 앱 다크 배경색 (#0B1120)
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
            
            $destBitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
            
            $destGraphics.Dispose()
            $destBitmap.Dispose()
            $img.Dispose()
        } catch {
            Write-Error "실패 ($tName): $($file.Name) - $($_.Exception.Message)"
        }
    }
    Write-Host "[$tName] 변환 완료!"
}

Write-Host "모든 규격 이미지 일괄 변환이 완료되었습니다."
