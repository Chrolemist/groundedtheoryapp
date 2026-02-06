import { useMemo, useState } from 'react'
import Joyride, { STATUS, type CallBackProps, type Step } from 'react-joyride'

const STORAGE_KEY = 'grounded-ai-tour-seen'

const getStoredSeen = () => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

type OnboardingTourProps = {
  run: boolean
  runId: number
  onFinish: () => void
}

export function OnboardingTour({ run, runId, onFinish }: OnboardingTourProps) {
  const steps = useMemo<Step[]>(
    () => [
      {
        target: 'body',
        placement: 'center',
        content: 'Välkommen till en snabb guide. Du kan avsluta guiden när du vill.',
      },
      {
        target: '#document-viewer',
        placement: 'right',
        content:
          'Open coding: markera text och applicera koder direkt i dokumentet.',
      },
      {
        target: '#open-coding-panel',
        placement: 'left',
        content:
          'Code Notes: öppna en kod och skriv definitioner och spontana tankar.',
      },
      {
        target: '#axial-coding-panel',
        placement: 'left',
        content:
          'Theoretical Notes: lägg memos i kategori-korten för att förklara sambanden.',
      },
      {
        target: '#core-category',
        placement: 'left',
        content:
          'Selective coding: välj eller skapa en core category som bär teorin.',
      },
      {
        target: '#theory-narrative',
        placement: 'left',
        content:
          'Theory narrative: formulera storyline och hur kategorierna hänger ihop.',
      },
      {
        target: '#theory-map-tab',
        placement: 'bottom',
        content:
          'Theory Map: visuell karta över kategorier, koder och utdrag. Klicka utdrag för att hoppa till markeringen.',
      },
      {
        target: '#theory-map-view',
        placement: 'right',
        content:
          'Kartan har zoom och pan. Theory narrative visas också här som egen nod.',
      },
      {
        target: '#overview-tab',
        placement: 'bottom',
        content:
          'Overview: samlar statistik och diagram på ett ställe.',
      },
      {
        target: '#analysis-overview',
        placement: 'right',
        content:
          'Overview visar totals, memos per typ, starkaste kategorier och mest markerade koder.',
      },
      {
        target: '#memos-tab',
        placement: 'left',
        content:
          'Bonus: integrative memos samlar helheten i en global memo-flik.',
      },
      {
        target: '#view-menu',
        placement: 'left',
        content:
          'Memos: slå på eller av i View-menyn. Memon löper parallellt med hela processen.',
      },
      {
        target: '#file-menu',
        placement: 'bottom',
        content: 'File: spara/ladda projekt och exportera till Word eller Excel.',
      },
    ],
    [],
  )

  const [seen, setSeen] = useState(getStoredSeen)
  const shouldRun = run && (!seen || runId > 0)

  const handleCallback = (data: CallBackProps) => {
    const finished = data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED
    if (finished) {
      localStorage.setItem(STORAGE_KEY, 'true')
      setSeen(true)
      onFinish()
    }
  }

  return (
    <Joyride
      key={runId}
      steps={steps}
      run={shouldRun}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      callback={handleCallback}
      styles={{
        options: {
          zIndex: 60,
          backgroundColor: '#ffffff',
          textColor: '#0f172a',
          arrowColor: '#ffffff',
          primaryColor: '#0f172a',
          overlayColor: 'rgba(15, 23, 42, 0.2)',
        },
        tooltip: {
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)',
        },
        buttonNext: {
          borderRadius: 10,
          fontWeight: 600,
        },
        buttonBack: {
          color: '#475569',
        },
        buttonSkip: {
          color: '#94a3b8',
        },
      }}
    />
  )
}
