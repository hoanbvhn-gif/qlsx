<#
================================================================
 SAO LUU HE THONG QLSX  —  chay tu dong hang ngay tren may 24/24
----------------------------------------------------------------
 Moi lan chay tao mot thu muc theo ngay, ben trong gom:
   database.sql   — ban dump day du, khoi phuc lai duoc 100%
   market\        — toan bo file thiet ke trong Storage
   csv\           — vai bang chinh dang CSV de mo bang Excel
   backup.log     — nhat ky lan chay

 May nay CHI GOI RA NGOAI toi Supabase. Khong can mo port vao.
================================================================
#>

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ---------- Nap cau hinh ----------
$thuMucScript = Split-Path -Parent $MyInvocation.MyCommand.Path
$fileCauHinh  = Join-Path $thuMucScript "config.ps1"
if (-not (Test-Path $fileCauHinh)) {
  Write-Host "THIEU FILE config.ps1 — hay copy config.example.ps1 thanh config.ps1 va dien thong tin." -ForegroundColor Red
  exit 1
}
. $fileCauHinh

# ---------- Chuan bi thu muc ----------
$ngay     = Get-Date -Format "yyyy-MM-dd"
$gio      = Get-Date -Format "HH:mm:ss"
$thuMuc   = Join-Path $Global:ThuMucLuu $ngay
$thuMucMk = Join-Path $thuMuc "market"
$thuMucCsv= Join-Path $thuMuc "csv"
New-Item -ItemType Directory -Force -Path $thuMuc, $thuMucMk, $thuMucCsv | Out-Null

$fileLog = Join-Path $thuMuc "backup.log"
function Ghi($msg, $mau = "Gray") {
  $dong = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg
  Write-Host $dong -ForegroundColor $mau
  Add-Content -Path $fileLog -Value $dong -Encoding UTF8
}

Ghi "===== BAT DAU SAO LUU QLSX — $ngay $gio =====" "Cyan"

# ---------- 1. DUMP DATABASE ----------
try {
  $pgDump = if ($Global:PgDump -and (Test-Path $Global:PgDump)) { $Global:PgDump } else { "pg_dump" }
  $fileSql = Join-Path $thuMuc "database.sql"

  Ghi "Dang dump database..."
  & $pgDump --dbname="$Global:ChuoiKetNoi" `
            --file="$fileSql" `
            --no-owner --no-privileges --clean --if-exists `
            --schema=public --schema=storage 2>&1 | ForEach-Object { Ghi "  pg_dump: $_" }

  if (Test-Path $fileSql) {
    $mb = [math]::Round((Get-Item $fileSql).Length / 1MB, 2)
    Ghi "Dump database xong — $mb MB" "Green"
  } else {
    throw "Khong tao duoc file database.sql"
  }
} catch {
  Ghi "LOI khi dump database: $_" "Red"
}

# ---------- 2. TAI FILE MARKET TU STORAGE ----------
$headers = @{
  "Authorization" = "Bearer $Global:ServiceKey"
  "apikey"        = $Global:ServiceKey
  "Content-Type"  = "application/json"
}

function Liet-Ke([string]$prefix) {
  $ket = @()
  $offset = 0
  do {
    $body = @{ prefix = $prefix; limit = 1000; offset = $offset
               sortBy = @{ column = "name"; order = "asc" } } | ConvertTo-Json -Depth 4
    $url  = "$Global:SupabaseUrl/storage/v1/object/list/$Global:TenBucket"
    $ds   = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body
    if (-not $ds) { break }
    foreach ($mt in $ds) {
      $duongDan = if ($prefix) { "$prefix/$($mt.name)" } else { $mt.name }
      if ($null -eq $mt.id) {
        $ket += Liet-Ke $duongDan            # la thu muc -> di sau vao trong
      } else {
        $ket += [pscustomobject]@{ Path = $duongDan; Size = $mt.metadata.size }
      }
    }
    $offset += 1000
  } while ($ds.Count -eq 1000)
  return $ket
}

try {
  Ghi "Dang liet ke file trong Storage..."
  $dsFile = Liet-Ke ""
  Ghi "Tim thay $($dsFile.Count) file"

  $tai = 0; $boQua = 0; $tongByte = 0
  foreach ($f in $dsFile) {
    $dich = Join-Path $thuMucMk ($f.Path -replace '/', '\')
    $thuMucCha = Split-Path -Parent $dich
    if (-not (Test-Path $thuMucCha)) { New-Item -ItemType Directory -Force -Path $thuMucCha | Out-Null }

    # Neu ban hom truoc da co file y het thi copy sang cho nhanh, khoi tai lai
    $homTruoc = Join-Path $Global:ThuMucLuu ((Get-Date).AddDays(-1).ToString("yyyy-MM-dd") + "\market\" + ($f.Path -replace '/', '\'))
    if ((Test-Path $homTruoc) -and ((Get-Item $homTruoc).Length -eq $f.Size)) {
      Copy-Item $homTruoc $dich -Force
      $boQua++
      continue
    }

    $url = "$Global:SupabaseUrl/storage/v1/object/$Global:TenBucket/$($f.Path)"
    Invoke-WebRequest -Uri $url -Headers @{ "Authorization" = "Bearer $Global:ServiceKey" } `
                      -OutFile $dich -UseBasicParsing
    $tai++; $tongByte += [int64]$f.Size
  }
  Ghi ("File Market: tai moi {0}, dung lai tu ban cu {1} — {2} MB" -f $tai, $boQua, [math]::Round($tongByte/1MB,1)) "Green"
} catch {
  Ghi "LOI khi tai file Market: $_" "Red"
}

