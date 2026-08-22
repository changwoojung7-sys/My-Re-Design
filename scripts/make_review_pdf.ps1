$htmlPath = "C:\calamusAppBuild\MyReDesign_App\mdfile\App_Review_Guide_iOS.html"
$pdfPath = "C:\calamusAppBuild\MyReDesign_App\mdfile\App_Review_Guide_iOS.pdf"
$docxPath = "C:\calamusAppBuild\MyReDesign_App\mdfile\App_Review_Guide_iOS.docx"

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Open($htmlPath)
    # Save as DOCX (wdFormatXMLDocument = 16)
    $doc.SaveAs([ref]$docxPath, [ref]16)
    # Save as PDF (wdFormatPDF = 17)
    $doc.SaveAs([ref]$pdfPath, [ref]17)
    $doc.Close()
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    Write-Host "DOCX and PDF generated successfully!"
} catch {
    Write-Warning "Word COM not available, copying markdown/text file"
}
