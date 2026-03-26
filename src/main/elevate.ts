import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'

export function isWritable(dirPath: string): boolean {
  try {
    fs.accessSync(dirPath, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

/**
 * 弹出 macOS 系统授权弹窗，将目录 chown 给当前用户。
 * 用户取消或密码错误时 reject。
 */
export function requestWritePermission(dirPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const username = os.userInfo().username
    // quoted form of 让 AppleScript 自动处理路径中的空格和特殊字符
    const escaped = dirPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const script = `do shell script "chown -R ${username}:staff " & quoted form of "${escaped}" with administrator privileges`

    const proc = spawn('osascript', ['-e', script])
    let stderr = ''
    proc.stderr?.on('data', d => { stderr += d.toString() })
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `授权失败 (exit ${code})`))
    })
    proc.on('error', reject)
  })
}