# ---------- 3. XUAT CSV DE MO BANG EXCEL ----------
try {
  $psql = if ($Global:PgDump) { Join-Path (Split-Path -Parent $Global:PgDump) "psql.exe" } else { "psql" }
  if (Test-Path $psql) {
    $bang = @{
      "don-hang"      = "select * from public.v_tat_ca_don_hang order by order_date"
      "so-thu-tien"   = "select * from public.v_payment_ledger order by payment_date"
      "cong-no"       = "select * from public.v_cong_no_thuc order by so_ngay_no desc"
      "ma-hang"       = "select item_code, item_name, unit, list_price, status from public.items order by item_code"
      "khach-hang"    = "select * from public.v_customer_debt order by customer_code"
      "nhat-ky"       = "select created_at, table_name, action, note from public.audit_log order by created_at desc"
    }
    foreach ($ten in $bang.Keys) {
      $out = Join-Path $thuMucCsv "$ten.csv"
      $cmd = "\copy ($($bang[$ten])) to '$out' with (format csv, header true, encoding 'UTF8')"
      & $psql "$Global:ChuoiKetNoi" -c $cmd 2>&1 | Out-Null
    }
    Ghi "Xuat $($bang.Count) file CSV xong" "Green"
  } else {
    Ghi "Khong tim thay psql.exe — bo qua buoc xuat CSV" "Yellow"
  }
} catch {
  Ghi "LOI khi xuat CSV: $_" "Red"
}

# ---------- 4. DON BAN CU ----------
try {
  $moc = (Get-Date).AddDays(-$Global:GiuNgay)
  $mocThang = (Get-Date).AddMonths(-$Global:GiuThang)
  $xoa = 0
  Get-ChildItem $Global:ThuMucLuu -Directory | ForEach-Object {
    $d = $null
    if ([datetime]::TryParseExact($_.Name, "yyyy-MM-dd", $null, 'None', [ref]$d)) {
      $laBanDauThang = ($d.Day -eq 1)
      $quaHan = if ($laBanDauThang) { $d -lt $mocThang } else { $d -lt $moc }
      if ($quaHan) {
        Remove-Item $_.FullName -Recurse -Force
        $xoa++
      }
    }
  }
  Ghi "Da don $xoa ban sao cu (giu $Global:GiuNgay ngay, ban dau thang giu $Global:GiuThang thang)" "Green"
} catch {
  Ghi "LOI khi don ban cu: $_" "Red"
}

# ---------- 5. TONG KET ----------
$tongMb = [math]::Round(((Get-ChildItem $thuMuc -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB, 1)
$oCung  = Get-PSDrive -Name (Split-Path -Qualifier $Global:ThuMucLuu).TrimEnd(':')
$conLai = [math]::Round($oCung.Free / 1GB, 1)

Ghi "===== XONG — ban sao $tongMb MB — o cung con trong $conLai GB =====" "Cyan"

# Ghi dong tom tat vao file tong de de theo doi
$fileTong = Join-Path $Global:ThuMucLuu "lich-su-backup.txt"
Add-Content -Path $fileTong -Encoding UTF8 -Value (
  "{0}  |  {1} MB  |  o cung con {2} GB" -f $ngay, $tongMb, $conLai)
