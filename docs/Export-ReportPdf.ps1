param(
    [string]$MarkdownPath = "$PSScriptRoot\PayFlow-Complete-Project-Report.md",
    [string]$HtmlPath = "$PSScriptRoot\PayFlow-Complete-Project-Report.html",
    [string]$PdfPath = "$PSScriptRoot\PayFlow-Complete-Project-Report.pdf"
)

function Escape-Html([string]$value) {
    return [System.Net.WebUtility]::HtmlEncode($value)
}

function Convert-InlineMarkdown([string]$value) {
    $encoded = Escape-Html $value
    $encoded = [regex]::Replace($encoded, '`([^`]+)`', '<code>$1</code>')
    $encoded = [regex]::Replace($encoded, '\*\*([^*]+)\*\*', '<strong>$1</strong>')
    return $encoded
}

$lines = Get-Content -LiteralPath $MarkdownPath
$body = New-Object System.Collections.Generic.List[string]
$inCode = $false
$codeBuffer = New-Object System.Collections.Generic.List[string]
$inList = $false
$inTable = $false

function Close-List {
    if ($script:inList) {
        $script:body.Add('</ul>')
        $script:inList = $false
    }
}

function Close-Table {
    if ($script:inTable) {
        $script:body.Add('</tbody></table>')
        $script:inTable = $false
    }
}

foreach ($line in $lines) {
    if ($line -like '```*') {
        if ($inCode) {
            $body.Add('<pre><code>' + (Escape-Html (($codeBuffer -join "`n").TrimEnd())) + '</code></pre>')
            $codeBuffer.Clear()
            $inCode = $false
        } else {
            Close-List
            Close-Table
            $inCode = $true
        }
        continue
    }

    if ($inCode) {
        $codeBuffer.Add($line)
        continue
    }

    if ($line.Trim() -eq '\pagebreak') {
        Close-List
        Close-Table
        $body.Add('<div class="pagebreak"></div>')
        continue
    }

    if ($line.Trim() -eq '') {
        Close-List
        Close-Table
        continue
    }

    if ($line -match '^\|(.+)\|$') {
        Close-List
        $cells = $line.Trim('|').Split('|') | ForEach-Object { (Convert-InlineMarkdown $_.Trim()) }
        $isDivider = $true
        foreach ($cell in $cells) {
            if ($cell -notmatch '^:?-{3,}:?$') { $isDivider = $false }
        }
        if ($isDivider) { continue }
        if (-not $inTable) {
            $body.Add('<table><tbody>')
            $inTable = $true
        }
        $tag = if ($body[$body.Count - 1] -eq '<table><tbody>') { 'th' } else { 'td' }
        $body.Add('<tr>' + (($cells | ForEach-Object { "<$tag>$_</$tag>" }) -join '') + '</tr>')
        continue
    } else {
        Close-Table
    }

    if ($line -match '^(#{1,6})\s+(.+)$') {
        Close-List
        $level = $matches[1].Length
        $text = Convert-InlineMarkdown $matches[2]
        $body.Add("<h$level>$text</h$level>")
        continue
    }

    if ($line -match '^\s*[-*]\s+(.+)$') {
        Close-Table
        if (-not $inList) {
            $body.Add('<ul>')
            $inList = $true
        }
        $body.Add('<li>' + (Convert-InlineMarkdown $matches[1]) + '</li>')
        continue
    }

    Close-List
    $body.Add('<p>' + (Convert-InlineMarkdown $line) + '</p>')
}

Close-List
Close-Table

$html = @"
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>PayFlow Complete Project Report</title>
<style>
@page { size: A4; margin: 0.7in; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.42; color: #111827; }
h1 { font-size: 24pt; border-bottom: 2px solid #111827; padding-bottom: 8px; }
h2 { font-size: 18pt; margin-top: 28px; border-bottom: 1px solid #d1d5db; padding-bottom: 5px; }
h3 { font-size: 14pt; margin-top: 18px; }
h4 { font-size: 12pt; margin-top: 14px; }
p { margin: 6px 0; }
table { border-collapse: collapse; width: 100%; margin: 10px 0 16px; font-size: 9pt; }
th, td { border: 1px solid #d1d5db; padding: 5px 7px; vertical-align: top; }
th { background: #f3f4f6; font-weight: 700; }
pre { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; white-space: pre-wrap; font-size: 8.5pt; }
code { font-family: Consolas, monospace; color: #0f172a; }
.pagebreak { page-break-after: always; }
</style>
</head>
<body>
$($body -join "`n")
</body>
</html>
"@

Set-Content -LiteralPath $HtmlPath -Value $html -Encoding UTF8

$word = $null
$doc = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Open((Resolve-Path -LiteralPath $HtmlPath).Path)
    $formatPdf = 17
    $doc.SaveAs([ref]$PdfPath, [ref]$formatPdf)
} finally {
    if ($doc -ne $null) { $doc.Close([ref]$false) | Out-Null }
    if ($word -ne $null) { $word.Quit() | Out-Null }
    if ($doc -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null }
    if ($word -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

Write-Output "HTML: $HtmlPath"
Write-Output "PDF:  $PdfPath"
