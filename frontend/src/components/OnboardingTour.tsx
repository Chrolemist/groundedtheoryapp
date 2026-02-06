import { useEffect, useMemo, useRef, useState } from 'react'
import Joyride, {
  ACTIONS,
  EVENTS,
  STATUS,
  type CallBackProps,
  type Step,
} from 'react-joyride'

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
        target: '#axial-tab',
        placement: 'left',
        content:
          'Axial coding: klicka fliken för att se kategorier och relationer.',
      },
      {
        target: '#theory-tab',
        placement: 'left',
        content:
          'Selective coding: klicka fliken och skriv core category + theory narrative.',
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
  const [stepIndex, setStepIndex] = useState(0)
  const skipScrollRef = useRef(false)
  const debugRef = useRef({
    notFoundCount: 0,
    lastEvent: '',
  })
  const shouldRun = run && (!seen || runId > 0)

  useEffect(() => {
    if (shouldRun) {
      setStepIndex(0)
    }
  }, [shouldRun, runId])

  const handleCallback = (data: CallBackProps) => {
    debugRef.current.lastEvent = data.type
    if (data.type === EVENTS.TARGET_NOT_FOUND) {
      debugRef.current.notFoundCount += 1
      console.log('[tour-debug] target not found', {
        index: data.index,
        target: data.step?.target,
        totalSteps: steps.length,
        notFoundCount: debugRef.current.notFoundCount,
      })
    } else {
      console.log('[tour-debug] event', {
        type: data.type,
        index: data.index,
        action: data.action,
        status: data.status,
        target: data.step?.target,
      })
    }
    if (data.type === EVENTS.TARGET_NOT_FOUND) {
      const nextIndex = data.index + 1
      if (nextIndex >= steps.length) {
        localStorage.setItem(STORAGE_KEY, 'true')
        setSeen(true)
        onFinish()
        return
      }
      setStepIndex(nextIndex)
      return
    }

    if (data.type === EVENTS.STEP_AFTER) {
      const delta = data.action === ACTIONS.PREV ? -1 : 1
      setStepIndex(data.index + delta)
    }

    if (data.type === EVENTS.STEP_AFTER || data.type === EVENTS.TOOLTIP) {
      const selector = data.step?.target
      if (typeof selector === 'string') {
        if (selector === '#theory-map-tab' || selector === '#overview-tab') {
          skipScrollRef.current = true
          window.scrollTo({ top: 0, behavior: 'auto' })
          document.documentElement.scrollTop = 0
          document.body.scrollTop = 0
          window.setTimeout(() => {
            skipScrollRef.current = false
          }, 200)
          return
        }
        if (skipScrollRef.current) {
          return
        }
        const element = document.querySelector(selector)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }

    const finished = data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED
    if (finished) {
      console.log('[tour-debug] finished', { status: data.status })
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
      stepIndex={stepIndex}
      continuous
      disableScrolling
      scrollToFirstStep={false}
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
