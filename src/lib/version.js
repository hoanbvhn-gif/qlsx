/**
 * Thong tin phien ban ban dung.
 * Cac ten __BUILD_NO__ / __COMMIT__ / __BUILD_TIME__ duoc Vite thay the
 * bang gia tri that luc build (xem muc define trong vite.config.js).
 * Chay o may (npm run dev) thi cung co gia tri, chi khac la BUILD_NO = 'local'.
 */
/* eslint-disable no-undef */
export const APP_VERSION = '1.0'
export const BUILD_NO   = typeof __BUILD_NO__   !== 'undefined' ? __BUILD_NO__   : 'local'
export const COMMIT     = typeof __COMMIT__     !== 'undefined' ? __COMMIT__     : ''
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString()

/** '10/08 09:15' theo giờ Việt Nam */
export function buildTimeVN() {
  const d = new Date(BUILD_TIME)
  if (isNaN(d.getTime())) return '--'
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh'
  })
}

/** 'v1.0 · build 23 · 10/08 09:15' */
export function versionLabel() {
  const build = (BUILD_NO && BUILD_NO !== 'local') ? `build ${BUILD_NO}` : 'bản máy'
  return `v${APP_VERSION} · ${build} · ${buildTimeVN()}`
}
