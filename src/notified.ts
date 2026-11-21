import fs from 'node:fs'

export class Notified {
  private path: string
  private notified: string[] = []

  constructor() {
    this.path = process.env.NOTIFIED_PATH ?? 'data/notified.json'

    if (fs.existsSync(this.path)) {
      this.load()
    }
  }

  public isNotified(id: string): boolean {
    return this.notified.includes(id)
  }

  /**
   * Records an ID and persists the list.
   *
   * @param id - The notified ID
   * @throws If the list cannot be saved; the ID is then not recorded
   */
  public add(id: string): void {
    const next = [...this.notified, id]
    this.write(next)
    this.notified = next
  }

  public isFirst(): boolean {
    return !fs.existsSync(this.path)
  }

  /**
   * Loads the notified IDs from the file. Never modifies the file.
   *
   * @throws If the file cannot be read, is not valid JSON, or is not an array of strings
   */
  public load(): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(fs.readFileSync(this.path, 'utf8'))
    } catch (error) {
      throw this.loadError((error as Error).message, error)
    }
    if (
      !Array.isArray(parsed) ||
      parsed.some((value) => typeof value !== 'string')
    ) {
      throw this.loadError('expected an array of strings')
    }
    this.notified = parsed
  }

  /**
   * Persists the current list atomically.
   *
   * @throws If the file cannot be written; the previous file is then left intact
   */
  public save(): void {
    this.write(this.notified)
  }

  public get length(): number {
    return this.notified.length
  }

  private loadError(reason: string, cause?: unknown): Error {
    return new Error(
      `Failed to load notified IDs from "${this.path}": ${reason}. Fix or restore the file manually; deleting it makes the next run a first run (current entries are recorded without notification, so entries published while the file was unusable are never notified).`,
      { cause }
    )
  }

  /**
   * Writes the list to a temp file in the same directory, then renames it over the target.
   */
  private write(list: string[]): void {
    const tmpPath = `${this.path}.tmp`
    let fd: number | undefined
    try {
      fd = fs.openSync(tmpPath, 'w')
      fs.writeFileSync(fd, JSON.stringify(list, null, 2))
      fs.fsyncSync(fd)
      const openedFd = fd
      fd = undefined
      fs.closeSync(openedFd)
      fs.renameSync(tmpPath, this.path)
    } catch (error) {
      if (fd !== undefined) {
        try {
          fs.closeSync(fd)
        } catch {
          // The original error is the one worth reporting
        }
      }
      try {
        fs.rmSync(tmpPath, { force: true })
      } catch {
        // The original error is the one worth reporting
      }
      throw error
    }
  }
}
