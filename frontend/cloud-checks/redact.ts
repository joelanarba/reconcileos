import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export default async function redactAuthenticationArtifacts() {
  const credentialPath = path.resolve('../deploy/.local/operator-access.json')
  const { password } = JSON.parse(await readFile(credentialPath, 'utf8'))
  const root = path.resolve('../deploy/.local/browser-check')
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile() && /\.(md|txt|json)$/.test(entry.name)) {
        const content = await readFile(file, 'utf8')
        if (content.includes(password)) await writeFile(file, content.replaceAll(password, '[REDACTED]'), 'utf8')
      }
    }
  }
  await visit(root)
}
