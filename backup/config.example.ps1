# ============================================================
#  CAU HINH SAO LUU QLSX
#  Copy file nay thanh  config.ps1  roi dien thong tin that.
#  KHONG dua config.ps1 len GitHub — trong do co mat khau.
# ============================================================

# --- 1. Noi luu ban sao ---
$Global:ThuMucLuu = "D:\QLSX-Backup"

# --- 2. Chuoi ket noi Postgres ---
# Lay tai: Supabase Dashboard > nut Connect (tren cung)
#          > tab "Session pooler"  > copy URI
# Dang:  postgresql://postgres.xxxx:MATKHAU@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
# LUU Y: phai dung Session pooler (cong 5432), khong dung Transaction pooler (6543).
$Global:ChuoiKetNoi = "postgresql://postgres.bdbyahzzfdmbtfxtrtuy:MAT_KHAU_DATABASE@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

# --- 3. Thong tin Storage (de tai file thiet ke Market) ---
$Global:SupabaseUrl = "https://bdbyahzzfdmbtfxtrtuy.supabase.co"

# service_role key — lay tai: Settings > API Keys > tab Legacy > service_role
# KHOA NAY RAT MANH: bo qua moi phan quyen. Chi de tren may nay, khong gui cho ai.
$Global:ServiceKey = "DAN_SERVICE_ROLE_KEY_VAO_DAY"

$Global:TenBucket = "designs"

# --- 4. Giu ban sao bao lau ---
$Global:GiuNgay = 30      # giu ban hang ngay trong 30 ngay
$Global:GiuThang = 24     # ban dau moi thang giu 24 thang

# --- 5. Duong dan pg_dump (de trong neu da co trong PATH) ---
$Global:PgDump = "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
