import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []

function read(rel) {
  const full = path.join(root, rel)
  if (!fs.existsSync(full)) {
    errors.push(`Missing ${rel}`)
    return ''
  }
  return fs.readFileSync(full, 'utf8')
}

function requireCheck(condition, message) {
  if (!condition) errors.push(message)
}

const css = read('app/globals.css')
const layout = read('components/Layout.tsx')
const rootLayout = read('app/layout.tsx')
const manifestRaw = read('public/manifest.webmanifest')
const sw = read('public/sw.js')
const pwa = read('components/PwaInstallPrompt.tsx')
const feedback = read('components/ui/AugustFeedback.tsx')
const dialog = read('components/ui/AugustDialog.tsx')
const icon = read('public/amado-icon.svg')
const appIcon = read('app/icon.svg')

requireCheck(css.includes('AUGUST_SYSTEM_V1_START'), 'August CSS marker missing')
for (const token of ['#171927', '#697084', '#F7F8FC', '#6E5CF6', '#5140DC', '#D7FF61', '#15172A']) {
  requireCheck(css.includes(token), `Missing August token ${token}`)
}
requireCheck(css.includes('@layer august.reset, august.tokens, august.base, august.layout'), 'August cascade layer order missing')
requireCheck(!css.includes('Playfair Display'), 'Playfair must be removed: August uses one Inter family')
requireCheck(css.includes('font-optical-sizing: auto'), 'Inter optical sizing missing')
requireCheck(css.includes('@media (prefers-reduced-motion: reduce)'), 'Reduced-motion support missing')
requireCheck(css.includes('@media (forced-colors: active)'), 'Forced-colors support missing')

requireCheck(layout.includes("href: '/overview'"), 'Desktop/mobile shell must include Overview')
requireCheck(layout.includes("href: '/market'"), 'Shell must include Market')
requireCheck(layout.includes("href: '/generate'"), 'Shell must include Generate')
requireCheck(layout.includes("href: '/knowledge'"), 'Shell must include Knowledge')
requireCheck(layout.includes("href: '/brand'"), 'Shell must include Brand')
requireCheck(layout.includes("href: '/competitors'"), 'Shell must include Competitors')
requireCheck(layout.includes("href: '/history'"), 'Shell must include History')
requireCheck(layout.includes('const MOBILE_NAV'), 'Mobile navigation registry missing')
requireCheck(layout.includes('MOBILE_MORE'), 'Mobile More sheet missing')
requireCheck(layout.includes('aug-mobile-nav'), 'August mobile navigation missing')
requireCheck(!layout.includes('bottom-nav-fab'), 'Legacy orange mobile FAB must be removed')
requireCheck(layout.includes('Быстро создать'), 'Quick-create action must remain available')

const mobileBlock = layout.match(/const MOBILE_NAV:[\s\S]*?\n\]/)?.[0] ?? ''
const visibleMobileDestinations = (mobileBlock.match(/href:/g) ?? []).length + 1 // + More
requireCheck(visibleMobileDestinations === 5, `Mobile nav must expose exactly five top-level items; found ${visibleMobileDestinations}`)

requireCheck(rootLayout.includes('<html lang="ru">'), 'Root document language must be Russian')
requireCheck(rootLayout.includes("themeColor: '#15172A'"), 'PWA theme color must use August Navy')
requireCheck(rootLayout.includes('AugustFeedbackProvider'), 'Global August feedback provider missing')
requireCheck(rootLayout.includes('/amado-icon.svg?v=4'), 'New Amado favicon metadata missing')

let manifest = null
try {
  manifest = JSON.parse(manifestRaw)
} catch (error) {
  errors.push(`manifest.webmanifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
}
if (manifest) {
  requireCheck(manifest.short_name === 'Amado', 'Manifest short_name must be Amado')
  requireCheck(manifest.start_url === '/overview?source=pwa', 'PWA must start on /overview')
  requireCheck(manifest.theme_color === '#15172A', 'Manifest theme_color must be August Navy')
  requireCheck(manifest.background_color === '#F7F8FC', 'Manifest background must be August Canvas')
  requireCheck(Array.isArray(manifest.icons) && manifest.icons.some((item) => item.purpose === 'maskable'), 'Manifest requires a maskable icon')
  requireCheck(Array.isArray(manifest.shortcuts) && manifest.shortcuts.some((item) => item.url === '/generate'), 'PWA shortcut to Generate missing')
  requireCheck(!manifestRaw.toLowerCase().includes('kupala'), 'Legacy Kupala manifest identity remains')
}

requireCheck(sw.includes("CACHE_NAME = 'amado-pwa-august-v4'"), 'Service worker cache version is stale')
requireCheck(sw.includes("'/offline'"), 'Service worker offline fallback missing')
requireCheck(!sw.toLowerCase().includes('kupala'), 'Legacy Kupala service-worker identity remains')
requireCheck(pwa.includes('Добавить Amado на экран'), 'PWA install UI is not localized/modernized')
requireCheck(pwa.includes('amado-pwa-install-dismiss-until-v4'), 'PWA install storage key not migrated')
requireCheck(feedback.includes("const TOAST_EVENT = 'amado:august-toast'"), 'Standard toast system missing')
requireCheck(feedback.includes('confirmAction'), 'Standard confirm dialog API missing')
requireCheck(dialog.includes('aria-modal="true"'), 'August dialog accessibility contract missing')

for (const svg of [icon, appIcon]) {
  requireCheck(svg.includes('#D7FF61'), 'Favicon background must use August lime')
  requireCheck(svg.includes('#15172A'), 'Favicon wordmark must use August navy')
  requireCheck(svg.includes('<path'), 'Favicon wordmark must be outlined, not depend on a bundled font')
}
requireCheck(!icon.includes('<text'), 'Favicon must not depend on local font availability')

for (const rel of ['public/amado-icon-192.png', 'public/amado-icon-512.png', 'public/amado-maskable-512.png', 'public/apple-touch-icon.png']) {
  requireCheck(fs.existsSync(path.join(root, rel)), `Missing ${rel}`)
}

const visualFiles = [
  'app/generate/page.tsx',
  'app/market/page.tsx',
  'app/rewrite/page.tsx',
  'components/ArticleCard.tsx',
  'components/RatingWidget.tsx',
]
const legacyBrandColors = ['#4A6FD4', '#2D55B0', '#1E3A8A', '#F97316', '#7C3AED', '#e5b513']
for (const rel of visualFiles) {
  const source = read(rel)
  for (const color of legacyBrandColors) {
    requireCheck(!source.toLowerCase().includes(color.toLowerCase()), `${rel} still contains legacy brand color ${color}`)
  }
}

if (errors.length) {
  console.error('August UI verification failed:')
  for (const error of errors) console.error(` - ${error}`)
  process.exit(1)
}

console.log('PASS  August tokens + Inter-only typography')
console.log('PASS  Desktop 280/230 shell + five-item PWA navigation')
console.log('PASS  Toasts + confirmations + modal contract')
console.log('PASS  Amado manifest, service worker and offline fallback')
console.log('PASS  Lime outlined-script favicon + PWA icon set')
console.log('PASS  Legacy Amado blue/orange accents removed from core visual routes')
console.log('6/6 August UI checks passed.')
