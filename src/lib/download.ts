/** Saves text as a file through a temporary link. */
export function download(name: string, data: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([data], { type: `${type};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}
