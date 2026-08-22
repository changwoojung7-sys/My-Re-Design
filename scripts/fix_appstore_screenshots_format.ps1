[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $PSScriptRoot "..\public"
$srcDir = (Get-ChildItem -Path $publicDir -Directory | Where-Object { $_.Name -like "*아이폰*" -or $_.Name -like "*2.0*" })[0].FullName

# App Store Connect 필수 규격들 (알파 채널 없는 24비트 RGB PNG 및 고화질 JPG 동시 생성)
$targets = @(
    @{
        Name = "6.7inch_1290x2796";
        Width = 1290;
        Height = 2796;
        Dir = (Join-Path $publicDir "AppStore_Screenshots_1290x2796")
    },
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

# JPEG 인코더 설정 (품질 95%)
$jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatID -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]95)

$files = Get-ChildItem -LiteralPath $srcDir | Where-Object { $_.Extension -match '\.(png|jpg|jpeg)$' }
Write-Host "총 $($files.Count)개 이미지 -> Apple No-Alpha 24비트 PNG 및 JPG 변환 시작"

foreach ($target in $targets) {
    $tWidth = $target.Width
    $tHeight = $target.Height
    $outDir = $target.Dir
    $tName = $target.Name

    if (-not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Path $outDir | Out-Null
    }

    Write-Host "==> [$tName] ($tWidth x $tHeight) 24비트 RGB (알파 제거) 변환 중..."

    foreach ($file in $files) {
        try {
            $img = [System.Drawing.Image]::FromFile($file.FullName)
            
            # ⭐ 핵심: Format24bppRgb 사용 (App Store는 알파 채널/투명도가 있으면 업로드 거부됨)
            $destBitmap = New-Object System.Drawing.Bitmap($tWidth, $tHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
            $destGraphics = [System.Drawing.Graphics]::FromImage($destBitmap)
            
            $destGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $destGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $destGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $destGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            
            # 앱 다크 배경색 (#0B1120) 채우기 (알파 없이 100% 불투명)
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
            
            # 1. 24비트 무알파 PNG 저장
            $pngName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name) + ".png"
            $pngPath = Join-Path $outDir $pngName
            $destBitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

            # 2. JPG 버전도 함께 저장 (가장 안전하게 100% 업로드 지원)
            $jpgName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name) + ".jpg"
            $jpgPath = Join-Path $outDir $jpgName
            $destBitmap.Save($jpgPath, $jpegEncoder, $encoderParams)
            
            $destGraphics.Dispose()
            $destBitmap.Dispose()
            $img.Dispose()
        } catch {
            Write-Error "실패 ($tName): $($file.Name) - $($_.Exception.Message)"
        }
    }
    Write-Host "[$tName] 완료!"
}

Write-Host "모든 스크린샷 알파 채널 제거 및 24-bit PNG / JPG 변환 완료!"
