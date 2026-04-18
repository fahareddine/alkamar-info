$asins = @(
  @{a='B0F6T9V2NN'; l='Dell Latitude 5420 i5-1135G7 32GB 512GB reco'},
  @{a='B0G1C334YW'; l='Dell OptiPlex 7060 Mini i7-8700T 16GB 240GB reco'}
)
foreach ($p in $asins) {
  try {
    $ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    $h = (Invoke-WebRequest -Uri "https://www.amazon.fr/dp/$($p.a)" -UserAgent $ua -TimeoutSec 10 -UseBasicParsing).Content
    $m = [regex]::Match($h, 'hiRes\":\"(https://m\.media-amazon\.com/images/I/[^\"]+)\"')
    if (-not $m.Success) { $m = [regex]::Match($h, 'data-old-hires=\"(https://m\.media-amazon\.com/images/I/[^\"]+)\"') }
    if ($m.Success) { Write-Host "$($p.l) ($($p.a)): $($m.Groups[1].Value)" }
    else { Write-Host "$($p.l) ($($p.a)): NOT FOUND" }
  } catch { Write-Host "$($p.l) ($($p.a)): ERROR" }
}
