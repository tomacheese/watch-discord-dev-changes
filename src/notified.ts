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

  public add(id: string): void {
    this.notified.push(id)
    this.save()
  }

  public isFirst(): boolean {
    return !fs.existsSync(this.path)
  }

  public load(): void {
    this.notified = JSON.parse(fs.readFileSync(this.path, 'utf8'))
  }

  public save(): void {
    fs.writeFileSync(this.path, JSON.stringify(this.notified, null, 2))
  }

  public get length(): number {
    return this.notified.length
  }
}
