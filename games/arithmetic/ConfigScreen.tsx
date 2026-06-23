'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import type { ArithmeticConfig, Operation } from '@/types'

interface ConfigScreenProps {
  onStart: (config: ArithmeticConfig) => void
}

const OPERATION_LABELS: Record<Operation, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
}

const DEFAULT_CONFIG: ArithmeticConfig = {
  operations: ['add'],
  ranges: {
    add: { min1: 1, max1: 20, min2: 1, max2: 20 },
    subtract: { min1: 1, max1: 20, min2: 1, max2: 20 },
    multiply: { min1: 1, max1: 12, min2: 1, max2: 12 },
    divide: { min1: 1, max1: 12, min2: 1, max2: 12 },
  },
  duration: 60,
}

const DURATIONS: (30 | 60 | 120)[] = [30, 60, 120]
const ALL_OPERATIONS: Operation[] = ['add', 'subtract', 'multiply', 'divide']

export function ConfigScreen({ onStart }: ConfigScreenProps) {
  const [config, setConfig] = useState<ArithmeticConfig>(DEFAULT_CONFIG)

  function toggleOperation(op: Operation) {
    setConfig(prev => {
      const ops = prev.operations.includes(op)
        ? prev.operations.filter(o => o !== op)
        : [...prev.operations, op]
      return { ...prev, operations: ops.length === 0 ? prev.operations : ops }
    })
  }

  function setDuration(duration: 30 | 60 | 120) {
    setConfig(prev => ({ ...prev, duration }))
  }

  function updateRange(op: Operation, field: keyof NonNullable<ArithmeticConfig['ranges'][Operation]>, value: number) {
    setConfig(prev => ({
      ...prev,
      ranges: {
        ...prev.ranges,
        [op]: { ...prev.ranges[op]!, [field]: value },
      },
    }))
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Arithmetic Sprint</h1>
        <p className="text-muted-foreground mt-1">Configure your game, then go!</p>
      </div>

      {/* Operations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            {ALL_OPERATIONS.map(op => (
              <button
                key={op}
                onClick={() => toggleOperation(op)}
                className={`
                  w-14 h-14 rounded-2xl text-2xl font-bold transition-all duration-150
                  ${config.operations.includes(op)
                    ? 'bg-primary text-primary-foreground shadow-md scale-105'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }
                `}
                aria-pressed={config.operations.includes(op)}
                aria-label={`Toggle ${op}`}
              >
                {OPERATION_LABELS[op]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ranges for selected operations */}
      {config.operations.map(op => (
        <Card key={op}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Number ranges for <Badge>{OPERATION_LABELS[op]}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>First number max</span>
                <span className="font-mono font-medium">{config.ranges[op]?.max1 ?? 20}</span>
              </div>
              <Slider
                min={2}
                max={100}
                step={1}
                value={[config.ranges[op]?.max1 ?? 20]}
                onValueChange={(v) => updateRange(op, 'max1', Array.isArray(v) ? v[0] : v)}
                className="min-h-[44px]"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Second number max</span>
                <span className="font-mono font-medium">{config.ranges[op]?.max2 ?? 20}</span>
              </div>
              <Slider
                min={2}
                max={100}
                step={1}
                value={[config.ranges[op]?.max2 ?? 20]}
                onValueChange={(v) => updateRange(op, 'max2', Array.isArray(v) ? v[0] : v)}
                className="min-h-[44px]"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Duration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Duration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`
                  flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-150 min-h-[44px]
                  ${config.duration === d
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }
                `}
                aria-pressed={config.duration === d}
              >
                {d}s
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full text-lg h-14 font-bold"
        onClick={() => onStart(config)}
        disabled={config.operations.length === 0}
      >
        Start Sprint!
      </Button>
    </div>
  )
}
