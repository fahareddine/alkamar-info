# fetch_images.ps1 — Scrape galerie Amazon.fr pour chaque ASIN
# Usage: powershell -ExecutionPolicy Bypass -File scripts\fetch_images.ps1
# Exécuter en LOCAL depuis le dossier alkamar-info

$asins = Get-Content scripts\asins.json | ConvertFrom-Json

$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
$headers = @{
  'Accept-Language' = 'fr-FR,fr;q=0.9'
  'Accept' = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  'Referer' = 'https://www.google.fr/'
}

foreach ($cat in $asins.PSObject.Properties) {
  foreach ($prod in $cat.Value.PSObject.Properties) {
    $slug = $prod.Name
    $asin = $prod.Value
    if (-not $asin) { continue }

    Write-Host "`n→ $slug ($asin)"
    Start-Sleep -Seconds (2 + (Get-Random -Maximum 3))

    try {
      $html = (Invoke-WebRequest -Uri "https://www.amazon.fr/dp/$asin" -UserAgent $ua -Headers $headers -TimeoutSec 15 -UseBasicParsing).Content
      $images = @()

      # hiRes dans JSON
      $matches = [regex]::Matches($html, '"hiRes"\s*:\s*"(https://m\.media-amazon\.com/images/I/[^"]+\.jpg)"')
      foreach ($m in $matches) {
        $url = $m.Groups[1].Value -replace '\._[A-Z]{2}[A-Z0-9,_]*_\.', '.'
        if ($images -notcontains $url) { $images += $url }
      }

      # large dans JSON
      if ($images.Count -lt 3) {
        $matches = [regex]::Matches($html, '"large"\s*:\s*"(https://m\.media-amazon\.com/images/I/[^"]+\.jpg)"')
        foreach ($m in $matches) {
          $url = $m.Groups[1].Value -replace '\._[A-Z]{2}[A-Z0-9,_]*_\.', '.'
          if ($images -notcontains $url) { $images += $url }
        }
      }

      # data-old-hires
      if ($images.Count -lt 3) {
        $matches = [regex]::Matches($html, 'data-old-hires="(https://m\.media-amazon\.com/images/I/[^"]+\.jpg)"')
        foreach ($m in $matches) {
          $url = $m.Groups[1].Value -replace '\._[A-Z]{2}[A-Z0-9,_]*_\.', '.'
          if ($images -notcontains $url) { $images += $url }
        }
      }

      $images = $images | Select-Object -First 3

      if ($images.Count -eq 0) {
        Write-Host "  ✗ Aucune image trouvée"
      } else {
        Write-Host "  ✓ $($images.Count) image(s)"
        $i = 1
        foreach ($img in $images) { Write-Host "    [$i] $img"; $i++ }
      }
    } catch {
      Write-Host "  ✗ Erreur: $_"
    }
  }
}
