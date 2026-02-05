import { useMemo, useState } from 'react'
import Joyride, { STATUS, type CallBackProps, type Step } from 'react-joyride'

const STORAGE_KEY = 'grounded-ai-tour-seen'

const getStoredSeen = () => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

type OnboardingTourProps = {
  run: boolean
  onFinish: () => void
}

export function OnboardingTour({ run, onFinish }: OnboardingTourProps) {
  const steps = useMemo<Step[]>(
    () => [
      {
        target: 'body',
        placement: 'center',
        content: "Welcome to Grounded AI! Let's learn the workflow.",
      },
      {
        target: '#document-viewer',
        placement: 'right',
        content:
          'Step A: Open Coding. Highlight text here to create concepts/codes.',
      },
      {
        target: '#axial-tab',
        placement: 'left',
        content:
          'Step B & C: Categorization & Axial Coding. Drag your codes into Categories to find patterns and relationships.',
      },
      {
        target: '#theory-tab',
        placement: 'left',
        content:
          'Step D: Selective Coding. Choose your core category and describe your final theory here.',
      },
      {
        target: '#export-actions',
        placement: 'bottom',
        content: 'Download your work as Word/Excel when done.',
      },
    ],
    [],
  )

  const [seen, setSeen] = useState(getStoredSeen)

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
      steps={steps}
      run={run && !seen}
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
