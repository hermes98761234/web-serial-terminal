/** A fake Arduino for demo mode: prints a banner, streams sensor values and answers a few commands. */

const dec = new TextDecoder()

export class DemoDevice {
  private ledOn = false
  private n = 0
  private buf = ''

  banner(): string {
    return 'Demo Arduino ready. Type "help" for commands.\r\n'
  }

  /** One streaming sample in Serial Plotter format. */
  tick(): string {
    const t = this.n++ / 20
    const temp = 24 + 2 * Math.sin(t / 3) + 0.15 * Math.sin(t * 17)
    const hum = 45 + 8 * Math.cos(t / 4)
    const wave = Math.sin(t * 2)
    return `temp:${temp.toFixed(2)},humidity:${hum.toFixed(2)},wave:${wave.toFixed(3)}\r\n`
  }

  /** Feeds received bytes; returns the reply for every completed line. */
  receive(data: Uint8Array): string {
    this.buf += dec.decode(data)
    let reply = ''
    let i: number
    while ((i = this.buf.search(/[\r\n]/)) >= 0) {
      const line = this.buf.slice(0, i).trim()
      this.buf = this.buf.slice(i + 1)
      if (line !== '') reply += this.command(line) + '\r\n'
    }
    return reply
  }

  private command(line: string): string {
    const [cmd, ...rest] = line.split(/\s+/)
    switch (cmd.toLowerCase()) {
      case 'help':
        return 'Commands: help, ping, led on|off, led, version, echo <text>'
      case 'ping':
        return 'pong'
      case 'version':
        return 'DemoDuino 1.0'
      case 'led':
        if (rest[0] === 'on') this.ledOn = true
        else if (rest[0] === 'off') this.ledOn = false
        return `LED is ${this.ledOn ? 'ON' : 'OFF'}`
      case 'echo':
        return rest.join(' ')
      default:
        return `Unknown command: ${line}`
    }
  }
}
