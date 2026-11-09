import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { BalanceLines } from '@/components/charts/BalanceLines'
import { ChartCard } from '@/components/charts/ChartCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { CHART, monthLong, monthShort } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import { formatBRL } from '@/lib/format'
import { parseMoneyInput, todayISO } from '@/lib/money'
import { dashboardApi } from '@/services/planning'

export function SimulatorTab() {
  const [amount, setAmount] = useState('')
  const [installments, setInstallments] = useState('10')
  const [firstDate, setFirstDate] = useState(todayISO())
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, message: null })

  const sim = useMutation({
    mutationFn: (body: { amount: string; installments: number; first_date: string }) => dashboardApi.simulate({ ...body, months: 12 }),
    onError: (e) => setErrors(toFormErrors(e)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseMoneyInput(amount)
    const n = Number(installments)
    const fields: Record<string, string> = {}
    if (parsed === null || Number(parsed) <= 0) fields.amount = 'Informe o valor da compra, como 3.600,00.'
    if (!Number.isInteger(n) || n < 1 || n > 120) fields.installments = 'Use de 1 a 120 parcelas.'
    if (!firstDate) fields.first_date = 'Informe a data da primeira parcela.'
    setErrors({ fields, message: null })
    if (Object.keys(fields).length || parsed === null) return
    sim.mutate({ amount: parsed, installments: n, first_date: firstDate })
  }

  const r = sim.data
  const goesNegative = !!r && r.becomes_negative_in.length > 0

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="text-base font-medium">Simulador de compra</h2>
        <p className="mt-1 text-sm text-cinza-t">Veja o efeito de uma compra parcelada nos próximos meses. Nada é registrado: é só uma simulação.</p>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" noValidate>
          <Field label="Valor total (R$)" error={errors.fields.amount}>
            <input className={inputClass} inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Parcelas" error={errors.fields.installments}>
            <input className={inputClass} inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} />
          </Field>
          <Field label="Primeira parcela" error={errors.fields.first_date}>
            <input className={inputClass} type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={sim.isPending}>
              {sim.isPending ? 'Simulando…' : 'Simular'}
            </Button>
          </div>
        </form>
        {errors.message && <div className="mt-3"><FormMessage>{errors.message}</FormMessage></div>}
      </Card>

      {r && (
        <>
          <section aria-label="Resultado da simulação" className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-sm text-cinza-t">Parcela mensal</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBRL(r.monthly_installment)}</p>
              <p className="mt-1 text-xs text-cinza-t">{r.installments}× (a última absorve os centavos)</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-cinza-t">Meses afetados</p>
              <p className="mt-1 text-2xl font-semibold">{r.months_affected.length}</p>
              <p className="mt-1 text-xs text-cinza-t">Dentro dos próximos 12 meses</p>
            </Card>
            <Card className={cn('p-4', goesNegative && 'border-queimado/40')}>
              <p className="text-sm text-cinza-t">Efeito no saldo</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                {goesNegative ? <ShieldAlert aria-hidden className="size-5 text-queimado-t" /> : <CheckCircle2 aria-hidden className="size-5 text-salvia-t" />}
                <span className={goesNegative ? 'text-queimado-t' : 'text-salvia-t'}>{goesNegative ? 'Saldo ficaria negativo' : 'Saldo se mantém positivo'}</span>
              </p>
              <p className="mt-1 text-xs text-cinza-t">{goesNegative ? `A partir de ${monthLong(r.becomes_negative_in[0] ?? '')}.` : 'Considerando tudo o que já está previsto.'}</p>
            </Card>
          </section>

          <ChartCard
            title="Saldo projetado: hoje × com a compra"
            legend={[
              { label: 'Cenário atual', color: CHART.income },
              { label: 'Com a compra', color: CHART.expense },
            ]}
            summary={`Comparação do saldo projetado. ${r.impact.map((x) => `${monthShort(x.month)}: antes ${formatBRL(x.balance_before)}, depois ${formatBRL(x.balance_after)}`).join('; ')}.`}
            table={{
              columns: ['Mês', 'Parcela', 'Antes', 'Depois'],
              rows: r.impact.map((x) => [monthLong(x.month), x.affected ? formatBRL(x.installment) : '—', formatBRL(x.balance_before), formatBRL(x.balance_after)]),
            }}
          >
            <BalanceLines
              data={r.impact.map((x) => ({ month: x.month, before: Number(x.balance_before), after: Number(x.balance_after) }))}
              series={[
                { key: 'before', label: 'Cenário atual', color: CHART.income },
                { key: 'after', label: 'Com a compra', color: CHART.expense },
              ]}
            />
          </ChartCard>

          <Card>
            <h2 className="mb-3 text-base font-medium">Impacto mês a mês</h2>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela (role para ver mais colunas)">
              <table className="w-full min-w-96 text-sm">
                <thead>
                  <tr className="text-left text-xs text-cinza-t">
                    <th scope="col" className="px-2 py-2 font-medium">Mês</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Parcela</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Saldo antes</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Saldo depois</th>
                  </tr>
                </thead>
                <tbody>
                  {r.impact.map((x) => {
                    const neg = Number(x.balance_after) < 0
                    return (
                      <tr key={x.month} className="border-t border-white/8">
                        <td className="px-2 py-2 first-letter:uppercase">
                          {monthLong(x.month)} {x.affected && <Badge tone="warning">Parcela</Badge>}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{x.affected ? formatBRL(x.installment) : '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatBRL(x.balance_before)}</td>
                        <td className={cn('px-2 py-2 text-right tabular-nums', neg && 'font-medium text-queimado-t')}>
                          {formatBRL(x.balance_after)}
                          {neg && <span className="ml-1 text-xs">(negativo)</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
