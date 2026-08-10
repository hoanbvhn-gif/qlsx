<#
================================================================
 KHOI PHUC HE THONG QLSX tu mot ban sao
----------------------------------------------------------------
 Dung khi Supabase hong / bi xoa / can dung lai tu dau.
 Cach dung:
   .\restore-qlsx.ps1 -Ngay 2026-08-10 -ChuoiKetNoiMoi "postgresql://..."

 CANH BAO: lenh nay GHI DE toan bo du lieu tren database dich.
================================================================
#>
param(
  [Parameter(Mandatory=$true)][string]$Ngay,
  [Parameter(Mandatory=$true)][string]$ChuoiKetNoiMoi
)

$ErrorActionPreference = "Stop"
$thuMucScript = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $thuMucScript "config.ps1")

$thuMuc  = Join-Path $Global:ThuMucLuu $Ngay
$fileSql = Join-Path $thuMuc "database.sql"

if (-not (Test-Path $fileSql)) {
  Write-Host "Khong tim thay $fileSql" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  Se khoi phuc ban sao ngay $Ngay" -ForegroundColor Yellow
Write-Host "  vao database: $($ChuoiKetNoiMoi -replace ':[^:@]+@', ':****@')" -ForegroundColor Yellow
Write-Host "  TOAN BO du lieu hien co tren database dich se bi ghi de." -ForegroundColor Red
Write-Host ""
$xacNhan = Read-Host "Go KHOIPHUC de xac nhan"
if ($xacNhan -ne "KHOIPHUC") { Write-Host "Da huy."; exit 0 }

$psql = if ($Global:PgDump) { Join-Path (Split-Path -Parent $Global:PgDump) "psql.exe" } else { "psql" }

Write-Host "Dang nap database..." -ForegroundColor Cyan
& $psql "$ChuoiKetNoiMoi" -f "$fileSql"

Write-Host ""
Write-Host "Nap database xong." -ForegroundColor Green
Write-Host ""
Write-Host "CON LAI PHAI LAM BANG TAY:" -ForegroundColor Yellow
Write-Host "  1. Tai lai file Market: thu muc $thuMuc\market"
Write-Host "     Vao Supabase moi > Storage > bucket designs > keo tha ca thu muc vao."
Write-Host "  2. Tao lai tai khoan dang nhap: Authentication > Users."
Write-Host "     (Ban dump giu bang public.users nhung khong giu mat khau trong auth.users)"
Write-Host "  3. Sua VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY trong GitHub Secrets"
Write-Host "     roi chay lai workflow de web tro sang database moi."
