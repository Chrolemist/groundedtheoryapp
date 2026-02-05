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
        content: "Welcome to Grounded Theory! Let's learn the workflow.",
      },
      {
        target: '#document-viewer',
        placement: 'right',
        content:
          'Step A: Open Coding. Highlight text here and apply codes to create concepts.',
      },
      {
        target: '#axial-tab',
        placement: 'left',
        content:
          'Step B & C: Categorization & Axial Coding. Drag codes into categories and edit Precondition/Action/Consequence logic.',
      },
      {
        target: '#theory-tab',
        placement: 'left',
        content:
          'Step D: Selective Coding. Choose your core category and use the category/code overview to craft your theory.',
      },
      {
        target: '#file-menu',
        placement: 'bottom',
        content: 'Use the File menu to save/load and export Word or Excel.',
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
