import fs from 'node:fs'
import path from 'node:path'

export interface CopyResult {
  success: boolean
  error?: string
  alreadyExists: boolean
  mode: 'symlink' | 'copy'
}

export function copySkill(
  sourceDirPath: string,
  targetSourcePath: string,
  slug: string
): CopyResult {
  const dest = path.join(targetSourcePath, slug)
  const alreadyExists = fs.existsSync(dest)

  // 优先尝试软链接（跨 volume 或无写权限时自动 fallback 到物理复制）
  try {
    if (alreadyExists) {
      // 已存在：若已是指向同一路径的软链接则跳过，否则先删再建
      const existing = fs.lstatSync(dest)
      if (existing.isSymbolicLink()) {
        const target = fs.realpathSync(dest)
        if (target === fs.realpathSync(sourceDirPath)) {
          return { success: true, alreadyExists: true, mode: 'symlink' }
        }
      }
      fs.rmSync(dest, { recursive: true, force: true })
    }

    fs.symlinkSync(sourceDirPath, dest, 'dir')
    return { success: true, alreadyExists, mode: 'symlink' }
  } catch (symlinkErr) {
    // symlink 失败（跨 volume、权限等）→ fallback 物理复制
    try {
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true })
      }
      fs.cpSync(sourceDirPath, dest, { recursive: true })
      return { success: true, alreadyExists, mode: 'copy' }
    } catch (copyErr) {
      return {
        success: false,
        alreadyExists,
        mode: 'copy',
        error: copyErr instanceof Error ? copyErr.message : String(copyErr),
      }
    }
  }
}
