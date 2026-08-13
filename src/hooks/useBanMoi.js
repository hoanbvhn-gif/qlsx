import { useCallback, useEffect, useRef, useState } from 'react'
import { BUILD_NO } from '@/lib/version'

/**
 * TU PHAT HIEN CO BAN MOI TREN MAY CHU.
 *
 * Van de: GitHub Pages tra ve index.html kem chi dan cho phep trinh duyet
 * giu lai vai phut. Safari giu lau hon the. index.html cu tro toi file JS cu,
 * nen build da xong tu lau ma nguoi dung van chay ban cu — bam F5 cung khong an.
 *
 * Cach xu ly: hoi rieng file version.json (rat nho, khong ma bam trong ten,
 * kem tham so thoi gian + cache no-store nen chac chan lay ban tuoi).
 * Neu so build tren may chu khac so build dang chay -> bao nguoi dung tai lai.
 *
 * Kiem tra khi: mo app, moi 2 phut, va moi lan quay lai tab.
 */
const CHU_KY = 2 * 60 * 1000

export function useBanMoi() {
  const [banMoi, setBanMoi] = useState(null)   // so build tren may chu
  const dangChay = useRef(false)

  const kiemTra = useCallback(async () => {
    if (dangChay.current) return
    if (BUILD_NO === 'local') return           // chay tren may thi khoi kiem
    dangChay.current = true
    try {
      const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return
      const j = await res.json()
      if (j?.build && String(j.build) !== String(BUILD_NO)) setBanMoi(String(j.build))
    } catch {
      // Mat mang thi thoi, lan sau kiem lai
    } finally {
      dangChay.current = false
    }
  }, [])

  useEffect(() => {
    kiemTra()
    const t = setInterval(kiemTra, CHU_KY)
    const khiQuayLai = () => { if (document.visibilityState === 'visible') kiemTra() }
    document.addEventListener('visibilitychange', khiQuayLai)
    window.addEventListener('focus', kiemTra)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', khiQuayLai)
      window.removeEventListener('focus', kiemTra)
    }
  }, [kiemTra])

  return banMoi
}

/**
 * Tai lai that su: xoa cache cua trinh duyet cho trang nay roi nap lai
 * kem tham so chong cache. Khac han voi F5 thuong.
 */
export async function taiLaiSach() {
  try {
    if ('caches' in window) {
      const ten = await caches.keys()
      await Promise.all(ten.map(t => caches.delete(t)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
  } catch {
    // khong xoa duoc cung khong sao, van nap lai o duoi
  }
  const u = new URL(window.location.href)
  u.searchParams.set('v', Date.now().toString())
  window.location.replace(u.toString())
}
