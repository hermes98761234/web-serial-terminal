import { describe, expect, it } from 'vitest'
import { niceTicks, parsePlotLine, PlotData, visibleRange } from './plot'

describe('parsePlotLine', () => {
  it('parses comma, space and tab separated numbers', () => {
    const v = (s: string) => parsePlotLine(s)?.map((e) => e.value)
    expect(v('1,2,3')).toEqual([1, 2, 3])
    expect(v('1 2.5\t-3e2')).toEqual([1, 2.5, -300])
    expect(v('  .5, +4 \r\n')).toEqual([0.5, 4])
  })
  it('parses label:value pairs', () => {
    expect(parsePlotLine('temp:23.5,hum:40')).toEqual([
      { label: 'temp', value: 23.5 },
      { label: 'hum', value: 40 },
    ])
    expect(parsePlotLine('x=1 y=2')).toEqual([
      { label: 'x', value: 1 },
      { label: 'y', value: 2 },
    ])
    expect(parsePlotLine('Temp: 21.5')).toEqual([{ label: 'Temp', value: 21.5 }])
  })
  it('rejects text lines', () => {
    expect(parsePlotLine('')).toBeNull()
    expect(parsePlotLine('Hello world')).toBeNull()
    expect(parsePlotLine('v1.2 ready')).toBeNull()
    expect(parsePlotLine('a:b')).toBeNull()
    expect(parsePlotLine('trailing:')).toBeNull()
    expect(parsePlotLine('1 2 oops')).toBeNull()
  })
})

describe('PlotData', () => {
  it('names unlabeled channels ch1.. and aligns series', () => {
    const p = new PlotData()
    p.add(parsePlotLine('1,2')!, 10)
    p.add(parsePlotLine('3,4,5')!, 20)
    expect(p.names).toEqual(['ch1', 'ch2', 'ch3'])
    expect(p.series).toEqual([[1, 3], [2, 4], [NaN, 5]])
    expect(p.times).toEqual([10, 20])
  })
  it('handles labels appearing later and missing values', () => {
    const p = new PlotData()
    p.add([{ label: 'a', value: 1 }], 1)
    p.add([{ label: 'b', value: 2 }], 2)
    expect(p.series).toEqual([[1, NaN], [NaN, 2]])
  })
  it('caps its length', () => {
    const p = new PlotData(10)
    for (let i = 0; i < 50; i++) p.add([{ label: null, value: i }], i)
    expect(p.length).toBeLessThanOrEqual(11)
    expect(p.series[0][p.length - 1]).toBe(49)
  })
  it('exports CSV', () => {
    const p = new PlotData()
    p.add([{ label: 'a', value: 1 }], Date.UTC(2026, 0, 1))
    p.add([{ label: 'b', value: 2 }], Date.UTC(2026, 0, 1, 0, 0, 1))
    expect(p.toCsv()).toBe('time,a,b\n2026-01-01T00:00:00.000Z,1,\n2026-01-01T00:00:01.000Z,,2\n')
  })
})

describe('axis helpers', () => {
  it('finds the visible range over the last n samples', () => {
    expect(visibleRange([[100, 1, 2], [NaN, -5, 3]], 2)).toEqual({ min: -5, max: 3 })
    expect(visibleRange([[]], 10)).toBeNull()
  })
  it('produces 1-2-5 ticks', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100])
    expect(niceTicks(-1, 1, 4)).toEqual([-1, -0.5, 0, 0.5, 1])
    expect(niceTicks(5, 5).length).toBeGreaterThan(1)
  })
})
