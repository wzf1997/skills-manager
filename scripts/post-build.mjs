/**
 * post-build.mjs
 * 打包后自动：
 *  1. 对 .app 做 ad-hoc 自签名（--deep --force）
 *  2. 重新打包成干净的 DMG（含 Applications 快捷方式）
 *  3. 对 DMG 签名 + 清除 quarantine 属性
 *  4. 复制 DMG 到桌面
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const RELEASE_DIR = path.resolve('release')
const APP_NAME = 'Skills Manager'
const DESKTOP = path.join(os.homedir(), 'Desktop')

const entries = fs.readdirSync(RELEASE_DIR)
const macDir =
  entries.includes('mac-arm64') ? 'mac-arm64' : entries.includes('mac') ? 'mac' : entries.find(d => d.startsWith('mac-'))
if (!macDir) { console.error('❌ 找不到 mac / mac-* 目录'); process.exit(1) }

const appPath = path.join(RELEASE_DIR, macDir, `${APP_NAME}.app`)
if (!fs.existsSync(appPath)) { console.error(`❌ 找不到 ${appPath}`); process.exit(1) }

const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version
const arch = macDir === 'mac' ? 'x64' : macDir.startsWith('mac-') ? macDir.slice(4) : macDir
const dmgName = `${APP_NAME}-${version}-${arch}.dmg`
const dmgOut = path.join(DESKTOP, dmgName)

console.log(`\n🔐 Step 1: 对 .app 做 ad-hoc 自签名...`)
execSync(`codesign --deep --force --sign - "${appPath}"`, { stdio: 'inherit' })
execSync(`codesign --verify --deep "${appPath}"`, { stdio: 'inherit' })
console.log('✅ .app 签名完成')

console.log(`\n📦 Step 2: 创建 DMG...`)
const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmg-stage-'))
const tmpDmg = path.join(os.tmpdir(), `${APP_NAME}-tmp.dmg`)
execSync(`cp -R "${appPath}" "${stagingDir}/"`)
execSync(`ln -s /Applications "${stagingDir}/Applications"`)
execSync(
  `hdiutil create -volname "${APP_NAME}" -srcfolder "${stagingDir}" -ov -format UDZO -fs HFS+ "${tmpDmg}"`,
  { stdio: 'inherit' }
)
fs.rmSync(stagingDir, { recursive: true })
console.log('✅ DMG 创建完成')

console.log(`\n🔐 Step 3: 对 DMG 签名 + 清除隔离属性...`)
execSync(`codesign --force --sign - "${tmpDmg}"`)
execSync(`xattr -cr "${tmpDmg}"`)
console.log('✅ DMG 签名 + 清除属性完成')

console.log(`\n📋 Step 4: 复制到桌面...`)
fs.copyFileSync(tmpDmg, dmgOut)
fs.rmSync(tmpDmg)
console.log(`✅ 已输出到桌面: ${dmgName}`)

console.log(`\n🎉 打包完成！文件: ~/Desktop/${dmgName}`)
console.log(`   大小: ${(fs.statSync(dmgOut).size / 1024 / 1024).toFixed(1)} MB`)
