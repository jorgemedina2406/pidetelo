param (
    [string]$SourcePath,
    [string]$AppDir
)

Add-Type -AssemblyName System.Drawing

function Generate-ResizedImage {
    param (
        [System.Drawing.Image]$SrcImage,
        [int]$Width,
        [int]$Height,
        [string]$DestPath
    )

    $destBitmap = New-Object System.Drawing.Bitmap($Width, $Height)
    $destBitmap.SetResolution(72, 72)
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Clean clear canvas (white or transparent)
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
    $graphics.DrawImage($SrcImage, $rect)

    $destBitmap.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $graphics.Dispose()
    $destBitmap.Dispose()
}

Write-Host "Processing $AppDir from $SourcePath..."
$resolvedSource = Resolve-Path $SourcePath
$src = [System.Drawing.Image]::FromFile($resolvedSource)

# 1. iOS AppIcon set
$iosDir = Join-Path $AppDir "ios\Runner\Assets.xcassets\AppIcon.appiconset"
if (Test-Path $iosDir) {
    Write-Host "Generating iOS icons in $iosDir..."
    Generate-ResizedImage $src 1024 1024 (Join-Path $iosDir "Icon-App-1024x1024@1x.png")
    Generate-ResizedImage $src 167 167 (Join-Path $iosDir "Icon-App-83.5x83.5@2x.png")
    Generate-ResizedImage $src 152 152 (Join-Path $iosDir "Icon-App-76x76@2x.png")
    Generate-ResizedImage $src 76 76 (Join-Path $iosDir "Icon-App-76x76@1x.png")
    Generate-ResizedImage $src 180 180 (Join-Path $iosDir "Icon-App-60x60@3x.png")
    Generate-ResizedImage $src 120 120 (Join-Path $iosDir "Icon-App-60x60@2x.png")
    Generate-ResizedImage $src 120 120 (Join-Path $iosDir "Icon-App-40x40@3x.png")
    Generate-ResizedImage $src 80 80 (Join-Path $iosDir "Icon-App-40x40@2x.png")
    Generate-ResizedImage $src 40 40 (Join-Path $iosDir "Icon-App-40x40@1x.png")
    Generate-ResizedImage $src 87 87 (Join-Path $iosDir "Icon-App-29x29@3x.png")
    Generate-ResizedImage $src 58 58 (Join-Path $iosDir "Icon-App-29x29@2x.png")
    Generate-ResizedImage $src 29 29 (Join-Path $iosDir "Icon-App-29x29@1x.png")
    Generate-ResizedImage $src 60 60 (Join-Path $iosDir "Icon-App-20x20@3x.png")
    Generate-ResizedImage $src 40 40 (Join-Path $iosDir "Icon-App-20x20@2x.png")
    Generate-ResizedImage $src 20 20 (Join-Path $iosDir "Icon-App-20x20@1x.png")
}

# 2. Android mipmaps
$androidRes = Join-Path $AppDir "android\app\src\main\res"
if (Test-Path $androidRes) {
    Write-Host "Generating Android icons in $androidRes..."
    Generate-ResizedImage $src 48 48 (Join-Path $androidRes "mipmap-mdpi\ic_launcher.png")
    Generate-ResizedImage $src 72 72 (Join-Path $androidRes "mipmap-hdpi\ic_launcher.png")
    Generate-ResizedImage $src 96 96 (Join-Path $androidRes "mipmap-xhdpi\ic_launcher.png")
    Generate-ResizedImage $src 144 144 (Join-Path $androidRes "mipmap-xxhdpi\ic_launcher.png")
    Generate-ResizedImage $src 192 192 (Join-Path $androidRes "mipmap-xxxhdpi\ic_launcher.png")
}

$src.Dispose()
Write-Host "Done for $AppDir!"

